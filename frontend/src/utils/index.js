import { getMeta } from '@/stores/meta'
import TaskStatusIcon from '@/components/Icons/TaskStatusIcon.vue'
import TaskPriorityIcon from '@/components/Icons/TaskPriorityIcon.vue'
import { usersStore } from '@/stores/users'
import { gemoji } from 'gemoji'
import { toast, getConfig } from 'frappe-ui'
import { h } from 'vue'
import { translateTaskStatus } from '@/utils/taskStatusTranslations'
import { translateTaskPriority } from '@/utils/taskPriorityTranslations'
import localDayjs, { 
  formatDateInUserTimezone, 
  formatDateInSystemTimezone,
  toUserTimezone,
  timeAgo as dayjsTimeAgo,
} from './dayjs'

export function formatTime(seconds) {
  const days = Math.floor(seconds / (3600 * 24))
  const hours = Math.floor((seconds % (3600 * 24)) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = Math.floor(seconds % 60)

  let formattedTime = ''

  if (days > 0) {
    formattedTime += `${days}d `
  }

  if (hours > 0 || days > 0) {
    formattedTime += `${hours}h `
  }

  if (minutes > 0 || hours > 0 || days > 0) {
    formattedTime += `${minutes}m `
  }

  formattedTime += `${remainingSeconds}s`

  return formattedTime.trim()
}

export function formatDate(date, format, onlyDate = false, onlyTime = false, useSystemTimezone = false) {
  if (!date) return ''
  try {
    format = getFormat(date, format, onlyDate, onlyTime, false)
    
    // Use system timezone when explicitly requested or for system-level operations
    if (useSystemTimezone) {
      return formatDateInSystemTimezone(date, format)
    }
    
    // Default to user's timezone
    return formatDateInUserTimezone(date, format)
  } catch (e) {
    console.warn('Error formatting date:', e)
    return ''
  }
}

export function getFormat(
  date,
  format,
  onlyDate = false,
  onlyTime = false,
  withDate = true,
) {
  try {
    if (!date) return ''
    let dateFormat =
      window.sysdefaults?.date_format
        ?.replace('mm', 'MM')
        ?.replace('yyyy', 'YYYY')
        ?.replace('dd', 'DD') || 'YYYY-MM-DD'
    let timeFormat = window.sysdefaults?.time_format || 'HH:mm:ss'
    format = format || 'ddd, MMM D, YYYY h:mm a'

    if (onlyDate) format = dateFormat
    if (onlyTime) format = timeFormat
    if (onlyTime && onlyDate) format = `${dateFormat} ${timeFormat}`

    if (withDate) {
      return formatDateInUserTimezone(date, format)
    }
    return format
  } catch (e) {
    console.warn('Error getting format:', e)
    return 'YYYY-MM-DD HH:mm:ss'
  }
}

export const timeAgo = dayjsTimeAgo

function getBrowserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function extractValue(field) {
  if (!field) return ''
  return typeof field === 'object' ? field.value : field
}

export function extractLabel(field, translator) {
  if (!field) return ''
  if (typeof field === 'object') return field.label
  return translator ? translator(field) : field
}

export function taskStatusOptions(action, data) {
  let options = ['Backlog', 'Todo', 'In Progress', 'Done', 'Canceled']
  let statusMeta = getMeta('CRM Task')
    .getFields()
    ?.find((field) => field.fieldname == 'status')
  if (statusMeta) {
    options = statusMeta.options
      .map((option) => option.value)
      .filter((option) => option)
  }
  return options.map((status) => {
    return {
      icon: () => h(TaskStatusIcon, { status }),
      label: translateTaskStatus(status),
      value: status,
      onClick: () => action && action(status, data),
    }
  })
}

export function taskPriorityOptions(action, data) {
  let options = ['Low', 'Medium', 'High']
  let priorityMeta = getMeta('CRM Task')
    .getFields()
    ?.find((field) => field.fieldname == 'priority')
  if (priorityMeta) {
    options = priorityMeta.options
      .map((option) => option.value)
      .filter((option) => option)
  }

  return options.map((priority) => {
    return {
      label: translateTaskPriority(priority),
      value: priority,
      icon: () => h(TaskPriorityIcon, { priority }),
      onClick: () => action && action(priority, data),
    }
  })
}

export function openWebsite(url) {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url
  }
  window.open(url, '_blank')
}

export function website(url) {
  return url && url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '')
}

export function htmlToText(html) {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}

