import frappe
import click

def execute():
    """Add read permissions for CRM Form Script to Sales User role"""
    if not frappe.db.exists("DocPerm", {"parent": "CRM Form Script", "role": "Sales User"}):
        click.secho("* Adding CRM Form Script read permissions for Sales User")
        
        doc = frappe.get_doc({
            "doctype": "DocPerm",
            "parent": "CRM Form Script",
            "parentfield": "permissions",
            "parenttype": "DocType",
            "role": "Sales User",
            "permlevel": 0,
            "read": 1,
            "write": 0,
            "create": 0,
            "delete": 0,
            "submit": 0,
            "cancel": 0,
            "amend": 0,
            "print": 1,
            "email": 1,
            "report": 1,
            "share": 1,
            "export": 0
        })
        
        doc.insert(ignore_permissions=True)
        frappe.db.commit() 