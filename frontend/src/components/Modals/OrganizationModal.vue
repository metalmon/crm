<template>
  <Dialog v-model="dialogShow" :options="{ size: 'xl' }">
    <template #body>
      <div class="px-4 pt-5 pb-6 bg-surface-modal sm:px-6">
        <div class="mb-5 flex items-center justify-between">
          <div class="flex items-baseline">
            <h3 class="text-2xl font-semibold leading-6 text-ink-gray-9 mr-2">
              {{ __('New Organization') }}
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
              <EditIcon class="w-4 h-4" />
            </Button>
            <Button variant="ghost" class="w-7" @click="handleClose">
              <FeatherIcon name="x" class="h-4 w-4" />
            </Button>
          </div>
        </div>
        <FieldLayout
          v-if="tabs.data?.length"
          :tabs="tabs.data"
          :data="organization.doc"
          doctype="CRM Organization"
          @change="handleFieldChange"
        />
        <ErrorMessage class="mt-8" v-if="error" :message="__(error)" />
      </div>
      <div class="px-4 pt-4 pb-7 sm:px-6">
        <div class="space-y-2">
          <Button
            class="w-full"
            variant="solid"
            :label="__('Create')"
            :loading="loading"
            @click="createOrganization"
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
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import EditIcon from '@/components/Icons/EditIcon.vue'
import ConfirmCloseDialog from '@/components/Modals/ConfirmCloseDialog.vue'
import { usersStore } from '@/stores/users'
import { isMobileView } from '@/composables/settings'
import {
  showQuickEntryModal,
  quickEntryProps,
  showAddressModal,
  addressProps,
} from '@/composables/modals'
import { useDocument } from '@/data/document'
import { capture } from '@/telemetry'
import { call, FeatherIcon, createResource, Badge } from 'frappe-ui'
import { ref, nextTick, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDirtyState } from '@/composables/useDirtyState'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  options: {
    type: Object,
    default: {
      redirect: true,
      afterInsert: () => {},
    },
  },
})

const { isManager } = usersStore()

const router = useRouter()
const show = defineModel()
const dialogShow = ref(false)
const showConfirmClose = ref(false)

const loading = ref(false)
const error = ref(null)
const tempFormData = ref(null)
const shouldOpenLayoutSettings = ref(false)

const { isDirty, markAsDirty, resetDirty } = useDirtyState()

const { document: organization, triggerOnBeforeCreate } =
  useDocument('CRM Organization')

async function createOrganization() {
  loading.value = true
  error.value = null

  await triggerOnBeforeCreate?.()

  const doc = await call(
    'frappe.client.insert',
    {
      doc: {
        doctype: 'CRM Organization',
        ...organization.doc,
      },
      {
        onError: (err) => {
          if (err.error.exc_type == 'ValidationError') {
            error.value = err.error?.messages?.[0]
          }
        },
      },
    )
    if (doc.name) {
      capture('organization_created')
      handleOrganizationUpdate(doc)
      resetDirty()
    }
  } finally {
    loading.value = false
  }
}

function handleOrganizationUpdate(doc) {
  if (doc.name && props.options.redirect) {
    router.push({
      name: 'Organization',
      params: { organizationId: doc.name },
    })
  }
  resetDirty()
  dialogShow.value = false
  show.value = false
  props.options.afterInsert && props.options.afterInsert(doc)
}

const tabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['QuickEntry', 'CRM Organization'],
  params: { doctype: 'CRM Organization', type: 'Quick Entry' },
  auto: true,
  transform: (_tabs) => {
    return _tabs.forEach((tab) => {
      tab.sections.forEach((section) => {
        section.columns.forEach((column) => {
          column.fields.forEach((field) => {
            if (field.fieldname == 'address') {
              field.create = (value, close) => {
                organization.doc.address = value
                openAddressModal()
                dialogShow.value = false
                close()
              }
              field.edit = (address) => {
                openAddressModal(address)
                dialogShow.value = false
              }
            } else if (field.fieldtype === 'Table') {
              organization.doc[field.fieldname] = []
            }
          })
        })
      })
    })
  },
})

function openQuickEntryModal() {
  if (isDirty.value) {
    tempFormData.value = { ...organization.doc }
    shouldOpenLayoutSettings.value = true
    showConfirmClose.value = true
  } else {
    dialogShow.value = false
    nextTick(() => {
      showQuickEntryModal.value = true
      quickEntryProps.value = { doctype: 'CRM Organization' }
      show.value = false
    })
  }
}

function handleFieldChange() {
  markAsDirty()
}

function handleClose() {
  if (isDirty.value) {
    tempFormData.value = { ...organization.doc }
    showConfirmClose.value = true
  } else {
    dialogShow.value = false
    show.value = false
  }
}

function confirmClose() {
  resetDirty()
  tempFormData.value = null
  organization.doc = {}
  dialogShow.value = false
  show.value = false
  
  if (shouldOpenLayoutSettings.value) {
    nextTick(() => {
      showQuickEntryModal.value = true
      quickEntryProps.value = { doctype: 'CRM Organization' }
      shouldOpenLayoutSettings.value = false
    })
  }
}

function cancelClose() {
  showConfirmClose.value = false
  shouldOpenLayoutSettings.value = false
  if (tempFormData.value) {
    Object.assign(organization.doc, tempFormData.value)
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
          Object.assign(organization.doc, tempFormData.value)
        }
        dialogShow.value = true
      })
    } else {
      organization.doc = {}
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
      // Initialize organization document when the modal opens
      organization.doc = {
        organization_name: '',
        website: '',
        ...props.data
      }
      dialogShow.value = true
    } else {
      // Reset organization document when the modal closes
      organization.doc = {}
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

function openAddressModal(_address) {
  showAddressModal.value = true
  addressProps.value = {
    doctype: 'Address',
    address: _address,
  }
  nextTick(() => (show.value = false))
}

onMounted(() => {
  // Initial assignment is now handled in the `show` watch when the modal opens
  // This ensures `resetDirty` is called and data is correctly initialized
})
</script>
