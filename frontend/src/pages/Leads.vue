<template>
  <LayoutHeader>
    <template #left-header>
      <ViewBreadcrumbs v-model="viewControls" routeName="Leads" />
    </template>
    <template #right-header>
      <div class="flex items-center gap-4">
        <SmartFilterField
          v-if="!isMobileView"
          ref="desktopSmartFilter"
          doctype="CRM Lead"
          @update:filters="handleSmartFilter"
          class="w-80"
        />
        <CustomActions
          v-if="leadsListView?.customListActions"
          :actions="leadsListView.customListActions"
        />
        <Button
          variant="solid"
          :label="__('Create')"
          @click="showLeadModal = true"
        >
          <template #prefix><FeatherIcon name="plus" class="h-4" /></template>
        </Button>
      </div>
    </template>
  </LayoutHeader>
  <div v-if="isMobileView" class="px-3 py-2 border-b">
    <SmartFilterField
      ref="mobileSmartFilter"
      doctype="CRM Lead"
      @update:filters="handleSmartFilter"
      class="w-full"
    />
  </div>
  <ViewControls
    ref="viewControls"
    v-model="leads"
    v-model:loadMore="loadMore"
    v-model:resizeColumn="triggerResize"
    v-model:updatedPageCount="updatedPageCount"
    doctype="CRM Lead"
    :filters="{ converted: 0 }"
    :options="{
      allowedViews: ['list', 'group_by', 'kanban'],
    }"
  >
    <template #filter-section>
      <div v-if="isMobileView" class="w-full px-3 py-2 border-b">
        <SmartFilterField
          ref="mobileSmartFilter"
          doctype="CRM Lead"
          @update:filters="handleSmartFilter"
          class="w-full"
        />
      </div>
    </template>
  </ViewControls>
  <KanbanView
    v-if="route.params.viewType == 'kanban'"
    v-model="leads"
    :options="{
      getRoute: (row) => ({
        name: 'Lead',
        params: { leadId: row.name },
        query: { view: route.query.view, viewType: route.params.viewType },
      }),
      onNewClick: (column) => onNewClick(column),
    }"
    @update="(data) => viewControls.updateKanbanSettings(data)"
    @loadMore="(columnName) => viewControls.loadMoreKanban(columnName)"
  >
    <template #title="{ titleField, itemName }">
      <div class="flex items-center gap-2">
        <div v-if="titleField === 'status'">
          <IndicatorIcon :class="getRow(itemName, titleField).color" />
        </div>
        <div
          v-else-if="
            titleField === 'organization' && getRow(itemName, titleField).label
          "
        >
          <Avatar
            class="flex items-center"
            :image="getRow(itemName, titleField).logo"
            :label="getRow(itemName, titleField).label"
            size="sm"
          />
        </div>
        <div
          v-else-if="
            titleField === 'lead_name' && getRow(itemName, titleField).label
          "
        >
          <Avatar
            class="flex items-center"
            :image="getRow(itemName, titleField).image"
            :label="getRow(itemName, titleField).image_label"
            size="sm"
          />
        </div>
        <div
          v-else-if="
            titleField === 'lead_owner' &&
            getRow(itemName, titleField).full_name
          "
        >
          <Avatar
            class="flex items-center"
            :image="getRow(itemName, titleField).user_image"
            :label="getRow(itemName, titleField).full_name"
            size="sm"
          />
        </div>
        <div v-else-if="titleField === 'mobile_no'">
          <PhoneIcon class="h-4 w-4" />
        </div>
        <div
          v-if="
            [
              'modified',
              'creation',
              'first_response_time',
              'first_responded_on',
              'response_by',
            ].includes(titleField)
          "
          class="truncate text-base"
        >
          <Tooltip :text="getRow(itemName, titleField).label">
            <div>{{ getRow(itemName, titleField).timeAgo }}</div>
          </Tooltip>
        </div>
        <div v-else-if="titleField === 'sla_status'" class="truncate text-base">
          <Badge
            v-if="getRow(itemName, titleField).value"
            :variant="'subtle'"
            :theme="getRow(itemName, titleField).color"
            size="md"
            :label="getRow(itemName, titleField).value"
          />
        </div>
        <div
          v-else-if="getRow(itemName, titleField).label"
          class="truncate text-base"
        >
          {{ getRow(itemName, titleField).label }}
        </div>
        <div class="text-ink-gray-4" v-else>{{ __('No Title') }}</div>
      </div>
    </template>
    <template #fields="{ fieldName, itemName }">
      <div
        v-if="getRow(itemName, fieldName).label"
        class="truncate flex items-center gap-2"
      >
        <div v-if="fieldName === 'status'">
          <IndicatorIcon :class="getRow(itemName, fieldName).color" />
        </div>
        <div
          v-else-if="
            fieldName === 'organization' && getRow(itemName, fieldName).label
          "
        >
          <Avatar
            class="flex items-center"
            :image="getRow(itemName, fieldName).logo"
            :label="getRow(itemName, fieldName).label"
            size="xs"
          />
        </div>
        <div v-else-if="fieldName === 'lead_name'">
          <Avatar
            v-if="getRow(itemName, fieldName).label"
            class="flex items-center"
            :image="getRow(itemName, fieldName).image"
            :label="getRow(itemName, fieldName).image_label"
            size="xs"
          />
        </div>
        <div v-else-if="fieldName === 'lead_owner'">
          <Avatar
            v-if="getRow(itemName, fieldName).full_name"
            class="flex items-center"
            :image="getRow(itemName, fieldName).user_image"
            :label="getRow(itemName, fieldName).full_name"
            size="xs"
          />
        </div>
        <div
          v-if="
            [
              'modified',
              'creation',
              'first_response_time',
              'first_responded_on',
              'response_by',
            ].includes(fieldName)
          "
          class="truncate text-base"
        >
          <Tooltip :text="getRow(itemName, fieldName).label">
            <div>{{ getRow(itemName, fieldName).timeAgo }}</div>
          </Tooltip>
        </div>
        <div v-else-if="fieldName === 'sla_status'" class="truncate text-base">
          <Badge
            v-if="getRow(itemName, fieldName).value"
            :variant="'subtle'"
            :theme="getRow(itemName, fieldName).color"
            size="md"
            :label="getRow(itemName, fieldName).value"
          />
        </div>
        <div v-else-if="fieldName === '_assign'" class="flex items-center">
          <MultipleAvatar
            :avatars="getRow(itemName, fieldName).label"
            size="xs"
          />
        </div>
        <div v-else class="truncate text-base">
          {{ getRow(itemName, fieldName).label }}
        </div>
      </div>
    </template>
    <template #actions="{ itemName }">
      <div class="flex gap-2 items-center justify-between">
        <div class="text-ink-gray-5 flex items-center gap-1.5">
          <EmailAtIcon class="h-4 w-4" />
          <span v-if="getRow(itemName, '_email_count').label">
            {{ getRow(itemName, '_email_count').label }}
          </span>
          <span class="text-3xl leading-[0]"> &middot; </span>
          <NoteIcon class="h-4 w-4" />
          <span v-if="getRow(itemName, '_note_count').label">
            {{ getRow(itemName, '_note_count').label }}
          </span>
          <span class="text-3xl leading-[0]"> &middot; </span>
          <TaskIcon class="h-4 w-4" />
          <span v-if="getRow(itemName, '_task_count').label">
            {{ getRow(itemName, '_task_count').label }}
          </span>
          <span class="text-3xl leading-[0]"> &middot; </span>
          <CommentIcon class="h-4 w-4" />
          <span v-if="getRow(itemName, '_comment_count').label">
            {{ getRow(itemName, '_comment_count').label }}
          </span>
        </div>
        <Dropdown
          class="flex items-center gap-2"
          :options="actions(itemName)"
          variant="ghost"
          @click.stop.prevent
        >
          <Button icon="plus" variant="ghost" />
        </Dropdown>
      </div>
    </template>
  </KanbanView>
  <LeadsListView
    ref="leadsListView"
    v-else-if="leads.data && rows.length"
    v-model="leads.data.page_length_count"
    v-model:list="leads"
    :rows="rows"
    :columns="leads.data.columns"
    :options="{
      showTooltip: false,
      resizeColumn: true,
      rowCount: leads.data.row_count,
      totalCount: leads.data.total_count,
    }"
    @loadMore="() => loadMore++"
    @columnWidthUpdated="() => triggerResize++"
    @updatePageCount="(count) => (updatedPageCount = count)"
    @applyFilter="(data) => viewControls.applyFilter(data)"
    @applyLikeFilter="(data) => viewControls.applyLikeFilter(data)"
    @likeDoc="(data) => viewControls.likeDoc(data)"
    @selectionsChanged="
      (selections) => viewControls.updateSelections(selections)
    "
  />
  <div v-else-if="leads.data" class="flex h-full items-center justify-center">
    <div
      class="flex flex-col items-center gap-3 text-xl font-medium text-ink-gray-4"
    >
      <LeadsIcon class="h-10 w-10" />
      <span>{{ __('No Leads Found') }}</span>
      <Button :label="__('Create')" @click="showLeadModal = true">
        <template #prefix><FeatherIcon name="plus" class="h-4" /></template>
      </Button>
    </div>
  </div>
  <LeadModal
    v-if="showLeadModal"
    v-model="showLeadModal"
    :defaults="defaults"
  />
  <NoteModal
    v-if="showNoteModal"
    v-model="showNoteModal"
    :note="note"
    doctype="CRM Lead"
    :doc="docname"
  />
  <TaskModal
    v-if="showTaskModal"
    v-model="showTaskModal"
    :task="task"
    doctype="CRM Lead"
    :doc="docname"
  />
