import { io } from 'socket.io-client'
import { socketio_port } from '../../../../sites/common_site_config.json'
import { getCachedListResource } from 'frappe-ui/src/resources/listResource'
import { getCachedResource } from 'frappe-ui/src/resources/resources'

// Ensure these logs are preserved in production
const log = {
  info: (...args) => {
    console.log('[Socket]', ...args)
  },
  error: (...args) => {
    console.error('[Socket]', ...args)
  }
}

export function initSocket() {
  let host = window.location.hostname
  let port = window.location.port && socketio_port ? `:${socketio_port}` : ''
  let protocol = window.location.protocol.replace(':', '')
  let url = `${protocol}://${host}${port}`

  log.info('Initializing socket connection to:', url)

  let socket = io(url, {
    withCredentials: true,
    reconnectionAttempts: 5
  })

  socket.on('connect', () => {
    log.info('Socket connected successfully')
    log.info('Transport type:', socket.io.engine.transport.name)
  })

  socket.io.engine.on("upgrade", () => {
    log.info('Transport upgraded to:', socket.io.engine.transport.name)
  })

  socket.on('connect_error', (error) => {
    log.error('Socket connection error:', error)
  })

  socket.on('disconnect', (reason) => {
    log.info('Socket disconnected:', reason)
    if (socket.io?.engine?.transport) {
      log.info('Last transport type:', socket.io.engine.transport.name)
    }
  })

  socket.on('refetch_resource', (data) => {
    if (data.cache_key) {
      let resource =
        getCachedResource(data.cache_key) ||
        getCachedListResource(data.cache_key)
      if (resource) {
        resource.reload()
      }
    }
  })
  return socket
}