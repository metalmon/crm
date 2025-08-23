import frappe


@frappe.whitelist()
def get_deal_contacts(name):
	contacts = frappe.get_all(
		"CRM Contacts",
		filters={"parenttype": "CRM Deal", "parent": name},
		fields=["contact", "is_primary"],
		distinct=True,
	)
	deal_contacts = []
	for contact in contacts:
		if not contact.contact:
			continue

		is_primary = contact.is_primary
		contact = frappe.get_doc("Contact", contact.contact).as_dict()

		_contact = {
			"name": contact.name,
			"image": contact.image,
			"full_name": contact.full_name,
			"email": contact.email_id,
			"mobile_no": contact.mobile_no,
			"is_primary": is_primary,
		}
		deal_contacts.append(_contact)
	return deal_contacts


@frappe.whitelist()
def get_deal_display_name(name):
	"""Get the display name for a CRM Deal"""
	deal = frappe.get_doc("CRM Deal", name)
	
	# First try to get organization name
	if deal.organization:
		org = frappe.get_doc("CRM Organization", deal.organization)
		if org.organization_name:
			return {"display_name": org.organization_name}
	
	# If no organization, try to get primary contact name
	if deal.contacts:
		for contact in deal.contacts:
			if contact.is_primary and contact.contact:
				contact_doc = frappe.get_doc("Contact", contact.contact)
				if contact_doc.full_name:
					return {"display_name": contact_doc.full_name}
	
	# Fallback to untitled
	return {"display_name": None}
