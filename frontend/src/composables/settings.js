import { createResource } from 'frappe-ui'
import { computed, ref } from 'vue'

export const whatsappEnabled = ref(false)
export const isWhatsappInstalled = ref(false)
createResource({
  url: 'crm.api.whatsapp.is_whatsapp_enabled',
  cache: 'Is Whatsapp Enabled',
  auto: true,
  onSuccess: (data) => {
    whatsappEnabled.value = Boolean(data)
  },
})
createResource({
  url: 'crm.api.whatsapp.is_whatsapp_installed',
  cache: 'Is Whatsapp Installed',
  auto: true,
  onSuccess: (data) => {
    isWhatsappInstalled.value = Boolean(data)
  },
})

export const callEnabled = ref(false)
export const twilioEnabled = ref(false)
export const exotelEnabled = ref(false)
export const beelineEnabled = ref(false)
export const defaultCallingMedium = ref('')

// New computed property for IP telephony
export const ipTelephonyEnabled = computed(() => {
  return twilioEnabled.value || exotelEnabled.value;
});

createResource({
  url: 'crm.integrations.api.is_call_integration_enabled',
  cache: 'Is Call Integration Enabled',
  auto: true,
  onSuccess: (data) => {
    twilioEnabled.value = Boolean(data.twilio_enabled)
    exotelEnabled.value = Boolean(data.exotel_enabled)
    beelineEnabled.value = Boolean(data.beeline_enabled)
    defaultCallingMedium.value = data.default_calling_medium
    // callEnabled still includes Beeline for Call Logs menu etc.
    callEnabled.value = twilioEnabled.value || exotelEnabled.value || beelineEnabled.value
    console.log('Call Integration Status:', {
        twilio: twilioEnabled.value,
        exotel: exotelEnabled.value,
        beeline: beelineEnabled.value,
        callEnabled: callEnabled.value,
        ipTelephonyEnabled: ipTelephonyEnabled.value // Log new flag
    });
  },
  onError: (err) => {
    console.error('Error fetching call integration status:', err);
    twilioEnabled.value = false;
    exotelEnabled.value = false;
    beelineEnabled.value = false;
    callEnabled.value = false;
    // Note: ipTelephonyEnabled will automatically become false due to computed property
  }
})

export const mobileSidebarOpened = ref(false)

export const isMobileView = computed(() => window.innerWidth < 768)

export const showSettings = ref(false)
export const activeSettingsPage = ref('')
