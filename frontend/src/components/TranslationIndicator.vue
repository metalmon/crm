<template>
  <div 
    v-if="showIndicator" 
    class="translation-indicator"
    :class="{ 
      'is-loading': loading, 
      'is-outdated': isOutdated,
      'is-updated': recentlyUpdated && !loading && !isOutdated
    }"
  >
    <div class="indicator-content">
      <FeatherIcon name="globe" class="icon" />
      <span v-if="loading">{{ __('Loading translations...') }}</span>
      <span v-else-if="isOutdated">{{ __('Updating translations...') }}</span>
      <span v-else-if="recentlyUpdated">{{ __('Translations updated!') }}</span>
      <span v-else>{{ __('Translations loaded') }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { translationState } from '../translation'
import FeatherIcon from 'frappe-ui/src/components/FeatherIcon.vue'

const props = defineProps({
  autoHide: {
    type: Boolean,
    default: true
  },
  hideDelay: {
    type: Number,
    default: 2000 // 2 seconds
  },
  updateNotificationDelay: {
    type: Number,
    default: 3000 // 3 seconds
  }
})

const visible = ref(false)
const timeoutId = ref(null)
const recentlyUpdated = ref(false)
const lastTranslationUpdate = ref(0)

const loading = computed(() => translationState.loading.value)
const initialized = computed(() => translationState.initialized.value)
const isOutdated = computed(() => !translationState.isLatestVersion.value)
const translationsUpdated = computed(() => translationState.translationsUpdated.value)

const showIndicator = computed(() => {
  return visible.value && (loading.value || isOutdated.value || recentlyUpdated.value || !props.autoHide)
})

// Show indicator when loading starts or translations are outdated
watch([() => translationState.loading.value, () => translationState.isLatestVersion.value], 
  ([isLoading, isLatest]) => {
    if (isLoading || !isLatest) {
      makeIndicatorVisible()
      clearTimeout(timeoutId.value)
    } else if (props.autoHide) {
      hideAfterDelay()
    }
  }
)

// Watch for translation updates
watch(() => translationState.translationsUpdated.value, (newVal, oldVal) => {
  if (newVal !== oldVal && oldVal > 0) {
    // Translations were updated, show notification
    recentlyUpdated.value = true
    makeIndicatorVisible()
    clearTimeout(timeoutId.value)
    
    // Hide after notification delay
    setTimeout(() => {
      recentlyUpdated.value = false
      if (props.autoHide) {
        hideAfterDelay()
      }
    }, props.updateNotificationDelay)
    
    lastTranslationUpdate.value = newVal
  }
})

// Initially show if we're loading or translations are outdated
onMounted(() => {
  if (translationState.loading.value || !translationState.isLatestVersion.value) {
    makeIndicatorVisible()
  }
})

function makeIndicatorVisible() {
  visible.value = true
}

function hideIndicator() {
  visible.value = false
}

function hideAfterDelay() {
  clearTimeout(timeoutId.value)
  timeoutId.value = setTimeout(() => {
    hideIndicator()
  }, props.hideDelay)
}
</script>

<style scoped>
.translation-indicator {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  z-index: 1000;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: opacity 0.3s ease;
}

.indicator-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon {
  width: 16px;
  height: 16px;
}

.is-loading {
  animation: pulse 1.5s infinite;
}

.is-outdated {
  background-color: #fff8e1;
  border-color: #ffd54f;
}

.is-updated {
  background-color: #e8f5e9;
  border-color: #66bb6a;
  animation: fadeIn 0.5s ease-in;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(0, 0, 0, 0.1);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(0, 0, 0, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(0, 0, 0, 0);
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Dark mode support */
:root.dark .translation-indicator {
  background-color: #2d3748;
  border-color: #4a5568;
  color: #e2e8f0;
}

:root.dark .is-outdated {
  background-color: #4a3f10;
  border-color: #b39121;
  color: #e2e8f0;
}

:root.dark .is-updated {
  background-color: #1b3a27;
  border-color: #2e7d32;
  color: #e2e8f0;
}
</style> 