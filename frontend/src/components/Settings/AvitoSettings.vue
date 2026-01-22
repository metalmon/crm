<template>
  <SettingsPage
    doctype="Avito Settings"
    :title="__('Avito settings')"
    :successMessage="__('Avito settings updated')"
    class="p-8"
  />
</template>
<script setup>
import SettingsPage from '@/components/Settings/SettingsPage.vue'
</script>