<template>
  <div class="app-container">
    <!-- Loading overlay for Redis warmup or network errors -->
    <LoadingView 
      v-if="redisWarmup.isWarmingUp || hasNetworkErrors"
      :is-loading="redisWarmup.isWarmingUp || hasNetworkErrors"
      :redis-warmup="redisWarmup.isWarmingUp" 
      :redis-warmup-progress="redisWarmup.progress"
      :redis-warmup-details="redisWarmup.details"
      :redis-error="redisWarmup.error"
      :redis-error-message="redisWarmup.errorMessage"
      :network-errors="hasNetworkErrors"
      :error-details="networkErrorDetails"
      @retry="handleRetry"
      class="app-overlay"
    />
    
    <!-- Main app content - only hidden during Redis warmup or network errors -->
    <div v-show="!redisWarmup.isWarmingUp && !hasNetworkErrors" class="app-content">
      <Layout v-if="session().isLoggedIn">
        <router-view :key="translationKey" />
      </Layout>
      <Dialogs />
      <Toasts />
    </div>
  </div>
</template>

<script setup>
import { Dialogs } from '@/utils/dialogs'
import { sessionStore as session } from '@/stores/session'
import { setTheme } from '@/stores/theme'
import { Toasts, setConfig, createResource } from 'frappe-ui'
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import LoadingView from './components/common/LoadingView.vue'
import { lastTranslationUpdate } from './translation'

// Redis warmup state
const redisWarmup = ref({
  isWarmingUp: false,
  progress: 0,
  details: null,
  error: false,
  errorMessage: ''
})

// Network error tracking
const hasNetworkErrors = ref(false)
const networkErrorDetails = ref({
  count: 0,
  failedModules: new Set(),
  lastError: null
})

// Timers for managing Redis checks
let initialLoadTimer = null
let failsafeTimer = null
let redisCheckTimer = null
let networkErrorTimer = null

// Flag to track if Redis check has been started
let redisCheckStarted = false

// Flag to track if we received first response from Redis API
let receivedFirstRedisResponse = false

// Track script loading errors
function handleResourceError(e) {
  // Only track JS module loading errors
  if (e && e.target) {
    const isScript = e.target.tagName === 'SCRIPT';
    const isModuleError = e.message && (
      e.message.includes('error loading dynamically imported module') || 
      e.message.includes('NetworkError when attempting to fetch resource')
    );
    
    if (isScript || isModuleError) {
      // Get the URL of the failed resource
      const resourceUrl = e.target.src || e.target.href || (e.message && e.message.match(/http[s]?:\/\/[^\s]+/)?.[0] || 'Unknown resource');
      
      // Extract module name from URL for better visibility
      const moduleMatch = resourceUrl.match(/\/assets\/([^\/]+)-[a-f0-9]+\.js/);
      const moduleName = moduleMatch ? moduleMatch[1] : 'Unknown module';
      
      console.error('Network resource loading error:', {
        moduleName,
        resourceUrl,
        error: e.message || 'Unknown error'
      });
      
      // Add to set of failed modules
      networkErrorDetails.value.failedModules.add(moduleName);
      networkErrorDetails.value.count++;
      networkErrorDetails.value.lastError = e.message || 'Unknown error';
      
      // Show network error state
      hasNetworkErrors.value = true;
      
      // Clear any previous network error reset timer
      if (networkErrorTimer) {
        clearTimeout(networkErrorTimer);
      }
      
      // Auto-hide network errors after a longer timeout (20 seconds)
      // This gives the user time to see the error and retry if needed
      networkErrorTimer = setTimeout(() => {
        console.log('Auto-hiding network error screen after timeout');
        hasNetworkErrors.value = false;
      }, 20000);
    }
  }
}

// Check Redis cache status
const redisCacheStatus = createResource({
  url: 'crm.api.system.get_redis_cache_status',
  transform(data) {
    console.log('Redis cache status response:', data)
    receivedFirstRedisResponse = true
    
    if (data.status === 'success' && data.data) {
      const isCurrentlyWarmingUp = data.data.is_warming_up
      console.log('Redis cache warmup status:', isCurrentlyWarmingUp ? 'warming up' : 'ready', data.data)
      
      redisWarmup.value = {
        isWarmingUp: isCurrentlyWarmingUp,
        progress: data.data.progress || 0,
        details: data.data.details || null,
        error: false,
        errorMessage: ''
      }
      
      if (!isCurrentlyWarmingUp) {
        console.log('Redis cache is ready')
        stopRedisPolling()
      } else {
        console.log(`Redis cache warming up: ${data.data.progress}% complete`)
        startRedisPolling()
      }
      return data.data
    }
    
    console.warn('Invalid Redis cache status response:', data)
    handleRedisError('Invalid response from Redis status check')
    return null
  },
  onError: (error) => {
    console.error('Error checking Redis cache status:', error)
    handleRedisError(error)
  },
  auto: false
})

// Handle Redis errors
function handleRedisError(error) {
  // Stop any existing polling
  stopRedisPolling()
  
  // Show error state with more detailed message
  redisWarmup.value = {
    isWarmingUp: true,
    progress: 0,
    error: true,
    errorMessage: __('System is not ready. Please wait or contact administrator if the issue persists.')
  }
  
  // Try to reconnect after delay
  setTimeout(() => {
    console.log('Retrying Redis connection...')
    redisCacheStatus.submit()
  }, 5000) // Retry every 5 seconds
}

// Manage Redis polling
let redisPollingInterval = null;

// Start Redis polling
function startRedisPolling() {
  console.log('Starting Redis cache status polling')
  // Clear any existing interval first
  stopRedisPolling()
  
  // Set up polling every 5 seconds
  redisPollingInterval = setInterval(() => {
    console.log('Polling Redis cache status...')
    redisCacheStatus.submit()
  }, 5000)
}

// Safely stop Redis polling
function stopRedisPolling() {
  if (redisPollingInterval) {
    console.log('Stopping Redis polling')
    clearInterval(redisPollingInterval)
    redisPollingInterval = null
  }
}

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
