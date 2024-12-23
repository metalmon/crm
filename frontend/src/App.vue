<template>
  <Layout v-if="session().isLoggedIn">
    <router-view />
  </Layout>
  <Dialogs />
  <Toasts />
</template>

<script setup>
import { Dialogs } from '@/utils/dialogs'
import { sessionStore as session } from '@/stores/session'
import { Toasts, setConfig } from 'frappe-ui'
import { computed, defineAsyncComponent, onMounted } from 'vue'
import { useStorage } from '@vueuse/core'

const MobileLayout = defineAsyncComponent(
  () => import('./components/Layouts/MobileLayout.vue'),
)
const DesktopLayout = defineAsyncComponent(
  () => import('./components/Layouts/DesktopLayout.vue'),
)
const Layout = computed(() => {
  if (window.innerWidth < 640) {
    return MobileLayout
  } else {
    return DesktopLayout
  }
})

setConfig('systemTimezone', window.timezone?.system || null)
setConfig('localTimezone', window.timezone?.user || null)

const theme = useStorage('theme', 'light')

onMounted(() => {
  if (['light', 'dark'].includes(theme.value)) {
    document.documentElement.setAttribute('data-theme', theme.value)
  }
})
</script>
