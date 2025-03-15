<template>
  <div>
    <!-- Redis cache warmup notice -->
    <div v-if="isRedisWarmupVisible" class="redis-warmup-overlay">
      <div class="redis-warmup-container">
        <div class="loading-spinner redis-spinner"></div>
        <h3 class="redis-warmup-title">{{ __('System Initialization') }}</h3>
        
        <p class="redis-warmup-text">{{ __('System initialization in progress...') }}</p>
        <p class="redis-warmup-subtext">
          {{ __('Please wait while the system is being prepared.') }}
        </p>
        
        <!-- Background loading message -->
        <p v-if="redisWarmupDetails?.loading_in_background" class="redis-warmup-notice">
          {{ __('Loading required components in background...') }}
        </p>
        
        <!-- Progress bar -->
        <div v-if="redisWarmupProgress > 0" class="redis-progress-container">
          <div class="redis-progress-bar" :style="`width: ${redisWarmupProgress}%`"></div>
        </div>
        
        <!-- Initialization details -->
        <div v-if="redisWarmupDetails" class="redis-warmup-details">
          <div class="detail-item" :class="{ 'is-ready': redisWarmupDetails.translations_loaded }">
            <span class="detail-label">{{ __('Translations') }}</span>
            <span class="detail-status">{{ redisWarmupDetails.translations_loaded ? __('Ready') : __('Loading...') }}</span>
          </div>
          
          <div class="detail-item" :class="{ 'is-ready': redisWarmupDetails.workers_ready }">
            <span class="detail-label">{{ __('Background Workers') }}</span>
            <span class="detail-status">{{ redisWarmupDetails.workers_ready ? __('Ready') : __('Starting...') }}</span>
      </div>
          
          <div class="detail-item">
            <span class="detail-label">{{ __('Required Data') }}</span>
            <span class="detail-status">{{ redisWarmupDetails.critical_doctypes_ready }}</span>
    </div>

          <div class="detail-item">
            <span class="detail-label">{{ __('System Cache') }}</span>
            <span class="detail-status">{{ redisWarmupDetails.cache_keys_ready }}</span>
        </div>

          <div v-if="redisWarmupDetails?.warming_up_reasons?.length" class="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <h3 class="text-sm font-medium text-yellow-800 dark:text-yellow-200">{{ __('Current processes:') }}</h3>
            <ul class="mt-2 text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside">
              <li v-for="reason in localizedReasons" :key="reason" class="reason-item">
                {{ reason }}
              </li>
          </ul>
        </div>
        </div>
      </div>
    </div>

    <!-- Regular loading state - shown only for slower loads -->
    <div v-if="isVisible && !isRedisWarmupVisible" class="loading-state">
      <div class="loading-spinner"></div>
      <p class="loading-text">{{ __('Loading data...') }}</p>
      
      <!-- Additional message for exceptionally long loads -->
      <p v-if="showLongMessage" class="loading-subtext">
        {{ __('This is taking longer than usual. Please wait...') }}
      </p>
    </div>
  </div>
</template>

<script>
/**
 * A reusable loading component with delayed visibility 
 * that prevents flickering for fast loads
 */
