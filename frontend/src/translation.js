import { createResource } from 'frappe-ui'
import { ref, nextTick } from 'vue'

// Constants for translation storage
const TRANSLATION_STORAGE_KEY = 'crm_translations'
const TRANSLATION_HASH_KEY = 'crm_translations_hash'
const TRANSLATION_TIMESTAMP_KEY = 'crm_translations_timestamp'
const TRANSLATION_TTL = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

// State for tracking translation loading
export const translationState = {
  loading: ref(false),
  initialized: ref(false),
  lastUpdated: ref(null),
  isLatestVersion: ref(true),
  // This reactive reference will be updated when translations change
  translationsUpdated: ref(0)
}

// Global Vue app instance reference for force update
let appInstance = null

export default function translationPlugin(app) {
  appInstance = app
  app.config.globalProperties.__ = translate
  window.__ = translate
  // Add a global refresh function
  window.__refreshTranslations = fetchTranslations
  
  // Initialize translations from localStorage and fetch from server
  initTranslations()
}

/**
 * Initialize translations by first loading from localStorage if available
 * and then fetching from server to ensure up-to-date translations
 */
function initTranslations() {
  translationState.loading.value = true
  
  // First try to load from localStorage to have translations immediately available
  const cachedTranslations = loadTranslationsFromCache()
  
  if (cachedTranslations) {
    window.translatedMessages = cachedTranslations
    translationState.initialized.value = true
    translationState.lastUpdated.value = new Date(parseInt(localStorage.getItem(TRANSLATION_TIMESTAMP_KEY) || Date.now()))
  }
  
  // Then fetch from server to check if translations have changed
  checkTranslationUpdates()
}

/**
 * Check if translations need to be updated by comparing hashes
 */
function checkTranslationUpdates() {
  const cachedHash = localStorage.getItem(TRANSLATION_HASH_KEY)
  
  createResource({
    url: 'crm.api.get_translations',
    cache: 'translations_hash_check',
    auto: true,
    transform: (response) => {
      const { hash } = response
      
      if (!cachedHash || cachedHash !== hash) {
        // Hash is different or not available, need to update translations
        translationState.isLatestVersion.value = false
        // Update translations with full data
        updateTranslations(response)
      } else {
        // Translations are up to date
        translationState.loading.value = false
        translationState.isLatestVersion.value = true
      }
      
      return hash
    },
    onError: () => {
      translationState.loading.value = false
    }
  })
}

/**
 * Update translations with new data from server
 */
function updateTranslations(response) {
  const { translations, hash } = response
  const previousTranslations = window.translatedMessages || {}
  const hadPreviousTranslations = Object.keys(previousTranslations).length > 0
  
  // Update window translations
  window.translatedMessages = translations
  
  // Save to localStorage for future use
  saveTranslationsToCache(translations, hash)
  
  // Update translation state
  translationState.loading.value = false
  translationState.initialized.value = true
  translationState.isLatestVersion.value = true
  translationState.lastUpdated.value = new Date()
  
  // Increment translations updated counter to trigger reactivity
  translationState.translationsUpdated.value++
  
  // If we had previous translations and they were updated, force UI refresh
  if (hadPreviousTranslations && hash !== localStorage.getItem(TRANSLATION_HASH_KEY)) {
    forceUiRefresh()
  }
}

/**
 * Force UI to refresh after translations have changed
 */
function forceUiRefresh() {
  console.log('Translations updated, refreshing UI components')
  
  if (!appInstance) return
  
  // Use nextTick to ensure DOM updates happen after current render cycle
  nextTick(() => {
    // Notify all components that translations have changed
    appInstance.config.globalProperties.$forceUpdate()
    
    // Find all Vue component instances and force update them
    const rootElement = document.getElementById('app')
    if (rootElement && rootElement.__vue_app__) {
      // This triggers a refresh of reactive components
      document.dispatchEvent(new CustomEvent('translations-updated'))
    }
  })
}

/**
 * Format a message with replacement values
 */
function format(message, replace) {
  return message.replace(/{(\d+)}/g, function (match, number) {
    return typeof replace[number] != 'undefined' ? replace[number] : match
  })
}

/**
 * Translate a message with optional replacement values and context
 */
function translate(message, replace, context = null) {
  let translatedMessages = window.translatedMessages || {}
  let translatedMessage = ''

  if (context) {
    let key = `${message}:${context}`
    if (translatedMessages[key]) {
      translatedMessage = translatedMessages[key]
    }
  }

  if (!translatedMessage) {
    translatedMessage = translatedMessages[message] || message
  }

  const hasPlaceholders = /{\d+}/.test(message)
  if (!hasPlaceholders) {
    return translatedMessage
  }

  return format(translatedMessage, replace)
}

/**
 * Load translations from localStorage if available and not expired
 * @returns {Object|null} Translations object or null if not available
 */
function loadTranslationsFromCache() {
  try {
    const timestamp = localStorage.getItem(TRANSLATION_TIMESTAMP_KEY)
    const translations = localStorage.getItem(TRANSLATION_STORAGE_KEY)
    
    if (!translations || !timestamp) {
      return null
    }
    
    // Check if translations are expired
    const now = Date.now()
    if (now - parseInt(timestamp) > TRANSLATION_TTL) {
      // Clear expired translations
      localStorage.removeItem(TRANSLATION_STORAGE_KEY)
      localStorage.removeItem(TRANSLATION_HASH_KEY)
      localStorage.removeItem(TRANSLATION_TIMESTAMP_KEY)
      return null
    }
    
    return JSON.parse(translations)
  } catch (error) {
    console.error('Error loading translations from cache:', error)
    return null
  }
}

/**
 * Save translations to localStorage with timestamp and hash
 * @param {Object} translations - Translations object to save
 * @param {string} hash - Hash of translations for change detection
 */
function saveTranslationsToCache(translations, hash) {
  try {
    localStorage.setItem(TRANSLATION_STORAGE_KEY, JSON.stringify(translations))
    localStorage.setItem(TRANSLATION_HASH_KEY, hash)
    localStorage.setItem(TRANSLATION_TIMESTAMP_KEY, Date.now().toString())
  } catch (error) {
    console.error('Error saving translations to cache:', error)
    // If localStorage is full, clear it and try again
    try {
      localStorage.clear()
      localStorage.setItem(TRANSLATION_STORAGE_KEY, JSON.stringify(translations))
      localStorage.setItem(TRANSLATION_HASH_KEY, hash)
      localStorage.setItem(TRANSLATION_TIMESTAMP_KEY, Date.now().toString())
    } catch (e) {
      console.error('Failed to save translations even after clearing cache:', e)
    }
  }
}

/**
 * Fetch translations from server and update localStorage cache
 * @param {string} lang - Optional language code
 * @returns {Promise} - Resource promise
 */
function fetchTranslations(lang) {
  translationState.loading.value = true
  
  return createResource({
    url: 'crm.api.get_translations',
    cache: 'translations',
    auto: true,
    transform: (response) => {
      const { translations, hash } = response
      
      // Update translations
      updateTranslations(response)
      
      return translations
    },
    onError: () => {
      translationState.loading.value = false
    }
  })
}
