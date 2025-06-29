<template>
  <Dialog
    v-model="dialogShow"
    :options="{
      size: 'xl',
      actions: [
        {
          label: editMode ? __('Update') : __('Create'),
          variant: 'solid',
          onClick: () => updateNote(),
        },
      ],
    }"
  >
    <template #body-title>
      <div class="flex items-baseline gap-3">
        <h3 class="text-2xl font-semibold leading-6 text-ink-gray-9 mr-2">
          {{ editMode ? __('Edit Note') : __('Create Note') }}
        </h3>
        <Badge v-if="isDirty" :label="__('Not Saved')" theme="orange" />
        <Button v-if="_note?.reference_docname" size="sm" :label="_note.reference_doctype == 'CRM Deal'
          ? __('Open Deal')
          : __('Open Lead')
          " @click="redirect()">
          <template #suffix>
            <ArrowUpRightIcon class="w-4 h-4" />
          </template>
        </Button>
      </div>
    </template>
    <template #body-content>
      <div class="flex flex-col gap-4">
        <div>
          <FormControl
            ref="title"
            :label="__('Title')"
            v-model="_note.doc.title"
            :placeholder="__('Call with John Doe')"
            required
            @update:modelValue="handleFieldChange"
          />
        </div>
        <div>
          <div class="mb-1.5 text-xs text-ink-gray-5">{{ __('Content') }}</div>
          <TextEditor variant="outline" ref="content"
            editor-class="!prose-sm overflow-auto min-h-[180px] max-h-80 py-1.5 px-2 rounded border border-[--surface-gray-2] bg-surface-gray-2 placeholder-ink-gray-4 hover:border-outline-gray-modals hover:bg-surface-gray-3 hover:shadow-sm focus:bg-surface-white focus:border-outline-gray-4 focus:shadow-sm focus:ring-0 focus-visible:ring-2 focus-visible:ring-outline-gray-3 text-ink-gray-8 transition-colors"
            :bubbleMenu="true"
            :content="_note.doc.content"
            @change="(val) => { _note.doc.content = val; handleFieldChange(); }"
            :placeholder="
              __('Took a call with John Doe and discussed the new project.')
            "
          />
        </div>
        <ErrorMessage class="mt-4" v-if="error" :message="__(error)" />
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
import ArrowUpRightIcon from '@/components/Icons/ArrowUpRightIcon.vue'
import ConfirmCloseDialog from '@/components/Modals/ConfirmCloseDialog.vue'
import { capture } from '@/telemetry'
import { TextEditor, call, createResource, Badge } from 'frappe-ui'
import { useOnboarding } from '@/components/custom-ui/onboarding/onboarding'
import { useDocument } from '@/data/document'
import { ref, nextTick, watch, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDirtyState } from '@/composables/useDirtyState'

const props = defineProps({
  note: {
    type: Object,
    default: {},
  },
  doctype: {
    type: String,
    default: 'CRM Lead',
  },
  doc: {
    type: String,
    default: '',
  },
  autoClose: {
    type: Boolean,
    default: true,
  },
})

const show = defineModel()
const dialogShow = ref(false)
const showConfirmClose = ref(false)
const shouldOpenLayoutSettings = ref(false)

const notes = defineModel('reloadNotes')

const emit = defineEmits(['after'])

const router = useRouter()

const { updateOnboardingStep } = useOnboarding('frappecrm')

const error = ref(null)
const title = ref(null)
const editMode = ref(false)

const { isDirty, markAsDirty, resetDirty } = useDirtyState()

const { document: _note } = useDocument('FCRM Note')

watch(
  () => show.value,
  (value) => {
    if (value === dialogShow.value) return
    if (value) {
      resetDirty()
      // Initialize note document when the modal opens
      _note.doc = {
        title: '',
        content: '',
        reference_doctype: props.doctype,
        reference_docname: props.doc || null,
        ...props.note
      }
      editMode.value = !!props.note?.name
      dialogShow.value = true
    } else {
      // Reset note document when the modal closes
      _note.doc = {}
      dialogShow.value = false
    }
  },
  { immediate: true }
)

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

function handleFieldChange() {
  markAsDirty()
}

function handleClose() {
  if (isDirty.value) {
    shouldOpenLayoutSettings.value = false
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
    quickEntryProps.value = { doctype: 'FCRM Note' }
    nextTick(() => {
      shouldOpenLayoutSettings.value = false
    })
  }
}

function cancelClose() {
  showConfirmClose.value = false
  shouldOpenLayoutSettings.value = false
}

async function updateNote() {
  if (_note.doc.name) {
    let d = await call('frappe.client.set_value', {
      doctype: 'FCRM Note',
      name: _note.doc.name,
      fieldname: _note.doc,
    })
    if (d.name) {
      notes.value?.reload()
      emit('after', d)
      resetDirty()
      if (props.autoClose) {
        dialogShow.value = false
      }
    }
  } else {
    let d = await call('frappe.client.insert', {
      doc: {
        doctype: 'FCRM Note',
        title: _note.doc.title,
        content: _note.doc.content,
        reference_doctype: props.doctype,
        reference_docname: props.doc || '',
      },
    }, {
      onError: (err) => {
        if (err.error.exc_type == 'MandatoryError') {
          error.value = __("Title is mandatory")
        }
      }
    })
    if (d.name) {
      updateOnboardingStep('create_first_note')
      capture('note_created')
      notes.value?.reload()
      emit('after', d, true)
      resetDirty()
      if (props.autoClose) {
        dialogShow.value = false
      }
    }
  }
}

function redirect() {
  if (!props.note?.reference_docname) return
  let name = props.note.reference_doctype == 'CRM Deal' ? 'Deal' : 'Lead'
  let params = { leadId: props.note.reference_docname }
  if (name == 'Deal') {
    params = { dealId: props.note.reference_docname }
  }
  router.push({ name: name, params: params })
}
</script>
