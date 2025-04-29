# -*- coding: utf-8 -*-
# Copyright (c) 2024, Your Name and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import getdate, flt, cint, nowdate, add_days, date_diff
from datetime import timedelta
from collections import OrderedDict, defaultdict
# Import the function to check telephony integrations
from crm.integrations.api import is_call_integration_enabled

# Вспомогательная функция (новая)
def get_relevant_docs_based_on_activity(initial_lead_names, initial_deal_names, period_start, period_end):
    """
    Определяет релевантные лиды и сделки на основе активности (логов) в периоде.
    Лиды: >1 лог ИЛИ (1 лог И конвертирован)
    Сделки: >=1 лог
    """
    # Use standard logger
    logger = frappe.logger("sales_funnel_conversion")
    # Use standard logger format
    # logger.error("SF_Relevance: ENTERING get_relevant_docs_based_on_activity | EntryPoints") # DEBUG ENTRY
    if not initial_lead_names and not initial_deal_names:
        return set(), set()

    all_initial_doc_names = list(set(initial_lead_names) | set(initial_deal_names))

    # 1. Получаем все логи в периоде для начального набора документов
    # Use standard logger format
    # logger.error("SF_Relevance: Attempting to fetch logs for {} docs | RelevanceDetail".format(len(all_initial_doc_names))) # DEBUG
    try:
        logs_in_period = frappe.get_all(
            "CRM Status Change Log",
            fields=["parent", "parenttype"], # Только parent нужен для подсчета
            filters={
                "parent": ("in", all_initial_doc_names),
                "creation": ("between", [period_start, period_end])
            },
        ) or [] # Ensure it's a list even if get_all returns None
        # Use standard logger format
        # logger.error(f"SF_Relevance: Fetched {len(logs_in_period)} logs in period | RelevanceDetail") # DEBUG
    except Exception as e:
        # Use standard logger format
        logger.error(f"SF_Relevance: Error fetching logs: {e} | RelevanceError")
        logs_in_period = [] # Continue with empty logs if query fails

    # 2. Считаем количество логов для каждого документа
    doc_log_counts_in_period = defaultdict(int)
    for log in logs_in_period:
        doc_log_counts_in_period[log.parent] += 1

    # 3. Получаем статус конвертации для Лидов
    lead_conversion_status = {}
    if initial_lead_names:
         # Используем стандартное поле status для проверки конвертации
        # Use standard logger format
        # logger.error("SF_Relevance: Attempting to fetch lead statuses for {} leads | RelevanceDetail".format(len(initial_lead_names))) # DEBUG
        try:
            lead_statuses = frappe.get_all("CRM Lead",
                                           filters={"name": ("in", initial_lead_names)},
                                           fields=["name", "status"])
            lead_conversion_status = {l.name: l.status for l in lead_statuses}
            # Use standard logger format
            # logger.error(f"SF_Relevance: Fetched statuses for {len(lead_conversion_status)} leads | RelevanceDetail") # DEBUG
        except Exception as e:
            # Use standard logger format
            logger.error(f"SF_Relevance: Error fetching lead statuses: {e} | RelevanceError")
            # Continue without conversion status if query fails

    # 4. Фильтруем Лиды
    relevant_lead_names = set()
    for lead_name in initial_lead_names:
        log_count = doc_log_counts_in_period.get(lead_name, 0)
        is_converted = lead_conversion_status.get(lead_name) == 'Converted'
        if log_count > 1 or (log_count == 1 and is_converted):
            relevant_lead_names.add(lead_name)

    # 5. Фильтруем Сделки
    relevant_deal_names = set()
    for deal_name in initial_deal_names:
        log_count = doc_log_counts_in_period.get(deal_name, 0)
        if log_count >= 1:
            relevant_deal_names.add(deal_name)

    # --- DEBUG LOG ---
    # Use standard logger format
    # logger.error(f"SF_Relevance: Initial Leads: {len(initial_lead_names)}, Initial Deals: {len(initial_deal_names)}, "
    #                  f"Relevant Leads: {len(relevant_lead_names)}, Relevant Deals: {len(relevant_deal_names)} | RelevanceCheck")
    # --- END DEBUG LOG ---

    return relevant_lead_names, relevant_deal_names

# Новая вспомогательная функция
def get_doc_stage_info(relevant_doc_names, all_stages_raw, period_start, period_end):
    """
    Определяет для каждого релевантного документа:
    - furthest_from_stage: Последнюю стадию, ИЗ которой был переход (до period_end)
    - entry_stage: Первую стадию, ИЗ которой был переход (внутри периода)
    """
    logger = frappe.logger("sales_funnel_conversion")
    doc_furthest_from_stage = {}
    doc_entry_stage = {}
    # Use raw keys for checking existence as filtering happens later
    all_stages_keys_raw = list(all_stages_raw.keys())

    if not relevant_doc_names:
        return doc_furthest_from_stage, doc_entry_stage

    # 1. Получаем логи для определения furthest_from_stage (до конца периода, DESC)
    # Use standard logger format
    # logger.error("SF_StageInfo: Attempting to fetch logs for furthest_from check | SF_Debug_StageInfoDetail")
    try:
        logs_for_furthest = frappe.get_all(
            "CRM Status Change Log",
            fields=["parent", "parenttype", "`from`", "creation"],
            filters={
                "parent": ("in", relevant_doc_names),
                "creation": ("<=", period_end),
            },
            order_by="parent asc, creation desc" # Сначала последние логи для каждого parent
        ) or []
        # Use standard logger format
        # logger.error(f"SF_StageInfo: Fetched {len(logs_for_furthest)} logs for furthest_from check | SF_Debug_StageInfoDetail")
    except Exception as e:
        # Use standard logger format
        logger.error(f"SF_StageInfo: Error fetching logs for furthest_from check: {e} | SF_Debug_StageInfoError")
        logs_for_furthest = []

    # Обрабатываем логи для furthest_from_stage
    processed_for_furthest = set()
    for log in logs_for_furthest:
        parent = log.parent
        if parent in processed_for_furthest:
            continue # Уже нашли самый последний 'from' для этого документа

        from_status = getattr(log, 'from') # Already filtered non-empty 'from'

        from_stage_key = f"{log.parenttype.replace('CRM ','')}_{from_status}"
        # Check against the raw list of all possible stages
        if from_stage_key in all_stages_keys_raw:
            doc_furthest_from_stage[parent] = {"stage_key": from_stage_key, "log_date": log.creation}
            processed_for_furthest.add(parent) # Отмечаем как обработанный

    # 2. Получаем логи для определения entry_stage (внутри периода, ASC)
    # Use standard logger format
    # logger.error("SF_StageInfo: Attempting to fetch logs for entry_stage check | SF_Debug_StageInfoDetail")
    try:
        logs_for_entry = frappe.get_all(
            "CRM Status Change Log",
            fields=["parent", "parenttype", "`from`", "creation"], # Get 'from' field
            filters={
                "parent": ("in", relevant_doc_names),
                "creation": ("between", [period_start, period_end]),
            },
            order_by="parent asc, creation asc" # Сначала первые логи в периоде для каждого parent
        ) or []
        # Use standard logger format
        # logger.error(f"SF_StageInfo: Fetched {len(logs_for_entry)} logs for entry_stage check | SF_Debug_StageInfoDetail")
    except Exception as e:
        # Use standard logger format
        logger.error(f"SF_StageInfo: Error fetching logs for entry_stage check: {e} | SF_Debug_StageInfoError")
        logs_for_entry = []

    # Обрабатываем логи для entry_stage
    processed_for_entry = set()
    for log in logs_for_entry:
        parent = log.parent
        if parent in processed_for_entry:
            continue # Уже нашли самый первый 'from' в периоде для этого документа

        from_status = getattr(log, 'from') # Already filtered non-empty 'from'

        from_stage_key = f"{log.parenttype.replace('CRM ','')}_{from_status}"
        # Check against the raw list of all possible stages
        if from_stage_key in all_stages_keys_raw:
            doc_entry_stage[parent] = {"stage_key": from_stage_key, "log_date": log.creation}
            processed_for_entry.add(parent) # Отмечаем как обработанный

    # Use standard logger format
    # logger.error(f"SF_StageInfo: Determined furthest_from for {len(doc_furthest_from_stage)} docs, entry_stage for {len(doc_entry_stage)} docs | SF_Debug_StageInfoResult")

    return doc_furthest_from_stage, doc_entry_stage

