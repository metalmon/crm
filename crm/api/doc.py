import json

import frappe
from frappe import _
from frappe.custom.doctype.property_setter.property_setter import make_property_setter
from frappe.desk.form.assign_to import set_status
from frappe.model import no_value_fields
from frappe.model.document import get_controller
from frappe.utils import make_filter_tuple
from pypika import Criterion

from crm.api.views import get_views
from crm.fcrm.doctype.crm_form_script.crm_form_script import get_form_script
from .performance import track_performance
from crm.utils import get_dynamic_linked_docs, get_linked_docs


@frappe.whitelist()
def sort_options(doctype: str):
	fields = frappe.get_meta(doctype).fields
	fields = [field for field in fields if field.fieldtype not in no_value_fields]
	fields = [
		{
			"label": _(field.label),
			"value": field.fieldname,
			"fieldname": field.fieldname,
		}
		for field in fields
		if field.label and field.fieldname
	]

	standard_fields = [
		{"label": "Name", "fieldname": "name"},
		{"label": "Created On", "fieldname": "creation"},
		{"label": "Last Modified", "fieldname": "modified"},
		{"label": "Modified By", "fieldname": "modified_by"},
		{"label": "Owner", "fieldname": "owner"},
	]

	for field in standard_fields:
		field["label"] = _(field["label"])
		field["value"] = field["fieldname"]
		fields.append(field)

	return fields


@frappe.whitelist()
def get_filterable_fields(doctype: str):
	allowed_fieldtypes = [
		"Check",
		"Data",
		"Float",
		"Int",
		"Currency",
		"Dynamic Link",
		"Link",
		"Long Text",
		"Select",
		"Small Text",
		"Text Editor",
		"Text",
		"Duration",
		"Date",
		"Datetime",
	]

	c = get_controller(doctype)
	restricted_fields = []
	if hasattr(c, "get_non_filterable_fields"):
		restricted_fields = c.get_non_filterable_fields()

	res = []

	# append DocFields
	DocField = frappe.qb.DocType("DocField")
	doc_fields = get_doctype_fields_meta(DocField, doctype, allowed_fieldtypes, restricted_fields)
	res.extend(doc_fields)

	# append Custom Fields
	CustomField = frappe.qb.DocType("Custom Field")
	custom_fields = get_doctype_fields_meta(CustomField, doctype, allowed_fieldtypes, restricted_fields)
	res.extend(custom_fields)

	# append standard fields (getting error when using frappe.model.std_fields)
	standard_fields = [
		{"fieldname": "name", "fieldtype": "Link", "label": "ID", "options": doctype},
		{"fieldname": "owner", "fieldtype": "Link", "label": "Created By", "options": "User"},
		{
			"fieldname": "modified_by",
			"fieldtype": "Link",
			"label": "Last Updated By",
			"options": "User",
		},
		{"fieldname": "_user_tags", "fieldtype": "Data", "label": "Tags"},
		{"fieldname": "_liked_by", "fieldtype": "Data", "label": "Like"},
		{"fieldname": "_comments", "fieldtype": "Text", "label": "Comments"},
		{"fieldname": "_assign", "fieldtype": "Text", "label": "Assigned To"},
		{"fieldname": "creation", "fieldtype": "Datetime", "label": "Created On"},
		{"fieldname": "modified", "fieldtype": "Datetime", "label": "Last Updated On"},
	]
	for field in standard_fields:
		if field.get("fieldname") not in restricted_fields and field.get("fieldtype") in allowed_fieldtypes:
			field["name"] = field.get("fieldname")
			res.append(field)

	for field in res:
		field["label"] = _(field.get("label"))
		field["value"] = field.get("fieldname")

	return res


@frappe.whitelist()
def get_group_by_fields(doctype: str):
	allowed_fieldtypes = [
		"Check",
		"Data",
		"Float",
		"Int",
		"Currency",
		"Dynamic Link",
		"Link",
		"Select",
		"Duration",
		"Date",
		"Datetime",
	]

	fields = frappe.get_meta(doctype).fields
	fields = [
		field
		for field in fields
		if field.fieldtype not in no_value_fields and field.fieldtype in allowed_fieldtypes
	]
	fields = [
		{
			"label": _(field.label),
			"fieldname": field.fieldname,
		}
		for field in fields
		if field.label and field.fieldname
	]

	standard_fields = [
		{"label": "Name", "fieldname": "name"},
		{"label": "Created On", "fieldname": "creation"},
		{"label": "Last Modified", "fieldname": "modified"},
		{"label": "Modified By", "fieldname": "modified_by"},
		{"label": "Owner", "fieldname": "owner"},
		{"label": "Liked By", "fieldname": "_liked_by"},
		{"label": "Assigned To", "fieldname": "_assign"},
		{"label": "Comments", "fieldname": "_comments"},
		{"label": "Created On", "fieldname": "creation"},
		{"label": "Modified On", "fieldname": "modified"},
	]

	for field in standard_fields:
		field["label"] = _(field["label"])
		fields.append(field)

	return fields