</template>

<script setup>
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import MultipleAvatar from '@/components/MultipleAvatar.vue'
import CustomActions from '@/components/CustomActions.vue'
import SmartFilterField from '@/components/SmartFilterField.vue'
import EmailAtIcon from '@/components/Icons/EmailAtIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import CommentIcon from '@/components/Icons/CommentIcon.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import LeadsIcon from '@/components/Icons/LeadsIcon.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import LeadsListView from '@/components/ListViews/LeadsListView.vue'
import KanbanView from '@/components/Kanban/KanbanView.vue'
import LeadModal from '@/components/Modals/LeadModal.vue'
import NoteModal from '@/components/Modals/NoteModal.vue'
import TaskModal from '@/components/Modals/TaskModal.vue'
import ViewControls from '@/components/ViewControls.vue'
import { getMeta } from '@/stores/meta'
import { globalStore } from '@/stores/global'
import { usersStore } from '@/stores/users'
import { statusesStore } from '@/stores/statuses'
import { callEnabled, isMobileView } from '@/composables/settings'
import { formatDate, timeAgo, website, formatTime } from '@/utils'
import { Avatar, Tooltip, Dropdown } from 'frappe-ui'
import { useRoute } from 'vue-router'
import { ref, computed, reactive, h, watch } from 'vue'

