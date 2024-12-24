import { createResource } from 'frappe-ui'
import { ref } from 'vue'

// Create a reactive translation store
const translations = ref({})
const isInitialized = ref(false)

// Cache key for translations
const TRANSLATIONS_CACHE_KEY = 'crm_translations_cache'
const TRANSLATIONS_CACHE_TIMESTAMP = 'crm_translations_timestamp'
const CACHE_VALIDITY_HOURS = 24

// Check if we're in development mode
const isDevelopment = import.meta.env.DEV

// Default translation function
export const __ = (str) => {
  if (!str) return ''
  return translations.value[str] || str
}

// Load translations from cache
function loadFromCache() {
  if (isDevelopment) return false
  
  try {
    const timestamp = localStorage.getItem(TRANSLATIONS_CACHE_TIMESTAMP)
    if (timestamp) {
      const cacheAge = (Date.now() - parseInt(timestamp)) / (1000 * 60 * 60)
      if (cacheAge < CACHE_VALIDITY_HOURS) {
        const cached = localStorage.getItem(TRANSLATIONS_CACHE_KEY)
        if (cached) {
          translations.value = JSON.parse(cached)
          isInitialized.value = true
          return true
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load translations from cache:', e)
  }
  return false
}

// Save translations to cache
function saveToCache(data) {
  if (isDevelopment) return
  
  try {
    localStorage.setItem(TRANSLATIONS_CACHE_KEY, JSON.stringify(data))
    localStorage.setItem(TRANSLATIONS_CACHE_TIMESTAMP, Date.now().toString())
  } catch (e) {
    console.warn('Failed to cache translations:', e)
  }
}

// Add retry logic and better error handling
async function fetchTranslations() {
  const maxRetries = isDevelopment ? 0 : 3 // No retries in development mode
  let retryCount = 0

  while (retryCount <= maxRetries) {
    try {
      const response = createResource({
        url: 'crm.api.get_translations',
        onError: (error) => {
          console.warn('Translation fetch warning:', error)
          return {}
        },
        cache: isDevelopment ? false : ['translations'],
      })

      await response.fetch()
      if (response.data) {
        translations.value = response.data
        saveToCache(response.data)
      }
      isInitialized.value = true
      return translations.value
    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.warn('Translation fetch failed after retries:', error)
        isInitialized.value = true
        return {}
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)))
    }
  }
}

// Single export for the translation plugin
export default {
  install: (app) => {
    // Register the translation function globally
    app.config.globalProperties.__ = __
    app.provide('__', __)

    // Try to load from cache first (skip in development)
    const loadedFromCache = loadFromCache()

    // Load translations in the background
    fetchTranslations().then(() => {
      if (isDevelopment) {
        console.log('Translations loaded (development mode)')
      } else {
        console.log('Translations loaded')
      }
    }).catch(error => {
      console.warn('Translation plugin initialization warning:', error)
    })
  },
}

// Export initialization status
export const translationsReady = isInitialized