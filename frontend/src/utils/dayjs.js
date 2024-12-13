import dayjs from 'dayjs'
import advancedFormat from 'dayjs/plugin/advancedFormat'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import relativeTime from 'dayjs/plugin/relativeTime'

// Extend dayjs with plugins
dayjs.extend(advancedFormat)
dayjs.extend(timezone)
dayjs.extend(utc)
dayjs.extend(localizedFormat)
dayjs.extend(relativeTime)

// Set default locale based on browser/system settings
const locale = window.navigator.language || 'en'
try {
  // Dynamically import the locale
  import(`dayjs/locale/${locale.toLowerCase()}`).then(() => {
    dayjs.locale(locale)
  }).catch(() => {
    // Fallback to English if locale import fails
    import('dayjs/locale/en').then(() => {
      dayjs.locale('en')
    })
  })
} catch (e) {
  console.warn('Failed to set dayjs locale:', e)
}

export default dayjs 