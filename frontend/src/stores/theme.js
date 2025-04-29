import { useStorage } from '@vueuse/core'

export const theme = useStorage('theme', 'light')

export function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme')
  theme.value = currentTheme === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', theme.value)
  updateThemeColor(theme.value)
}

export function setTheme(value) {
  theme.value = value || theme.value
  if (['light', 'dark'].includes(theme.value)) {
    document.documentElement.setAttribute('data-theme', theme.value)
    updateThemeColor(theme.value)
  }
}

function updateThemeColor(currentTheme) {
  const themeColor = currentTheme === 'dark' ? '#0f0f0f' : '#ffffff'
  
  // Update theme-color meta tags
  const metaTags = document.querySelectorAll('meta[name="theme-color"], meta[name="msapplication-TileColor"]')
  metaTags.forEach(tag => tag.content = themeColor)
  
  // Force update manifest theme color
  const manifestLink = document.querySelector('link[rel="manifest"]')
  if (manifestLink) {
    const currentHref = manifestLink.href
    manifestLink.href = currentHref.includes('?') ? 
      currentHref.split('?')[0] + '?t=' + Date.now() :
      currentHref + '?t=' + Date.now()
  }
}