def get_doctype_fields_meta(DocField, doctype, allowed_fieldtypes, restricted_fields):
	parent = "parent" if DocField._table_name == "tabDocField" else "dt"
	return (
		frappe.qb.from_(DocField)
		.select(
			DocField.fieldname,
			DocField.fieldtype,
			DocField.label,
			DocField.name,
			DocField.options,
		)
		.where(DocField[parent] == doctype)
		.where(DocField.hidden == False)  # noqa: E712
		.where(Criterion.any([DocField.fieldtype == i for i in allowed_fieldtypes]))
		.where(Criterion.all([DocField.fieldname != i for i in restricted_fields]))
		.run(as_dict=True)
	)


@frappe.whitelist()
def get_quick_filters(doctype: str, cached: bool = True):
	meta = frappe.get_meta(doctype, cached)
	quick_filters = []

	if global_settings := frappe.db.exists("CRM Global Settings", {"dt": doctype, "type": "Quick Filters"}):
		_quick_filters = frappe.db.get_value("CRM Global Settings", global_settings, "json")
		_quick_filters = json.loads(_quick_filters) or []

		fields = []

		for filter in _quick_filters:
			if filter == "name":
				fields.append({"label": "Name", "fieldname": "name", "fieldtype": "Data"})
			elif filter == "_assign":
				fields.append({"label": "Assigned To", "fieldname": "_assign", "fieldtype": "Text"})
			else:
				field = next((f for f in meta.fields if f.fieldname == filter), None)
				if field:
					fields.append(field)

	else:
		fields = [field for field in meta.fields if field.in_standard_filter]



	for field in fields:
		options = field.get("options")
		if field.get("fieldtype") == "Select" and options and isinstance(options, str):
			options = options.split("\n")
			options = [{"label": _(option), "value": option} for option in options]
			if not any([not option.get("value") for option in options]):
				options.insert(0, {"label": "", "value": ""})
		quick_filters.append(
			{
				"label": _(field.get("label")),
				"fieldname": field.get("fieldname"),
				"fieldtype": field.get("fieldtype"),
				"options": options,
			}
		)

	if doctype == "CRM Lead":
		quick_filters = [filter for filter in quick_filters if filter.get("fieldname") != "converted"]

	return quick_filters


@frappe.whitelist()
def update_quick_filters(quick_filters: str, old_filters: str, doctype: str):
	quick_filters = json.loads(quick_filters)
	old_filters = json.loads(old_filters)

	new_filters = [filter for filter in quick_filters if filter not in old_filters]
	removed_filters = [filter for filter in old_filters if filter not in quick_filters]

	# update or create global quick filter settings
	create_update_global_settings(doctype, quick_filters)

	# remove old filters
	for filter in removed_filters:
		update_in_standard_filter(filter, doctype, 0)

	# add new filters
	for filter in new_filters:
		update_in_standard_filter(filter, doctype, 1)


def clear_quick_filters_cache(doctype):
	"""Clear the quick filters cache for a specific doctype"""
	frappe.cache().delete_key(['Quick Filters', doctype])


def update_in_standard_filter(fieldname, doctype, value):
	if property_name := frappe.db.exists(
		"Property Setter",
		{"doc_type": doctype, "field_name": fieldname, "property": "in_standard_filter"},
	):
		frappe.db.set_value("Property Setter", property_name, "value", value)
	else:
		make_property_setter(
			doctype,
			fieldname,
			"in_standard_filter",
			value,
			"Check",
			validate_fields_for_doctype=False,
		)
	
	# Clear cache after updating standard filter
	clear_quick_filters_cache(doctype)


