// Task priority translation utilities
//const { __ } = window

// Map of original priority values to their translations
export function taskPriorityTranslations() {
  return {
    'Low': window.__('Low', null, 'Task priority - lowest urgency level'),
    'Medium': window.__('Medium', null, 'Task priority - normal urgency level'),
    'High': window.__('High', null, 'Task priority - highest urgency level')
  }
}

// Reverse map for looking up original values from translations
export const reverseTaskPriorityTranslations = Object.entries(taskPriorityTranslations)
  .reduce((acc, [key, value]) => {
    acc[value] = key
    return acc
  }, {})

// Translate a priority to localized version
export const translateTaskPriority = (priority) => {
  if (!priority) return ''
  return window.__(priority) // Use __ directly to ensure translation at render time
}

// Get original priority from translated version
export function getOriginalTaskPriority(translatedPriority) {
  return reverseTaskPriorityTranslations[translatedPriority] || translatedPriority
} 