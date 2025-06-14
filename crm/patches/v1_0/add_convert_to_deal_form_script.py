import frappe
from crm.install import add_convert_to_deal_script

def execute():
    add_convert_to_deal_script()
    frappe.db.commit() 