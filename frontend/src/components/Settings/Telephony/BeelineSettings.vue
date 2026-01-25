<template>
  <SettingsPage
    doctype="Beeline Settings"
    :title="__('Beeline settings')"
    :successMessage="__('Beeline settings updated successfully')"
    class="p-8"
    :back="() => $emit('updateStep', 'telephony-settings')"
    :onSaveSuccess="handleBeelineSaveSuccess"
  />
</template>
<script setup>
import SettingsPage from '@/components/Settings/SettingsPage.vue'
import { call } from 'frappe-ui'

const emit = defineEmits(['updateStep'])

async function handleBeelineSaveSuccess() {
  try {
    const result = await call({
      method:
        'beeline.beeline.doctype.beeline_settings.beeline_settings.update_scheduler_frequency',
      args: {},
    })

    if (result && result.message) {
      console.log('Scheduler frequency update successful:', result.message)
    }
  } catch (err) {
    console.warn('Non-critical error updating scheduler frequency:', err)
  }
}
</script>