const { getFormattedPercent, getFormattedFloat, getFormattedCurrency } =
  getMeta('CRM Lead')
const { makeCall } = globalStore()
const { getUser } = usersStore()
const { getLeadStatus } = statusesStore()

const route = useRoute()

const leadsListView = ref(null)
const showLeadModal = ref(false)

const defaults = reactive({})

// leads data is loaded in the ViewControls component
const leads = ref({})
const loadMore = ref(1)
const triggerResize = ref(1)
const updatedPageCount = ref(20)
const viewControls = ref(null)

const desktopSmartFilter = ref(null)
const mobileSmartFilter = ref(null)
const isResettingFilters = ref(false)

// Watch for filter changes in the list
watch(() => leads.value?.params?.filters, (newFilters) => {
  // Skip if we're already resetting filters
  if (isResettingFilters.value) return;
  
  // If filters are empty, clear the smart filter fields
  if (!newFilters || Object.keys(newFilters).length === 0) {
    isResettingFilters.value = true;
    desktopSmartFilter.value?.clearSearch();
    mobileSmartFilter.value?.clearSearch();
    isResettingFilters.value = false;
  }
}, { deep: true })

function getRow(name, field) {
  function getValue(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value
    }
    return { label: value }
  }
  return getValue(rows.value?.find((row) => row.name == name)[field])
}

