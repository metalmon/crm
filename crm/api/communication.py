import frappe
from frappe import _
import time
def init_for_execute():
    """Initialize session for bench execute"""
    if not frappe.db:
        frappe.connect()
    if not frappe.session:
        frappe.set_user("Administrator")

def column_exists(doctype, column):
    """Check if column exists in table"""
    return frappe.db.sql(
        """SELECT COUNT(*)
        FROM information_schema.COLUMNS 
        WHERE TABLE_NAME = 'tab{doctype}'
        AND COLUMN_NAME = '{column}'""".format(
            doctype=doctype,
            column=column
        )
    )[0][0] > 0

def create_indices():
    """Create necessary indices for better query performance"""
    indices = [
        {
            "doctype": "Communication",
            "fields": ["communication_medium", "communication_type", "reference_doctype", "reference_name", "sender", "recipients"]
        },
        {
            "doctype": "CRM Lead",
            "fields": ["email"]
        },
        {
            "doctype": "CRM Deal",
            "fields": ["email"]
        }
    ]
    
    for index in indices:
        doctype = index["doctype"]
        for field in index["fields"]:
            # Check if column exists
            if not column_exists(doctype, field):
                frappe.logger().warning(f"Column {field} does not exist in {doctype}, skipping index creation")
                continue
                
            # Get existing indices
            existing_indices = frappe.db.sql(
                """SHOW INDEX FROM `tab{doctype}`
                WHERE Column_name='{field}'""".format(
                    doctype=doctype,
                    field=field
                ), as_dict=1
            )
            
            if not existing_indices:
                # Create index if it doesn't exist
                frappe.db.sql(
                    """ALTER TABLE `tab{doctype}`
                    ADD INDEX `idx_{field}` (`{field}`)""".format(
                        doctype=doctype,
                        field=field
                    )
                )
                frappe.db.commit()
                frappe.logger().info(f"Created index on {doctype}.{field}")

@frappe.whitelist()
def track_communication():
    """Create a communication record for phone/whatsapp tracking, ignoring standard permissions"""
    try:
        doc = frappe.get_doc(frappe.parse_json(frappe.form_dict.get("doc")))
        doc.insert(ignore_permissions=True)
        return doc
    except Exception as e:
        frappe.log_error("Error in track_communication", str(e))
        frappe.throw(_("Could not track communication: {0}").format(str(e)))