def execute(filters=None):
    # Use standard logger
    logger = frappe.logger("sales_funnel_conversion")
    # Use standard logger format
    # logger.error("SF_Relevance: ENTERING execute function | EntryPoints") # DEBUG ENTRY
    if not filters:
        filters = {}

    columns = get_columns()
    # get_data now returns only data and summary
    processed_data, report_summary = get_data(filters)

    chart = get_chart_data(processed_data, filters)
    report_legend = get_report_legend_html()
    # logger.error(f"SF_LegendDebug: Generated Legend HTML (first 500 chars): {report_legend[:500]}") # DEBUG LEGEND

    # Correct return order: columns, data, message (legend), chart, report_summary
    return columns, processed_data, report_legend, chart, report_summary

def get_columns():
    return [
        {"fieldname": "stage_name", "label": _("Stage"), "fieldtype": "Data", "width": 300},
        {"fieldname": "is_lost", "label": _("Is Lost Stage"), "fieldtype": "Check", "hidden": 1},
        {"fieldname": "is_postponed", "label": _("Is Postponed Stage"), "fieldtype": "Check", "hidden": 1},
        {"fieldname": "stage_count", "label": _("Count Reached"), "fieldtype": "Int", "width": 130},
        {"fieldname": "entry_count", "label": _("Entered Here (Period)"), "fieldtype": "Int", "width": 150},
        {"fieldname": "finished_here_count", "label": _("Finished Here"), "fieldtype": "Int", "width": 130},
        {"fieldname": "finished_here_percent", "label": _("% Finished (Overall)"), "fieldtype": "Percent", "width": 150},
        {"fieldname": "dropped_count_prev", "label": _("Dropped (Prev Displayed)"), "fieldtype": "Int", "width": 180},
        {"fieldname": "conversion_prev", "label": _("Conv. (Prev Displayed)"), "fieldtype": "Percent", "width": 180},
        {"fieldname": "conversion_total", "label": _("Conv. (Overall Relevant)"), "fieldtype": "Percent", "width": 180},
        {"fieldname": "churn_rate", "label": _("Churn (Prev Displayed)"), "fieldtype": "Percent", "width": 180},
        {"fieldname": "avg_time_in_stage", "label": _("Avg. Time in Stage"), "fieldtype": "Duration", "width": 180},
        {"fieldname": "avg_touches", "label": _("Avg. Touches (Lead)"), "fieldtype": "Float", "width": 180, "precision": 2}
    ]

def get_all_stages_ordered():
    """
    Fetches all lead and deal statuses ordered by position, including is_postponed flag.
    Returns an OrderedDict: {stage_key: {"name": stage_name, "is_lost": is_lost, "is_postponed": is_postponed, "type": "Lead"/"Deal"}}
    """
    stages = OrderedDict()

    lead_statuses = frappe.get_all(
        "CRM Lead Status",
        fields=["lead_status", "position", "is_lost", "is_postponed"],
        order_by="position asc"
    )
    for status in lead_statuses:
        key = f"Lead_{status.lead_status}"
        stages[key] = {
            "name": status.lead_status, 
            "is_lost": cint(status.is_lost), 
            "is_postponed": cint(status.is_postponed),
            "type": "Lead"
        }

    deal_statuses = frappe.get_all(
        "CRM Deal Status",
        fields=["deal_status", "position", "is_lost", "is_postponed"],
        order_by="position asc"
    )
    for status in deal_statuses:
        key = f"Deal_{status.deal_status}"
        stages[key] = {
            "name": status.deal_status,
            "is_lost": cint(status.is_lost), 
            "is_postponed": cint(status.is_postponed),
            "type": "Deal"
        }

    return stages