// Rows
const rows = computed(() => {
  if (!leads.value?.data?.data) return []
  if (leads.value.data.view_type === 'group_by') {
    if (!leads.value?.data.group_by_field?.fieldname) return []
    return getGroupedByRows(
      leads.value?.data.data,
      leads.value?.data.group_by_field,
      leads.value.data.columns,
    )
  } else if (leads.value.data.view_type === 'kanban') {
    return getKanbanRows(leads.value.data.data, leads.value.data.fields)
  } else {
    return parseRows(leads.value?.data.data, leads.value.data.columns)
  }
})

function getGroupedByRows(listRows, groupByField, columns) {
  let groupedRows = []

  groupByField.options?.forEach((option) => {
    let filteredRows = []

    if (!option) {
      filteredRows = listRows.filter((row) => !row[groupByField.fieldname])
    } else {
      filteredRows = listRows.filter(
        (row) => row[groupByField.fieldname] == option,
      )
    }

    let groupDetail = {
      label: groupByField.label,
      group: option || __(' '),
      collapsed: false,
      rows: parseRows(filteredRows, columns),
    }
    if (groupByField.fieldname == 'status') {
      groupDetail.icon = () =>
        h(IndicatorIcon, {
          class: getLeadStatus(option)?.color,
        })
    }
    groupedRows.push(groupDetail)
  })

  return groupedRows || listRows
}

function getKanbanRows(data, columns) {
  let _rows = []
  data.forEach((column) => {
    column.data?.forEach((row) => {
      _rows.push(row)
    })
  })
  return parseRows(_rows, columns)
}

