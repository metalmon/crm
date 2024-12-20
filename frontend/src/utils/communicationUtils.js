import { createResource, getCachedDocumentResource } from 'frappe-ui'
import { errorMessage } from '@/utils'
import { capture } from '@/telemetry'
import { usersStore } from '@/stores/users'
const { getUser } = usersStore()

function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

function normalizePhoneNumber(phoneNumber) {
  let normalizedNumber = phoneNumber.replace(/\D/g, '')
  
  if (normalizedNumber.startsWith('8')) {
    normalizedNumber = '7' + normalizedNumber.slice(1)
  }
  
  return normalizedNumber.startsWith('+') ? normalizedNumber : `+${normalizedNumber}`
}

function trackCommunicationImpl({ type, doctype, docname, phoneNumber, activities, contactName }) {
  if (!phoneNumber) return errorMessage(__('No phone number set'))

  const formattedNumber = normalizePhoneNumber(phoneNumber)

  if (type === 'phone') {
    window.location.href = `tel:${formattedNumber}`
  } else {
    window.open(`https://wa.me/${formattedNumber}`, '_blank')
  }

  const params = {
    doc: {
      doctype: 'Communication',
      communication_type: 'Communication',
      communication_medium: type === 'phone' ? 'Phone' : 'Chat',
      sent_or_received: 'Sent',
      recipients: contactName,
      status: 'Linked',
      reference_doctype: doctype,
      reference_name: docname,
      phone_no: formattedNumber,
      content: type === 'phone' 
        ? __('Outgoing call to') + ' ' + formattedNumber
        : __('Chat initiated with') + ' ' + formattedNumber,
      subject: type === 'phone' 
        ? __('Phone call')
        : __('WhatsApp chat'),
      sender: getUser()?.full_name || undefined
    }
  }

  const logCommunication = createResource({
    url: 'frappe.client.insert',
    params: params,
    onSuccess: () => {
      activities?.all_activities?.reload()
      capture(type === 'phone' ? 'phone_call_initiated' : 'whatsapp_chat_initiated')
    },
    onError: (error) => {
      errorMessage(error.message)
    }
  })

  try {
    logCommunication.submit()
  } catch (e) {
    console.error('Error submitting communication:', e)
  }
}

export const trackCommunication = debounce(trackCommunicationImpl, 1000)

export { normalizePhoneNumber }

