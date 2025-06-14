<template>
  <Dialog v-model="dialogShow" :options="{ size: '3xl' }">
    <template #body>
      <div class="bg-surface-modal px-4 pb-6 pt-5 sm:px-6">
        <div class="mb-5 flex items-center justify-between">
          <div>
            <h3 class="text-2xl font-semibold leading-6 text-ink-gray-9">
              {{ __('Create Deal') }}
            </h3>
            <Badge v-if="isDirty" :label="__('Not Saved')" theme="orange" />
          </div>
          <div class="flex items-center gap-1">
            <Button
              v-if="isManager() && !isMobileView"
              variant="ghost"
              class="w-7"
              @click="openQuickEntryModal"
            >
              <EditIcon class="h-4 w-4" />
            </Button>
            <Button variant="ghost" class="w-7" @click="handleClose">
              <FeatherIcon name="x" class="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div>
          <div
            v-if="hasOrganizationSections || hasContactSections"
            class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3"
          >
            <div
              v-if="hasOrganizationSections"
              class="flex items-center gap-3 text-sm text-ink-gray-5"
            >
              <div>{{ __('Choose Existing Organization') }}</div>
              <Switch v-model="chooseExistingOrganization" />
            </div>
            <div
              v-if="hasContactSections"
              class="flex items-center gap-3 text-sm text-ink-gray-5"
            >
              <div>{{ __('Choose Existing Contact') }}</div>
              <Switch v-model="chooseExistingContact" />
            </div>
          </div>
          <div
            v-if="hasOrganizationSections || hasContactSections"
            class="h-px w-full border-t my-5"
          />
          <FieldLayout
            v-if="tabs.data"
            :tabs="tabs.data"
            :data="deal.doc"
            doctype="CRM Deal"
            @change="handleFieldChange"
          />
          <ErrorMessage class="mt-4" v-if="error" :message="__(error)" />
        </div>
      </div>
      <div class="px-4 pb-7 pt-4 sm:px-6">
        <div class="flex flex-row-reverse gap-2">
          <Button
            variant="solid"
            :label="__('Create')"
            :loading="isDealCreating"
            @click="createDeal"
          />
        </div>
      </div>
    </template>
  </Dialog>
  <ConfirmCloseDialog 
    v-model="showConfirmClose"
    @confirm="confirmClose"
    @cancel="cancelClose"
  />
</template>

<script setup>
import EditIcon from '@/components/Icons/EditIcon.vue'
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import ConfirmCloseDialog from '@/components/Modals/ConfirmCloseDialog.vue'
import { usersStore } from '@/stores/users'
import { statusesStore } from '@/stores/statuses'
import { isMobileView } from '@/composables/settings'
import { showQuickEntryModal, quickEntryProps } from '@/composables/modals'
import { useDocument } from '@/data/document'
import { capture } from '@/telemetry'
import { Switch, createResource, Badge } from 'frappe-ui'
import { computed, ref, onMounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDirtyState } from '@/composables/useDirtyState'

const props = defineProps({
  defaults: Object,
})

const { getUser, isManager } = usersStore()
const { getDealStatus, statusOptions } = statusesStore()

const show = defineModel()
const dialogShow = ref(false)
const showConfirmClose = ref(false)

const router = useRouter()
const error = ref(null)
const tempFormData = ref(null)
const shouldOpenLayoutSettings = ref(false)

const { isDirty, markAsDirty, resetDirty } = useDirtyState()

const { document: deal } = useDocument('CRM Deal')

const hasOrganizationSections = ref(true)
const hasContactSections = ref(true)

const isDealCreating = ref(false)
const chooseExistingContact = ref(false)
const chooseExistingOrganization = ref(false)

const tabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['QuickEntry', 'CRM Deal'],
  params: { doctype: 'CRM Deal', type: 'Quick Entry' },
  auto: true,
  transform: (_tabs) => {
    hasOrganizationSections.value = false
    return _tabs.forEach((tab) => {
      tab.sections.forEach((section) => {
        section.columns.forEach((column) => {
          if (
            ['organization_section', 'organization_details_section'].includes(
              section.name,
            )
          ) {
            hasOrganizationSections.value = true
          } else if (
            ['contact_section', 'contact_details_section'].includes(
              section.name,
            )
          ) {
            hasContactSections.value = true
          }
          column.fields.forEach((field) => {
            if (field.fieldname == 'status') {
              field.fieldtype = 'Select'
              field.options = dealStatuses.value
              field.prefix = getDealStatus(deal.doc.status).color
            }

            if (field.fieldtype === 'Table') {
              deal.doc[field.fieldname] = []
            }
          })
        })
      })
    })
  },
})

const dealStatuses = computed(() => {
  let statuses = statusOptions('deal')
  if (!deal.doc.status) {
    deal.doc.status = statuses[0].value
  }
  return statuses
})