function parseRows(rows, columns = []) {
  let view_type = leads.value.data.view_type
  let key = view_type === 'kanban' ? 'fieldname' : 'key'
  let type = view_type === 'kanban' ? 'fieldtype' : 'type'

  return rows.map((lead) => {
    let _rows = {}
    leads.value?.data.rows.forEach((row) => {
      _rows[row] = lead[row]

      let fieldType = columns?.find((col) => (col[key] || col.value) == row)?.[
        type
      ]

      if (
        fieldType &&
        ['Date', 'Datetime'].includes(fieldType) &&
        !['modified', 'creation'].includes(row)
      ) {
        _rows[row] = formatDate(lead[row], '', true, fieldType == 'Datetime')
      }

      if (fieldType && fieldType == 'Currency') {
        _rows[row] = getFormattedCurrency(row, lead)
      }

      if (fieldType && fieldType == 'Float') {
        _rows[row] = getFormattedFloat(row, lead)
      }

      if (fieldType && fieldType == 'Percent') {
        _rows[row] = getFormattedPercent(row, lead)
      }

      if (row == 'lead_name') {
        _rows[row] = {
          label: lead.lead_name,
          image: lead.image,
          image_label: lead.first_name,
        }
      } else if (row == 'organization') {
        _rows[row] = lead.organization
      } else if (row === 'website') {
        _rows[row] = website(lead.website)
      } else if (row == 'status') {
        _rows[row] = {
          label: getLeadStatus(lead.status).label,
          value: lead.status,
          color: getLeadStatus(lead.status)?.color,
        }
      } else if (row == 'sla_status') {
        let value = lead.sla_status
        let tooltipText = value
        let color =
          lead.sla_status == 'Failed'
            ? 'red'
            : lead.sla_status == 'Fulfilled'
              ? 'green'
              : 'orange'
        if (value == 'First Response Due') {
          value = timeAgo(lead.response_by)
          tooltipText = formatDate(lead.response_by)
          if (new Date(lead.response_by) < new Date()) {
            color = 'red'
          }
        }
        _rows[row] = {
          label: tooltipText,
          value: value,
          color: color,
        }
      } else if (row == 'lead_owner') {
        _rows[row] = {
          label: lead.lead_owner && getUser(lead.lead_owner).full_name,
          ...(lead.lead_owner && getUser(lead.lead_owner)),
        }
      } else if (row == '_assign') {
        let assignees = JSON.parse(lead._assign || '[]')
        _rows[row] = assignees.map((user) => ({
          name: user,
          image: getUser(user).user_image,
          label: getUser(user).full_name,
        }))
      } else if (['modified', 'creation'].includes(row)) {
        _rows[row] = {
          label: formatDate(lead[row]),
          timeAgo: timeAgo(lead[row]),
        }
      } else if (
        ['first_response_time', 'first_responded_on', 'response_by'].includes(
          row,
        )
      ) {
        let field = row == 'response_by' ? 'response_by' : 'first_responded_on'
        _rows[row] = {
          label: lead[field] ? formatDate(lead[field]) : '',
          timeAgo: lead[row]
            ? row == 'first_response_time'
              ? formatTime(lead[row])
              : timeAgo(lead[row])
            : '',
        }
      }
    })
    _rows['_email_count'] = lead._email_count
    _rows['_note_count'] = lead._note_count
    _rows['_task_count'] = lead._task_count
    _rows['_comment_count'] = lead._comment_count
    return _rows
  })
}

function onNewClick(column) {
  let column_field = leads.value.params.column_field

  if (column_field) {
    defaults[column_field] = column.column.name
  }

  showLeadModal.value = true
}

function actions(itemName) {
  let mobile_no = getRow(itemName, 'mobile_no')?.label || ''
  let actions = [
    {
      icon: h(PhoneIcon, { class: 'h-4 w-4' }),
      label: __('Make a Call'),
      onClick: () => makeCall(mobile_no),
      condition: () => mobile_no && callEnabled.value,
    },
    {
      icon: h(NoteIcon, { class: 'h-4 w-4' }),
      label: __('New Note'),
      onClick: () => showNote(itemName),
    },
    {
      icon: h(TaskIcon, { class: 'h-4 w-4' }),
      label: __('New Task'),
      onClick: () => showTask(itemName),
    },
  ]
  return actions.filter((action) =>
    action.condition ? action.condition() : true,
  )
}

const docname = ref('')
const showNoteModal = ref(false)
const note = ref({
  title: '',
  content: '',
})

function showNote(name) {
  docname.value = name
  showNoteModal.value = true
}

const showTaskModal = ref(false)
const task = ref({
  title: '',
  description: '',
  assigned_to: '',
  due_date: '',
  priority: 'Low',
  status: 'Backlog',
})

function showTask(name) {
  docname.value = name
  showTaskModal.value = true
}

function handleSmartFilter(filters) {
  if (!viewControls.value || !filters) return;
  if (isResettingFilters.value) return;
  if (!leads.value || !leads.value.params) return;

  const currentFilters = leads.value.params.filters || {};
  const standardFilters = {};
  Object.entries(currentFilters).forEach(([key, value]) => {
    if (!['mobile_no', 'email', 'lead_name'].includes(key)) {
      standardFilters[key] = value;
    }
  });

  leads.value.params.filters = {
    ...standardFilters,
    ...filters
  };
  
  leads.value.reload();
}
</script>
