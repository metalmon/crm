// Task status translation utilities
//const { __ } = window

// Map of original status values to their translations
export function taskStatusTranslations() {
  return {
    'Backlog': window.__('Backlog', null, 'Task status - items waiting to be processed'),
    'Todo': window.__('Todo', null, 'Task status - items that need to be done'),
    'In Progress': window.__('In Progress', null, 'Task status - items currently being worked on'),
    'Done': window.__('Done', null, 'Task status - completed items'),
    'Canceled': window.__('Canceled', null, 'Task status - items that were cancelled')
  }
}

// Reverse map for looking up original values from translations
export const reverseTaskStatusTranslations = Object.entries(taskStatusTranslations)
  .reduce((acc, [key, value]) => {
    acc[value] = key
    return acc
  }, {})

// Translate a status to localized version
export const translateTaskStatus = (status) => {
  if (!status) return ''
  return window.__(status) // Use __ directly to ensure translation at render time
}

// Get original status from translated version
export function getOriginalTaskStatus(translatedStatus) {
  return reverseTaskStatusTranslations[translatedStatus] || translatedStatus
} 