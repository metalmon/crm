import { createApp } from './main'
import { renderToString } from '@vue/server-renderer'

export async function render(url, manifest) {
  const { app, router, store } = createApp()

  // Set server-side router location
  router.push(url)
  await router.isReady()

  // Pass SSR context to the app
  const ctx = {}
  const html = await renderToString(app, ctx)

  // Get Vuex state
  const state = store ? store.state.value : {}

  return [html, state]
} 