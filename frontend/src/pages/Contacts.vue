<template>
  <LayoutHeader>
    <template #left-header>
      <ViewBreadcrumbs v-model="viewControls" routeName="Contacts" />
    </template>
    <template #right-header>
      <div class="flex items-center gap-4">
        <SmartFilterField
          v-if="!isMobileView"
          ref="desktopSmartFilter"
          doctype="Contact"
          @update:filters="handleSmartFilter"
        />
        <CustomActions
          v-if="contactsListView?.customListActions"
          :actions="contactsListView.customListActions"
        />
        <Button
          variant="solid"
          :label="__('Create')"
          @click="showContactModal = true"
        >
          <template #prefix><FeatherIcon name="plus" class="h-4" /></template>
        </Button>
      </div>
    </template>
  </LayoutHeader>
  <div v-if="isMobileView" class="px-3 py-2 border-b">
    <SmartFilterField
      ref="mobileSmartFilter"
      doctype="Contact"
      @update:filters="handleSmartFilter"
    />
  </div>
  <ViewControls
    ref="viewControls"
    v-model="contacts"
    v-model:loadMore="loadMore"
    v-model:resizeColumn="triggerResize"
    v-model:updatedPageCount="updatedPageCount"
    doctype="Contact"
  />
  <ContactsListView
    ref="contactsListView"
    v-if="contacts.data && rows.length"
    v-model="contacts.data.page_length_count"
    v-model:list="contacts"
    :rows="rows"
    :columns="contacts.data.columns"
    :options="{
      showTooltip: false,
      resizeColumn: true,
      rowCount: contacts.data.row_count,
      totalCount: contacts.data.total_count,
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
  <div
    v-else-if="contacts.data"
    class="flex h-full items-center justify-center"
  >
    <div
      class="flex flex-col items-center gap-3 text-xl font-medium text-ink-gray-4"
    >
      <ContactsIcon class="h-10 w-10" />
      <span>{{ __('No Contacts Found') }}</span>
      <Button :label="__('Create')" @click="showContactModal = true">
        <template #prefix><FeatherIcon name="plus" class="h-4" /></template>
      </Button>
    </div>
  </div>
  <ContactModal
    v-if="showContactModal"
    v-model="showContactModal"
    :contact="{}"
  />
</template>

<script setup>
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import CustomActions from '@/components/CustomActions.vue'
import ContactsIcon from '@/components/Icons/ContactsIcon.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import ContactModal from '@/components/Modals/ContactModal.vue'
import ContactsListView from '@/components/ListViews/ContactsListView.vue'
import ViewControls from '@/components/ViewControls.vue'
import { getMeta } from '@/stores/meta'
import { organizationsStore } from '@/stores/organizations.js'
import { formatDate, timeAgo } from '@/utils'
import { call } from 'frappe-ui'
import { ref, computed, watch } from 'vue'
import { isMobileView } from '@/composables/settings'
import SmartFilterField from '@/components/SmartFilterField.vue'

const { getFormattedPercent, getFormattedFloat, getFormattedCurrency } =
  getMeta('Contact')
const { getOrganization } = organizationsStore()

const showContactModal = ref(false)

const contactsListView = ref(null)

// contacts data is loaded in the ViewControls component
const contacts = ref({})
const loadMore = ref(1)
const triggerResize = ref(1)
const updatedPageCount = ref(20)
const viewControls = ref(null)

const rows = computed(() => {
  if (
    !contacts.value?.data?.data ||
    !['list', 'group_by'].includes(contacts.value.data.view_type)
  )
    return []
  return contacts.value?.data.data.map((contact) => {
    let _rows = {}
    contacts.value?.data.rows.forEach((row) => {
      _rows[row] = contact[row]

      let fieldType = contacts.value?.data.columns?.find(
        (col) => (col.key || col.value) == row,
      )?.type

      if (
        fieldType &&
        ['Date', 'Datetime'].includes(fieldType) &&
        !['modified', 'creation'].includes(row)
      ) {
        _rows[row] = formatDate(contact[row], '', true, fieldType == 'Datetime')
      }

      if (fieldType && fieldType == 'Currency') {
        _rows[row] = getFormattedCurrency(row, contact)
      }

      if (fieldType && fieldType == 'Float') {
        _rows[row] = getFormattedFloat(row, contact)
      }

      if (fieldType && fieldType == 'Percent') {
        _rows[row] = getFormattedPercent(row, contact)
      }

      if (row == 'full_name') {
        _rows[row] = {
          label: contact.full_name,
          image_label: contact.full_name,
          image: contact.image,
        }
      } else if (row == 'company_name') {
        _rows[row] = {
          label: contact.company_name,
          logo: getOrganization(contact.company_name)?.organization_logo,
        }
      } else if (['modified', 'creation'].includes(row)) {
        _rows[row] = {
          label: formatDate(contact[row]),
          timeAgo: timeAgo(contact[row]),
        }
      }
    })
    return _rows
  })
})

const desktopSmartFilter = ref(null)
const mobileSmartFilter = ref(null)
const isResettingFilters = ref(false)

watch(() => contacts.value?.params?.filters, (newFilters) => {
  if (isResettingFilters.value) return;
  
  if (!newFilters || Object.keys(newFilters).length === 0) {
    isResettingFilters.value = true;
    desktopSmartFilter.value?.clearSearch();
    mobileSmartFilter.value?.clearSearch();
    isResettingFilters.value = false;
  }
}, { deep: true })

function handleSmartFilter(filters) {
  if (!viewControls.value || !filters) return;
  if (isResettingFilters.value) return;
  if (!contacts.value || !contacts.value.params) return;

  // Get current filters
  const currentFilters = contacts.value.params.filters || {};
  
  // Preserve standard filters (name, id) but replace smart filter fields
  const standardFilters = {};
  Object.entries(currentFilters).forEach(([key, value]) => {
    // Keep filters that aren't handled by smart filter
    if (!['mobile_no', 'email_id', 'company_name'].includes(key)) {
      standardFilters[key] = value;
    }
  });

  // Merge standard filters with new smart filters
  contacts.value.params.filters = {
    ...standardFilters,
    ...filters
  };
  
  contacts.value.reload();
}

</script>