def get_data(filters):
    """
    Fetches lead/deal data, determines the furthest stage reached for each,
    filters stages based on filters, and calculates metrics.
    Returns processed data list and the filtered stages dictionary used.
    """
    # Use standard logger
    logger = frappe.logger("sales_funnel_conversion")
    # Use standard logger format
    # logger.error("SF_Relevance: ENTERING get_data function | EntryPoints") # DEBUG ENTRY
    all_stages_raw = get_all_stages_ordered()
    if not all_stages_raw:
        frappe.msgprint(_("No Lead or Deal statuses found. Please configure statuses."))
        return [], OrderedDict()

    # --- Get Date Range ---
    period_start = filters.get("from_date")
    period_end = filters.get("to_date")
    if not period_start or not period_end:
         frappe.throw(_("From Date and To Date are required"))

    # Шаг 1: Получаем НАЧАЛЬНЫЕ списки (НЕ фильтрованные по активности)
    # Get Lead conditions (includes territory, industry, source, funnel, lead_owner, employees)
    lead_conditions = get_lead_conditions(filters)
    initial_leads = frappe.get_all("CRM Lead", filters=lead_conditions, fields=["name"])
    initial_lead_names = [l.name for l in initial_leads]

    # Получаем сделки, ПРИМЕНЯЯ общие фильтры (territory, industry, source, funnel, employees)
    deal_conditions = get_deal_conditions(filters)
    # Fetch deals with filters, also get 'lead' field for mapping
    all_deals_filtered = frappe.get_all("CRM Deal", filters=deal_conditions, fields=["name", "lead"])
    initial_deal_names = [d.name for d in all_deals_filtered]
    # Create map from the *filtered* deals list
    deal_to_lead_map = {d.name: d.lead for d in all_deals_filtered if d.lead}

    # Шаг 2: Определение релевантности по активности (логи)
    # Use the pre-filtered initial lists
    relevant_lead_names, relevant_deal_names = get_relevant_docs_based_on_activity(
        initial_lead_names, initial_deal_names, period_start, period_end
    )

    # Шаг 3: Применение фильтров владельцев (ДО вычисления стадий)
    filtered_relevant_leads, filtered_relevant_deals = apply_owner_filters(
        relevant_lead_names, relevant_deal_names, filters, deal_to_lead_map
    )
    # Define the combined list after filtering
    filtered_relevant_doc_names = list(filtered_relevant_leads | filtered_relevant_deals)

    if not filtered_relevant_doc_names:
         # frappe.msgprint(_("No documents remaining after applying owner filters.")) # Optional: Keep msgprint or remove
         return [], OrderedDict()

    # Шаг 4: Определение furthest_from и entry стадий для ОТФИЛЬТРОВАННЫХ документов
    doc_furthest_from_stage, doc_entry_stage = get_doc_stage_info(
        filtered_relevant_doc_names, all_stages_raw, period_start, period_end
    )

    # Шаг 5: Расчет среднего времени в стадии для ОТФИЛЬТРОВАННЫХ документов
    avg_stage_times = calculate_average_stage_times(
        filtered_relevant_doc_names, all_stages_raw, period_start, period_end
    )

    # Шаг 6: Расчет касаний для ОТФИЛЬТРОВАННЫХ лидов/сделок
    lead_touch_counts = get_touch_counts(
        filtered_relevant_leads, filtered_relevant_deals, deal_to_lead_map, period_end
    )

    # Шаг 7: Получение всех логов для ОТФИЛЬТРОВАННЫХ документов для расчета цикла
    all_logs_for_cycle = []
    try:
        all_logs_for_cycle = frappe.get_all(
            "CRM Status Change Log",
            fields=["parent", "parenttype", "creation", "to"],
            filters={"parent": ("in", filtered_relevant_doc_names)},
            order_by="parent asc, creation asc"
        )
        # logger.error(f"SF_CycleTime: Fetched {len(all_logs_for_cycle)} logs for cycle time calculation.") # DEBUG
    except Exception as e:
        logger.error(f"SF_CycleTime: Error fetching logs for cycle time: {e}")

    # Шаг 8: Подготовка данных для таблицы (использует отфильтрованные данные)
    result_data = prepare_result_data(
        filtered_relevant_doc_names,
        doc_furthest_from_stage,
        doc_entry_stage,
        all_stages_raw,
        lead_touch_counts,
        avg_stage_times,
        filters,
        deal_to_lead_map
    )

    # Шаг 9: Расчет сводки (использует отфильтрованные данные)
    report_summary = calculate_report_summary(
        filtered_relevant_leads,
        filtered_relevant_deals,
        deal_to_lead_map,
        doc_furthest_from_stage, # Теперь на основе отфильтрованных
        all_stages_raw,
        lead_touch_counts, # Теперь на основе отфильтрованных
        period_end,
        all_logs_for_cycle # Теперь на основе отфильтрованных
    )

    return result_data, report_summary

# --- Helper Functions for get_data ---

def calculate_average_stage_times(relevant_doc_names, all_stages_raw, period_start, period_end):
    log_filters_duration = {
        "parent": ("in", relevant_doc_names),
        "creation": ("<=", period_end),
        "duration": (">", 0)
    }
    all_logs_with_duration = frappe.get_all(
        "CRM Status Change Log",
        fields=["parent", "parenttype", "creation", "`from`", "duration"],
        filters=log_filters_duration,
        order_by="parent asc, creation asc" 
    )
    stage_durations = defaultdict(lambda: {"total_duration": 0.0, "count": 0})
    for log in all_logs_with_duration:
        from_status = getattr(log, 'from')
        if not from_status: continue
        from_stage_key = f"{log.parenttype.replace('CRM ','')}_{from_status}"
        if from_stage_key in all_stages_raw:
            log_from_date = log.creation - timedelta(seconds=flt(log.duration)) if log.duration else log.creation
            if getdate(log.creation) >= getdate(period_start) and getdate(log_from_date) <= getdate(period_end):
                stage_durations[from_stage_key]["total_duration"] += flt(log.duration)
                stage_durations[from_stage_key]["count"] += 1
    avg_stage_times = {}
    for stage_key, data in stage_durations.items():
        avg_stage_times[stage_key] = data["total_duration"] / data["count"] if data["count"] > 0 else 0
    return avg_stage_times

def determine_lead_max_stage(relevant_doc_names, all_stages, deal_to_lead_map, period_end):
    # This function seems unused now after refactoring get_data
    # Can be removed if confirmed unused.
    logger = frappe.logger("sales_funnel_conversion")
    max_stage_log_filters = {
        "parent": ("in", relevant_doc_names),
        "creation": ("<=", period_end)
    }
    all_max_stage_logs = frappe.get_all(
        "CRM Status Change Log",
        fields=["parent", "parenttype", "to", "creation"],
        filters=max_stage_log_filters,
        order_by="parent asc, creation asc"
    )
    lead_max_stage = defaultdict(lambda: {"stage_key": None, "stage_details": None, "log_date": None})
    original_stage_order_keys = list(get_all_stages_ordered().keys())

    # --- REMOVE DEBUG ---
    # logs_processed_count = 0
    # --- END REMOVE DEBUG ---

    for log in all_max_stage_logs:
        # --- REMOVE DEBUG ---
        # if logs_processed_count < 5:
        #     frappe.log_error(f"Sales Funnel (determine_max): Processing log - Parent: {log.parent}, Type: {log.parenttype}, To: {log.to}, Creation: {log.creation}", "SF_Debug_RawLogs")
        #     logs_processed_count += 1
        # --- END REMOVE DEBUG ---

        potential_stage_key = f"{log.parenttype.replace('CRM ','')}_{log.to}"

        # --- REMOVE DEBUG LOG AGAIN ---
        # is_in_filtered_stages = potential_stage_key in all_stages
        # frappe.log_error(f"Sales Funnel (determine_max): Lead/Deal: {log.parent}, Log.to: \"{log.to}\", PotentialKey: {potential_stage_key}, InFilteredStages: {is_in_filtered_stages}", "SF_Debug_StageCheck")
        # --- END REMOVE DEBUG LOG AGAIN ---

        if potential_stage_key in all_stages:
            lead_name = log.parent if log.parenttype == "CRM Lead" else deal_to_lead_map.get(log.parent)
            if not lead_name: continue

            current_max = lead_max_stage[lead_name]
            new_stage_details = all_stages[potential_stage_key]
            is_new_max = False

            if not current_max["stage_key"]:
                is_new_max = True
            else:
                # Compare based on position in the *original* full list
                try:
                    current_index = original_stage_order_keys.index(current_max["stage_key"])
                    new_index = original_stage_order_keys.index(potential_stage_key)
                    if new_index > current_index:
                        is_new_max = True
                    elif new_index == current_index and log.creation > current_max["log_date"]:
                        is_new_max = True
                except ValueError:
                     # Use standard logger
                     # Use standard logger format
                     logger.error(f"Stage key error during max stage determination: {current_max.get('stage_key')} or {potential_stage_key} | SalesFunnelConversion")

            if is_new_max:
                lead_max_stage[lead_name] = { "stage_key": potential_stage_key, "stage_details": new_stage_details, "log_date": log.creation }

    return lead_max_stage
    
