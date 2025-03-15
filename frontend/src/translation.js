import { createResource } from 'frappe-ui'
import { ref, nextTick } from 'vue'

// Constants for translation storage
const TRANSLATION_STORAGE_KEY = 'crm_translations'
const TRANSLATION_HASH_KEY = 'crm_translations_hash'
const TRANSLATION_TIMESTAMP_KEY = 'crm_translations_timestamp'

// Global Vue app instance reference for force update
let appInstance = null
let translationResource = null

// Export timestamp ref for components that need to react to translation updates
export const lastTranslationUpdate = ref(parseInt(localStorage.getItem(TRANSLATION_TIMESTAMP_KEY) || Date.now()))

export default function translationPlugin(app) {
  appInstance = app
  app.config.globalProperties.__ = translate
  window.__ = translate
  
  // Initialize translations
  initTranslations()
}

/**
 * Initialize translations by first loading from localStorage
 * and then checking server for updates
 */
function initTranslations() {
   // Try to load from localStorage first
  const cachedTranslations = loadTranslationsFromCache()
  
  if (cachedTranslations) {
    // Use cached translations immediately
    window.translatedMessages = cachedTranslations
  }
  
  // Check for updates from server
  if (!translationResource) {
    translationResource = createResource({
      url: 'crm.api.get_translations',
      auto: false, // Don't fetch automatically
      transform: (response) => {
        const { translations, hash } = response
        const cachedHash = localStorage.getItem(TRANSLATION_HASH_KEY)
        
        // Only update if hash is different or no cache exists
        if (!cachedHash || hash !== cachedHash) {
          updateTranslations(response)
        }
        return translations
      },
      onError: () => {
        // If error and no cached translations, set empty translations
        if (!window.translatedMessages) {
          window.translatedMessages = {}
        }
      }
    })
  }
  
  // Submit request to check for updates
  translationResource.submit()
}

/**
 * Update translations in memory and localStorage
 */
function updateTranslations(response) {
  const { translations, hash } = response
  
  // Update in-memory translations
  window.translatedMessages = translations
  
  // Save to localStorage
  saveTranslationsToCache(translations, hash)
  
  // Update timestamp ref to trigger reactivity
  lastTranslationUpdate.value = Date.now()
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
 * Load translations from localStorage if available
 * @returns {Object|null} Translations object or null if not available
 */
function loadTranslationsFromCache() {
  try {
    const translations = localStorage.getItem(TRANSLATION_STORAGE_KEY)
    
    if (!translations) {
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
