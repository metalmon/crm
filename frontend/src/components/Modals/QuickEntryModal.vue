<template>
  <Dialog v-model="show" :options="{ size: '4xl' }">
    <template #body-title>
      <h3
        class="flex items-baseline gap-2 text-2xl font-semibold leading-6 text-ink-gray-9"
      >
        <div class="mr-2">{{ __('Edit Quick Entry Layout') }}</div>
        <Badge
          v-if="dirty"
          :label="__('Not Saved')"
          variant="subtle"
          theme="orange"
        />
      </h3>
    </template>
    <template #body-content>
      <div class="flex flex-col gap-3">
        <div class="flex justify-between gap-2">
          <Button
            :label="preview ? __('Hide preview') : __('Show preview')"
            @click="preview = !preview"
          />
          <div class="flex flex-row-reverse gap-2">
            <Button
              :loading="loading"
              :label="__('Save')"
              variant="solid"
              @click="saveChanges"
            />
            <Button :label="__('Reset')" @click="reload" />
          </div>
        </div>
        <div v-if="tabs?.data">
          <FieldLayoutEditor
            v-if="!preview"
            :tabs="tabs.data"
            :doctype="_doctype"
            :onlyRequired="onlyRequired"
          />
          <FieldLayout v-else :tabs="tabs.data" :data="{}" :preview="true" />
        </div>
      </div>
    </template>
  </Dialog>
</template>
<script setup>
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import FieldLayoutEditor from '@/components/FieldLayoutEditor.vue'
import { useDebounceFn } from '@vueuse/core'
import { capture } from '@/telemetry'
import { Dialog, Badge, Switch, call, createResource } from 'frappe-ui'
import { ref, watch, onMounted, nextTick } from 'vue'

const props = defineProps({
  doctype: {
    type: String,
    default: 'CRM Lead',
  },
  onlyRequired: {
    type: Boolean,
    default: false,
  },
})

const show = defineModel()
const _doctype = ref(props.doctype)
const loading = ref(false)
const dirty = ref(false)
const preview = ref(false)

function getParams() {
  let type = props.onlyRequired ? 'Required Fields' : 'Quick Entry'
  return { doctype: _doctype.value, type }
}

const tabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['QuickEntryModal', _doctype.value, props.onlyRequired],
  params: getParams(),
  onSuccess(data) {
    tabs.originalData = JSON.parse(JSON.stringify(data))
  },
})

watch(
  () => tabs?.data,
  () => {
    dirty.value =
      JSON.stringify(tabs?.data) !== JSON.stringify(tabs?.originalData)
  },
  { deep: true },
)

onMounted(() => useDebounceFn(reload, 100)())

function reload() {
  nextTick(() => {
    tabs.params = getParams()
    tabs.reload()
  })
}

function saveChanges() {
  let _tabs = JSON.parse(JSON.stringify(tabs.data))
  _tabs.forEach((tab) => {
    if (!tab.sections) return
    tab.sections.forEach((section) => {
      section.columns.forEach((column) => {
        if (!column.fields) return
        column.fields = column.fields.map((field) => field.fieldname)
      })
    })
  })
  loading.value = true
  let type = props.onlyRequired ? 'Required Fields' : 'Quick Entry'
  call(
    'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.save_fields_layout',
    {
      doctype: _doctype.value,
      type: type,
      layout: JSON.stringify(_tabs),
    },
  ).then(() => {
    loading.value = false
    show.value = false
    capture('quick_entry_layout_builder', { doctype: _doctype.value })
  })
}
</script>
