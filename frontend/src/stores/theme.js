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
  const themeColor = currentTheme === 'dark' ? '#1f2937' : '#ffffff'
  const metaThemeColor = document.querySelector('meta[name="theme-color"]:not([media])')
  
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', themeColor)
  } else {
    const newMeta = document.createElement('meta')
    newMeta.name = 'theme-color'
    newMeta.content = themeColor
    document.head.appendChild(newMeta)
  }
}
