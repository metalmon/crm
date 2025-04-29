import { createResource, call } from 'frappe-ui'
import { errorMessage } from '@/utils'
import { capture } from '@/telemetry'
import { usersStore } from '@/stores/users'
import { normalizePhoneNumber } from './phoneUtils'
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

function trackCommunicationImpl({ type, doctype, docname, phoneNumber, activities, contactName, message, modelValue }) {
  if (!phoneNumber) return errorMessage(__('No phone number set'))

  const formattedNumber = normalizePhoneNumber(phoneNumber)
  const user = getUser()

  if (type === 'phone') {
    window.location.href = `tel:${formattedNumber}`
    logCommunication()
  } else {
    let messageText = ''

    if (message) {
      // Use email template endpoint to render template with variables
      call('frappe.email.doctype.email_template.email_template.get_email_template', {
        template_name: message.name,
        doc: modelValue
      }).then(data => {
        messageText = data.message
        // Remove HTML tags but preserve line breaks
        messageText = messageText.replace(/<br\s*\/?>/g, '\n')
        messageText = messageText.replace(/<[^>]+>/g, '')
        // Encode for URL
        const encodedMessage = encodeURIComponent(messageText)

        const url = `whatsapp://send?phone=${formattedNumber}${encodedMessage ? '&text=' + encodedMessage : ''}`;
        
        window.location.href = url;

        // Log communication with processed message
        logCommunication(messageText)
      })
    } else {
      const url = `whatsapp://send?phone=${formattedNumber}`;

      window.location.href = url;

      logCommunication()
    }
  }

  function logCommunication(processedMessage = '') {
    const params = {
      doc: {
        doctype: 'Communication',
        communication_type: 'Communication',
        communication_medium: type === 'phone' ? 'Phone' : 'Chat',
        sent_or_received: 'Sent',
        recipients: contactName || '',
        status: 'Linked',
        reference_doctype: doctype,
        reference_name: docname,
        phone_no: formattedNumber,
        content: type === 'phone' 
          ? __('Outgoing call to') + ' ' + formattedNumber
          : __('Chat initiated with') + ' ' + formattedNumber + 
            (processedMessage ? '<br><br>' + processedMessage.replace(/\n/g, '<br>') : ''),
        subject: type === 'phone' 
          ? __('Phone call')
          : __('WhatsApp chat'),
        sender: user?.email || undefined,
        sender_full_name: user?.full_name || undefined
      }
    }

    const logCommunicationResource = createResource({
      url: 'crm.api.communication.track_communication',
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
      logCommunicationResource.submit()
    } catch (e) {
      console.error('Error submitting communication:', e)
    }
  }
}

export const trackCommunication = debounce(trackCommunicationImpl, 1000)

export { normalizePhoneNumber }