def create_update_global_settings(doctype, quick_filters):
	if global_settings := frappe.db.exists("CRM Global Settings", {"dt": doctype, "type": "Quick Filters"}):
		frappe.db.set_value("CRM Global Settings", global_settings, "json", json.dumps(quick_filters))
	else:
		# create CRM Global Settings doc
		doc = frappe.new_doc("CRM Global Settings")
		doc.dt = doctype
		doc.type = "Quick Filters"
		doc.json = json.dumps(quick_filters)
		doc.insert()
	
	# Clear cache after updating global settings
	clear_quick_filters_cache(doctype)


@frappe.whitelist()
@track_performance
def get_data(
	doctype: str,
	filters: dict,
	order_by: str,
	page_length=20,
	page_length_count=20,
	column_field=None,
	title_field=None,
	columns=[],
	rows=[],
	kanban_columns=[],
	kanban_fields=[],
	view=None,
	default_filters=None,
):
	custom_view = False
	filters = frappe._dict(filters)
	rows = frappe.parse_json(rows or "[]")
	columns = frappe.parse_json(columns or "[]")
	kanban_fields = frappe.parse_json(kanban_fields or "[]")
	kanban_columns = frappe.parse_json(kanban_columns or "[]")

	custom_view_name = view.get("custom_view_name") if view else None
	view_type = view.get("view_type") if view else None
	group_by_field = view.get("group_by_field") if view else None

	for key in filters:
		value = filters[key]
		if isinstance(value, list):
			if "@me" in value:
				value[value.index("@me")] = frappe.session.user
			elif "%@me%" in value:
				index = [i for i, v in enumerate(value) if v == "%@me%"]
				for i in index:
					value[i] = "%" + frappe.session.user + "%"
			# Handle _assign field filtering
			elif key == "_assign" and len(value) == 2 and value[0] == "assigned_user":
				# Get user email by name
				user_email = frappe.db.get_value("User", value[1], "email")
				if user_email:
					# Convert to LIKE filter for JSON field
					filters[key] = ["LIKE", f"%{user_email}%"]
		elif value == "@me":
			filters[key] = frappe.session.user

	if default_filters:
		default_filters = frappe.parse_json(default_filters)
		filters.update(default_filters)

	is_default = True
	data = []
	_list = get_controller(doctype)
	default_rows = []
	if hasattr(_list, "default_list_data"):
		default_rows = _list.default_list_data().get("rows")

	meta = frappe.get_meta(doctype)

	if view_type != "kanban":
		if columns or rows:
			custom_view = True
			is_default = False
			columns = frappe.parse_json(columns)
			rows = frappe.parse_json(rows)

		if not columns:
			columns = [
				{"label": _("Name"), "type": "Data", "key": "name", "width": "16rem"},
				{"label": _("Last Modified"), "type": "Datetime", "key": "modified", "width": "8rem"},
			]

		if not rows:
			rows = ["name"]

		default_view_filters = {
			"dt": doctype,
			"type": view_type or "list",
			"is_standard": 1,
			"user": frappe.session.user,
		}

		if not custom_view and frappe.db.exists("CRM View Settings", default_view_filters):
			list_view_settings = frappe.get_doc("CRM View Settings", default_view_filters)
			columns = frappe.parse_json(list_view_settings.columns)
			rows = frappe.parse_json(list_view_settings.rows)
			is_default = False
		elif not custom_view or (is_default and hasattr(_list, "default_list_data")):
			rows = default_rows
			columns = _list.default_list_data().get("columns")

		# check if rows has all keys from columns if not add them
		for column in columns:
			if column.get("key") not in rows:
				rows.append(column.get("key"))
			column["label"] = _(column.get("label"))

			if column.get("key") == "_liked_by" and column.get("width") == "10rem":
				column["width"] = "50px"

			# remove column if column.hidden is True
			column_meta = meta.get_field(column.get("key"))
			if column_meta and column_meta.get("hidden"):
				columns.remove(column)

		# check if rows has group_by_field if not add it
		if group_by_field and group_by_field not in rows:
			rows.append(group_by_field)

		data = (
			frappe.get_list(
				doctype,
				fields=rows,
				filters=filters,
				order_by=order_by,
				page_length=page_length,
			)
			or []
		)
		data = parse_list_data(data, doctype)

	if view_type == "kanban":
		if not rows:
			rows = default_rows

		if not kanban_columns and column_field:
			field_meta = frappe.get_meta(doctype).get_field(column_field)
			if field_meta.fieldtype == "Link":
				kanban_columns = frappe.get_all(
					field_meta.options,
					fields=["name", "position"],
					order_by="position asc",
				)
			elif field_meta and field_meta.fieldtype == "Select":
				kanban_columns = [{"name": option} for option in field_meta.options.split("\n")]
			else:
				kanban_columns = []

		if not title_field:
			title_field = "name"
			if hasattr(_list, "default_kanban_settings"):
				title_field = _list.default_kanban_settings().get("title_field")

		if title_field not in rows:
			rows.append(title_field)

		if not kanban_fields:
			kanban_fields = ["name"]
			if hasattr(_list, "default_kanban_settings"):
				kanban_fields = json.loads(_list.default_kanban_settings().get("kanban_fields"))

		for field in kanban_fields:
			if field not in rows:
				rows.append(field)

		for kc in kanban_columns:
			column_filters = {column_field: kc.get("name")}
			order = kc.get("order")
			if (column_field in filters and filters.get(column_field) != kc.get("name")) or kc.get("delete"):
				column_data = []
			else:
				column_filters.update(filters.copy())
				page_length = 20

				if kc.get("page_length"):
					page_length = kc.get("page_length")

				if order:
					column_data = get_records_based_on_order(
						doctype, rows, column_filters, page_length, order
					)
				else:
					column_data = frappe.get_list(
						doctype,
						fields=rows,
						filters=convert_filter_to_tuple(doctype, column_filters),
						order_by=order_by,
						page_length=page_length,
					)

				new_filters = filters.copy()
				new_filters.update({column_field: kc.get("name")})

				all_count = frappe.get_list(
					doctype,
					filters=convert_filter_to_tuple(doctype, new_filters),
					fields="count(*) as total_count",
				)[0].total_count

				kc["all_count"] = all_count
				kc["count"] = len(column_data)

				for d in column_data:
					getCounts(d, doctype)

			if order:
				column_data = sorted(
					column_data,
					key=lambda x: order.index(x.get("name")) if x.get("name") in order else len(order),
				)

			data.append({"column": kc, "fields": kanban_fields, "data": column_data})

	fields = frappe.get_meta(doctype).fields
	fields = [field for field in fields if field.fieldtype not in no_value_fields]
	fields = [
		{
			"label": _(field.label),
			"fieldtype": field.fieldtype,
			"fieldname": field.fieldname,
			"options": field.options,
		}
		for field in fields
		if field.label and field.fieldname
	]

	std_fields = [
		{"label": "Name", "fieldtype": "Data", "fieldname": "name"},
		{"label": "Created On", "fieldtype": "Datetime", "fieldname": "creation"},
		{"label": "Last Modified", "fieldtype": "Datetime", "fieldname": "modified"},
		{
			"label": "Modified By",
			"fieldtype": "Link",
			"fieldname": "modified_by",
			"options": "User",
		},
		{"label": "Assigned To", "fieldtype": "Text", "fieldname": "_assign"},
		{"label": "Owner", "fieldtype": "Link", "fieldname": "owner", "options": "User"},
		{"label": "Like", "fieldtype": "Data", "fieldname": "_liked_by"},
	]

	for field in std_fields:
		if field.get("fieldname") not in rows:
			rows.append(field.get("fieldname"))
		if field not in fields:
			field["label"] = _(field["label"])
			fields.append(field)

	if not is_default and custom_view_name:
		is_default = frappe.db.get_value("CRM View Settings", custom_view_name, "load_default_columns")

	if group_by_field and view_type == "group_by":

		def get_options(type, options):
			if type == "Select":
				return [option for option in options.split("\n")]
			else:
				has_empty_values = any([not d.get(group_by_field) for d in data])
				options = list(set([d.get(group_by_field) for d in data]))
				options = [u for u in options if u]
				if has_empty_values:
					options.append("")

				if order_by and group_by_field in order_by:
					order_by_fields = order_by.split(",")
					order_by_fields = [
						(field.split(" ")[0], field.split(" ")[1]) for field in order_by_fields
					]
					if (group_by_field, "asc") in order_by_fields:
						options.sort()
					elif (group_by_field, "desc") in order_by_fields:
						options.sort(reverse=True)
				else:
					options.sort()
				return options

		for field in fields:
			if field.get("fieldname") == group_by_field:
				group_by_field = {
					"label": field.get("label"),
					"fieldname": field.get("fieldname"),
					"fieldtype": field.get("fieldtype"),
					"options": get_options(field.get("fieldtype"), field.get("options")),
				}

	return {
		"data": data,
		"columns": columns,
		"rows": rows,
		"fields": fields,
		"column_field": column_field,
		"title_field": title_field,
		"kanban_columns": kanban_columns,
		"kanban_fields": kanban_fields,
		"group_by_field": group_by_field,
		"page_length": page_length,
		"page_length_count": page_length_count,
		"is_default": is_default,
		"views": get_views(doctype),
		"total_count": frappe.get_list(
			doctype, filters=filters, fields="count(*) as total_count"
		)[0].total_count,
		"row_count": len(data),
		"form_script": get_form_script(doctype),
		"list_script": get_form_script(doctype, "List"),
		"view_type": view_type,
	}


