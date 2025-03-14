<template>
  <Layout v-if="session().isLoggedIn">
    <router-view :key="translationKey" />
  </Layout>
  <Dialogs />
  <Toasts />
  <TranslationIndicator />
</template>

<script setup>
import { Dialogs } from '@/utils/dialogs'
import { sessionStore as session } from '@/stores/session'
import { setTheme } from '@/stores/theme'
import { Toasts, setConfig } from 'frappe-ui'
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue'
import TranslationIndicator from './components/TranslationIndicator.vue'
import { translationState } from './translation'

// This key will force router-view to completely re-render when translations change
const translationKey = computed(() => translationState.translationsUpdated.value)

const MobileLayout = defineAsyncComponent(
  () => import('./components/Layouts/MobileLayout.vue'),
)
const DesktopLayout = defineAsyncComponent(
  () => import('./components/Layouts/DesktopLayout.vue'),
)
const Layout = computed(() => {
  if (window.innerWidth < 640) {
    return MobileLayout
  } else {
    return DesktopLayout
  }
})

// Handler for translation updates
function handleTranslationUpdate() {
  console.log('Translations updated, refreshing components')
  // Force update will happen automatically via the computed key
}

onMounted(() => {
  setTheme()
  // Add event listener for translation updates
  document.addEventListener('translations-updated', handleTranslationUpdate)
})

onUnmounted(() => {
  // Clean up event listener
  document.removeEventListener('translations-updated', handleTranslationUpdate)
})

setConfig('systemTimezone', window.timezone?.system || null)
setConfig('localTimezone', window.timezone?.user || null)
</script>
