import frappe

# ... other imports and functions ...

@frappe.whitelist()
def is_beeline_installed():
	"""Check if the 'beeline' app is installed in the current bench."""
	return "beeline" in frappe.get_installed_apps() 