<template>
  <div>
    <!-- Redis cache warmup notice -->
    <div v-if="isRedisWarmupVisible" class="redis-warmup-overlay">
      <div class="redis-warmup-container">
        <div class="loading-spinner redis-spinner"></div>
        <h3 class="redis-warmup-title">{{ __('System Initialization') }}</h3>
        
        <!-- Show network error message -->
        <div v-if="networkErrors" class="redis-error-message">
          <p class="redis-error-text">{{ __('Network connection error') }}</p>
          <p class="redis-error-details" v-if="errorDetails?.lastError">
            {{ errorDetails.lastError.message || __('No error message available') }}
            <template v-if="errorDetails.lastError.type">
              <br><small>{{ __('Error type:') }} {{ errorDetails.lastError.type }}</small>
            </template>
            <template v-if="errorDetails.lastError.resource">
              <br><small>{{ __('Resource type:') }} {{ errorDetails.lastError.resource }}</small>
            </template>
            <template v-if="errorDetails.lastError.url">
              <br><small>{{ __('Resource URL:') }} {{ errorDetails.lastError.url }}</small>
            </template>
          </p>
          <p class="redis-error-modules" v-if="errorDetails?.failedModules?.size">
            {{ __('Failed modules:') }} {{ Array.from(errorDetails.failedModules).join(', ') }}
          </p>
          <button @click="$emit('retry')" class="retry-button">
            {{ __('Retry') }}
          </button>
        </div>
        
        <!-- Normal Redis warmup info -->
        <template v-else>
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

            <div class="detail-item" :class="{ 'is-ready': redisWarmupDetails.cache_keys_ready }">
              <span class="detail-label">{{ __('System Cache') }}</span>
              <span class="detail-status">{{ redisWarmupDetails.cache_keys_ready ? __('Ready') : __('Loading...') }}</span>
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
        </template>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * Component for displaying Redis cache warmup state
 */
export default {
  name: 'LoadingView',
  
  props: {
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
    },
    
    // Network error state
    networkErrors: {
      type: Boolean,
      default: false
    },
    
    // Network error details
    errorDetails: {
      type: Object,
      default: () => ({})
    }
  },
  
  emits: ['retry'],
  
  data() {
    return {
      isRedisWarmupVisible: false
    }
  },
  
  computed: {
    localizedReasons() {
      const reasonMap = {
        'missing_critical_doctypes': __('Loading critical components...'),
        'missing_background_doctypes': __('Loading background document types...'),
        'database_unhealthy': __('Initializing database...'),
        'websocket_unhealthy': __('Connecting to messaging system...'),
        'translations_not_loaded': __('Loading language packs...'),
        'workers_not_ready': __('Starting background processes...')
      };
      
      return this.redisWarmupDetails?.warming_up_reasons?.map(reason => reasonMap[reason] || reason) || [];
    }
  },
  
  watch: {
    redisWarmup(newValue) {
      // Only show component when redisWarmup is true or network errors exist
      this.isRedisWarmupVisible = newValue || this.networkErrors
    },
    
    networkErrors(newValue) {
      this.isRedisWarmupVisible = newValue || this.redisWarmup
    }
  },
  
  mounted() {
    this.isRedisWarmupVisible = this.redisWarmup || this.networkErrors
  }
}
</script>

<style>
.loading-spinner {
  @apply w-8 h-8 mb-4 border-2 rounded-full border-gray-200 dark:border-gray-700 border-t-gray-600 dark:border-t-gray-400;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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

.redis-warmup-subtext {
  @apply text-base mb-6 text-gray-600 dark:text-gray-400;
}

.redis-warmup-notice {
  @apply text-sm mb-4 text-yellow-600 dark:text-yellow-400;
}

/* Error message styling */
.redis-error-message {
  @apply mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-left;
}

.redis-error-text {
  @apply text-base font-medium text-red-700 dark:text-red-300 mb-2;
}

.redis-error-details, 
.redis-error-modules {
  @apply text-sm text-red-600 dark:text-red-400 mb-4;
}

.retry-button {
  @apply px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700 
         text-red-700 dark:text-red-200 rounded-md font-medium transition-colors;
}

/* Progress bar */
.redis-progress-container {
  @apply w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full mb-6 overflow-hidden;
}

.redis-progress-bar {
  @apply h-full bg-blue-500 dark:bg-blue-400 rounded-full;
  transition: width 0.5s ease-in-out;
}

/* Details section */
.redis-warmup-details {
  @apply text-sm text-left p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg;
}

.detail-item {
  @apply flex justify-between items-center mb-3 pb-2 border-b border-gray-200 dark:border-gray-700;
}

.detail-item:last-child {
  @apply mb-0 pb-0 border-0;
}

.detail-label {
  @apply font-medium text-gray-700 dark:text-gray-300;
}

.detail-status {
  @apply text-gray-600 dark:text-gray-400;
}

.is-ready .detail-status {
  @apply text-green-600 dark:text-green-400 font-medium;
}

.reason-item {
  @apply mb-1;
}

.reason-item:last-child {
  @apply mb-0;
}
</style> 