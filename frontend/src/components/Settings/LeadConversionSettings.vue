<template>
  <div class="flex h-full flex-col gap-6 px-6 py-8 text-ink-gray-8">
    <div class="flex flex-col gap-1 px-2">
      <h2 class="flex gap-2 text-xl font-semibold leading-none h-5">
        {{ __('Lead Conversion') }}
      </h2>
      <p class="text-p-base text-ink-gray-6">
        {{
          __(
            'Configure default settings for converting leads to deals',
          )
        }}
      </p>
    </div>

    <div class="flex-1 flex flex-col overflow-y-auto">
      <div class="flex items-center justify-between gap-8 py-3 px-2">
        <div class="flex flex-col">
          <div class="text-p-base font-medium text-ink-gray-7 truncate">
            {{ __('Default Status for Converted Lead') }}
          </div>
          <div class="text-p-sm text-ink-gray-5">
            {{
              __(
                'Status that will be set when lead is converted to deal. Leave empty to use first status by position.',
              )
            }}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <FormControl
            type="select"
            class="w-44"
            v-model="settings.doc.default_converted_lead_status"
            :options="[{ label: '', value: '' }, ...statusOptions('deal')]"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { getSettings } from '@/stores/settings'
import { FormControl, toast } from 'frappe-ui'
import { statusesStore } from '@/stores/statuses'
import { watch } from 'vue'

const { _settings: settings } = getSettings()
const { statusOptions } = statusesStore()

// Auto-save on change with debounce
let saveTimeout = null
watch(
  () => settings.doc.default_converted_lead_status,
  () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }
    saveTimeout = setTimeout(() => {
      if (settings.isDirty) {
        settings.save.submit(null, {
          onSuccess: () => {
            toast.success(__('Lead conversion settings updated successfully'))
          },
        })
      }
    }, 500)
  },
)
</script>