def parse_list_data(data, doctype):
	_list = get_controller(doctype)
	if hasattr(_list, "parse_list_data"):
		data = _list.parse_list_data(data)
	return data


def convert_filter_to_tuple(doctype, filters):
	if isinstance(filters, dict):
		filters_items = filters.items()
		filters = []
		for key, value in filters_items:
			filters.append(make_filter_tuple(doctype, key, value))
	return filters


def get_records_based_on_order(doctype, rows, filters, page_length, order):
	records = []
	filters = convert_filter_to_tuple(doctype, filters)
	in_filters = filters.copy()
	in_filters.append([doctype, "name", "in", order[:page_length]])
	records = frappe.get_list(
		doctype,
		fields=rows,
		filters=in_filters,
		order_by="creation desc",
		page_length=page_length,
	)

	if len(records) < page_length:
		not_in_filters = filters.copy()
		not_in_filters.append([doctype, "name", "not in", order])
		remaining_records = frappe.get_list(
			doctype,
			fields=rows,
			filters=not_in_filters,
			order_by="creation desc",
			page_length=page_length - len(records),
		)
		for record in remaining_records:
			records.append(record)

	return records


@frappe.whitelist()
def get_fields_meta(doctype, restricted_fieldtypes=None, as_array=False, only_required=False):
	not_allowed_fieldtypes = [
		"Tab Break",
		"Section Break",
		"Column Break",
	]

	if restricted_fieldtypes:
		restricted_fieldtypes = frappe.parse_json(restricted_fieldtypes)
		not_allowed_fieldtypes += restricted_fieldtypes

	fields = frappe.get_meta(doctype).fields
	fields = [field for field in fields if field.fieldtype not in not_allowed_fieldtypes]

	standard_fields = [
		{"fieldname": "name", "fieldtype": "Link", "label": "ID", "options": doctype},
		{"fieldname": "owner", "fieldtype": "Link", "label": "Created By", "options": "User"},
		{
			"fieldname": "modified_by",
			"fieldtype": "Link",
			"label": "Last Updated By",
			"options": "User",
		},
		{"fieldname": "_user_tags", "fieldtype": "Data", "label": "Tags"},
		{"fieldname": "_liked_by", "fieldtype": "Data", "label": "Like"},
		{"fieldname": "_comments", "fieldtype": "Text", "label": "Comments"},
		{"fieldname": "_assign", "fieldtype": "Text", "label": "Assigned To"},
		{"fieldname": "creation", "fieldtype": "Datetime", "label": "Created On"},
		{"fieldname": "modified", "fieldtype": "Datetime", "label": "Last Updated On"},
	]

	for field in standard_fields:
		if not restricted_fieldtypes or field.get("fieldtype") not in restricted_fieldtypes:
			fields.append(field)

	if only_required:
		fields = [field for field in fields if field.get("reqd")]

	if as_array:
		return fields

	fields_meta = {}
	for field in fields:
		fields_meta[field.get("fieldname")] = field
		if field.get("fieldtype") == "Table":
			_fields = frappe.get_meta(field.get("options")).fields
			fields_meta[field.get("fieldname")] = {"df": field, "fields": _fields}

	return fields_meta


