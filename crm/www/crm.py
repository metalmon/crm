# Copyright (c) 2022, Frappe Technologies Pvt. Ltd. and Contributors
# GNU GPLv3 License. See license.txt
import os
import json

import frappe
from frappe.integrations.frappe_providers.frappecloud_billing import is_fc_site
from frappe.utils import cint, get_system_timezone
from frappe.utils.telemetry import capture

no_cache = 1


def get_context():
	frappe.db.commit()
	context = frappe._dict()
	context.boot = get_boot()
	if frappe.session.user != "Guest":
		capture("active_site", "crm")
	return context


@frappe.whitelist(methods=["POST"], allow_guest=True)
def get_context_for_dev():
	if not frappe.conf.developer_mode:
		frappe.throw("This method is only meant for developer mode")
	return get_boot()


def get_boot():
	return frappe._dict(
		{
			"frappe_version": frappe.__version__,
			"default_route": get_default_route(),
			"site_name": frappe.local.site,
			"read_only_mode": frappe.flags.read_only,
			"csrf_token": frappe.sessions.get_csrf_token(),
			"setup_complete": cint(frappe.get_system_settings("setup_complete")),
			"sysdefaults": frappe.defaults.get_defaults(),
			"is_demo_site": frappe.conf.get("is_demo_site"),
			"is_fc_site": is_fc_site(),
			"timezone": {
				"system": get_system_timezone(),
				"user": frappe.db.get_value("User", frappe.session.user, "time_zone")
				or get_system_timezone(),
			},
			"app_version": get_app_version(),
		}
	)


def get_default_route():
	return "/crm"


def get_app_version():
	app = "crm"
	version_file_path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "public", "version.json")
	
	try:
		with open(version_file_path, 'r') as f:
			version_data = json.load(f)
		
		return {
			"branch": version_data.get("branch", ""),
			"commit": version_data.get("commit", ""),
			"commit_date": version_data.get("commit_date", ""),
			"commit_message": version_data.get("commit_message", ""),
			"tag": version_data.get("tag", ""),
			"dirty": False,  # Set to False since we can't determine this from version.json
		}
	except Exception:
		frappe.log_error(
			title="Version File Read Error",
		)
		return {
			"branch": "",
			"commit": "",
			"commit_date": "",
			"tag": "",
			"commit_message": "",
			"dirty": False,
		}