def apply_owner_filters(relevant_lead_names, relevant_deal_names, filters, deal_to_lead_map):
    logger = frappe.logger("sales_funnel_conversion") # Use logger
    lead_owner_filter = filters.get("lead_owner")
    assigned_to_filter = filters.get("assigned_to")
    deal_owner_filter = filters.get("deal_owner")

    # Start with copies of the original relevant sets
    filtered_relevant_leads = set(relevant_lead_names)
    filtered_relevant_deals = set(relevant_deal_names)
    # logger.error(f"SF_OwnerFilter_Debug: Initial Counts - Leads: {len(filtered_relevant_leads)}, Deals: {len(filtered_relevant_deals)}")

    if not (lead_owner_filter or assigned_to_filter or deal_owner_filter):
        return filtered_relevant_leads, filtered_relevant_deals # No filters to apply

    # Apply Lead Owner Filter (affects only leads)
    if lead_owner_filter and filtered_relevant_leads:
        owner_leads = set(frappe.get_all("CRM Lead", filters={"name": ("in", list(filtered_relevant_leads)), "lead_owner": lead_owner_filter}, pluck="name"))
        # leads_before = len(filtered_relevant_leads)
        filtered_relevant_leads &= owner_leads
        # logger.error(f"SF_OwnerFilter_Debug: After Lead Owner ({lead_owner_filter}) - Leads: {leads_before} -> {len(filtered_relevant_leads)}")
    # elif lead_owner_filter:
        # logger.error(f"SF_OwnerFilter_Debug: Lead Owner filter ({lead_owner_filter}) present but no leads to filter.")

    # Apply Assigned To Filter (affects both leads and deals)
    if assigned_to_filter:
        # leads_before = len(filtered_relevant_leads)
        # deals_before = len(filtered_relevant_deals)
        assigned_leads_final = set()
        assigned_deals_final = set()
        
        # Find all relevant docs (leads + deals) for the query
        docs_to_check_assign = list(filtered_relevant_leads | filtered_relevant_deals)
        
        if docs_to_check_assign:
            assigned_todos = frappe.get_all("ToDo",
                filters={
                    "allocated_to": assigned_to_filter, 
                    "status": ("!=", "Cancelled"),
                    "reference_type": ("in", ["CRM Lead", "CRM Deal"]),
                    "reference_name": ("in", docs_to_check_assign)
                },
                fields=["reference_type", "reference_name"], 
                distinct=True
            )
            # logger.error(f"SF_OwnerFilter_Debug: Assigned To ({assigned_to_filter}) - Found {len(assigned_todos)} ToDos.") # Log ToDo count

            leads_directly_assigned = {t.reference_name for t in assigned_todos if t.reference_type == "CRM Lead"}
            deals_directly_assigned = {t.reference_name for t in assigned_todos if t.reference_type == "CRM Deal"}
            deals_assigned_leads = {deal_to_lead_map.get(dn) 
                                    for dn in deals_directly_assigned 
                                    if deal_to_lead_map.get(dn)}
            all_assigned_leads = {lead for lead in (leads_directly_assigned | deals_assigned_leads) if lead} # Filter None

            assigned_leads_final = filtered_relevant_leads & all_assigned_leads
            assigned_deals_final = filtered_relevant_deals & deals_directly_assigned
            
            filtered_relevant_leads = assigned_leads_final
            filtered_relevant_deals = assigned_deals_final
        # else:
             # logger.error(f"SF_OwnerFilter_Debug: Assigned To ({assigned_to_filter}) - No leads or deals left to check.")
             # If nothing to check, sets should be empty
             # filtered_relevant_leads = set()
             # filtered_relevant_deals = set()
        
        # logger.error(f"SF_OwnerFilter_Debug: After Assigned To ({assigned_to_filter}) - Leads: {leads_before} -> {len(filtered_relevant_leads)}, Deals: {deals_before} -> {len(filtered_relevant_deals)}")

    # Apply Deal Owner Filter (affects both leads and deals)
    if deal_owner_filter:
        # leads_before = len(filtered_relevant_leads)
        # deals_before = len(filtered_relevant_deals)
        # Find deals matching the owner
        owned_deals_names = set(frappe.get_all("CRM Deal", 
                                            filters={"name": ("in", list(filtered_relevant_deals)), "deal_owner": deal_owner_filter}, 
                                            pluck="name"))
        # Filter the deals list directly
        filtered_relevant_deals &= owned_deals_names
        
        # Find leads whose linked deal matches the owner
        leads_whose_deal_is_owned = {lead 
                                     for deal, lead in deal_to_lead_map.items() 
                                     if deal in owned_deals_names and lead}
                                     
        # Filter the leads list 
        filtered_relevant_leads &= leads_whose_deal_is_owned
        # logger.error(f"SF_OwnerFilter_Debug: After Deal Owner ({deal_owner_filter}) - Leads: {leads_before} -> {len(filtered_relevant_leads)}, Deals: {deals_before} -> {len(filtered_relevant_deals)}. Found {len(owned_deals_names)} owned deals.")

    # --- DEBUG LOG --- 
    # logger.error(f"SF_OwnerFilter: After owner filters - Leads: {len(filtered_relevant_leads)}, Deals: {len(filtered_relevant_deals)} | SF_Debug_OwnerFilterResult")
    # --- END DEBUG LOG ---

    return filtered_relevant_leads, filtered_relevant_deals