function createDeal() {
  if (deal.doc.website && !deal.doc.website.startsWith('http')) {
    deal.doc.website = 'https://' + deal.doc.website
  }
  if (chooseExistingContact.value) {
    deal.doc['first_name'] = null
    deal.doc['last_name'] = null
    deal.doc['email'] = null
    deal.doc['mobile_no'] = null
  } else deal.doc['contact'] = null

  createResource({
    url: 'crm.fcrm.doctype.crm_deal.crm_deal.create_deal',
    params: { args: deal.doc },
    auto: true,
    validate() {
      error.value = null
      if (deal.doc.annual_revenue) {
        if (typeof deal.doc.annual_revenue === 'string') {
          deal.doc.annual_revenue = deal.doc.annual_revenue.replace(/,/g, '')
        } else if (isNaN(deal.doc.annual_revenue)) {
          error.value = __('Annual Revenue should be a number')
          return error.value
        }
      }
      if (
        deal.doc.mobile_no &&
        isNaN(deal.doc.mobile_no.replace(/[-+() ]/g, ''))
      ) {
        error.value = __('Mobile No should be a number')
        return error.value
      }
      if (deal.doc.email && !deal.doc.email.includes('@')) {
        error.value = __('Invalid Email')
        return error.value
      }
      if (!deal.doc.status) {
        error.value = __('Status is required')
        return error.value
      }
      isDealCreating.value = true
    },
    onSuccess(name) {
      capture('deal_created')
      isDealCreating.value = false
      show.value = false
      resetDirty()
      router.push({ name: 'Deal', params: { dealId: name } })
    },
    onError(err) {
      isDealCreating.value = false
      if (!err.messages) {
        error.value = err.message
        return
      }
      error.value = err.messages.join('\n')
    },
  })
}

watch(
  [chooseExistingOrganization, chooseExistingContact],
  ([organization, contact]) => {
    tabs.data.forEach((tab) => {
      tab.sections.forEach((section) => {
        if (section.name === 'organization_section') {
          section.hidden = !organization
        } else if (section.name === 'organization_details_section') {
          section.hidden = organization
        } else if (section.name === 'contact_section') {
          section.hidden = !contact
        } else if (section.name === 'contact_details_section') {
          section.hidden = contact
        }
      })
    })
  },
)

function openQuickEntryModal() {
  if (isDirty.value) {
    tempFormData.value = { ...deal.doc }
    shouldOpenLayoutSettings.value = true
    showConfirmClose.value = true
  } else {
    showQuickEntryModal.value = true
    quickEntryProps.value = { doctype: 'CRM Deal' }
    nextTick(() => {
      dialogShow.value = false
      show.value = false
    })
  }
}

function handleFieldChange() {
  markAsDirty()
}

function handleClose() {
  if (isDirty.value) {
    showConfirmClose.value = true
  } else {
    dialogShow.value = false
    show.value = false
  }
}

function confirmClose() {
  resetDirty()
  tempFormData.value = null
  deal.doc = {}
  dialogShow.value = false
  show.value = false
  
  if (shouldOpenLayoutSettings.value) {
    showQuickEntryModal.value = true
    nextTick(() => {
      shouldOpenLayoutSettings.value = false
    })
  }
}

function cancelClose() {
  showConfirmClose.value = false
  shouldOpenLayoutSettings.value = false
  if (tempFormData.value) {
    Object.assign(deal.doc, tempFormData.value)
    tempFormData.value = null
  }
}

watch(
  () => dialogShow.value,
  (value) => {
    if (value) return
    if (isDirty.value) {
      showConfirmClose.value = true
      nextTick(() => {
        if (tempFormData.value) {
          Object.assign(deal.doc, tempFormData.value)
        }
        dialogShow.value = true
      })
    } else {
      deal.doc = {}
      tempFormData.value = null
      show.value = false
    }
  }
)

watch(
  () => show.value,
  (value) => {
    if (value === dialogShow.value) return
    if (value) {
      resetDirty()
      deal.doc = {
        ...props.defaults,
      }
      if (!deal.doc.deal_owner) {
        deal.doc.deal_owner = getUser().name
      }
      if (!deal.doc.currency) {
        deal.doc.currency = window.sysdefaults?.currency || ''
      }
      if (!deal.doc.status && dealStatuses.value[0].value) {
        deal.doc.status = dealStatuses.value[0].value
      }
      dialogShow.value = true
    } else {
      tempFormData.value = null
      dialogShow.value = false
    }
  },
  { immediate: true }
)

watch(
  () => showQuickEntryModal.value,
  (value) => {
    if (!value) {
      tabs.reload()
    }
  }
)

onMounted(() => {
  // Initial assignment is now handled in the `show` watch when the modal opens
  // This ensures `resetDirty` is called and data is correctly initialized
})
</script>
