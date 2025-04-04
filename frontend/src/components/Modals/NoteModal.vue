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
      <div class="flex items-center gap-3">
        <h3 class="text-2xl font-semibold leading-6 text-ink-gray-9">
          {{ editMode ? __('Edit Note') : __('Create Note') }}
        </h3>
        <Button
          v-if="_note?.reference_docname"
          size="sm"
          :label="
            _note.reference_doctype == 'CRM Deal'
              ? __('Open Deal')
              : __('Open Lead')
          "
          @click="redirect()"
        >
          <template #suffix>
            <ArrowUpRightIcon class="h-4 w-4" />
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
            v-model="_note.title"
            :placeholder="__('Call with John Doe')"
            @update:modelValue="handleFieldChange"
          />
        </div>
        <div>
          <div class="mb-1.5 text-xs text-ink-gray-5">{{ __('Content') }}</div>
          <TextEditor
            variant="outline"
            ref="content"
            editor-class="!prose-sm overflow-auto min-h-[180px] max-h-80 py-1.5 px-2 rounded border border-[--surface-gray-2] bg-surface-gray-2 placeholder-ink-gray-4 hover:border-outline-gray-modals hover:bg-surface-gray-3 hover:shadow-sm focus:bg-surface-white focus:border-outline-gray-4 focus:shadow-sm focus:ring-0 focus-visible:ring-2 focus-visible:ring-outline-gray-3 text-ink-gray-8 transition-colors"
            :bubbleMenu="true"
            :content="_note.content"
            @change="(val) => { _note.content = val; handleFieldChange(); }"
            :placeholder="
              __('Took a call with John Doe and discussed the new project.')
            "
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
import ArrowUpRightIcon from '@/components/Icons/ArrowUpRightIcon.vue'
import ConfirmCloseDialog from '@/components/Modals/ConfirmCloseDialog.vue'
import { capture } from '@/telemetry'
import { TextEditor, call } from 'frappe-ui'
import { useOnboarding } from '@/components/custom-ui/onboarding/onboarding'
import { ref, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'

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
})

const show = defineModel()
const dialogShow = ref(false)
const showConfirmClose = ref(false)

const notes = defineModel('reloadNotes')

const emit = defineEmits(['after'])

const router = useRouter()

const { updateOnboardingStep } = useOnboarding('frappecrm')

const title = ref(null)
const editMode = ref(false)
const isDirty = ref(false)
let _note = ref({})

watch(
  () => show.value,
  (value) => {
    if (value === dialogShow.value) return
    if (value) {
      _note.value = { ...props.note }
      editMode.value = !!props.note.name
      isDirty.value = false
      dialogShow.value = true
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
  isDirty.value = true
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
  isDirty.value = false
  dialogShow.value = false
  show.value = false
}

function cancelClose() {
  showConfirmClose.value = false
}

async function updateNote() {
  if (
    props.note.title === _note.value.title &&
    props.note.content === _note.value.content
  )
    return

  if (_note.value.name) {
    let d = await call('frappe.client.set_value', {
      doctype: 'FCRM Note',
      name: _note.value.name,
      fieldname: _note.value,
    })
    if (d.name) {
      notes.value?.reload()
      emit('after', d)
      isDirty.value = false
      dialogShow.value = false
      show.value = false
    }
  } else {
    let d = await call('frappe.client.insert', {
      doc: {
        doctype: 'FCRM Note',
        title: _note.value.title,
        content: _note.value.content,
        reference_doctype: props.doctype,
        reference_docname: props.doc || '',
      },
    })
    if (d.name) {
      updateOnboardingStep('create_first_note')
      capture('note_created')
      notes.value?.reload()
      emit('after', d, true)
      isDirty.value = false
      dialogShow.value = false
      show.value = false
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