def get_touch_counts(filtered_relevant_leads, filtered_relevant_deals, deal_to_lead_map, period_end):
    """
    Calculates touch counts (Comm+Call) for relevant leads,
    including touches via linked relevant deals.
    Excludes Phone Comm if telephony is active.
    """
    # TODO: Adapt this function to work with relevant_leads and relevant_deals sets
    lead_touch_counts = defaultdict(int)
    logger = frappe.logger("sales_funnel_conversion") # Use logger
    # Combine relevant leads and deals names for the query filter
    # Use the filtered sets directly
    relevant_lead_names_set = set(filtered_relevant_leads)
    relevant_deal_names_set = set(filtered_relevant_deals)
    # Get names of deals linked to relevant leads (even if deal itself wasn't relevant by activity)
    # This ensures touches on deals linked to relevant leads are counted.
    # However, we should only query for deals that ARE relevant or linked to relevant leads.
    # Let's query Communications/Calls for all filtered leads AND filtered deals.
    relevant_doc_names = list(relevant_lead_names_set | relevant_deal_names_set)
    if not relevant_doc_names:
        return lead_touch_counts

    # Check which integrations are enabled
    try:
        integration_status = is_call_integration_enabled()
        is_telephony_logging_active = integration_status.get('twilio_enabled') or \
                                      integration_status.get('exotel_enabled') or \
                                      integration_status.get('beeline_enabled')
    except Exception as e:
        # Use standard logger format
        logger.error(f"Could not check telephony integration status: {e} | SalesFunnelConversionReport")
        is_telephony_logging_active = False

    # Get Communication counts
    # Get Communication counts for relevant leads and deals
    comm_filters = {
        "reference_doctype": ("in", ["CRM Lead", "CRM Deal"]),
        "reference_name": ("in", relevant_doc_names),
        "creation": ("<=", period_end)
    }
    if is_telephony_logging_active:
        comm_filters["communication_medium"] = ("!=", "Phone") # Exclude Phone comms if integration logs calls

    # Use standard logger format
    # Aggregate counts, mapping deals back to leads if possible
    comm_counts_list = []
    try:
        comm_counts_list = frappe.get_all("Communication", filters=comm_filters, fields=["reference_doctype", "reference_name", "count(*) as count"], group_by="reference_doctype, reference_name", as_list=False) or []
        # logger.error(f"SF_Touches: Fetched {len(comm_counts_list)} Communication groups. | SF_Debug_TouchesDetail")
    except Exception as e:
        logger.error(f"SF_Touches: Error fetching Communications: {e} | SF_Debug_TouchesError")
        # comm_counts_list = [] # Already initialized

    for comm in comm_counts_list:
        lead_name = None # Initialize lead_name for each loop iteration
        if comm.reference_doctype == "CRM Lead":
            lead_name = comm.reference_name
        elif comm.reference_doctype == "CRM Deal": # Handle deals
             lead_name = deal_to_lead_map.get(comm.reference_name)

        # Add touch count ONLY if the determined lead is in the filtered relevant lead set
        if lead_name and lead_name in relevant_lead_names_set:
             lead_touch_counts[lead_name] += comm.count

    # Get CRM Call Log counts (always include)
    # Get CRM Call Log counts for relevant leads and deals
    call_filters = [
        ["reference_doctype", "in", ["CRM Lead", "CRM Deal"]],
        ["reference_docname", "in", relevant_doc_names],
        ["creation", "<=", period_end]
    ]
    # Use standard logger format
    # Aggregate counts, mapping deals back to leads if possible
    call_log_counts_list = []
    try:
        call_log_counts_list = frappe.get_all("CRM Call Log", filters=call_filters, fields=["reference_doctype", "reference_docname", "count(*) as count"], group_by="reference_doctype, reference_docname", as_list=False) or []
        # logger.error(f"SF_Touches: Fetched {len(call_log_counts_list)} CRM Call Log groups. | SF_Debug_TouchesDetail")
    except Exception as e:
        logger.error(f"SF_Touches: Error fetching CRM Call Logs: {e} | SF_Debug_TouchesError")
        # call_log_counts_list = [] # Already initialized

    for call in call_log_counts_list:
        lead_name = None # Initialize lead_name for each loop iteration
        if call.reference_doctype == "CRM Lead":
            lead_name = call.reference_docname
        elif call.reference_doctype == "CRM Deal": # Handle deals
             lead_name = deal_to_lead_map.get(call.reference_docname)

        # Add touch count ONLY if the determined lead is in the filtered relevant lead set
        if lead_name and lead_name in relevant_lead_names_set:
             lead_touch_counts[lead_name] += call.count

    # Use standard logger format
    # logger.error(f"SF_Touches: Calculated touch counts for {len(lead_touch_counts)} leads. | SF_Debug_TouchesResult")
    return lead_touch_counts


def prepare_result_data(filtered_relevant_doc_names, doc_furthest_from_stage, doc_entry_stage, all_stages_raw, lead_touch_counts, avg_stage_times, filters, deal_to_lead_map):
    """Prepares the final list of dictionaries for the report table based on new logic."""
    logger = frappe.logger("sales_funnel_conversion") # Use logger

    if not all_stages_raw or not filtered_relevant_doc_names:
        return []

    all_stage_keys_raw = list(all_stages_raw.keys())
    first_stage_key_raw = all_stage_keys_raw[0] if all_stage_keys_raw else None

    # --- Calculate Counts --- 
    stage_counts = OrderedDict([(key, 0) for key in all_stage_keys_raw])
    entry_stage_counts = OrderedDict([(key, 0) for key in all_stage_keys_raw])
    finished_here_counts = OrderedDict([(key, 0) for key in all_stage_keys_raw]) # New counter
    stage_total_touches = OrderedDict([(key, 0) for key in all_stage_keys_raw])

    # Calculate counts based on furthest_from and entry stages
    for doc_name in filtered_relevant_doc_names:
        furthest_info = doc_furthest_from_stage.get(doc_name)
        entry_info = doc_entry_stage.get(doc_name)

        # Count cumulative stages reached (up to furthest_from)
        if furthest_info and furthest_info["stage_key"] in all_stage_keys_raw:
            # Count for "Finished Here"
            finished_here_counts[furthest_info["stage_key"]] += 1 
            # Cumulative Count Reached
            try:
                furthest_index = all_stage_keys_raw.index(furthest_info["stage_key"])
                # Aggregate touches - find the lead name (moved here for efficiency)
                original_lead_name = doc_name if doc_name.startswith("CRM-LEAD-") else deal_to_lead_map.get(doc_name)
                touches = lead_touch_counts.get(original_lead_name, 0) if original_lead_name else 0
                
                for i in range(furthest_index + 1):
                    stage_key_to_count = all_stage_keys_raw[i]
                    stage_counts[stage_key_to_count] += 1
                    stage_total_touches[stage_key_to_count] += touches
            except ValueError:
                pass # Stage key not found

        # Count entry stage
        if entry_info and entry_info["stage_key"] in all_stage_keys_raw:
             entry_stage_counts[entry_info["stage_key"]] += 1

    total_relevant_docs_in_funnel = stage_counts.get(first_stage_key_raw, 0) if first_stage_key_raw else 0

    # --- Determine Display Stages --- 
    exclude_lost = filters.get("exclude_lost", 0)
    show_postponed = filters.get("show_postponed", 0)
    display_stages = OrderedDict()

    if show_postponed:
        # Show ONLY the first stage + all postponed stages
        if first_stage_key_raw:
            display_stages[first_stage_key_raw] = all_stages_raw[first_stage_key_raw]
            for key, stage_info in all_stages_raw.items():
                if stage_info["is_postponed"] and key != first_stage_key_raw:
                    display_stages[key] = stage_info
    else:
        # Standard mode: Show active funnel
        for key, stage_info in all_stages_raw.items():
            if stage_info["is_lost"] and exclude_lost:
                continue # Correct indentation for continue
            if stage_info["is_postponed"]:
                continue # Correctly indented now
            display_stages[key] = stage_info

    # --- Prepare Result Rows --- 
    result_data = []
    display_stage_keys = list(display_stages.keys())

    for i, stage_key in enumerate(display_stage_keys):
        stage_info = display_stages[stage_key]
        current_total_count = stage_counts.get(stage_key, 0)
        current_entry_count = entry_stage_counts.get(stage_key, 0)
        current_finished_count = finished_here_counts.get(stage_key, 0) # Get finished count
        current_total_touches_agg = stage_total_touches.get(stage_key, 0)

        # Find previous *displayed* stage count
        count_at_previous_displayed_stage = total_relevant_docs_in_funnel # Default for first displayed stage
        if i > 0:
            prev_display_stage_key = display_stage_keys[i-1]
            count_at_previous_displayed_stage = stage_counts.get(prev_display_stage_key, 0)

        # Calculate metrics
        conv_total = (flt(current_total_count) / flt(total_relevant_docs_in_funnel)) * 100 if total_relevant_docs_in_funnel > 0 else 0
        conv_prev, dropped_count, churn = 0, 0, 0

        # Metrics relative to the PREVIOUS DISPLAYED stage shown
        if count_at_previous_displayed_stage > 0:
            conv_prev = (flt(current_total_count) / flt(count_at_previous_displayed_stage)) * 100
            dropped_count = max(0, count_at_previous_displayed_stage - current_total_count)
            churn = (flt(dropped_count) / flt(count_at_previous_displayed_stage)) * 100
        elif i == 0 and current_total_count > 0: # Handle first stage conversion
             conv_prev = 100.0

        # New Metric: % Finished Here (Overall)
        finished_percent = (flt(current_finished_count) / flt(total_relevant_docs_in_funnel) * 100) if total_relevant_docs_in_funnel > 0 else 0
        avg_touches_calc = flt(current_total_touches_agg) / flt(current_total_count) if current_total_count > 0 else 0

        result_data.append({
            "stage_key": stage_key,
            "stage_name": f"[{_(stage_info['type'])}] {_(stage_info['name'])}",
            "is_lost": stage_info["is_lost"],
            "is_postponed": stage_info["is_postponed"],
            "stage_count": current_total_count,
            "entry_count": current_entry_count,
            "finished_here_count": current_finished_count, # Add finished count
            "finished_here_percent": finished_percent, # Add finished percent
            "dropped_count_prev": dropped_count,
            "conversion_prev": conv_prev,
            "conversion_total": conv_total,
            "churn_rate": max(0, churn),
            "avg_time_in_stage": avg_stage_times.get(stage_key, 0),
            "avg_touches": avg_touches_calc
        })

    return result_data

