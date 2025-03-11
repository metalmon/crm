import { createApp } from './main'

const { app, store } = createApp()

// Если есть начальное состояние от SSR
if (window.__INITIAL_STATE__) {
  store.state.value = window.__INITIAL_STATE__
}

app.mount('#app') 