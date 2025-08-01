<template>
  <div class="flex h-full flex-col gap-6 p-8 text-ink-gray-8">
    <!-- Header -->
    <div class="flex justify-between">
      <div class="flex gap-1 -ml-4 w-9/12">
        <Button
          variant="ghost"
          icon-left="chevron-left"
          :label="__('Conversion settings')"
          size="md"
          @click="() => emit('updateStep', 'general-settings')"
          class="text-xl !h-7 font-semibold hover:bg-transparent focus:bg-transparent focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:none active:bg-transparent active:outline-none active:ring-0 active:ring-offset-0 active:text-ink-gray-5"
        />
      </div>
      <div class="flex item-center space-x-2 w-3/12 justify-end">
        <Button
          :label="__('Update')"
          icon-left="plus"
          variant="solid"
          :disabled="!settings.isDirty"
          :loading="settings.loading"
          @click="updateSettings"
        />
      </div>
    </div>

    <!-- Fields -->
    <div class="flex flex-1 flex-col gap-4 overflow-y-auto dark-scrollbar">
      <!-- Lead conversion status -->
      <div class="flex flex-col justify-between gap-4">
        <span class="text-base font-semibold text-ink-gray-9">
          {{ __('Lead Conversion') }}
        </span>
        <div class="flex w-full">
          <FormControl
            type="select"
            class="w-full max-w-md"
            v-model="settings.doc.default_converted_lead_status"
            :label="__('Default Status for Converted Lead')"
            :options="[{ label: '', value: '' }, ...statusOptions('deal')]"
            :description="__('Status that will be set when lead is converted to deal. Leave empty to use first status by position.')"
          />
        </div>
      </div>
    </div>
    <div v-if="errorMessage">
      <ErrorMessage :message="__(errorMessage)" />
    </div>
  </div>
</template>
<script setup>
import { FormControl, ErrorMessage } from 'frappe-ui'
import { getSettings } from '@/stores/settings'
import { statusesStore } from '@/stores/statuses'
import { ref } from 'vue'

const { _settings: settings } = getSettings()
const { statusOptions } = statusesStore()

const emit = defineEmits(['updateStep'])
const errorMessage = ref('')

function updateSettings() {
  settings.save.submit(null, {
    onSuccess: () => {
      // Settings saved successfully, modal stays open
    },
  })
}
</script> 