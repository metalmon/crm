import frappe
from frappe import _
from frappe.desk.form.assign_to import add as frappe_assign_to
from frappe.desk.form.assign_to import remove as frappe_remove_assign
from frappe.desk.form.assign_to import get


@frappe.whitelist()
def add_with_retry(args=None, retry_count=3):
    """
    Add an assignment with retry logic to avoid deadlocks.
    
    Args:
        args: Dictionary containing assignment details
        retry_count: Number of retries in case of deadlock
    
    Returns:
        Assignment details
    """
    if not args:
        args = frappe.local.form_dict
    
    for attempt in range(retry_count):
        try:
            # Just call the function directly and let Frappe handle transactions
            result = frappe_assign_to(args, ignore_permissions=False)
            return result
        except Exception as e:
            error_message = str(e)
            # Check if it's a deadlock error
            is_deadlock = "Deadlock found when trying to get lock" in error_message
            
            if is_deadlock and attempt < retry_count - 1:
                # Log the deadlock and continue with retry
                frappe.log_error(_("Deadlock detected in assignment, retrying... (Attempt {0}/{1})").format(attempt+1, retry_count))
                continue
            else:
                # Either not a deadlock or we've exhausted our retries
                frappe.log_error(_("Error in assignment: {0}").format(error_message))
                frappe.throw(_("Error while assigning: {0}").format(error_message))
    
    frappe.throw(_("Failed to assign after multiple attempts"))


@frappe.whitelist()
def add_multiple_with_retry(args=None, retry_count=3):
    """
    Add multiple assignments with retry logic.
    
    Args:
        args: Dictionary containing assignment details with multiple document names
        retry_count: Number of retries in case of deadlock
    
    Returns:
        Assignment details
    """
    if not args:
        args = frappe.local.form_dict
    
    import json
    docname_list = json.loads(args["name"])
    results = []
    
    for docname in docname_list:
        args_copy = args.copy()
        args_copy.update({"name": docname})
        try:
            result = add_with_retry(args_copy, retry_count)
            results.append(result)
        except Exception as e:
            frappe.log_error(_("Error assigning to {0}: {1}").format(docname, str(e)))
            # Continue with other assignments even if one fails
            continue
    
    return results


@frappe.whitelist()
def remove_with_retry(doctype=None, name=None, assign_to=None, retry_count=3):
    """
    Remove an assignment with retry logic to avoid deadlocks.
    
    Args:
        doctype: DocType of the document
        name: Name of the document
        assign_to: User to unassign
        retry_count: Number of retries in case of deadlock
    
    Returns:
        Assignment details
    """
    if not doctype:
        doctype = frappe.local.form_dict.get('doctype')
    
    if not name:
        name = frappe.local.form_dict.get('name')
    
    if not assign_to:
        assign_to = frappe.local.form_dict.get('assign_to')
    
    for attempt in range(retry_count):
        try:
            # Just call the function directly and let Frappe handle transactions
            result = frappe_remove_assign(doctype, name, assign_to, ignore_permissions=False)
            return result
        except Exception as e:
            error_message = str(e)
            # Check if it's a deadlock error
            is_deadlock = "Deadlock found when trying to get lock" in error_message
            
            if is_deadlock and attempt < retry_count - 1:
                # Log the deadlock and continue with retry
                frappe.log_error(_("Deadlock detected in unassignment, retrying... (Attempt {0}/{1})").format(attempt+1, retry_count))
                continue
            else:
                # Either not a deadlock or we've exhausted our retries
                frappe.log_error(_("Error in unassignment: {0}").format(error_message))
                frappe.throw(_("Error while unassigning: {0}").format(error_message))
    
    frappe.throw(_("Failed to unassign after multiple attempts")) 