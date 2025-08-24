# import frappe
from frappe import _
from frappe.contacts.doctype.contact.contact import Contact


class CustomContact(Contact):
	def validate(self):
		"""Custom validation to ensure data integrity"""
		super().validate()
		self.clean_email_ids()
		self.clean_phone_nos()

	def clean_email_ids(self):
		"""Clean email_ids to prevent None values"""
		if self.email_ids:
			for email in self.email_ids:
				if email.email_id is None:
					email.email_id = ""
				elif isinstance(email.email_id, str):
					email.email_id = email.email_id.strip()

	def clean_phone_nos(self):
		"""Clean phone_nos to prevent None values"""
		if self.phone_nos:
			for phone in self.phone_nos:
				if phone.phone is None:
					phone.phone = ""
				elif isinstance(phone.phone, str):
					phone.phone = phone.phone.strip()

	def set_primary_email(self):
		"""Override to fix None.strip() error"""
		if not self.email_ids:
			return

		# Find primary email
		primary_email = None
		for d in self.email_ids:
			if d.is_primary:
				primary_email = d
				break

		if primary_email and primary_email.email_id:
			self.email_id = primary_email.email_id.strip()
		else:
			self.email_id = ""

	def set_primary_mobile_no(self):
		"""Override to fix None.strip() error"""
		if not self.phone_nos:
			return

		# Find primary mobile number
		primary_mobile = None
		for d in self.phone_nos:
			if d.is_primary_mobile_no:
				primary_mobile = d
				break

		if primary_mobile and primary_mobile.phone:
			self.mobile_no = primary_mobile.phone.strip()
		else:
			self.mobile_no = ""

	def set_primary_phone(self):
		"""Override to fix None.strip() error"""
		if not self.phone_nos:
			return

		# Find primary phone number
		primary_phone = None
		for d in self.phone_nos:
			if d.is_primary_phone:
				primary_phone = d
				break

		if primary_phone and primary_phone.phone:
			self.phone = primary_phone.phone.strip()
		else:
			self.phone = ""

	@staticmethod
	def default_list_data():
		columns = [
			{
				'label': 'First Name',
				'type': 'Data',
				'key': 'first_name',
				'width': '10rem',
			},
			{
				'label': 'Last Name',
				'type': 'Data',
				'key': 'last_name',
				'width': '10rem',
			},
			{
				'label': 'Full Name',
				'type': 'Data',
				'key': 'full_name',
				'width': '17rem',
			},
			{
				'label': 'Email',
				'type': 'Data',
				'key': 'email_id',
				'width': '12rem',
			},
			{
				'label': 'Phone',
				'type': 'Data',
				'key': 'mobile_no',
				'width': '12rem',
			},
			{
				'label': 'Organization',
				'type': 'Data',
				'key': 'company_name',
				'width': '12rem',
			},
			{
				'label': 'Last Modified',
				'type': 'Datetime',
				'key': 'modified',
				'width': '8rem',
			},
		]
		rows = [
			"name",
			"first_name",
			"last_name",
			"full_name",
			"company_name",
			"email_id",
			"mobile_no",
			"modified",
			"image",
		]
		return {'columns': columns, 'rows': rows}
