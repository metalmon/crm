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

export const avitoEnabled = ref(false)
export const isAvitoInstalled = ref(false)
createResource({
  url: 'crm.api.avito.is_avito_enabled',
  cache: 'Is Avito Enabled',
  auto: true,
  onSuccess: (data) => {
    avitoEnabled.value = Boolean(data)
  },
})
createResource({
  url: 'crm.api.avito.is_avito_installed',
  cache: 'Is Avito Installed',
  auto: true,
  onSuccess: (data) => {
    isAvitoInstalled.value = Boolean(data)
  },
})

export const callEnabled = ref(false)
createResource({
  url: 'crm.integrations.twilio.api.is_enabled',
  cache: 'Is Twilio Enabled',
  auto: true,
  onSuccess: (data) => {
    callEnabled.value = Boolean(data)
  },
})

export const mobileSidebarOpened = ref(false)

export const isMobileView = computed(() => window.innerWidth < 768)

export const showSettings = ref(false)
export const activeSettingsPage = ref('')
