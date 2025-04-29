import frappe
from crm.api.communication import create_indices

def execute():
    """Create indices for email-related fields in CRM Lead and CRM Deal"""
    create_indices()
    frappe.db.commit() 