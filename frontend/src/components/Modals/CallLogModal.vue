<template>
  <Dialog v-model="dialogShow" :options="dialogOptions">
    <template #body>
      <div class="px-4 pt-5 pb-6 bg-surface-modal sm:px-6">
        <div class="flex items-center justify-between mb-5">
          <div class="flex items-baseline gap-2">
            <h3 class="text-2xl font-semibold leading-6 text-ink-gray-9 mr-2">
              {{ __(dialogOptions.title) || __('Untitled') }}
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
              <FeatherIcon name="x" class="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div v-if="tabs.data">
          <FieldLayout
            :tabs="tabs.data"
            :data="callLog.doc"
            doctype="CRM Call Log"
            @change="handleFieldChange"
          />
          <ErrorMessage class="mt-8" :message="error" />
        </div>
      </div>
      <div class="px-4 pt-4 pb-7 sm:px-6">
        <div class="space-y-2">
          <Button
            class="w-full"
            v-for="action in dialogOptions.actions"
            :key="action.label"
            v-bind="action"
            :label="__(action.label)"
            :loading="loading"
          />
        </div>
      </div>
    </template>
  </Dialog>
  <QuickEntryModal
    v-if="showQuickEntryModal"
    v-model="showQuickEntryModal"
    doctype="CRM Call Log"
  />
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
import { showQuickEntryModal, quickEntryProps } from '@/composables/modals'
import { getRandom } from '@/utils'
import { capture } from '@/telemetry'
import { useDocument } from '@/data/document'
import { FeatherIcon, createResource, ErrorMessage, Badge } from 'frappe-ui'
import { ref, nextTick, computed, onMounted, watch } from 'vue'
import { useDirtyState } from '@/composables/useDirtyState'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  options: {
    type: Object,
    default: {
      afterInsert: () => {},
    },
  },
  showTaskModal: {
    type: Boolean,
    default: false
  },
  showNoteModal: {
    type: Boolean,
    default: false
  }
})

const { isManager } = usersStore()

const show = defineModel()
const dialogShow = ref(false)
const showConfirmClose = ref(false)

const loading = ref(false)
const error = ref(null)
const editMode = ref(false)

const { isDirty, markAsDirty, resetDirty } = useDirtyState()

const { document: callLog } = useDocument(
  'CRM Call Log',
  props.data?.name || '',
)

const dialogOptions = computed(() => {
  let title = !editMode.value ? __('New Call Log') : __('Edit Call Log')
  let size = 'xl'
  let actions = [
    {
      label: editMode.value ? __('Save') : __('Create'),
      variant: 'solid',
      onClick: () => editMode.value ? updateCallLog() : createCallLog.submit(),
    },
  ]

  return { title, size, actions }
})

const tabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['QuickEntry', 'CRM Call Log'],
  params: { doctype: 'CRM Call Log', type: 'Quick Entry' },
  auto: true,
})

watch(
  () => show.value,
  (value) => {
    if (!value) return
    editMode.value = false
    nextTick(() => {
      callLog.doc = props.data || {}
      if (callLog.doc.name) {
        editMode.value = true
      }
      resetDirty()
      dialogShow.value = true
    })
  }
)

watch(
  () => dialogShow.value,
  (value) => {
    if (value) return
    if (props.showTaskModal || props.showNoteModal) {
      nextTick(() => {
        dialogShow.value = true
      })
      return
    }
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

function handleFieldChange() {
  markAsDirty()
}

function handleClose() {
  if (props.showTaskModal || props.showNoteModal) {
    return
  }
  
  if (isDirty.value) {
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
}

function cancelClose() {
  showConfirmClose.value = false
}

const callBacks = {
  onSuccess: (doc) => {
    loading.value = false
    handleCallLogUpdate(doc)
    resetDirty()
  },
  onError: (err) => {
    loading.value = false
    if (err.exc_type == 'MandatoryError') {
      const errorMessage = err.messages
        .map((msg) => msg.split(': ')[2].trim())
        .join(', ')
      error.value = __('These fields are required: {0}', [errorMessage])
      return
    }
    error.value = err
  },
}

async function updateCallLog() {
  error.value = null
  loading.value = true
  await callLog.save.submit(null, callBacks)
}

const createCallLog = createResource({
  url: 'frappe.client.insert',
  makeParams() {
    return {
      doc: {
        doctype: 'CRM Call Log',
        id: getRandom(6),
        telephony_medium: 'Manual',
        ...callLog.doc,
      },
    }
  },
  onSuccess(doc) {
    loading.value = false
    if (doc.name) {
      capture('call_log_created')
      handleCallLogUpdate(doc)
      resetDirty()
    }
  },
  onError(err) {
    callBacks.onError(err)
  },
})

function handleCallLogUpdate(doc) {
  if (!props.options.afterInsert || typeof props.options.afterInsert !== 'function') {
    if (!props.showTaskModal && !props.showNoteModal) {
      dialogShow.value = false
      show.value = false
    }
  }
  props.options.afterInsert && props.options.afterInsert(doc)
}

onMounted(() => {
  editMode.value = props.data?.name ? true : false

  if (!props.data?.name) {
    callLog.doc = { ...props.data }
  }
})

function openQuickEntryModal() {
  showQuickEntryModal.value = true
  quickEntryProps.value = { doctype: 'CRM Call Log' }
  nextTick(() => {
    dialogShow.value = false
  })
}
</script>
