<template>
  <SettingsPage
    doctype="Twilio Settings"
    :title="__('Twilio settings')"
    :successMessage="__('Twilio settings updated')"
    class="p-8"
  />
</template>
<script setup>
import SettingsPage from '@/components/Settings/SettingsPage.vue'
</script>
