import frappe
from frappe import _
from crm.fcrm.doctype.crm_notification.crm_notification import notify_user


def after_insert(doc, method=None):
    """Handle document sharing after ToDo creation"""
    share_on_assignment(doc)

    if (
        doc.reference_type in ["CRM Lead", "CRM Deal"]
        and doc.reference_name
        and doc.allocated_to
    ):
        fieldname = "lead_owner" if doc.reference_type == "CRM Lead" else "deal_owner"
        lead_owner = frappe.db.get_value(
            doc.reference_type, doc.reference_name, fieldname
        )
        if not lead_owner:
            frappe.db.set_value(
                doc.reference_type, doc.reference_name, fieldname, doc.allocated_to
            )

    if (
        doc.reference_type in ["CRM Lead", "CRM Deal", "CRM Task"]
        and doc.reference_name
        and doc.allocated_to
    ):
        notify_assigned_user(doc)


def on_update(doc, method=None):
    """Handle document sharing on ToDo update"""
    share_on_assignment(doc)

    if (
        doc.has_value_changed("status")
        and doc.status == "Cancelled"
        and doc.reference_type in ["CRM Lead", "CRM Deal", "CRM Task"]
        and doc.reference_name
        and doc.allocated_to
    ):
        notify_assigned_user(doc, is_cancelled=True)


def notify_assigned_user(doc, is_cancelled=False):
    _doc = frappe.get_doc(doc.reference_type, doc.reference_name)
    owner = frappe.get_cached_value("User", frappe.session.user, "full_name")
    notification_text = get_notification_text(owner, doc, _doc, is_cancelled)

    message = (
        _("Your assignment on {0} {1} has been removed by {2}").format(
            doc.reference_type, doc.reference_name, owner
        )
        if is_cancelled
        else _("{0} assigned a {1} {2} to you").format(
            owner, doc.reference_type, doc.reference_name
        )
    )

    redirect_to_doctype, redirect_to_name = get_redirect_to_doc(doc)

    notify_user(
        {
            "owner": frappe.session.user,
            "assigned_to": doc.allocated_to,
            "notification_type": "Assignment",
            "message": message,
            "notification_text": notification_text,
            "reference_doctype": doc.reference_type,
            "reference_docname": doc.reference_name,
            "redirect_to_doctype": redirect_to_doctype,
            "redirect_to_docname": redirect_to_name,
        }
    )


def get_notification_text(owner, doc, reference_doc, is_cancelled=False):
    name = doc.reference_name
    doctype = doc.reference_type

    if doctype.startswith("CRM "):
        doctype = doctype[4:].lower()

    if doctype == "lead":
        name = reference_doc.lead_name or name
        
        if is_cancelled:
            # Extract translation strings separately for better extraction
            message = _('Your assignment on lead {0} has been removed by {1}')
            formatted_name = f'<span class="font-medium text-ink-gray-9">{ name }</span>'
            formatted_owner = f'<span class="font-medium text-ink-gray-9">{ owner }</span>'
            return f"""
                <div class="mb-2 leading-5 text-ink-gray-5">
                    <span>{ message.format(formatted_name, formatted_owner) }</span>
                </div>
            """

        # Extract translation strings separately for better extraction
        message = _('assigned lead {0} to you')
        formatted_name = f'<span class="font-medium text-ink-gray-9">{ name }</span>'
        return f"""
            <div class="mb-2 leading-5 text-ink-gray-5">
                <span class="font-medium text-ink-gray-9">{ owner }</span>
                <span>{ message.format(formatted_name) }</span>
            </div>
        """
    elif doctype == "deal":
        name = reference_doc.organization or reference_doc.lead_name or name
        
        if is_cancelled:
            # Extract translation strings separately for better extraction
            message = _('Your assignment on deal {0} has been removed by {1}')
            formatted_name = f'<span class="font-medium text-ink-gray-9">{ name }</span>'
            formatted_owner = f'<span class="font-medium text-ink-gray-9">{ owner }</span>'
            return f"""
                <div class="mb-2 leading-5 text-ink-gray-5">
                    <span>{ message.format(formatted_name, formatted_owner) }</span>
                </div>
            """

        # Extract translation strings separately for better extraction
        message = _('assigned deal {0} to you')
        formatted_name = f'<span class="font-medium text-ink-gray-9">{ name }</span>'
        return f"""
            <div class="mb-2 leading-5 text-ink-gray-5">
                <span class="font-medium text-ink-gray-9">{ owner }</span>
                <span>{ message.format(formatted_name) }</span>
            </div>
        """

    if doctype == "task":
        if is_cancelled:
            # Extract translation strings separately for better extraction
            message = _('Your assignment on task {0} has been removed by {1}')
            formatted_title = f'<span class="font-medium text-ink-gray-9">{ reference_doc.title }</span>'
            formatted_owner = f'<span class="font-medium text-ink-gray-9">{ owner }</span>'
            return f"""
                <div class="mb-2 leading-5 text-ink-gray-5">
                    <span>{ message.format(formatted_title, formatted_owner) }</span>
                </div>
            """
            
        # Extract translation strings separately for better extraction
        message = _('assigned task {0} to you')
        formatted_title = f'<span class="font-medium text-ink-gray-9">{ reference_doc.title }</span>'
        return f"""
            <div class="mb-2 leading-5 text-ink-gray-5">
                <span class="font-medium text-ink-gray-9">{ owner }</span>
                <span>{ message.format(formatted_title) }</span>
            </div>
        """


def get_redirect_to_doc(doc):
    if doc.reference_type == "CRM Task":
        reference_doc = frappe.get_doc(doc.reference_type, doc.reference_name)
        return reference_doc.reference_doctype, reference_doc.reference_docname

    return doc.reference_type, doc.reference_name


def share_on_assignment(todo):
    """Share the referenced document with the assigned user"""
    try:
        if not todo.reference_type or not todo.reference_name or not todo.allocated_to:
            return
            
        
        # If ToDo is cancelled, remove share
        if todo.status == "Cancelled":
            frappe.share.remove(
                todo.reference_type,
                todo.reference_name,
                todo.allocated_to,
                flags={"ignore_share_permission": True}
            )
            return
            
        # Get the referenced document
        doc = frappe.get_doc(todo.reference_type, todo.reference_name)
        
        # Check if document sharing is already set up
        existing_share = frappe.db.exists(
            "DocShare",
            {
                "user": todo.allocated_to,
                "share_doctype": todo.reference_type,
                "share_name": todo.reference_name
            }
        )
        
        if existing_share:
            # Update existing share to ensure correct permissions
            share_doc = frappe.get_doc("DocShare", existing_share)
            share_doc.read = 1
            share_doc.write = 1
            share_doc.share = 0
            share_doc.notify = 1
            share_doc.flags.ignore_permissions = True
            share_doc.save()
            return
            
        # Create new share
        frappe.share.add_docshare(
            todo.reference_type,
            todo.reference_name,
            todo.allocated_to,
            write=1,
            flags={"ignore_share_permission": True}
        )
        
        
    except Exception as e:
        frappe.log_error(f"Error sharing document on assignment: {str(e)}")
        frappe.throw(_("Error sharing document on assignment"))