export function startCase(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function validateEmail(email) {
  let regExp =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
  return regExp.test(email)
}

export function parseAssignees(assignees) {
  let { getUser } = usersStore()
  return assignees.map((user) => ({
    name: user,
    image: getUser(user).user_image,
    label: getUser(user).full_name,
  }))
}

async function getFormScript(script, obj) {
  if (!script.includes('setupForm(')) return {}
  let scriptFn = new Function(script + '\nreturn setupForm')()
  let formScript = await scriptFn(obj)
  return formScript || {}
}

export async function setupCustomizations(doc, obj) {
  if (!doc.data?._form_script) return []

  let statuses = []
  let actions = []
  if (Array.isArray(doc.data._form_script)) {
    for (let script of doc.data._form_script) {
      let _script = await getFormScript(script, obj)
      actions = actions.concat(_script?.actions || [])
      statuses = statuses.concat(_script?.statuses || [])
    }
  } else {
    let _script = await getFormScript(doc.data._form_script, obj)
    actions = _script?.actions || []
    statuses = _script?.statuses || []
  }

  doc.data._customStatuses = statuses
  doc.data._customActions = actions
  return { statuses, actions }
}

async function getListScript(script, obj) {
  let scriptFn = new Function(script + '\nreturn setupList')()
  let listScript = await scriptFn(obj)
  return listScript || {}
}

export async function setupListCustomizations(data, obj = {}) {
  if (!data.list_script) return []

  let actions = []
  let bulkActions = []

  if (Array.isArray(data.list_script)) {
    for (let script of data.list_script) {
      let _script = await getListScript(script, obj)
      actions = actions.concat(_script?.actions || [])
      bulkActions = bulkActions.concat(_script?.bulk_actions || [])
    }
  } else {
    let _script = await getListScript(data.list_script, obj)
    actions = _script?.actions || []
    bulkActions = _script?.bulk_actions || []
  }

  data.listActions = actions
  data.bulkActions = bulkActions
  return { actions, bulkActions }
}

export function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(showSuccessAlert)
  } else {
    let input = document.createElement('textarea')
    document.body.appendChild(input)
    input.value = text
    input.select()
    document.execCommand('copy')
    showSuccessAlert()
    document.body.removeChild(input)
  }
  function showSuccessAlert() {
    toast.success(__('Copied to clipboard'))
  }
}

export const colors = [
  'gray',
  'blue',
  'green',
  'red',
  'pink',
  'orange',
  'amber',
  'yellow',
  'cyan',
  'teal',
  'violet',
  'purple',
  'black',
]

export function parseColor(color) {
  let textColor = `!text-${color}-600`
  if (color == 'black') {
    textColor = '!text-ink-gray-9'
  } else if (['gray', 'green'].includes(color)) {
    textColor = `!text-${color}-700`
  }

  return textColor
}

export function isEmoji(str) {
  const emojiList = gemoji.map((emoji) => emoji.emoji)
  return emojiList.includes(str)
}

export function isTouchScreenDevice() {
  return 'ontouchstart' in document.documentElement
}

export function convertArrayToString(array) {
  return array.map((item) => item).join(',')
}

export function _eval(code, context = {}) {
  let variable_names = Object.keys(context)
  let variables = Object.values(context)
  code = `let out = ${code}; return out`
  try {
    let expression_function = new Function(...variable_names, code)
    return expression_function(...variables)
  } catch (error) {
    console.log('Error evaluating the following expression:')
    console.error(code)
    throw error
  }
}

export function evaluateDependsOnValue(expression, doc) {
  if (!expression) return true
  if (!doc) return true

  let out = null

  if (typeof expression === 'boolean') {
    out = expression
  } else if (typeof expression === 'function') {
    out = expression(doc)
  } else if (expression.substr(0, 5) == 'eval:') {
    try {
      out = _eval(expression.substr(5), { doc })
    } catch (e) {
      out = true
    }
  } else {
    let value = doc[expression]
    if (Array.isArray(value)) {
      out = !!value.length
    } else {
      out = !!value
    }
  }

  return out
}

export function convertSize(size) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let unitIndex = 0
  while (size > 1024) {
    size /= 1024
    unitIndex++
  }
  return `${size?.toFixed(2)} ${units[unitIndex]}`
}

export function isImage(extention) {
  if (!extention) return false
  return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'bmp', 'webp'].includes(
    extention.toLowerCase(),
  )
}

export function validateIsImageFile(file) {
  const extn = file.name.split('.').pop().toLowerCase()
  if (!isImage(extn)) {
    return __('Only image files are allowed')
  }
}

export function getRandom(len = 4) {
  let text = ''
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

  Array.from({ length: len }).forEach(() => {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  })

  return text
}

export function runSequentially(functions) {
  return functions.reduce((promise, fn) => {
    return promise.then(() => fn())
  }, Promise.resolve())
}
