import { io } from 'socket.io-client'
import { socketio_port } from '../../../../sites/common_site_config.json'
import { getCachedListResource } from 'frappe-ui/src/resources/listResource'
import { getCachedResource } from 'frappe-ui/src/resources/resources'

export function initSocket() {
  let host = window.location.hostname
  let siteName = window.site_name
  let port = window.location.port ? `:${socketio_port}` : ''
  let protocol = port ? 'http' : 'https'
  let url = `${protocol}://${host}${port}/${siteName}`

  console.log('Initializing socket connection to:', url)

  let socket = io(url, {
    withCredentials: true,
    reconnectionAttempts: 5
  })

  socket.on('connect', () => {
    console.log('Socket connected successfully')
    console.log('Transport type:', socket.io.engine.transport.name)
  })

  socket.io.engine.on("upgrade", () => {
    console.log('Transport upgraded to:', socket.io.engine.transport.name)
  })

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error)
  })

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason)
    if (socket.io?.engine?.transport) {
      console.log('Last transport type:', socket.io.engine.transport.name)
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