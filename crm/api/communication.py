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
        batch_size = 50  # Process 50 emails at a time to avoid server overload
        processed_total = 0
        linked_total = 0
        not_found_total = 0
        error_total = 0
        
        # Get initial count for progress reporting
        total_emails = frappe.db.count(
            "Communication",
            filters={
                "communication_medium": "Email",
                "communication_type": "Communication",
                "reference_doctype": ["in", ["", None]],
                "reference_name": ["in", ["", None]]
            }
        )
        
        if not total_emails:
            frappe.logger().info("No emails without references found. Nothing to process.")
            return
            
        frappe.logger().info(f"Starting email reference update: {total_emails} total emails to process")
        
        # Process in batches
        start = 0
        while True:
            # Get batch of emails without references
            emails_without_refs = frappe.get_all(
                "Communication",
                filters={
                    "communication_medium": "Email",
                    "communication_type": "Communication",
                    "reference_doctype": ["in", ["", None]],
                    "reference_name": ["in", ["", None]]
                },
                fields=["name", "sender", "recipients", "cc", "bcc", "creation"],
                order_by="creation desc",  # Process newest first
                start=start,
                page_length=batch_size
            )
            
            if not emails_without_refs:
                break  # No more emails to process
                
            batch_processed = 0
            batch_linked = 0
            batch_not_found = 0
            batch_errors = 0
            
            for email in emails_without_refs:
                try:
                    # Collect all email addresses from the communication
                    email_addresses = set()
                    if email.sender:
                        email_addresses.add(email.sender.lower())
                    if email.recipients:
                        email_addresses.update([e.strip().lower() for e in email.recipients.split(",")])
                    if email.cc:
                        email_addresses.update([e.strip().lower() for e in email.cc.split(",")])
                    if email.bcc:
                        email_addresses.update([e.strip().lower() for e in email.bcc.split(",")])
                    
                    # Skip if no valid email addresses found
                    if not email_addresses:
                        batch_not_found += 1
                        continue
                    
                    # Search for deals with matching emails (prioritize newest deals)
                    deals = frappe.get_all(
                        "CRM Deal",
                        filters={"email": ["in", list(email_addresses)]},
                        fields=["name", "email", "creation"],
                        order_by="creation desc"  # Newest deals first
                    )
                    
                    # Priority given to deals over leads
                    linked = False
                    if deals:
                        deal = deals[0]  # Take newest deal (already sorted by creation desc)
                        frappe.db.set_value(
                            "Communication",
                            email.name,
                            {
                                "reference_doctype": "CRM Deal",
                                "reference_name": deal.name
                            },
                            update_modified=False
                        )
                        linked = True
                        batch_linked += 1
                    else:
                        # Search for leads with matching emails ONLY if no deals found
                        leads = frappe.get_all(
                            "CRM Lead",
                            filters={"email": ["in", list(email_addresses)]},
                            fields=["name", "email", "creation"],
                            order_by="creation desc"  # Newest leads first
                        )
                        
                        if leads:
                            lead = leads[0]  # Take newest lead
                            frappe.db.set_value(
                                "Communication",
                                email.name,
                                {
                                    "reference_doctype": "CRM Lead",
                                    "reference_name": lead.name
                                },
                                update_modified=False
                            )
                            linked = True
                            batch_linked += 1
                        else:
                            batch_not_found += 1
                    
                except Exception as e:
                    batch_errors += 1
                    error_msg = f"Error processing communication {email.name}: {str(e)}"
                    frappe.logger().error(error_msg)
                    # Continue with next email despite error
                
                batch_processed += 1
                
            # Update total counters
            processed_total += batch_processed
            linked_total += batch_linked
            not_found_total += batch_not_found
            error_total += batch_errors
            
            # Commit transaction after each batch to free up resources
            frappe.db.commit()
            
            # Log batch progress
            frappe.logger().info(
                f"Email batch processed: {batch_processed} emails, {batch_linked} linked, "
                f"{batch_not_found} not found, {batch_errors} errors. "
                f"Progress: {processed_total}/{total_emails} ({round(processed_total/total_emails*100, 2)}%)"
            )
            
            # Move to next batch
            start += batch_size
            
            # Optional: Add a small delay to reduce database load
            time.sleep(0.5)  # 500ms delay between batches
        
        # Log final summary
        frappe.logger().info(
            f"Email reference update completed: {processed_total} processed, {linked_total} linked, "
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
        # Initialize session only if needed (for bench execute)
        if not frappe.session or not frappe.session.user:
            init_for_execute()
        
        # Check permissions
        if not frappe.has_permission("Communication", "write"):
            frappe.throw(_("Not permitted to update email references"), frappe.PermissionError)
        
        # Ensure indices exist
        create_indices()
        
        # Run update directly
        update_email_references()
        
        frappe.msgprint(_("Email references update completed successfully"))
        return "Email reference update completed"
    except Exception as e:
        frappe.log_error("Error in fix_email_references", str(e))
        frappe.throw(_("Failed to update email references: {0}").format(str(e))) 