export default {
  name: 'LoadingView',
  
  props: {
    // Whether the component is in loading state
    isLoading: {
      type: Boolean,
      required: true
    },
    
    // Delay before showing the loading indicator (ms)
    initialDelay: {
      type: Number,
      default: 500
    },
    
    // Delay before showing the "taking longer" message (ms)
    longMessageDelay: {
      type: Number,
      default: 7000
    },
    
    // Redis cache warmup state
    redisWarmup: {
      type: Boolean,
      default: false
    },
    
    // Redis cache warmup progress (0-100)
    redisWarmupProgress: {
      type: Number,
      default: 0
    },
    
    redisWarmupDetails: {
      type: Object,
      default: () => ({})
    }
  },
  
  data() {
    return {
      isVisible: false,
      showLongMessage: false,
      isRedisWarmupVisible: false,
      timers: {
        initialDelay: null,
        longMessage: null
      }
    }
  },
  
  computed: {
    localizedReasons() {
      const reasonMap = {
        'missing_critical_doctypes': 'Загрузка критически важных компонентов...',
        'database_unhealthy': 'Инициализация базы данных...',
        'websocket_unhealthy': 'Подключение к системе обмена сообщениями...',
        'translations_not_loaded': 'Загрузка языковых пакетов...',
        'workers_not_ready': 'Запуск фоновых процессов...'
      };
      
      return this.redisWarmupDetails?.warming_up_reasons?.map(reason => reasonMap[reason] || reason) || [];
    }
  },
  
  watch: {
    isLoading(newValue, oldValue) {
      if (newValue === true && oldValue === false) {
        this.setupTimers()
      } else if (newValue === false && oldValue === true) {
        this.clearTimers()
        this.isVisible = false
        this.showLongMessage = false
      }
    },
    
    redisWarmup(newValue) {
      this.isRedisWarmupVisible = newValue
      if (newValue) {
        this.clearTimers()
        this.isVisible = false
        this.showLongMessage = false
      }
    },
    
    redisWarmupProgress(newValue) {
      // Empty watcher for progress updates
    }
  },
  
  mounted() {
    this.isRedisWarmupVisible = this.redisWarmup
    
    if (this.isLoading && !this.redisWarmup) {
      this.setupTimers()
    }
  },
  
  beforeUnmount() {
    this.clearTimers()
  },
  
  methods: {
    setupTimers() {
      if (this.redisWarmup) return
      
      this.clearTimers()
      this.isVisible = false
      this.showLongMessage = false
      
      this.timers.initialDelay = setTimeout(() => {
        if (this.isLoading) {
          this.isVisible = true
          
          this.timers.longMessage = setTimeout(() => {
            if (this.isLoading) {
              this.showLongMessage = true
            }
          }, this.longMessageDelay)
        }
      }, this.initialDelay)
    },
    
    clearTimers() {
      if (this.timers.initialDelay) {
        clearTimeout(this.timers.initialDelay)
        this.timers.initialDelay = null
      }
      if (this.timers.longMessage) {
        clearTimeout(this.timers.longMessage)
        this.timers.longMessage = null
      }
    }
  }
}
</script>

<style>
/* Base loading state */
.loading-state {
  @apply flex flex-col items-center justify-center h-[60vh] text-center text-gray-600 dark:text-gray-400;
}

.loading-spinner {
  @apply w-8 h-8 mb-4 border-2 rounded-full border-gray-200 dark:border-gray-700 border-t-gray-600 dark:border-t-gray-400;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  @apply text-base mb-2;
}

.loading-subtext {
  @apply text-sm opacity-80 mb-4;
}

/* Redis warmup overlay */
.redis-warmup-overlay {
  @apply fixed inset-0 w-full h-full bg-white dark:bg-gray-900 flex items-center justify-center z-50;
}

.redis-warmup-container {
  @apply w-full max-w-lg p-6 text-center;
}

.redis-spinner {
  @apply w-8 h-8 mx-auto mb-6 border-2 rounded-full border-gray-200 dark:border-gray-700 border-t-gray-600 dark:border-t-gray-400;
  animation: spin 1s linear infinite;
}

.redis-warmup-title {
  @apply text-xl font-medium mb-4 text-gray-900 dark:text-white;
}

.redis-warmup-text {
  @apply text-base mb-2 text-gray-600 dark:text-gray-400;
}

.redis-warmup-subtext {
  @apply text-sm mb-6 text-gray-500 dark:text-gray-500;
}

.redis-progress-container {
  @apply h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mt-4;
}

.redis-progress-bar {
  @apply h-full bg-gray-600 dark:bg-gray-400 rounded-full transition-all duration-300 ease-in-out;
}

.redis-warmup-details {
  @apply mt-6 space-y-2 text-left max-w-sm mx-auto;
}

.detail-item {
  @apply flex justify-between items-center py-2 px-4 rounded bg-gray-50 dark:bg-gray-800;
}

.detail-item.is-ready {
  @apply bg-gray-100 dark:bg-gray-700;
}

.detail-label {
  @apply text-sm text-gray-600 dark:text-gray-400;
}

.detail-status {
  @apply text-sm font-medium text-gray-900 dark:text-white;
}

.redis-warmup-notice {
  @apply text-sm text-blue-600 dark:text-blue-400;
  @apply mt-2 mb-1;
  @apply font-medium;
}

.reason-item {
  @apply text-yellow-700 dark:text-yellow-300;
  @apply my-1;
  @apply text-sm;
}
</style> 