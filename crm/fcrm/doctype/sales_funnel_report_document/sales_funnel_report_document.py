# Copyright (c) 2025, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, getdate, date_diff, escape_html, nowdate

from collections import OrderedDict, defaultdict
import logging # Use standard logging
import json # Import json module
import datetime # Import datetime module

# Import necessary functions from the main report
# Adjust path if necessary based on your app structure
try:
	from crm.fcrm.report.sales_funnel_conversion.sales_funnel_conversion import (
		get_all_stages_ordered,
		get_lead_conditions,
		get_deal_conditions,
		get_relevant_docs_based_on_activity,
		apply_owner_filters,
		get_doc_stage_info,
	)
except ImportError:
	# Fallback or log error if import fails
	frappe.log_error("Failed to import functions from Sales Funnel Conversion report", "SalesFunnelReportDocument")
	# Define stubs or raise error to prevent runtime failures
	def get_all_stages_ordered(): return OrderedDict()
	def get_lead_conditions(f): return {}
	def get_deal_conditions(f): return {}
	def get_relevant_docs_based_on_activity(l, d, s, e): return set(), set()
	def apply_owner_filters(rl, rd, f, m): return set(), set()
	def get_doc_stage_info(d, s, start, end): return {}, {}


# Configure logger for this virtual doctype
logger = logging.getLogger(__name__)
# Set logging level if needed (e.g., logging.INFO, logging.DEBUG)
# logger.setLevel(logging.DEBUG) 
# Example handler setup (Frappe might handle this automatically)
# handler = logging.StreamHandler() 
# formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
# handler.setFormatter(formatter)
# logger.addHandler(handler)