def update_email_references():
    """Find emails without references and link them to leads/deals based on email addresses"""
    try:
        start_time = time.time()
        batch_size = 50  # Process 50 emails at a time to avoid server overload
        processed_total = 0
        linked_total = 0
        not_found_total = 0
        error_total = 0
        
        # Log initial state
        frappe.logger().info(f"Starting update_email_references at {frappe.utils.now_datetime()}")
        
        # Add time cutoff (5 minutes) to avoid conflicts with Frappe's own email linking
        cutoff_time = frappe.utils.add_to_date(frappe.utils.now_datetime(), minutes=-5)
        
        # Get initial count for progress reporting
        count_start = time.time()
        total_emails = frappe.db.count(
            "Communication",
            filters={
                "communication_medium": "Email",
                "communication_type": "Communication",
                "reference_doctype": ["in", ["", None]],
                "reference_name": ["in", ["", None]],
                "creation": ["<=", cutoff_time]
            }
        )
        frappe.logger().info(f"Count query took {time.time() - count_start:.2f}s, found {total_emails} emails")
        
        if not total_emails:
            frappe.logger().info("No emails without references found. Nothing to process.")
            return
            
        # Process in batches
        start = 0
        batch_number = 0
        while True:
            batch_start_time = time.time()
            batch_number += 1
            frappe.logger().info(f"Starting batch #{batch_number} at {frappe.utils.now_datetime()}")
            
            # Get batch of emails without references
            query_start = time.time()
            emails_without_refs = frappe.get_all(
                "Communication",
                filters={
                    "communication_medium": "Email",
                    "communication_type": "Communication",
                    "reference_doctype": ["in", ["", None]],
                    "reference_name": ["in", ["", None]],
                    "creation": ["<=", cutoff_time]
                },
                fields=["name", "sender", "recipients", "cc", "bcc", "creation"],
                order_by="creation desc",  # Process newest first
                start=start,
                page_length=batch_size
            )
            frappe.logger().info(f"Batch query took {time.time() - query_start:.2f}s, found {len(emails_without_refs)} emails")
            
            if not emails_without_refs:
                break  # No more emails to process
                
            # Collect all email addresses from the batch
            collect_start = time.time()
            all_email_addresses = set()
            for email in emails_without_refs:
                if email.sender:
                    all_email_addresses.add(email.sender.lower())
                if email.recipients:
                    all_email_addresses.update([e.strip().lower() for e in email.recipients.split(",")])
                if email.cc:
                    all_email_addresses.update([e.strip().lower() for e in email.cc.split(",")])
                if email.bcc:
                    all_email_addresses.update([e.strip().lower() for e in email.bcc.split(",")])
            frappe.logger().info(f"Collecting email addresses took {time.time() - collect_start:.2f}s, found {len(all_email_addresses)} unique addresses")
            
            # Skip if no valid email addresses found
            if not all_email_addresses:
                start += batch_size
                continue
                
            # Get all matching deals and leads in bulk
            search_start = time.time()
            deals = frappe.get_all(
                "CRM Deal",
                filters={"email": ["in", list(all_email_addresses)]},
                fields=["name", "email", "creation"],
                order_by="creation desc"
            )
            
            leads = frappe.get_all(
                "CRM Lead",
                filters={"email": ["in", list(all_email_addresses)]},
                fields=["name", "email", "creation"],
                order_by="creation desc"
            )
            frappe.logger().info(f"Search query took {time.time() - search_start:.2f}s, found {len(deals)} deals and {len(leads)} leads")
            
            # Create lookup dictionaries for faster access
            deals_by_email = {}
            for deal in deals:
                if deal.email:
                    deals_by_email[deal.email.lower()] = deal
                    
            leads_by_email = {}
            for lead in leads:
                if lead.email:
                    leads_by_email[lead.email.lower()] = lead
            
            batch_processed = 0
            batch_linked = 0
            batch_not_found = 0
            batch_errors = 0
            
            # Process each email
            process_start = time.time()
            for email in emails_without_refs:
                try:
                    # Check each email address for matches
                    linked = False
                    email_addresses = set()
                    if email.sender:
                        email_addresses.add(email.sender.lower())
                    if email.recipients:
                        email_addresses.update([e.strip().lower() for e in email.recipients.split(",")])
                    if email.cc:
                        email_addresses.update([e.strip().lower() for e in email.cc.split(",")])
                    if email.bcc:
                        email_addresses.update([e.strip().lower() for e in email.bcc.split(",")])
                    
                    # First try to find a matching deal
                    for addr in email_addresses:
                        if addr in deals_by_email:
                            deal = deals_by_email[addr]
                            update_start = time.time()
                            frappe.db.set_value(
                                "Communication",
                                email.name,
                                {
                                    "reference_doctype": "CRM Deal",
                                    "reference_name": deal.name
                                },
                                update_modified=False
                            )
                            if time.time() - update_start > 1:  # Log slow updates
                                frappe.logger().warning(f"Slow update for email {email.name}: {time.time() - update_start:.2f}s")
                            linked = True
                            batch_linked += 1
                            break
                    
                    # If no deal found, try to find a matching lead
                    if not linked:
                        for addr in email_addresses:
                            if addr in leads_by_email:
                                lead = leads_by_email[addr]
                                update_start = time.time()
                                frappe.db.set_value(
                                    "Communication",
                                    email.name,
                                    {
                                        "reference_doctype": "CRM Lead",
                                        "reference_name": lead.name
                                    },
                                    update_modified=False
                                )
                                if time.time() - update_start > 1:  # Log slow updates
                                    frappe.logger().warning(f"Slow update for email {email.name}: {time.time() - update_start:.2f}s")
                                linked = True
                                batch_linked += 1
                                break
                    
                    if not linked:
                        batch_not_found += 1
                    
                except Exception as e:
                    batch_errors += 1
                    error_msg = f"Error processing communication {email.name}: {str(e)}"
                    frappe.logger().error(error_msg)
                    # Continue with next email despite error
                
                batch_processed += 1
            
            frappe.logger().info(f"Processing emails took {time.time() - process_start:.2f}s")
                
            # Update total counters
            processed_total += batch_processed
            linked_total += batch_linked
            not_found_total += batch_not_found
            error_total += batch_errors
            
            # Commit transaction after each batch to free up resources
            commit_start = time.time()
            frappe.db.commit()
            if time.time() - commit_start > 1:  # Log slow commits
                frappe.logger().warning(f"Slow commit for batch #{batch_number}: {time.time() - commit_start:.2f}s")
            
            # Log batch progress
            frappe.logger().info(
                f"Batch #{batch_number} completed in {time.time() - batch_start_time:.2f}s: "
                f"{batch_processed} emails, {batch_linked} linked, "
                f"{batch_not_found} not found, {batch_errors} errors. "
                f"Progress: {processed_total}/{total_emails} ({round(processed_total/total_emails*100, 2)}%)"
            )
            
            # Move to next batch
            start += batch_size
            
            # Optional: Add a small delay to reduce database load
            time.sleep(0.5)  # 500ms delay between batches
        
        # Log final summary
        total_time = time.time() - start_time
        frappe.logger().info(
            f"Email reference update completed in {total_time:.2f}s: "
            f"{processed_total} processed, {linked_total} linked, "
            f"{not_found_total} not found, {error_total} errors"
        )

    except Exception as e:
        frappe.logger().error(f"Critical error in update_email_references: {str(e)}")
        # Re-throw for further handling
        raise

@frappe.whitelist()
def fix_email_references():
    """Endpoint to manually trigger email reference update"""
    try:
        needs_destroy = False
        # Initialize session only if needed (for bench execute)
        if not frappe.session or not frappe.session.user:
            init_for_execute()
            needs_destroy = True
        
        try:
            # Check permissions
            if not frappe.has_permission("Communication", "write"):
                frappe.throw(_("Not permitted to update email references"), frappe.PermissionError)
            
            # Ensure indices exist
            create_indices()
            
            # Run update directly
            update_email_references()
            
            frappe.msgprint(_("Email references update completed successfully"))
            return "Email reference update completed"
        finally:
            # Close connection if we created it
            if needs_destroy:
                frappe.destroy()
    except Exception as e:
        frappe.log_error("Error in fix_email_references", str(e))
        frappe.throw(_("Failed to update email references: {0}").format(str(e))) 