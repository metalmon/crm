// Copyright (c) 2025, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

frappe.ui.form.on("Sales Funnel Report Document", {
	onload(frm) {
		// Hide the standard Save button as early as possible
		frm.disable_save();
	},
	refresh(frm) {
		// Button is added in refresh, which runs after onload
		// Add a "View at Portal" button if the document name is available
		if (frm.doc.name) {
			let portal_path = null;
			let doc_type_label = null;

			if (frm.doc.name.startsWith("CRM-LEAD-")) {
				portal_path = `crm/leads/${frm.doc.name}`;
				doc_type_label = __("Lead");
			} else if (frm.doc.name.startsWith("CRM-DEAL-")) { // Assuming standard naming
				portal_path = `crm/deals/${frm.doc.name}`; // Adjust if your deal portal path is different
				doc_type_label = __("Deal");
			}

			if (portal_path) {
				// Remove the group argument to make it a standalone button
				frm.add_custom_button(__("View on Portal"), () => {
					// Construct the full URL
					let portal_url = window.location.origin + "/" + portal_path;
					// Open in a new tab
					window.open(portal_url, "_blank");
				});
			}
		}
	},
});
