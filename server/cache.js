import LRU from 'lru-cache'

const ssrCache = new LRU({
  max: 100, // Maximum number of cached pages
  ttl: 1000 * 60 * 5 // Cache TTL - 5 minutes
})

export function getCachedPage(key) {
  return ssrCache.get(key)
}

export function setCachedPage(key, html, state) {
  const cached = {
    html,
    state,
    timestamp: Date.now()
  }
  ssrCache.set(key, cached)
  return cached
}

export function isCacheable(url) {
  // List of paths that should not be cached
  const nonCacheablePaths = [
    '/api/',
    '/login',
    '/logout',
  ]
  
  return !nonCacheablePaths.some(path => url.startsWith(path))
}

export function generateCacheKey(url, userAgent) {
  // Generate unique key based on URL and User-Agent
  return `${url}::${userAgent}`
} 