# --- Remaining Report Functions ---

# Renamed and specific to leads
def get_lead_conditions(filters):
    """Gets conditions for the initial lead query.
       Includes common filters (territory, industry), lead-specific (source, funnel, owner, employees).
    """
    conditions = {}
    if filters.get("sales_funnel"): # Lead specific
        conditions["sales_funnel"] = filters["sales_funnel"]
    if filters.get("source"): # Lead specific
        conditions["source"] = filters["source"]
    if filters.get("territory"): # Common
        conditions["territory"] = filters["territory"]
    if filters.get("industry"): # Common
        conditions["industry"] = filters["industry"]
    if filters.get("no_of_employees"): # Lead specific
        conditions["no_of_employees"] = filters["no_of_employees"]
    if filters.get("lead_owner"): # Lead specific (applied early)
        conditions["lead_owner"] = filters["lead_owner"]
    # Exclude date and other owner filters (deal_owner, assigned_to) - handled later
    return conditions

# New function for deal conditions
def get_deal_conditions(filters):
    """Gets conditions for the initial deal query.
       Includes common filters (territory, industry, source, sales_funnel, no_of_employees).
    """
    conditions = {}
    if filters.get("territory"): # Common
        conditions["territory"] = filters["territory"]
    if filters.get("industry"): # Common
        conditions["industry"] = filters["industry"]
    if filters.get("source"): # Common - Apply to Deal's source field
        conditions["source"] = filters["source"]
    if filters.get("sales_funnel"): # Exists in Deal doctype
        conditions["sales_funnel"] = filters["sales_funnel"]
    if filters.get("no_of_employees"): # Exists in Deal doctype
        conditions["no_of_employees"] = filters["no_of_employees"]

    # Exclude date and owner filters
    return conditions


def get_chart_data(data, filters):
    if not data:
        return None

    labels = []
    counts = []
    stage_keys = [] 
    
    for d in data:
        # Extract label (remove type prefix)
        label = d["stage_name"].split("]", 1)[-1].strip() if "]" in d["stage_name"] else d["stage_name"]
        labels.append(label)
        counts.append(d["stage_count"])
        # Get the stage_key added in prepare_result_data
        stage_keys.append(d.get("stage_key", None))

    return {
        "data": {
            "labels": labels, 
            "datasets": [{'name': _('Count Reaching Stage'), 'values': counts}] 
        },
        "type": "bar", 
        "height": 350, 
        "colors": ['#00A2E8'],
        # Add custom options for click handling in JS
        "options": {
            "stageKeys": stage_keys,
            "reportFilters": filters 
        },
        # Add stageKeys at top level for easier JS access
        "stageKeys": stage_keys 
        # We will add the click handler in the JS file
    }