@frappe.whitelist()
def remove_assignments(doctype, name, assignees, ignore_permissions=False, retry_count=3):
	assignees = json.loads(assignees)

	if not assignees:
		return

	for assign_to in assignees:
		for attempt in range(retry_count):
			try:
				set_status(
					doctype,
					name,
					todo=None,
					assign_to=assign_to,
					status="Cancelled",
					ignore_permissions=ignore_permissions,
				)
				break  # Break inner loop if successful
			except Exception as e:
				error_message = str(e)
				is_deadlock = "Deadlock found when trying to get lock" in error_message

				if is_deadlock and attempt < retry_count - 1:
					frappe.log_error(_("Deadlock detected in unassignment, retrying... (Attempt {0}/{1})").format(attempt + 1, retry_count))
					continue
				else:
					frappe.log_error(_("Error in unassignment: {0}").format(error_message))
					frappe.throw(_("Error while unassigning: {0}").format(error_message))
		else:
			frappe.throw(_("Failed to unassign after multiple attempts"))



@frappe.whitelist()
def get_assigned_users(doctype, name, default_assigned_to=None):
	assigned_users = frappe.get_all(
		"ToDo",
		fields=["allocated_to"],
		filters={
			"reference_type": doctype,
			"reference_name": name,
			"status": ("!=", "Cancelled"),
		},
		pluck="allocated_to",
	)

	users = list(set(assigned_users))

	# if users is empty, add default_assigned_to
	if not users and default_assigned_to:
		users = [default_assigned_to]
	return users


