<template>
  <Dialog v-model="dialogShow" :options="{ size: '3xl' }">
    <template #body>
      <div class="bg-surface-modal px-4 pb-6 pt-5 sm:px-6">
        <div class="mb-5 flex items-center justify-between">
          <div>
            <h3 class="text-2xl font-semibold leading-6 text-ink-gray-9">
              {{ __('Create Lead') }}
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
          <FieldLayout v-if="tabs.data"
          :tabs="tabs.data"
          :data="lead.doc"
          @change="handleFieldChange" />
          <ErrorMessage class="mt-4" v-if="error" :message="__(error)" />
        </div>
      </div>
      <div class="px-4 pb-7 pt-4 sm:px-6">
        <div class="flex flex-row-reverse gap-2">
          <Button
            variant="solid"
            :label="__('Create')"
            :loading="isLeadCreating"
            @click="createNewLead"
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
import { sessionStore } from '@/stores/session'
import { isMobileView } from '@/composables/settings'
import { showQuickEntryModal, quickEntryProps } from '@/composables/modals'
import { capture } from '@/telemetry'
import { createResource, Badge } from 'frappe-ui'
import { useOnboarding } from 'frappe-ui/frappe'
import { useDocument } from '@/data/document'
import { computed, onMounted, ref, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDirtyState } from '@/composables/useDirtyState'

const props = defineProps({
  defaults: Object,
})

const { user } = sessionStore()
const { getUser, isManager } = usersStore()
const { getLeadStatus, statusOptions } = statusesStore()
const { updateOnboardingStep } = useOnboarding('frappecrm')

const show = defineModel()
const dialogShow = ref(false)
const showConfirmClose = ref(false)
const tempFormData = ref(null)
const shouldOpenLayoutSettings = ref(false)

const router = useRouter()
const error = ref(null)
const isLeadCreating = ref(false)

const { isDirty, markAsDirty, resetDirty } = useDirtyState()

const { document: lead } = useDocument('CRM Lead')

const leadStatuses = computed(() => {
  let statuses = statusOptions('lead')
  if (!lead.doc.status) {
    lead.doc.status = statuses?.[0]?.value
  }
  return statuses
})

const tabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['QuickEntry', 'CRM Lead'],
  params: { doctype: 'CRM Lead', type: 'Quick Entry' },
  auto: true,
  transform: (_tabs) => {
    return _tabs.forEach((tab) => {
      tab.sections.forEach((section) => {
        section.columns.forEach((column) => {
          column.fields.forEach((field) => {
            if (field.fieldname == 'status') {
              field.fieldtype = 'Select'
              field.options = leadStatuses.value
              field.prefix = getLeadStatus(lead.doc.status).color
            }

            if (field.fieldtype === 'Table') {
              lead.doc[field.fieldname] = []
            }
          })
        })
      })
    })
  },
})

const createLead = createResource({
  url: 'frappe.client.insert',
  makeParams(values) {
    return {
      doc: {
        doctype: 'CRM Lead',
        ...values,
      },
    }
  },
})

function createNewLead() {
  if (lead.doc.website && !lead.doc.website.startsWith('http')) {
    lead.doc.website = 'https://' + lead.doc.website
  }

  createLead.submit(lead.doc, {
    validate() {
      error.value = null
      if (!lead.doc.first_name) {
        error.value = __('First Name is mandatory')
        return error.value
      }
      if (lead.doc.annual_revenue) {
        if (typeof lead.doc.annual_revenue === 'string') {
          lead.doc.annual_revenue = lead.doc.annual_revenue.replace(/,/g, '')
        } else if (isNaN(lead.doc.annual_revenue)) {
          error.value = __('Annual Revenue should be a number')
          return error.value
        }
      }
      if (
        lead.doc.mobile_no &&
        isNaN(lead.doc.mobile_no.replace(/[-+() ]/g, ''))
      ) {
        error.value = __('Mobile No should be a number')
        return error.value
      }
      if (lead.doc.email && !lead.doc.email.includes('@')) {
        error.value = __('Invalid Email')
        return error.value
      }
      if (!lead.doc.status) {
        error.value = __('Status is required')
        return error.value
      }
      isLeadCreating.value = true
    },
    onSuccess(data) {
      capture('lead_created')
      isLeadCreating.value = false
      show.value = false
      resetDirty() // Reset dirty state on success
      router.push({ name: 'Lead', params: { leadId: data.name } })
      updateOnboardingStep('create_first_lead', true, false, () => {
        localStorage.setItem('firstLead' + user, data.name)
      })
    },
    onError(err) {
      isLeadCreating.value = false
      if (!err.messages) {
        error.value = err.message
        return
      }
      error.value = err.messages.join('\n')
    },
  })
}

function openQuickEntryModal() {
  if (isDirty.value) {
    shouldOpenLayoutSettings.value = true
    showConfirmClose.value = true
  } else {
    showQuickEntryModal.value = true
    quickEntryProps.value = { doctype: 'CRM Lead' }
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
    shouldOpenLayoutSettings.value = false // Reset this if user closes via X button without opening quick entry
    showConfirmClose.value = true
  } else {
    dialogShow.value = false
    show.value = false
  }
}

function confirmClose() {
  resetDirty()
  dialogShow.value = false
  show.value = false
  
  if (shouldOpenLayoutSettings.value) {
    showQuickEntryModal.value = true
    quickEntryProps.value = { doctype: 'CRM Lead' } // Ensure doctype is passed
    nextTick(() => {
      shouldOpenLayoutSettings.value = false
    })
  }
}

function cancelClose() {
  showConfirmClose.value = false
  shouldOpenLayoutSettings.value = false
}

watch(
  () => dialogShow.value,
  (value) => {
    if (value) return
    if (isDirty.value) {
      showConfirmClose.value = true
      nextTick(() => {
        dialogShow.value = true
      })
    } else {
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
      // Initialize lead.doc when the main modal opens
      lead.doc = { no_of_employees: '1-10', ...props.defaults }

      if (!lead.doc?.lead_owner) {
        lead.doc.lead_owner = getUser().name
      }
      if (!lead.doc?.status && leadStatuses.value[0]?.value) {
        lead.doc.status = leadStatuses.value[0].value
      }
      dialogShow.value = true
    } else {
      // Reset lead.doc and tempFormData when the main modal closes clean
      lead.doc = {}
      tempFormData = null
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