# New function to calculate summary based on new logic
def calculate_report_summary(filtered_relevant_leads, filtered_relevant_deals, deal_to_lead_map, doc_furthest_from_stage, all_stages_raw, lead_touch_counts, period_end, all_logs):
    summary = []
    logger = frappe.logger("sales_funnel_conversion") # Use logger

    # Group logs by parent for easier access
    logs_by_parent = defaultdict(list)
    for log in all_logs:
        logs_by_parent[log.parent].append(log)

    # --- Find Last Positive Deal Stage --- 
    last_positive_deal_stage_key = None
    for key, info in reversed(all_stages_raw.items()): # Iterate backwards
        if info["type"] == "Deal" and not info["is_lost"] and not info["is_postponed"]:
            last_positive_deal_stage_key = key
            break # Found the last one

    # 1. Total Unique Entries
    relevant_deal_leads = {deal_to_lead_map.get(deal_name) for deal_name in filtered_relevant_deals if deal_to_lead_map.get(deal_name)}
    non_converted_or_untracked_leads = {lead for lead in filtered_relevant_leads if lead not in relevant_deal_leads}
    total_unique_entries = len(non_converted_or_untracked_leads) + len(filtered_relevant_deals)
    summary.append({"value": total_unique_entries, "label": _("Unique Entries"), "datatype": "Int"})

    # 2. Total Deals Closed (Reached Last Positive Stage)
    closed_deals = set()
    if last_positive_deal_stage_key:
        for deal_name in filtered_relevant_deals:
            furthest_info = doc_furthest_from_stage.get(deal_name)
            # Count if furthest stage reached IS the last positive one
            if furthest_info and furthest_info["stage_key"] == last_positive_deal_stage_key:
                closed_deals.add(deal_name)
    total_closed_deals = len(closed_deals)
    summary.append({"value": total_closed_deals, "label": _("Deals Closed"), "datatype": "Int"})

    # Calculate Lead Conversion Rate specific data first
    total_relevant_leads = len(filtered_relevant_leads)
    # converted_leads_for_touches = {lead for lead in filtered_relevant_leads if lead in relevant_deal_leads}
    # Use the already computed relevant_deal_leads to find converted leads accurately
    converted_leads_for_touches = filtered_relevant_leads & relevant_deal_leads # Intersection
    total_converted_leads = len(converted_leads_for_touches)

    # 3. Lead Conversion Rate (Moved Up)
    lead_conversion_rate = (flt(total_converted_leads) / flt(total_relevant_leads) * 100) if total_relevant_leads > 0 else 0
    summary.append({"value": flt(f"{lead_conversion_rate:.2f}"), "label": _("Lead Conversion Rate"), "datatype": "Percent"})

    # 4. Overall Conversion Rate (to Close)
    conversion_rate = (flt(total_closed_deals) / flt(total_unique_entries) * 100) if total_unique_entries > 0 else 0
    summary.append({"value": flt(f"{conversion_rate:.2f}"), "label": _("Close Rate"), "datatype": "Percent", "indicator": "Green" if conversion_rate > 0 else "Red"})

    # 5. Average Touches (Lead Conversion - Leads converted to relevant deals)
    total_touches_conversion = 0
    valid_touch_leads_conversion_count = 0
    # touches_details_conv = [] # Debug
    for lead_name in converted_leads_for_touches:
        touches = lead_touch_counts.get(lead_name)
        if touches is not None:
            # touches_details_conv.append(f"{lead_name}: {touches}") # Debug
            total_touches_conversion += touches
            valid_touch_leads_conversion_count += 1
    avg_touches_conversion = flt(total_touches_conversion) / flt(valid_touch_leads_conversion_count) if valid_touch_leads_conversion_count > 0 else 0
    # logger.error(f"SF_SummaryTouches (Lead Conv): Found {valid_touch_leads_conversion_count} leads out of {total_converted_leads} converted leads with touches. Total: {total_touches_conversion}. Details: {touches_details_conv[:5]}") # DEBUG
    summary.append({"value": f"{avg_touches_conversion:.2f}", "label": _("Avg. Touches (Lead Conv.)"), "datatype": "Float"})

    # 6. Average Touches (Closed Deals - Deal Phase Only)
    avg_touches_closed = 0
    total_touches_closed_deals = 0 # Initialize
    # comm_counts_closed_debug = [] # Debug
    # call_log_counts_closed_debug = [] # Debug

    if closed_deals:
        closed_deals_list = list(closed_deals)
        deal_touch_counts = defaultdict(int)
        try:
            integration_status = is_call_integration_enabled()
            is_telephony_logging_active = integration_status.get('twilio_enabled') or \
                                          integration_status.get('exotel_enabled') or \
                                          integration_status.get('beeline_enabled')
        except Exception as e:
            logger.error(f"SF_SummaryTouches: Could not check telephony integration status: {e}")
            is_telephony_logging_active = False

        # Get Communication counts for CLOSED DEALS ONLY
        comm_filters_closed = {
            "reference_doctype": "CRM Deal",
            "reference_name": ("in", closed_deals_list),
            "creation": ("<=", period_end)
        }
        if is_telephony_logging_active:
            comm_filters_closed["communication_medium"] = ("!=", "Phone")
        try:
            comm_counts_closed = frappe.get_all("Communication", filters=comm_filters_closed, fields=["reference_name", "count(*) as count"], group_by="reference_name")
            # comm_counts_closed_debug = comm_counts_closed # Debug
            for comm in comm_counts_closed:
                deal_touch_counts[comm.reference_name] += comm.count
        except Exception as e:
             logger.error(f"SF_SummaryTouches: Error fetching Communications for closed deals: {e}")

        # Get CRM Call Log counts for CLOSED DEALS ONLY
        call_filters_closed = [
            ["reference_doctype", "=", "CRM Deal"],
            ["reference_docname", "in", closed_deals_list],
            ["creation", "<=", period_end]
        ]
        try:
            call_log_counts_closed = frappe.get_all("CRM Call Log", filters=call_filters_closed, fields=["reference_docname", "count(*) as count"], group_by="reference_docname")
            # call_log_counts_closed_debug = call_log_counts_closed # Debug
            for call in call_log_counts_closed:
                deal_touch_counts[call.reference_docname] += call.count
        except Exception as e:
             logger.error(f"SF_SummaryTouches: Error fetching CRM Call Logs for closed deals: {e}")

        # Calculate average
        total_touches_closed_deals = sum(deal_touch_counts.values())
        avg_touches_closed = flt(total_touches_closed_deals) / flt(len(closed_deals)) if closed_deals else 0
    
    # logger.error(f"SF_SummaryTouches (Closed): Found {total_touches_closed_deals} direct touches for {len(closed_deals)} closed deals. Comm Results: {comm_counts_closed_debug[:5]}. Call Results: {call_log_counts_closed_debug[:5]}") # DEBUG
    summary.append({"value": f"{avg_touches_closed:.1f}", "label": _("Avg. Touches (Closed)"), "datatype": "Float"})

    # 7. Average Sales Cycle (Closed Deals)
    total_cycle_days = 0
    cycle_calculated_count = 0
    # cycle_details_debug = [] # Debug

    if closed_deals and last_positive_deal_stage_key: # Need closed deals and the target stage
        for deal_name in closed_deals:
            lead_name = deal_to_lead_map.get(deal_name)
            
            # Get logs for this deal and potentially its lead
            current_logs = logs_by_parent.get(deal_name, [])
            if lead_name:
                current_logs.extend(logs_by_parent.get(lead_name, []))
            
            if not current_logs:
                continue
                
            # Sort combined logs by creation date
            current_logs.sort(key=lambda x: x.creation)
            
            start_date = current_logs[0].creation
            end_date = None
            
            # Find the latest log entry that matches the closing stage for the DEAL
            for log in reversed(current_logs):
                # Important: Check parenttype is Deal and status matches
                if log.parent == deal_name and log.parenttype == "CRM Deal":
                     stage_key = f"Deal_{log.to}"
                     if stage_key == last_positive_deal_stage_key:
                         end_date = log.creation
                         break # Found the latest closing log for the deal
            
            if start_date and end_date:
                cycle_days = date_diff(getdate(end_date), getdate(start_date))
                if cycle_days >= 0: # Ensure valid duration
                    total_cycle_days += cycle_days
                    cycle_calculated_count += 1
                    # if cycle_calculated_count <= 5: # Debug log first 5
                        # cycle_details_debug.append(f"{deal_name}({lead_name}): {cycle_days} days")
            # else: # Debugging logs for missing start/end
                # logger.warning(f"SF_CycleTime: Could not determine cycle for {deal_name}. Start: {start_date}, End: {end_date}")

    avg_cycle_days = flt(total_cycle_days) / flt(cycle_calculated_count) if cycle_calculated_count > 0 else 0
    # logger.error(f"SF_CycleTime: Calculated avg cycle for {cycle_calculated_count} deals. Avg: {avg_cycle_days:.2f} days. Details: {cycle_details_debug}") # DEBUG
    summary.append({"value": f"{avg_cycle_days:.1f}", "label": _("Avg. Cycle (Closed)"), "datatype": "Float"}) # Displaying as Float (days)
    
    return summary 

