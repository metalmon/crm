<template>
  <SettingsPage
    doctype="WhatsApp Settings"
    :title="__('WhatsApp settings')"
    :successMessage="__('WhatsApp settings updated')"
    class="p-8"
  />
</template>
<script setup>
import SettingsPage from '@/components/Settings/SettingsPage.vue'
</script>