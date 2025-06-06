<template>
  <Dialog v-model="dialogShow" :options="{ size: 'xl' }">
    <template #body>
      <div class="bg-surface-modal px-4 pb-6 pt-5 sm:px-6">
        <div class="mb-5 flex items-center justify-between">
          <div>
            <h3 class="text-2xl font-semibold leading-6 text-ink-gray-9">
              {{ __('New Organization') }}
            </h3>
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
        <FieldLayout
          v-if="tabs.data?.length"
          :tabs="tabs.data"
          :data="_organization"
          doctype="CRM Organization"
          @change="handleFieldChange"
        />
      </div>
      <div class="px-4 pb-7 pt-4 sm:px-6">
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
import { capture } from '@/telemetry'
import { call, FeatherIcon, createResource } from 'frappe-ui'
import { ref, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  options: {
    type: Object,
    default: {
      redirect: true,
      afterInsert: () => {},
    },
  },
})

const emit = defineEmits(['openAddressModal'])

const { isManager } = usersStore()

const router = useRouter()
const show = defineModel()
const dialogShow = ref(false)
const showConfirmClose = ref(false)
const organization = defineModel('organization')

const loading = ref(false)
const isDirty = ref(false)
const tempFormData = ref(null)

let _organization = ref({
  organization_name: '',
  website: '',
  annual_revenue: '',
  no_of_employees: '1-10',
  industry: '',
})

let doc = ref({})

async function createOrganization() {
  const doc = await call('frappe.client.insert', {
    doc: {
      doctype: 'CRM Organization',
      ..._organization.value,
    },
  })
  loading.value = false
  if (doc.name) {
    capture('organization_created')
    handleOrganizationUpdate(doc)
  }
}

function handleOrganizationUpdate(doc) {
  if (doc.name && props.options.redirect) {
    router.push({
      name: 'Organization',
      params: { organizationId: doc.name },
    })
  } else {
    organization.value?.reload?.()
  }
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
                _organization.value.address = value
                emit('openAddressModal')
                show.value = false
                close()
              }
              field.edit = (address) => {
                emit('openAddressModal', address)
                show.value = false
              }
            } else if (field.fieldtype === 'Table') {
              _organization.value[field.fieldname] = []
            }
          })
        })
      })
    })
  },
})

const showQuickEntryModal = defineModel('showQuickEntryModal')
const shouldOpenLayoutSettings = ref(false)

function openQuickEntryModal() {
  if (isDirty.value) {
    tempFormData.value = { ...      _organization.value }
    shouldOpenLayoutSettings.value = true
    showConfirmClose.value = true
  } else {
    dialogShow.value = false
    nextTick(() => {
      showQuickEntryModal.value = true
      show.value = false
    })
  }
}

function handleFieldChange() {
  isDirty.value = true
}

function handleClose() {
  if (isDirty.value) {
    tempFormData.value = { ...      _organization.value }
    showConfirmClose.value = true
  } else {
    dialogShow.value = false
    show.value = false
  }
}

function confirmClose() {
  isDirty.value = false
  tempFormData.value = null
  _organization.value = {}
  dialogShow.value = false
  show.value = false
  
  if (shouldOpenLayoutSettings.value) {
    nextTick(() => {
      showQuickEntryModal.value = true
      shouldOpenLayoutSettings.value = false
    })
  }
}

function cancelClose() {
  showConfirmClose.value = false
  shouldOpenLayoutSettings.value = false
  if (tempFormData.value) {
    _organization.value = tempFormData.value
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
          _organization.value = tempFormData.value
        }
        dialogShow.value = true
      })
    } else {
      _organization.value = {}
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
      isDirty.value = false
      dialogShow.value = true
    } else {
      tempFormData.value = null
      dialogShow.value = true
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
</script>

watch(
  () => show.value,
  (value) => {
    if (value === dialogShow.value) return
    if (value) {
      _organization.value = {}
      isDirty.value = false
      dialogShow.value = true
    }
  },
  { immediate: true }
)
