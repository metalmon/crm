frappe.query_reports["Sales Funnel Conversion"] = {
	"filters": [
		{
			"fieldname": "from_date",
			"label": __("From Date"),
			"fieldtype": "Date",
			"default": frappe.datetime.add_months(frappe.datetime.get_today(), -1), // Default to 1 month ago
			"reqd": 1
		},
		{
			"fieldname": "to_date",
			"label": __("To Date"),
			"fieldtype": "Date",
			"default": frappe.datetime.get_today(), // Default to today
			"reqd": 1
		},
		{
			"fieldname": "sales_funnel",
			"label": __("Sales Funnel"),
			"fieldtype": "Link",
			"options": "CRM Funnel"
		},
		{
			"fieldname": "lead_owner",
			"label": __("Lead Owner"),
			"fieldtype": "Link",
			"options": "User"
		},
		{
			"fieldname": "deal_owner",
			"label": __("Deal Owner"),
			"fieldtype": "Link",
			"options": "User"
		},
		{
			"fieldname": "source",
			"label": __("Source"),
			"fieldtype": "Link",
			"options": "CRM Lead Source"
		},
		{
			"fieldname": "territory",
			"label": __("Territory"),
			"fieldtype": "Link",
			"options": "CRM Territory"
		},
		{
			"fieldname": "industry",
			"label": __("Industry"),
			"fieldtype": "Link",
			"options": "CRM Industry"
		},
		{
			"fieldname": "no_of_employees",
			"label": __("No. of Employees"),
			"fieldtype": "Select",
			"options": "\n1-10\n11-50\n51-200\n201-500\n501-1000\n1000+" // Match options from DocType
		},
		{
			"fieldname": "assigned_to",
			"label": __("Assigned To"),
			"fieldtype": "Link",
			"options": "User"
		},
		{
			"fieldname": "exclude_lost",
			"label": __("Exclude Lost/Junk Stages"),
			"fieldtype": "Check",
			"default": 1
		},
		{
			"fieldname": "show_postponed",
			"label": __("Show Postponed Stages"),
			"fieldtype": "Check",
			"default": 0
		},
		// Можно добавить еще фильтры при необходимости
	],

	"onload": function(report) {
		// No need to store stageKeys anymore
		// report.report_data = { stageKeys: [] }; 

		const report_container = report.parent || report.page.main;
		if (!report_container) { 
			console.error("Cannot find report container element to observe.");
			return; 
		}

		let listener_attached = false;
		let observer = null; 

		function cleanup_listeners() {
			if (observer) observer.disconnect();
			observer = null;
		}

		function attach_chart_listener() {
			if (listener_attached) return;

			const chart_container = report_container.querySelector('.chart-container');
			if (!chart_container) return; 
			
			// Attach listener only once
			if (!chart_container.hasAttribute('data-sales-funnel-click-listener')) {
				chart_container.setAttribute('data-sales-funnel-click-listener', 'true');
				chart_container.addEventListener('click', (event) => {
					const target_element = event.target;

					if (target_element && target_element.classList.contains('bar') && target_element.hasAttribute('data-point-index')) {
						const index_str = target_element.getAttribute('data-point-index');
						const index = parseInt(index_str, 10);

						// --- Get Label and Filters ---
						let clicked_stage_label = null;
						if (report.chart && report.chart.data && report.chart.data.labels && report.chart.data.labels.length > index) {
						 	clicked_stage_label = report.chart.data.labels[index];
						} else {
						 	console.error("Could not find chart labels array on report.chart.data.labels");
							frappe.show_alert({ message: __("Could not get chart label data."), indicator: "error" });
							return; 
						}

						const original_filters = report.get_values(); 

						if (!original_filters) {
							console.error("Could not get report filters using report.get_values().");
							frappe.show_alert({ message: __("Could not get current report filters."), indicator: "error" });
							return; 
						}
						// --- End Get Label and Filters ---

						if (!isNaN(index) && clicked_stage_label) {
							
							// --- Bundle context into a single JSON string --- 
							const context_data = {
								clicked_stage_name: clicked_stage_label,
								...original_filters // Spread all original filters
							};
							const context_json = JSON.stringify(context_data);
							
							// Construct filters with only the context field
							let list_view_filters = { 
								"report_context": context_json
							};
							
							frappe.set_route("List", "Sales Funnel Report Document", list_view_filters);
							
						} else { 
							 console.error("Sales Funnel Chart: Invalid index or missing label.", { index, clicked_stage_label });
							 frappe.show_alert({ message: __("Error processing chart click (invalid data)."), indicator: "error" });
						}
					}
				});
				listener_attached = true;
				if (observer) { 
					observer.disconnect();
				}
			}
		}
		// --- End Function ---

		// --- Observer Setup ---
		observer = new MutationObserver((mutationsList) => {
			for(const mutation of mutationsList) {
				if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
					for (const node of mutation.addedNodes) {
						if (node.nodeType === Node.ELEMENT_NODE && (node.matches('.chart-container') || node.querySelector('.chart-container'))) {
							attach_chart_listener(); 
							if (listener_attached) break; 
						}
					}
				}
				if (listener_attached) break;
			}
		});

		observer.observe(report_container, { childList: true, subtree: true });

		// Initial check 
		setTimeout(attach_chart_listener, 100); 
	}
}; 