class SalesFunnelReportDocument(Document):
	
	# --- Standard Virtual DocType Methods ---
	def db_insert(self, *args, **kwargs):
		logger.error("Virtual DocType 'Sales Funnel Report Document' cannot be inserted.")
		raise NotImplementedError("Virtual DocType cannot be inserted.")

	def load_from_db(self):
		# This method is called when trying to load the form view of the virtual doctype.
		# We will populate the fields based on the document name (which is the Lead/Deal name).
		_ = frappe._ # Ensure translation is available
		doc_name = self.name
		logger = frappe.logger("sales_funnel_report_document_load")
		logger.info(f"load_from_db called for: {doc_name}")

		if not doc_name: return

		self.document_name = doc_name

		# Determine Document Type
		doc_type_simple = None
		original_full_doctype = None # Variable to store original doctype name
		if doc_name.startswith("CRM-LEAD-"):
			# Set the simple type first
			doc_type_simple = "Lead"
			original_full_doctype = "CRM Lead"
			# Use the translated simple type for the field
			self.document_type = _(doc_type_simple)
			self.document_type_original = original_full_doctype # Store original doctype for linking
		elif doc_name.startswith("CRM-DEAL-"): # Assuming standard naming
			# Set the simple type first
			doc_type_simple = "Deal"
			original_full_doctype = "CRM Deal"
			# Use the translated simple type for the field
			self.document_type = _(doc_type_simple)
			self.document_type_original = original_full_doctype # Store original doctype for linking
		else:
			logger.warning(f"Could not determine document type for {doc_name}")
			# Set defaults or leave empty
			self.document_type = None
			self.furthest_stage_reached = None
			self.furthest_stage_log_date = None
			self.entry_stage_period = None
			self.entry_stage_date_period = None
			return # Cannot proceed without doctype

		if not original_full_doctype:
			logger.error(f"Original doctype could not be determined for {doc_name}")
			return
			
		try:
			# Get all stages definitions
			all_stages_raw = get_all_stages_ordered()
			if not all_stages_raw:
				logger.error("Failed to get stage definitions in load_from_db")
				return

			# Get the *absolute* furthest stage reached by this document
			# Use a very wide date range to ensure we find the latest log ever.
			# Note: get_doc_stage_info returns furthest_from and entry_stage based on logs
			# where the 'from' field matches a stage. This is correct for our purpose.
			# The period_end='nowdate()' ensures we consider all logs up to the present.
			# Use a different variable name instead of _ to avoid overwriting the translation function
			doc_furthest_from_stage, entry_stage_ignored = get_doc_stage_info(
				[doc_name], 
				all_stages_raw, 
				"1900-01-01", # Irrelevant start date for furthest stage
				nowdate() # Use current date as end date
			)

			furthest_info = doc_furthest_from_stage.get(doc_name)

			if furthest_info and furthest_info.get("stage_key"):
				furthest_stage_key = furthest_info["stage_key"]
				stage_details = all_stages_raw.get(furthest_stage_key)
				if stage_details:
					self.furthest_stage_reached = _(stage_details.get("name", furthest_stage_key))
					self.furthest_stage_log_date = furthest_info.get("log_date")
				else:
					self.furthest_stage_reached = furthest_stage_key # Fallback to key
					self.furthest_stage_log_date = furthest_info.get("log_date")
			else:
				# Document might exist but have no logs yet or only initial state
				self.furthest_stage_reached = _("N/A") # Or some other indicator
				self.furthest_stage_log_date = None

			# We cannot reliably determine the Entry Stage/Date for the *report's period*
			# without having the original report's date filters available here.
			# So, we set them to None.
			self.entry_stage_period = None
			self.entry_stage_date_period = None

			# --- Fetch additional general info --- 
			try:
				# Get the actual Lead/Deal document using original name
				actual_doc = frappe.get_doc(original_full_doctype, doc_name)
				# Translate the status
				self.current_status = _(actual_doc.status) if actual_doc.status else None
				# Assign to the renamed field
				self.document_owner = actual_doc.get("lead_owner") or actual_doc.get("deal_owner")
				
				# Calculate total lifetime touches using original name
				comm_count = frappe.db.count("Communication", filters={
					"reference_doctype": original_full_doctype,
					"reference_name": doc_name
				})
				call_count = frappe.db.count("CRM Call Log", filters={
					"reference_doctype": original_full_doctype,
					"reference_docname": doc_name
				})
				self.total_touches = cint(comm_count) + cint(call_count)
				
			except frappe.DoesNotExistError:
				logger.warning(f"Underlying document {original_full_doctype} {doc_name} not found.")
				self.current_status = _("Original Doc Missing")
				# Update assignment in except block
				self.document_owner = None 
				self.total_touches = 0
			except Exception as fetch_err:
				logger.error(f"Error fetching additional info for {doc_name}: {fetch_err}")
				self.current_status = _("Error")
				# Update assignment in except block
				self.document_owner = _("Error")
				self.total_touches = None
			# --- End additional info fetch ---

			# Set display_name for the form view, applying Deal logic
			self.display_name = doc_name # Default fallback
			if self.document_type == "CRM Lead":
				if hasattr(actual_doc, 'lead_name') and actual_doc.lead_name:
					self.display_name = actual_doc.lead_name
			elif self.document_type == "CRM Deal":
				org_id = actual_doc.organization
				primary_contact_full_name = None
				# Fetch primary contact for this specific deal
				try:
					link = frappe.db.get_value("Dynamic Link", 
											 filters={'link_doctype': 'CRM Deal', 
													'link_name': doc_name, 
													'parenttype': 'CRM Contact', 
													'is_primary': 1}, 
											 fieldname='parent')
					if link:
						primary_contact_full_name = frappe.db.get_value("Contact", link, "full_name")
				except Exception as contact_load_err:
					logger.warning(f"Could not fetch primary contact name for {doc_name} in load_from_db: {contact_load_err}")
				
				# Apply priority
				if org_id:
					self.display_name = org_id
				elif primary_contact_full_name:
					self.display_name = primary_contact_full_name
				# Else: keep default doc_name set above
				
			logger.info(f"Successfully loaded data for {doc_name}: Furthest Stage='{self.furthest_stage_reached}', Date='{self.furthest_stage_log_date}', Current='{self.current_status}', Display='{self.display_name}'")

		except Exception as e:
			_ = frappe._ # Re-ensure translation is available in except block
			logger.error(f"Error in load_from_db for {doc_name}: {e}", exc_info=True)
			# Set fields to indicate error or leave empty
			self.furthest_stage_reached = _("Error loading data")
			self.furthest_stage_log_date = None
			self.entry_stage_period = None
			self.entry_stage_date_period = None
			# Set defaults for new fields on error too
			self.current_status = _("Error loading data")
			self.document_owner = _("Error loading data")
			self.total_touches = None
			self.display_name = _("Error loading data")

		# --- End of load_from_db ---

	def db_update(self):
		logger.error("Virtual DocType 'Sales Funnel Report Document' cannot be updated.")
		raise NotImplementedError("Virtual DocType cannot be updated.")

	def delete(self):
		logger.error("Virtual DocType 'Sales Funnel Report Document' cannot be deleted.")
		raise NotImplementedError("Virtual DocType cannot be deleted.")

	# --- Methods for List View ---
	@staticmethod
	def _get_filter_value(filters, fieldname):
		"""Helper function to extract filter value from list or dict."""
		if isinstance(filters, dict): # Handle dicts just in case
			return filters.get(fieldname)
		if isinstance(filters, (list, tuple)):
			for f in filters:
				if isinstance(f, (list, tuple)) and len(f) >= 3:
					# Standard list view format: ['Doctype', 'fieldname', 'operator', 'value']
					# Or sometimes: ['fieldname', 'operator', 'value']
					doc_field = f[1] if len(f) == 4 else f[0]
					value_index = 3 if len(f) == 4 else 2
					if doc_field == fieldname:
						return f[value_index]
		return None # Filter not found or format not recognized

	@staticmethod
	def get_list(filters=None, page_length=20, order_by=None, **kwargs):
		_ = frappe._ # Ensure translation function is available
		frappe_logger = frappe.logger("sales_funnel_report_document_list")
		frappe_logger.info(f"get_list called with filters (type: {type(filters)}): {filters}")

		# --- Extract context from the single filter --- 
		context_json = SalesFunnelReportDocument._get_filter_value(filters, "report_context")
		if not context_json:
			frappe_logger.warning("report_context filter not found. Returning empty list.")
			return []
		
		try:
			context_data = json.loads(context_json)
			frappe_logger.info(f"Parsed context_data: {context_data}")
		except json.JSONDecodeError:
			frappe_logger.error(f"Failed to parse report_context JSON: {context_json}")
			return []

		# Extract needed values from context_data
		clicked_stage_name = context_data.get("clicked_stage_name")
		report_filters = context_data # The rest of context_data are the original filters
		report_filters.pop("clicked_stage_name", None) # Remove the name itself

		if not clicked_stage_name:
			frappe_logger.warning("clicked_stage_name missing in report_context.")
			return []

		period_start = report_filters.get("from_date")
		period_end = report_filters.get("to_date")
		if not period_start or not period_end:
			frappe_logger.error("From Date or To Date missing in report_context.")
			return []

		# --- Get stages and find the matching key (logic as before) --- 
		try:
			all_stages_raw = get_all_stages_ordered()
		except Exception as e: 
			frappe_logger.error(f"Error calling get_all_stages_ordered: {e}")
			return []
		if not all_stages_raw: return []
		clicked_stage_key = None
		clicked_stage_index = -1
		all_stage_keys_raw = list(all_stages_raw.keys())
		stage_name_to_key_map = {} 
		for i, key in enumerate(all_stage_keys_raw):
			stage_info = all_stages_raw[key]
			simple_name_translated = _(stage_info['name']) 
			stage_name_to_key_map[simple_name_translated] = key 
			if simple_name_translated == clicked_stage_name:
				clicked_stage_key = key
				clicked_stage_index = i
				break 
		if clicked_stage_key is None:
			frappe_logger.error(f"Could not find stage_key for name '{clicked_stage_name}'. Map: {stage_name_to_key_map}")
			return [] 
		frappe_logger.info(f"Found stage_key '{clicked_stage_key}' at index {clicked_stage_index} for name '{clicked_stage_name}'")

		# --- Get relevant documents (using report_filters from context) --- 
		try:
			# --- Leads --- 
			lead_conditions = get_lead_conditions(report_filters) 
			initial_leads = frappe.get_all("CRM Lead", filters=lead_conditions, fields=["name", "lead_name"])
			initial_lead_names = [l.name for l in initial_leads]
			lead_name_map = {l.name: l.lead_name for l in initial_leads}

			# --- Deals --- 
			deal_conditions = get_deal_conditions(report_filters) 
			deal_fields = ["name"]
			deal_meta = frappe.get_meta("CRM Deal")
			if deal_meta.has_field("lead"): deal_fields.append("lead")
			if deal_meta.has_field("deal_name"): deal_fields.append("deal_name")
			if deal_meta.has_field("organization"): deal_fields.append("organization") # Fetch organization link
			all_deals_filtered = frappe.get_all("CRM Deal", filters=deal_conditions, fields=deal_fields)
			initial_deal_names = [d.name for d in all_deals_filtered]
			deal_to_lead_map = {d.name: d.lead for d in all_deals_filtered if hasattr(d, 'lead') and d.lead}
			deal_name_map = {d.name: d.deal_name for d in all_deals_filtered if hasattr(d, 'deal_name')}
			# Store organization mapping for deals
			deal_org_map = {d.name: d.organization for d in all_deals_filtered if hasattr(d, 'organization') and d.organization}
			
			# --- Filter by Activity & Owner --- 
			relevant_lead_names, relevant_deal_names = get_relevant_docs_based_on_activity(initial_lead_names, initial_deal_names, period_start, period_end)
			filtered_relevant_leads, filtered_relevant_deals = apply_owner_filters(relevant_lead_names, relevant_deal_names, report_filters, deal_to_lead_map) 
			filtered_relevant_doc_names = list(filtered_relevant_leads | filtered_relevant_deals)
			frappe_logger.info(f"Total relevant docs after owner/activity filters: {len(filtered_relevant_doc_names)}")
			if not filtered_relevant_doc_names: return []

			# --- Get Furthest Stage --- 
			doc_furthest_from_stage, entry_stage_ignored = get_doc_stage_info(filtered_relevant_doc_names, all_stages_raw, period_start, period_end)
			
			# --- Get Primary Contact Full Names for Relevant Deals (Final Attempt) --- 
			deal_primary_contact_full_name_map = {}
			if filtered_relevant_deals:
				try:
					# 1. Get all links between relevant deals and contacts
					links = frappe.get_all("Dynamic Link", 
									 filters={'link_doctype': 'CRM Deal', 
											'link_name': ('in', list(filtered_relevant_deals)), 
											'parenttype': 'CRM Contact'}, 
									 fields=['link_name', 'parent'])
					
					deal_to_contact_ids = defaultdict(list)
					contact_ids = set()
					for link in links:
						deal_to_contact_ids[link.link_name].append(link.parent)
						contact_ids.add(link.parent)
					
					if contact_ids:
						# 2. Get details (including is_primary) for these contacts
						contacts = frappe.get_all("Contact", 
											filters={'name': ('in', list(contact_ids))}, 
											fields=['name', 'full_name', 'is_primary'])
						contact_id_to_details = {c.name: {"full_name": c.full_name, "is_primary": c.is_primary} for c in contacts}
						
						# 3. Find the primary contact's full name for each deal
						for deal_name, linked_contact_ids in deal_to_contact_ids.items():
							for contact_id in linked_contact_ids:
								if contact_id in contact_id_to_details and contact_id_to_details[contact_id]["is_primary"] == 1:
									deal_primary_contact_full_name_map[deal_name] = contact_id_to_details[contact_id]["full_name"]
									break # Found primary, move to next deal
				except Exception as contact_fetch_err:
					frappe_logger.error(f"Error fetching primary contacts for deals (final attempt): {contact_fetch_err}")
			# --- End Primary Contact Fetch ---

			# --- Calculate Total Touches (Optimized) ---
			total_touches_map = defaultdict(int)
			if filtered_relevant_doc_names:
				try:
					# Communications
					comm_counts = frappe.get_all("Communication", 
											 filters={
												 "reference_doctype": ("in", ["CRM Lead", "CRM Deal"]),
												 "reference_name": ("in", filtered_relevant_doc_names)
											 },
											 fields=["reference_name", "count(*) as count"],
											 group_by="reference_name")
					for row in comm_counts:
						total_touches_map[row.reference_name] += cint(row.count)
					
					# CRM Call Logs
					call_counts = frappe.get_all("CRM Call Log", 
											 filters={
												 "reference_doctype": ("in", ["CRM Lead", "CRM Deal"]),
												 "reference_docname": ("in", filtered_relevant_doc_names)
											 },
											 fields=["reference_docname", "count(*) as count"],
											 group_by="reference_docname")
					for row in call_counts:
						total_touches_map[row.reference_docname] += cint(row.count)
						
				except Exception as touch_fetch_err:
					frappe_logger.error(f"Error fetching total touches: {touch_fetch_err}")
			# --- End Total Touches Fetch ---

			frappe_logger.debug(f"Doc furthest stages map: {doc_furthest_from_stage}")
		except Exception as e: 
			frappe_logger.error(f"Error during data fetching steps: {e}", exc_info=True)
			return []

		# --- Prepare Result Documents --- 
		result_docs = []
		filtered_out_count = 0
		for doc_name in filtered_relevant_doc_names:
			furthest_info = doc_furthest_from_stage.get(doc_name)
			if furthest_info and furthest_info.get("stage_key"):
				furthest_key = furthest_info["stage_key"]
				if furthest_key in all_stage_keys_raw:
					try:
						furthest_index = all_stage_keys_raw.index(furthest_key)
						frappe_logger.debug(f"Checking doc: {doc_name}, furthest_key: {furthest_key}, furthest_index: {furthest_index}, required_index: {clicked_stage_index}") 
						if furthest_index >= clicked_stage_index:
							doc_type = "Lead" if doc_name.startswith("CRM-LEAD-") else "Deal"
							full_doc_type = "CRM " + doc_type # e.g., "CRM Lead"
							stage_details = all_stages_raw.get(furthest_key, {})
							# Get the untranslated stage name first
							stage_name_untranslated = stage_details.get("name", furthest_key)
							# Apply translation here
							stage_display_name_translated = _(stage_name_untranslated)
							
							# Get Display Name based on new logic
							display_name_to_use = doc_name # Default fallback
							if doc_type == "Lead":
								display_name_to_use = lead_name_map.get(doc_name) or doc_name
							else: # Deal
								org_id = deal_org_map.get(doc_name)
								primary_contact_name = deal_primary_contact_full_name_map.get(doc_name)
								
								if org_id:
									display_name_to_use = org_id # Use Org ID as per Vue logic
								elif primary_contact_name:
									display_name_to_use = primary_contact_name
								# Else, keep the default doc_name
							
							# Get total touches from pre-calculated map
							total_touches = total_touches_map.get(doc_name, 0)
								
							# Get Entry Stage info (placeholder - needs actual implementation if required)
							entry_stage_name = None 
							entry_stage_date = None

							result_docs.append({
								"doctype": "Sales Funnel Report Document", 
								"name": doc_name, 
								"document_type": _(doc_type), # Use translated short name
								"document_type_original": full_doc_type, # Add original full name
								"document_name": doc_name, # Plain name for the Link field
								"display_name": display_name_to_use, # Add display name
								"furthest_stage_reached": stage_display_name_translated, # Use translated name
								"furthest_stage_log_date": furthest_info.get("log_date"),
								"entry_stage_period": entry_stage_name, # Match JSON fieldname
								"entry_stage_date_period": entry_stage_date, # Match JSON fieldname
								"total_touches": total_touches # Add total touches
							})
						else:
							filtered_out_count += 1
					except ValueError: 
						frappe_logger.warning(f"ValueError finding index for furthest_key '{furthest_key}' for doc {doc_name}")
						filtered_out_count += 1
				else:
					frappe_logger.warning(f"Doc {doc_name} has invalid furthest_key '{furthest_key}'")
					filtered_out_count += 1
			else:
				frappe_logger.warning(f"Doc {doc_name} has no furthest_info or stage_key")
				filtered_out_count += 1
		frappe_logger.info(f"Final filtering: Kept {len(result_docs)}, Filtered out: {filtered_out_count}")
		
		# --- Apply Sorting --- 
		if order_by and result_docs:
			try:
				# Process only the first sort condition
				first_condition = order_by.split(',')[0].strip()
				parts = first_condition.split()
				
				sort_order_desc = False
				if len(parts) > 1 and parts[-1].lower() == "desc":
					sort_order_desc = True
					parts.pop() # Remove desc
				elif len(parts) > 1 and parts[-1].lower() == "asc":
					parts.pop() # Remove asc
					
				# Join remaining parts to get full field identifier
				full_field_identifier = " ".join(parts)
				# Extract field name, removing potential table prefix like `tabDoctype`.fieldname
				sort_field_raw = full_field_identifier.split('.')[-1].strip('`')
				
				# Handle None values during sort comparison (Simplified)
				def sort_key(item):
					val = item.get(sort_field_raw)
					# Log value for first few items (optional, can be verbose)
					# if result_docs.index(item) < 5:
					# 	frappe_logger.error(f"Sort key for item {item.get('name')}: field='{sort_field_raw}', value={val}")
					return (val is None, val) # Sort None first

				result_docs.sort(key=sort_key, reverse=sort_order_desc)
				# Sorting finished log removed
			except Exception as sort_err:
				frappe_logger.error(f"Error applying sort '{order_by}': {sort_err}")
		# --- End Sorting ---
		
		frappe_logger.info(f"Returning {len(result_docs)} documents for stage name '{clicked_stage_name}'.")
		return result_docs

	@staticmethod
	def get_count(filters=None, **kwargs):
		_ = frappe._ # Ensure translation function is available
		frappe_logger = frappe.logger("sales_funnel_report_document_count")
		frappe_logger.info(f"get_count called with filters: {filters}") # Can be verbose

		# --- Extract context from the single filter --- 
		context_json = SalesFunnelReportDocument._get_filter_value(filters, "report_context")
		if not context_json: return 0 
		try:
			context_data = json.loads(context_json)
		except json.JSONDecodeError:
			frappe_logger.error(f"[get_count] Failed to parse report_context JSON: {context_json}")
			return 0

		clicked_stage_name = context_data.get("clicked_stage_name")
		report_filters = context_data
		report_filters.pop("clicked_stage_name", None)

		if not clicked_stage_name: return 0
		period_start = report_filters.get("from_date")
		period_end = report_filters.get("to_date")
		if not period_start or not period_end: return 0

		# --- Minimal steps needed for counting ---
		try:
			all_stages_raw = get_all_stages_ordered()
			if not all_stages_raw: return 0
			all_stage_keys_raw = list(all_stages_raw.keys())
			
			# --- Re-add map creation and population --- 
			stage_name_to_key_map = {}
			for i, key in enumerate(all_stage_keys_raw):
				stage_info = all_stages_raw[key]
				# Сравниваем только с переведенным именем
				simple_name_translated = _(stage_info['name'])
				stage_name_to_key_map[simple_name_translated] = key # Для отладки
				if simple_name_translated == clicked_stage_name:
					clicked_stage_key = key
					clicked_stage_index = i # Store the correct index
					break
			if clicked_stage_key is None: 
				frappe_logger.error(f"[get_count] Could not find stage_key for name '{clicked_stage_name}'. Simple Name Map: {stage_name_to_key_map}")
				return 0 
			# --- End map creation --- 

			# Get relevant doc names (same logic as get_list)
			lead_conditions = get_lead_conditions(report_filters)
			initial_leads = frappe.get_all("CRM Lead", filters=lead_conditions, fields=["name"])
			initial_lead_names = [l.name for l in initial_leads]

			deal_conditions = get_deal_conditions(report_filters)
			deal_fields = ["name"]
			if frappe.get_meta("CRM Deal").has_field("lead"):
				deal_fields.append("lead")
			all_deals_filtered = frappe.get_all("CRM Deal", filters=deal_conditions, fields=deal_fields)
			initial_deal_names = [d.name for d in all_deals_filtered]
			deal_to_lead_map = {d.name: d.lead for d in all_deals_filtered if hasattr(d, 'lead') and d.lead}

			relevant_lead_names, relevant_deal_names = get_relevant_docs_based_on_activity(
				initial_lead_names, initial_deal_names, period_start, period_end
			)
			filtered_relevant_leads, filtered_relevant_deals = apply_owner_filters(
				relevant_lead_names, relevant_deal_names, report_filters, deal_to_lead_map
			)
			filtered_relevant_doc_names = list(filtered_relevant_leads | filtered_relevant_deals)

			if not filtered_relevant_doc_names: return 0

			# Get furthest stage info only
			doc_furthest_from_stage, entry_stage_ignored = get_doc_stage_info(
				filtered_relevant_doc_names, all_stages_raw, period_start, period_end
			)

			# --- Count matching documents ---
			count = 0
			for doc_name in filtered_relevant_doc_names:
				furthest_info = doc_furthest_from_stage.get(doc_name)
				if furthest_info and furthest_info.get("stage_key"):
					furthest_key = furthest_info["stage_key"]
					if furthest_key in all_stage_keys_raw:
						try:
							furthest_index = all_stage_keys_raw.index(furthest_key)
							if furthest_index >= clicked_stage_index:
								count += 1
						except ValueError:
							pass # Ignore inconsistent data points found during count
					# else: pass # Ignore invalid stage keys
				# else: pass # Ignore docs without furthest stage info
						
			frappe_logger.info(f"get_count returning {count} for stage name '{clicked_stage_name}'.")
			return count
		
		except Exception as e:
			frappe_logger.error(f"Error during get_count execution: {e}", exc_info=True)
			return 0 # Return 0 on any unexpected error during count

	@staticmethod
	def get_stats(filters=None, **kwargs):
		# Optional: Implement if stats (like counts per type) are needed for the list view sidebar
		# Example: Count Leads vs Deals in the filtered list
		# data = SalesFunnelReportDocument.get_list(filters, **kwargs) # Get the full list (potentially inefficient)
		# lead_count = sum(1 for d in data if d['document_type'] == 'CRM Lead')
		# deal_count = len(data) - lead_count
		# return [
		#     {"label": _("Leads"), "value": lead_count},
		#     {"label": _("Deals"), "value": deal_count},
		# ]
		frappe_logger = frappe.logger("sales_funnel_report_document_stats")
		frappe_logger.debug("get_stats called (not implemented).")
		return [] # Return empty list if no stats are needed

