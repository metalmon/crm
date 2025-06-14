import dayjs from 'dayjs'
import advancedFormat from 'dayjs/plugin/advancedFormat'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import relativeTime from 'dayjs/plugin/relativeTime'
import updateLocale from 'dayjs/plugin/updateLocale'

// Import common locales
import 'dayjs/locale/en'
import 'dayjs/locale/ru'
import 'dayjs/locale/es'
import 'dayjs/locale/fr'
import 'dayjs/locale/de'
import 'dayjs/locale/it'
import 'dayjs/locale/pt'
import 'dayjs/locale/zh'
import 'dayjs/locale/ja'
import 'dayjs/locale/ko'
import 'dayjs/locale/ar'
import 'dayjs/locale/hi'

// Extend dayjs with plugins
dayjs.extend(advancedFormat)
dayjs.extend(timezone)
dayjs.extend(utc)
dayjs.extend(localizedFormat)
dayjs.extend(relativeTime)
dayjs.extend(updateLocale)

// Function to set dayjs locale
export async function setDayjsLocale(locale = null) {
  // Use provided locale or get from browser/system settings
  locale = locale || window.frappe?.boot?.lang || window.navigator.language || 'en'
  
  // Handle locales with region codes (e.g., 'en-US' -> 'en')
  const baseLocale = locale.split('-')[0].toLowerCase()
  
  try {
    dayjs.locale(baseLocale)
  } catch (e) {
    console.warn(`Dayjs locale '${baseLocale}' not found, falling back to English`)
    dayjs.locale('en')
  }
}

// Format date with current locale
export function formatDate(date, format = 'L LTS') {
  if (!date) return ''
  return toUserTimezone(date).format(format)
}

// Get relative time in current locale
export function timeAgo(date) {
  if (!date) {
    return ''
  }
  const dateInUserTimezone = toUserTimezone(date);
  
  // Check if the date is valid before proceeding
  if (!dateInUserTimezone.isValid()) {
    return ''
  }

  const nowInUserTimezone = toUserTimezone(dayjs());
  let fromNowResult = dateInUserTimezone.from(nowInUserTimezone);
  
  // Safeguard: Ensure fromNowResult is never undefined
  if (typeof fromNowResult === 'undefined') {
    return '';
  }

  return fromNowResult;
}

// Initialize with default locale
setDayjsLocale()

// Convert date to user's timezone
export function toUserTimezone(date) {
  if (!date) return dayjs()
  const userTz = window.timezone?.user || dayjs.tz.guess()
  const systemTz = window.timezone?.system || 'UTC';
  // Parse the date string assuming it's in the system timezone (server timezone)
  const parsedDate = dayjs.tz(date, systemTz);
  return parsedDate.tz(userTz)
}

// Convert date to system timezone
export function toSystemTimezone(date) {
  if (!date) return dayjs()
  const systemTz = window.timezone?.system || 'UTC'
  // Parse the date string assuming it's in the system timezone (server timezone)
  const parsedDate = dayjs.tz(date, systemTz);
  return parsedDate.tz(systemTz)
}

// Format date in user's timezone
export function formatDateInUserTimezone(date, format = 'L LTS') {
  if (!date) return ''
  try {
    return toUserTimezone(date).format(format)
  } catch (e) {
    console.warn('Error formatting date in user timezone:', e)
    return ''
  }
}

// Format date in system timezone
export function formatDateInSystemTimezone(date, format = 'L LTS') {
  if (!date) return ''
  try {
    return toSystemTimezone(date).format(format)
  } catch (e) {
    console.warn('Error formatting date in system timezone:', e)
    return ''
  }
}

// Get current time in user's timezone
export function getUserNow() {
  try {
    return toUserTimezone(dayjs())
  } catch (e) {
    console.warn('Error getting user now:', e)
    return dayjs()
  }
}

// Get current time in system timezone
export function getSystemNow() {
  try {
    return toSystemTimezone(dayjs())
  } catch (e) {
    console.warn('Error getting system now:', e)
    return dayjs()
  }
}

export default dayjs 