@frappe.whitelist()
def get_fields(doctype: str, allow_all_fieldtypes: bool = False):
	not_allowed_fieldtypes = [*list(frappe.model.no_value_fields), "Read Only"]
	if allow_all_fieldtypes:
		not_allowed_fieldtypes = []
	fields = frappe.get_meta(doctype).fields

	_fields = []

	for field in fields:
		if field.fieldtype not in not_allowed_fieldtypes and field.fieldname:
			_fields.append(field)

	return _fields


def getCounts(d, doctype):
	d["_email_count"] = (
		frappe.db.count(
			"Communication",
			filters={
				"reference_doctype": doctype,
				"reference_name": d.get("name"),
				"communication_type": "Communication",
			},
		)
		or 0
	)
	d["_email_count"] = d["_email_count"] + frappe.db.count(
		"Communication",
		filters={
			"reference_doctype": doctype,
			"reference_name": d.get("name"),
			"communication_type": "Automated Message",
		},
	)
	d["_comment_count"] = frappe.db.count(
		"Comment",
		filters={"reference_doctype": doctype, "reference_name": d.get("name"), "comment_type": "Comment"},
	)
	d["_task_count"] = frappe.db.count(
		"CRM Task", filters={"reference_doctype": doctype, "reference_docname": d.get("name")}
	)
	d["_note_count"] = frappe.db.count(
		"FCRM Note", filters={"reference_doctype": doctype, "reference_docname": d.get("name")}
	)
	return d


def get_changed_fields(doc):
	"""Get fields that were changed in the document"""
	if not doc._doc_before_save:
		return {}
		
	changed = {}
	for key, value in doc.as_dict().items():
		if (
			key not in ['modified', 'creation'] and 
			doc._doc_before_save.get(key) != value
		):
			changed[key] = value
			
	return changed


@frappe.whitelist()
def subscribe_doc(doctype, name):
	"""Subscribe to document updates"""
	if not frappe.has_permission(doctype, "read", name):
		frappe.throw(_("Not permitted"))
		
	# Add to session subscriptions
	if not hasattr(frappe.local, 'document_subscriptions'):
		frappe.local.document_subscriptions = set()
	
	frappe.local.document_subscriptions.add(f"{doctype}:{name}")
	return True


@frappe.whitelist()
def unsubscribe_doc(doctype, name):
	"""Unsubscribe from document updates"""
	if hasattr(frappe.local, 'document_subscriptions'):
		frappe.local.document_subscriptions.remove(f"{doctype}:{name}")
	return True


def on_doc_update(doc, method=None):
	"""Publish updates to subscribed clients"""
	# Handle CRM Lead, CRM Deal and CRM Task
	if doc.doctype not in ['CRM Lead', 'CRM Deal', 'CRM Task']:
		return
		
	# Determine event type based on method
	event = 'modified'
	if method == 'after_insert':
		event = 'created'
	elif method == 'on_trash':
		event = 'deleted'
		
	# Send document identifier and event type
	frappe.publish_realtime(
		'doc_update',
		{
			'doctype': doc.doctype,
			'name': doc.name,
			'data': {
				'event': event  # Signal the type of document event
			}
		},
		after_commit=True
	)
