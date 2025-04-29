<template>
  <FrappeUIProvider>
    <Layout v-if="session().isLoggedIn">
      <router-view />
    </Layout>
    <Dialogs />
  </FrappeUIProvider>
</template>

<script setup>
import { Dialogs } from '@/utils/dialogs'
import { sessionStore as session } from '@/stores/session'
import { setTheme } from '@/stores/theme'
import { FrappeUIProvider, setConfig } from 'frappe-ui'
import { computed, defineAsyncComponent, onMounted } from 'vue'

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

// Start Redis check if application needs it
function startRedisCheck() {
  if (redisCheckStarted) return
  
  console.log('Starting initial Redis cache check')
  redisCheckStarted = true
  
  // Start initial Redis check immediately
  redisCacheStatus.submit()
  
  // Set a short timer to check if Redis responded
  redisCheckTimer = setTimeout(() => {
    if (!receivedFirstRedisResponse) {
      console.warn('No Redis response received, checking system status')
      handleRedisError(__('Checking system readiness...'))
    }
  }, 1500)
}

// Handle retry function
function handleRetry() {
  console.log('Retrying system initialization')
  redisCacheStatus.submit()
}

// This key will force router-view to completely re-render when translations change
const translationKey = computed(() => lastTranslationUpdate.value)

onMounted(() => {
  setTheme()
  window.addEventListener('error', handleResourceError, true)
  window.addEventListener('unhandledrejection', handleResourceError, true)
  
  // Start Redis check immediately after mount
  startRedisCheck()
})

onUnmounted(() => {
  // Clean up event listeners
  window.removeEventListener('error', handleResourceError, true)
  window.removeEventListener('unhandledrejection', handleResourceError, true)
  
  // Stop Redis status polling
  stopRedisPolling()
  
  // Clear all timers
  if (networkErrorTimer) clearTimeout(networkErrorTimer)
})

setConfig('systemTimezone', window.timezone?.system || null)
setConfig('localTimezone', window.timezone?.user || null)
</script>

<style>
.app-container {
  position: relative;
  min-height: 100vh;
  width: 100%;
}

.app-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 9999;
}

.app-content {
  position: relative;
  z-index: 1;
}
</style>
