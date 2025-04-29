frappe.listview_settings["Sales Funnel Report Document"] = {
	hide_name_column: true,
	// Optionally hide the name filter as well, if not needed
	hide_name_filter: true,
	// has_primary_action: false, // This setting might not work reliably

	refresh: function(listview) {
		// Add context information above the list
		const context_filter = listview.get_filters_for_args().find(f => f[1] === 'report_context');
		let context_html = '';

		if (context_filter && context_filter[3]) {
			try {
				const context_data = JSON.parse(context_filter[3]);
				const stage_name = context_data.clicked_stage_name;
				const from_date = context_data.from_date;
				const to_date = context_data.to_date;

				if (stage_name && from_date && to_date) {
					const translated_stage = __(stage_name);
					const formatted_from = frappe.datetime.str_to_user(from_date);
					const formatted_to = frappe.datetime.str_to_user(to_date);
					// Using template literals for cleaner string construction
					// Added some basic styling
					context_html = `<div class="report-context-message text-muted px-3" style="margin-bottom: 10px;">
						${__("Showing documents for stage:")} <strong>${translated_stage}</strong> 
						(${__("Period:")} ${formatted_from} - ${formatted_to})
					</div>`;
				}
			} catch (e) {
				// Keep error log, but remove debug logs
				console.error("Failed to parse report_context in list view refresh:", e);
				context_html = `<div class="report-context-message text-danger" style="margin-bottom: 10px;">${__("Error displaying report context.")}</div>`;
			}
		}

		// Wrap DOM manipulation in setTimeout
		setTimeout(() => {
			// Try finding the main content area within the page wrapper using jQuery
			const $main_section = $(listview.page.wrapper).find('.layout-main-section');

			if ($main_section.length > 0) {
				// Remove previous context message if it exists
				$main_section.find('.report-context-message').remove();

				// Add the new context message
				if (context_html) {
					$main_section.prepend(context_html); // Prepend to the found main section
				}
			} else {
				// Keep warning log if container not found
				console.warn("Could not find .layout-main-section within listview.page.wrapper (in setTimeout).");
				// Fallback attempt: Query the document directly (less reliable)
				const $direct_find = $('.layout-main-section:visible');
				if ($direct_find.length > 0) {
					$direct_find.find('.report-context-message').remove();
					if (context_html) {
						$direct_find.prepend(context_html);
					}
				} else {
					console.error("Could not find any suitable container to insert context message.");
				}
			}
		}, 150); // Slightly longer delay just in case
	},

	// Add button to each row
	button: {
		show(doc) {
			// Show button for all rows
			return true;
		},
		get_label() {
			// Static label for the button, with context for translation
			return __('View', context="Button Label");
		},
		get_description(doc) {
			// Dynamic tooltip based on document type
			let doctype_label = '';
			if (doc.document_type === "CRM Lead") {
				doctype_label = __('Lead');
			} else if (doc.document_type === "CRM Deal") {
				doctype_label = __('Deal');
			} else {
				doctype_label = __('Document');
			}
			return __('View {0} on Portal', [doctype_label]);
		},
		action(doc) {
			// Determine the portal path based on the ORIGINAL document type
			let portal_path = null;
			// Check the original type field we added in Python
			if (doc.document_type_original === "CRM Lead") {
				portal_path = `crm/leads/${doc.name}`;
			} else if (doc.document_type_original === "CRM Deal") {
				portal_path = `crm/deals/${doc.name}`; // Adjust if your deal portal path is different
			}

			if (portal_path) {
				// Construct the full URL and open in a new tab
				let portal_url = window.location.origin + "/" + portal_path;
				window.open(portal_url, "_blank");
			} else {
				frappe.show_alert({message: __('Cannot determine portal path for this document type.'), indicator: 'warning'});
			}
		}
	}
}; 