@frappe.whitelist()
def get_linked_docs_of_document(doctype, docname):
	doc = frappe.get_doc(doctype, docname)
	linked_docs = get_linked_docs(doc)
	dynamic_linked_docs = get_dynamic_linked_docs(doc)

	linked_docs.extend(dynamic_linked_docs)
	linked_docs = list({doc["reference_docname"]: doc for doc in linked_docs}.values())

	docs_data = []
	for doc in linked_docs:
		data = frappe.get_doc(doc["reference_doctype"], doc["reference_docname"])
		title = data.get("title")
		if data.doctype == "CRM Call Log":
			title = f"Call from {data.get('from')} to {data.get('to')}"

		if data.doctype == "CRM Deal":
			title = data.get("organization")

		docs_data.append(
			{
				"doc": data.doctype,
				"title": title or data.get("name"),
				"reference_docname": doc["reference_docname"],
				"reference_doctype": doc["reference_doctype"],
			}
		)
	return docs_data


def remove_doc_link(doctype, docname):
	linked_doc_data = frappe.get_doc(doctype, docname)
	linked_doc_data.update(
		{
			"reference_doctype": None,
			"reference_docname": None,
		}
	)
	linked_doc_data.save(ignore_permissions=True)


def remove_contact_link(doctype, docname):
	linked_doc_data = frappe.get_doc(doctype, docname)
	linked_doc_data.update(
		{
			"contact": None,
			"contacts": [],
		}
	)
	linked_doc_data.save(ignore_permissions=True)


@frappe.whitelist()
def remove_linked_doc_reference(items, remove_contact=None, delete=False):
	if isinstance(items, str):
		items = frappe.parse_json(items)

	for item in items:
		if remove_contact:
			remove_contact_link(item["doctype"], item["docname"])
		else:
			universal_remove_doc_link(item["doctype"], item["docname"])

		if delete:
			frappe.delete_doc(item["doctype"], item["docname"])

	return "success"


@frappe.whitelist()
def delete_bulk_docs(doctype, items, delete_linked=False):
	from frappe.desk.reportview import delete_bulk

	try:
		items = frappe.parse_json(items)
		
		# Process linked documents for each item
		for doc in items:
			try:
				linked_docs = get_linked_docs_of_document(doctype, doc)
				
				# If there are linked documents, handle them according to delete_linked flag
				for linked_doc in linked_docs:
					try:
						remove_linked_doc_reference(
							[
								{
									"doctype": linked_doc["reference_doctype"],
									"docname": linked_doc["reference_docname"],
								}
							],
							remove_contact=doctype == "Contact",
							delete=delete_linked,
						)
					except Exception as e:
						frappe.log_error(f"Error handling linked doc {linked_doc['reference_docname']}: {str(e)}")
						# Continue with other linked documents
						continue
			except Exception as e:
				frappe.log_error(f"Error processing linked documents for {doc}: {str(e)}")
				# Continue with other documents
				continue

		# Delete the main documents
		try:
			if len(items) > 10:
				frappe.enqueue("frappe.desk.reportview.delete_bulk", doctype=doctype, items=items)
			else:
				delete_bulk(doctype, items)
		except Exception as e:
			frappe.log_error(f"Error in bulk delete: {str(e)}")
			raise
			
		return "success"
	except Exception as e:
		frappe.log_error(f"Error in delete_bulk_docs: {str(e)}")
		frappe.throw(f"Error in bulk delete operation: {str(e)}")


# --- UNIVERSAL UNLINK FUNCTION FOR FORK SUPPORT ---
def universal_remove_doc_link(doctype, docname):
    """
    Universally unlinks a document from its parent for any DocType
    that uses reference_doctype/reference_name or reference_docname fields.
    Clears all Link fields to DocType and all Dynamic Link fields that use them as options.
    """
    doc = frappe.get_doc(doctype, docname)
    meta = frappe.get_meta(doctype)
    # Find all Link fields to DocType
    link_fields = [f.fieldname for f in meta.fields if f.fieldtype == "Link" and f.options == "DocType"]
    # Find all Dynamic Link fields that use these Link fields as options
    dynlink_fields = [
        f.fieldname
        for f in meta.fields
        if f.fieldtype == "Dynamic Link" and f.options in link_fields
    ]
    # Clear all found fields
    for lf in link_fields:
        doc.set(lf, None)
    for dlf in dynlink_fields:
        doc.set(dlf, None)
    doc.save(ignore_permissions=True)
# --- END UNIVERSAL UNLINK FUNCTION ---
