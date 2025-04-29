import { formatDate, timeAgo } from '@/utils'
import { getMeta } from '@/stores/meta'
import dayjs, { formatDateInUserTimezone, formatDateInSystemTimezone } from '@/utils/dayjs'

const { getFormattedPercent, getFormattedFloat, getFormattedCurrency } =
  getMeta('CRM Call Log')

export function getCallLogDetail(row, log, columns = []) {
  let incoming = log.type === 'Incoming'

  if (row === 'duration') {
    return {
      label: log._duration,
      icon: 'clock',
    }
  } else if (row === 'caller') {
    return {
      label: log._caller?.label,
      image: log._caller?.image,
    }
  } else if (row === 'receiver') {
    return {
      label: log._receiver?.label,
      image: log._receiver?.image,
    }
  } else if (row === 'type') {
    return {
      label: __(log.type),
      icon: incoming ? 'phone-incoming' : 'phone-outgoing',
    }
  } else if (row === 'status') {
    return {
      label: statusLabelMap[log.status],
      color: statusColorMap[log.status],
      value: log.status,
    }
  } else if (['modified', 'creation'].includes(row)) {
    try {
      return {
        label: formatDate(log[row], undefined, false, false, true),
        timeAgo: log[row] ? __(timeAgo(log[row])) : '',
      }
    } catch (e) {
      console.warn('Error formatting system date:', e)
      return { label: '', timeAgo: '' }
    }
  }

  let fieldType = columns?.find((col) => (col.key || col.value) == row)?.type

  if (fieldType && ['Date', 'Datetime'].includes(fieldType)) {
    try {
      return formatDate(log[row], undefined, true, fieldType == 'Datetime', false)
    } catch (e) {
      console.warn('Error formatting field date:', e)
      return ''
    }
  }

  if (fieldType && fieldType == 'Currency') {
    return getFormattedCurrency(row, log)
  }

  if (fieldType && fieldType == 'Float') {
    return getFormattedFloat(row, log)
  }

  if (fieldType && fieldType == 'Percent') {
    return getFormattedPercent(row, log)
  }

  if (row === 'telephony_medium') {
    return __(log[row]);
  }

  return log[row]
}

export const statusLabelMap = {
  Completed: __('Completed'),
  Initiated: __('Initiated'),
  Busy: __('Declined'),
  Failed: __('Failed'),
  Queued: __('Queued'),
  Canceled: __('Canceled'),
  Ringing: __('Ringing'),
  'No Answer': __('Missed Call'),
  'In Progress': __('In Progress'),
}

export const statusColorMap = {
  Completed: 'green',
  Busy: 'orange',
  Failed: 'red',
  Initiated: 'gray',
  Queued: 'gray',
  Canceled: 'gray',
  Ringing: 'gray',
  'No Answer': 'red',
  'In Progress': 'blue',
}
