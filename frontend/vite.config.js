import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import path from 'path'
import frappeui from 'frappe-ui/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    frappeui(),
    vue({
      script: {
        propsDestructure: true,
      },
    }),
    vueJsx(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'script',
      strategies: 'generateSW',
      srcDir: 'src',
      filename: 'sw.js',
      devOptions: {
        enabled: true,
        type: 'module',
      },
      manifest: {
        display: 'standalone',
        name: 'Frappe CRM',
        short_name: 'Frappe CRM',
        start_url: '/crm/',
        scope: '/crm/',
        theme_color: '#0f0f0f',
        background_color: '#0f0f0f',
        description:
          'Modern & 100% Open-source CRM tool to supercharge your sales operations',
        orientation: 'any',
        categories: ['productivity', 'business'],
        icons: [
          {
            src: '/assets/crm/manifest/manifest-icon-192.maskable.png',
            sizes: '192x192',
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
            purpose: 'any',
          },
          {
            src: '/assets/crm/manifest/manifest-icon-512.maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/(api|crm)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'crm-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ],
        navigateFallback: '/crm/',
        navigateFallbackDenylist: [/^\/api/, /^\/raven/],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true
      }
    }),
    {
      name: 'transform-index.html',
      transformIndexHtml(html, context) {
        if (!context.server) {
          return html.replace(
            /<\/body>/,
            `
            <script>
                {% for key in boot %}
                window["{{ key }}"] = {{ boot[key] | tojson }};
                {% endfor %}
            </script>
            </body>
            `
          )
        }
        return html
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: '../crm/public/frontend',
    emptyOutDir: true,
    commonjsOptions: {
      include: [/tailwind.config.js/, /node_modules/],
    },
    sourcemap: true,
  },
  optimizeDeps: {
    include: [
      'feather-icons',
      'showdown',
      'tailwind.config.js',
      'engine.io-client',
      'prosemirror-state',
    ],
  },
})