# Helper function for legend item HTML generation
def _generate_legend_item_html(item):
    """Generates HTML for a single legend item."""
    title = item['title']
    desc = item['desc']
    if title.startswith('---'):
        # Separator styling
        return f'<li style="margin-top: 15px; margin-bottom: 10px; font-weight: bold; list-style: none;">{title.replace("---", "").strip()}</li>'
    else:
        # Item styling (term + description with spacing)
        return (
            f'<li style="margin-bottom: 12px;">'
            f'  <div style="font-weight: bold; margin-bottom: 3px;">{title}</div>'
            f'  <div>{desc}</div>'
            f'</li>'
        )

def get_report_legend_html():
    """Returns a collapsible HTML string with explanations for report columns and summary items."""
    legend_definitions = [
        # --- Filters --- 
        {'title': _('Exclude Lost/Junk Stages (Filter)'), 'desc': _('If checked (and "Show Postponed" is unchecked), stages marked as "Lost/Junk" are excluded from the funnel view and calculations. This filter has no effect if "Show Postponed" is checked.')},
        {'title': _('Show Postponed Stages (Filter)'), 'desc': _('If checked, the report ONLY shows the first stage and any stages marked as "Postponed". Metrics for postponed stages (Conv. Prev, Dropped, Churn) are calculated relative to the first stage count. If unchecked, the report shows the standard active funnel (respecting the "Exclude Lost" filter).')},
        # --- Summary --- 
        {'title': _('--- Summary ---'), 'desc': ''},
        {'title': _('Unique Entries'), 'desc': _('Estimated number of unique opportunities (non-converted leads + deals) relevant to the selected filters and period.')},
        {'title': _('Deals Closed'), 'desc': _('Number of relevant deals that reached the *last defined active* (not lost/postponed) deal status within the analysis scope.')},
        {'title': _('Lead Conversion Rate'), 'desc': _('Percentage of relevant leads that were converted into relevant deals. (Relevant Leads Converted / Total Relevant Leads) * 100%.')},
        {'title': _('Close Rate'), 'desc': _('("Deals Closed" / "Unique Entries") * 100%.')},
        {'title': _('Avg. Touches (Lead Conv.)'), 'desc': _('Average number of total touches (from Lead+Deal phases, associated with the Lead) for relevant leads that were converted into relevant deals.')},
        {'title': _('Avg. Touches (Closed)'), 'desc': _('Average number of touches (Communications + Call Logs) logged *directly* against the Deal document for deals that were successfully closed (reached the last active status).')},
        {'title': _('Avg. Cycle (Closed)'), 'desc': _('Average duration in days from the very first status log (Lead or Deal) to the log confirming the deal reached the last active status.')},
        # --- Columns --- 
        {'title': _('--- Columns ---'), 'desc': ''},
        {'title': _('Count Reached'), 'desc': _('Cumulative count of unique documents (leads/deals) that reached this stage or any subsequent stage, based on the furthest progress log before the period end.')},
        {'title': _('Entered Here (Period)'), 'desc': _('Count of unique documents (leads/deals) for which the *first* status change log *within the selected period* indicated a move *from* this stage.')},
        # New Column Descriptions
        {'title': _('Finished Here'), 'desc': _('Absolute count of documents whose progress ended at this specific stage (their last recorded status change was *from* this stage).')},
        {'title': _('% Finished (Overall)'), 'desc': _('("Finished Here"[Current Stage] / "Count Reached"[First Displayed Stage]) * 100%. Percentage of documents entering the funnel that finished at this stage.')},
        # Existing Column Descriptions
        {'title': _('Dropped (Prev Displayed)'), 'desc': _('Absolute number difference between the "Count Reached" of the *previous displayed* stage and this stage. Helps identify bottlenecks between visible stages.')},
        {'title': _('Conv. (Prev Displayed)'), 'desc': _('("Count Reached"[Current Stage] / "Count Reached"[Previous Displayed Stage]) * 100%. Shows the progression rate between consecutive *visible* stages.')},
        {'title': _('Conv. (Overall Relevant)'), 'desc': _('("Count Reached"[Current Stage] / "Count Reached"[First Displayed Stage]) * 100%. Shows the progression relative to the start of the *visible* funnel.')},
        {'title': _('Churn (Prev Displayed)'), 'desc': _('("Dropped (Prev Displayed)" / "Count Reached"[Previous Displayed Stage]) * 100%. Shows the percentage drop-off between consecutive *visible* stages.')},
        {'title': _('Avg. Time in Stage'), 'desc': _('Average time (seconds) spent in this specific stage before moving to the next, calculated based on logs with duration within the period end. Note: Calculation might be approximate.')},
        {'title': _('Avg. Touches (Lead)'), 'desc': _('Average number of total touches (from Lead+Deal phases, associated with the Lead) for documents that reached *at least* this stage.')}, # Clarified description slightly
    ]

    # Separate filter definitions
    filter_defs = legend_definitions[:2]
    remaining_defs = legend_definitions[2:]

    # Generate HTML for filters section using the helper
    filters_html_items = "".join([_generate_legend_item_html(item) for item in filter_defs])
    filters_html = f'<ul style="margin-bottom: 15px; padding-left: 20px; list-style: none;">{filters_html_items}</ul>'

    # Split remaining for columns
    # Now 7 summary items + 1 separator = 8 summary section items
    # Now 10 column items + 1 separator = 11 column section items
    # Total items = 2 filters + 8 summary + 11 columns = 21 items
    # Split after filters + summary = 2 + 8 = 10 items
    mid_point = 10 # Keep split point after summary section
    col1_defs = remaining_defs[:mid_point] # Filters + Summary
    col2_defs = remaining_defs[mid_point:] # Columns

    # Generate HTML for columns using the helper
    col1_html_items = "".join([_generate_legend_item_html(item) for item in col1_defs])
    col1_html = f'<ul style="margin-bottom: 0; padding-left: 20px; list-style: none;">{col1_html_items}</ul>'

    col2_html_items = "".join([_generate_legend_item_html(item) for item in col2_defs])
    col2_html = f'<ul style="margin-bottom: 0; padding-left: 20px; list-style: none;">{col2_html_items}</ul>'

    # Combine into final structure
    legend_title_text = _('Legend')
    html = (
        '<details style="background-color: var(--card-bg); border: 1px solid var(--border-color); border-radius: 5px; margin-top: 25px; padding: 15px;">\n'
        f'  <summary style="cursor: pointer; font-weight: bold; margin-bottom: 10px;">{legend_title_text}</summary>\n'
        '  <div>\n' # Content div
        f'    <div>{filters_html}</div>\n'
        '    <div style="display: flex; flex-wrap: wrap; border-top: 1px solid var(--border-color); padding-top: 15px; margin-top: 15px;">\n'
        f'      <div style="flex: 1; min-width: 300px; padding-right: 10px;">{col1_html}</div>\n'
        f'      <div style="flex: 1; min-width: 300px; padding-left: 10px; padding-right: 10px;">{col2_html}</div>\n'
        '    </div>\n'
        '  </div>\n'
        '</details>'
    )
    return html 