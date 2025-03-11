import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import compression from 'compression'
import serveStatic from 'serve-static'
import { createServer as createViteServer } from 'vite'
import { getCachedPage, setCachedPage, isCacheable, generateCacheKey } from './server/cache.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITE_TEST_BUILD
const isProduction = process.env.NODE_ENV === 'production'

async function createServer(root = process.cwd(), isProd = isProduction) {
  const app = express()
  const resolve = (p) => path.resolve(__dirname, p)

  let vite
  if (!isProd) {
    // Create Vite dev server in middleware mode
    vite = await createViteServer({
      root,
      logLevel: isTest ? 'error' : 'info',
      server: {
        middlewareMode: true,
        watch: {
          usePolling: true,
          interval: 100
        }
      },
      appType: 'custom'
    })
    app.use(vite.middlewares)
  } else {
    // Production: use compression and serve static files
    app.use(compression())
    app.use(
      '/assets',
      serveStatic(resolve('dist/client'), {
        index: false,
        maxAge: '1y' // Cache static assets for 1 year
      })
    )
  }

  app.use('*', async (req, res) => {
    try {
      const url = req.originalUrl
      
      // Check if the page can be served from cache in production
      if (isProd && isCacheable(url)) {
        const cacheKey = generateCacheKey(url, req.get('user-agent'))
        const cached = getCachedPage(cacheKey)
        
        if (cached) {
          // Return cached version if available
          console.log(`Cache hit for ${url}`)
          return res
            .status(200)
            .set({ 
              'Content-Type': 'text/html',
              'Cache-Control': 'public, max-age=300' // Browser cache for 5 minutes
            })
            .end(cached.html)
        }
      }

      // Load template and SSR module
      let template, render
      if (!isProd) {
        // Development: transform template and load SSR module on the fly
        template = fs.readFileSync(resolve('index.html'), 'utf-8')
        template = await vite.transformIndexHtml(url, template)
        render = (await vite.ssrLoadModule('/src/entry-server.js')).render
      } else {
        // Production: use built files
        template = fs.readFileSync(resolve('dist/client/index.html'), 'utf-8')
        render = (await import('./dist/server/entry-server.js')).render
      }

      // Render the app
      const [appHtml, state] = await render(url)

      // Inject the rendered app and state into the HTML template
      const html = template
        .replace(`<!--ssr-outlet-->`, appHtml)
        .replace(
          `<!--pinia-state-->`,
          `<script>window.__INITIAL_STATE__=${JSON.stringify(state)}</script>`
        )

      // Cache the rendered page in production
      if (isProd && isCacheable(url)) {
        const cacheKey = generateCacheKey(url, req.get('user-agent'))
        setCachedPage(cacheKey, html, state)
      }

      // Send the response
      res
        .status(200)
        .set({ 
          'Content-Type': 'text/html',
          'Cache-Control': isProd ? 'public, max-age=300' : 'no-cache'
        })
        .end(html)
    } catch (e) {
      // Handle errors
      vite && vite.ssrFixStacktrace(e)
      console.log(e.stack)
      res.status(500).end(e.stack)
    }
  })

  return { app, vite }
}

// Start the server
createServer().then(({ app }) =>
  app.listen(3000, () => {
    console.log('Server running at http://localhost:3000')
  })
) 