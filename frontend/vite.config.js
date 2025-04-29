import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import path from 'path'
import frappeui from 'frappe-ui/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    frappeui({
      frappeProxy: true,
      lucideIcons: true,
      jinjaBootData: true,
      buildConfig: {
        indexHtmlPath: '../crm/www/crm.html',
        emptyOutDir: true,
        sourcemap: true,
      },
    }),
    vue(),
    vueJsx(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: 'public',
      filename: 'sw.js',
      injectRegister: null,
      outDir: "../crm/public/crm",
      manifest: {
        name: 'Frappe CRM',
        short_name: 'Frappe CRM',
        start_url: '/crm',
        display: 'standalone',
        background_color: '#0f0f0f',
        theme_color: '#0f0f0f',
        description: 'Modern & 100% Open-source CRM tool to supercharge your sales operations',
        scope: '/crm',
        categories: ['productivity', 'business'],
        icons: [
          {
            src: '/assets/crm/manifest/manifest-icon-192.maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/assets/crm/manifest/manifest-icon-512.maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/assets/crm/manifest/manifest-icon-192.maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/assets/crm/manifest/manifest-icon-512.maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          }
        ],
        id: 'crm'
      },
      devOptions: {
        enabled: true,
        type: 'module'
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifestFilename: 'manifest.json'
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {
    include: [
      'feather-icons',
      'showdown',
      'tailwind.config.js',
      'prosemirror-state',
      'prosemirror-view',
      'lowlight',
    ],
  },
})
