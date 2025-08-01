import './index.css'
// Import custom scrollbar styles for dark theme
import './styles/scrollbar.css'
// Import dark mode styles
import './styles/dark-mode.css'
import './styles/forms.css'
import './utils/dayjs'

import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import { createDialog } from './utils/dialogs'
import { initSocket } from './socket'
import router from './router'
import translationPlugin from './translation'
import { posthogPlugin } from './telemetry'
import App from './App.vue'
import { setLocale } from './utils/localeUtils'


import {
  FrappeUI,
  Button,
  Input,
  TextInput,
  FormControl,
  ErrorMessage,
  Dialog,
  Alert,
  Badge,
  setConfig,
  frappeRequest,
  FeatherIcon,
} from 'frappe-ui'

let globalComponents = {
  Button,
  TextInput,
  Input,
  FormControl,
  ErrorMessage,
  Dialog,
  Alert,
  Badge,
  FeatherIcon,
}

// create a pinia instance
let pinia = createPinia()

let app = createApp(App)

setConfig('resourceFetcher', frappeRequest)
app.use(FrappeUI)
app.use(pinia)
app.use(router)
app.use(translationPlugin)
app.use(posthogPlugin)
for (let key in globalComponents) {
  app.component(key, globalComponents[key])
}

app.config.globalProperties.$dialog = createDialog

let socket
if (import.meta.env.DEV) {
  frappeRequest({ url: '/api/method/crm.www.crm.get_context_for_dev' }).then(
    (values) => {
      for (let key in values) {
        window[key] = values[key]
      }
      fetch(import.meta.env.BASE_URL + 'version.json')
        .then(r => r.json())
        .then(data => { window.app_version = data })
        .finally(() => {
          socket = initSocket()
          app.config.globalProperties.$socket = socket
          app.mount('#app')
        })
    },
  )
} else {
  fetch(import.meta.env.BASE_URL + 'version.json')
    .then(r => r.json())
    .then(data => { window.app_version = data })
    .finally(() => {
      socket = initSocket()
      app.config.globalProperties.$socket = socket
      app.mount('#app')
    })
}

if (import.meta.env.DEV) {
  window.$dialog = createDialog
}
