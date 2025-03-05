import { io } from 'socket.io-client'
import { socketio_port } from '../../../../sites/common_site_config.json'
import { getCachedListResource } from 'frappe-ui/src/resources/listResource'
import { getCachedResource } from 'frappe-ui/src/resources/resources'
import { reactive, ref } from 'vue'

// Subscription management
const subscriptions = reactive(new Map()) // { doctype:name: Set of callbacks }
const subscriptionQueue = reactive(new Map()) // { doctype:name: priority }
const MAX_SUBSCRIPTIONS = 50

// Priority levels
export const PRIORITY = {
  VIEWPORT: 3,    // Currently visible
  ADJACENT: 2,    // In adjacent columns/pages
  BACKGROUND: 1   // Not currently visible
}

const localTransactions = new Map()

/**
 * Generate a unique transaction ID combining timestamp and random string
 * @returns {string} Unique transaction ID
 */
function generateTransactionId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Start a new transaction for document modification
 * @param {string} doctype - Document type
 * @param {string} name - Document name
 * @returns {string} Transaction ID
 */
export function startTransaction(doctype, name) {
  const transactionId = generateTransactionId()
  const key = `${doctype}:${name}`
  console.log(`[Socket] Starting transaction ${transactionId} for ${key}`)
  localTransactions.set(key, transactionId)
  return transactionId
}

/**
 * End transaction if it matches the current transaction ID
 * @param {string} doctype - Document type
 * @param {string} name - Document name
 * @param {string} transactionId - Transaction ID to check
 */
export function endTransaction(doctype, name, transactionId) {
  const key = `${doctype}:${name}`
  console.log(`[Socket] Ending transaction ${transactionId} for ${key}`)
  if (localTransactions.get(key) === transactionId) {
    localTransactions.delete(key)
  }
}

/**
 * Check if the update is from a local transaction
 * @param {string} doctype - Document type
 * @param {string} name - Document name
 * @param {string} transactionId - Transaction ID to verify
 * @returns {boolean} True if it's a local transaction
 */
export function isLocalTransaction(doctype, name, transactionId) {
  const key = `${doctype}:${name}`
  const isLocal = localTransactions.get(key) === transactionId
  console.log(`[Socket] Checking transaction ${transactionId} for ${key}: ${isLocal ? 'local' : 'remote'}`)
  return isLocal
}

export function initSocket() {
  // Singleton pattern
  if (window._socketInstance) {
    console.log(`[Socket] Reusing existing socket connection`)
    return window._socketInstance
  }

  let host = window.location.hostname
  let siteName = window.site_name
  let port = window.location.port ? `:${socketio_port}` : ''
  let protocol = port ? 'http' : 'https'
  let url = `${protocol}://${host}${port}/${siteName}`

  console.log(`[Socket] Initializing socket connection to ${url}`)

  const socket = io(url, {
    withCredentials: true,
    reconnectionAttempts: 5,
  })

  // Store socket instance
  window._socketInstance = socket

  // Connection event handlers
  socket.on('connect', () => {
    console.log('[Socket] Connected successfully')
    console.log(`[Socket] Socket ID: ${socket.id}`)
    
    // Resubscribe to all documents
    const batchResubscribe = async () => {
      const docs = Array.from(subscriptions.keys()).map(key => {
        const [doctype, name] = key.split(':')
        return { doctype, name }
      })
      
      console.log(`[Socket] Resubscribing to ${docs.length} documents`)
      
      // Resubscribe in batches
      for (let i = 0; i < docs.length; i += MAX_SUBSCRIPTIONS) {
        const batch = docs.slice(i, i + MAX_SUBSCRIPTIONS)
        console.log(`[Socket] Resubscribing batch ${i/MAX_SUBSCRIPTIONS + 1}`)
        await Promise.all(
          batch.map(doc => {
            console.log(`[Socket] Resubscribing to ${doc.doctype}/${doc.name}`)
            return socket.emit('subscribe_doc', doc)
          })
        )
      }
    }
    
    batchResubscribe()
  })

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error)
  })

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Disconnected. Reason: ${reason}`)
  })

  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`[Socket] Reconnection attempt ${attemptNumber}`)
  })

  socket.on('reconnect', (attemptNumber) => {
    console.log(`[Socket] Reconnected after ${attemptNumber} attempts`)
  })

  // Handle resource updates
  socket.on('refetch_resource', (data) => {
    console.log(`[Socket] Received refetch_resource event:`, data)
    if (data.cache_key) {
      let resource = getCachedResource(data.cache_key) || getCachedListResource(data.cache_key)
      if (resource) {
        console.log(`[Socket] Reloading resource with cache key: ${data.cache_key}`)
        resource.reload()
      } else {
        console.log(`[Socket] No cached resource found for key: ${data.cache_key}`)
      }
    }
  })

  // Handle doc update events from server
  socket.on('doc_update', ({ doctype, name, data }) => {
    const key = `${doctype}:${name}`
    console.log(`[Socket] Received doc_update event for ${key}:`, data)
    
    // Handle document creation events
    if (data.event === 'created') {
      console.log(`[Socket] Document created: ${doctype}/${name}`);
      // Dispatch a custom event for document creation
      window.dispatchEvent(new CustomEvent('crm:doc_created', { 
        detail: { doctype, name } 
      }));
      return
    }
    
    // Handle document deletion events
    if (data.event === 'deleted') {
      console.log(`[Socket] Document deleted: ${doctype}/${name}`);
      // If we have subscriptions for this document, notify them about deletion
      const callbacks = subscriptions.get(key)
      if (callbacks) {
        console.log(`[Socket] Notifying ${callbacks.size} subscribers about deletion`)
        callbacks.forEach(callback => callback({ event: 'deleted' }))
        
        // Clean up subscriptions for deleted document
        subscriptions.delete(key)
        subscriptionQueue.delete(key)
        console.log(`[Socket] Cleaned up subscriptions for ${key}`)
      }
      
      // Dispatch a custom event for document deletion
      window.dispatchEvent(new CustomEvent('crm:doc_deleted', { 
        detail: { doctype, name } 
      }));
      return
    }
    
    // Handle regular document updates
    const callbacks = subscriptions.get(key)
    if (callbacks) {
      console.log(`[Socket] Notifying ${callbacks.size} subscribers about update`)
      callbacks.forEach(callback => callback(data))
    } else {
      console.log(`[Socket] No subscribers found for ${key}`)
    }
  })

  return socket
}

// Get singleton socket instance
const socket = initSocket()

// Socket composable for components
export function useSocket() {
  return {
    on(event, callback) {
      socket.on(event, callback)
    },
    off(event, callback) {
      socket.off(event, callback)
    },
    emit(event, data) {
      socket.emit(event, data)
    },
    subscribeToDoc(doctype, name, callback, priority = PRIORITY.BACKGROUND) {
      return subscribeToDoc(doctype, name, callback, priority)
    }
  }
}

export function subscribeToDoc(doctype, name, callback, priority = PRIORITY.BACKGROUND) {
  const key = `${doctype}:${name}`
  console.log(`[Socket] Attempting to subscribe to ${key} with priority ${priority}`)
  
  // Update priority in queue
  const currentPriority = subscriptionQueue.get(key) || 0
  subscriptionQueue.set(key, Math.max(currentPriority, priority))
  console.log(`[Socket] Updated priority for ${key} to ${Math.max(currentPriority, priority)}`)
  
  // If we're already subscribed, just add the callback
  if (subscriptions.has(key)) {
    console.log(`[Socket] Already subscribed to ${key}, adding callback`)
    subscriptions.get(key).add(callback)
    return createCleanupFunction(key, callback)
  }
  
  // Check if we need to manage subscriptions
  if (subscriptions.size >= MAX_SUBSCRIPTIONS) {
    console.log(`[Socket] Reached max subscriptions (${MAX_SUBSCRIPTIONS}), managing subscriptions`)
    manageSubscriptions()
  }
  
  // Subscribe if we have room or high enough priority
  if (subscriptions.size < MAX_SUBSCRIPTIONS || priority > PRIORITY.BACKGROUND) {
    console.log(`[Socket] Creating new subscription for ${key}`)
    subscriptions.set(key, new Set([callback]))
    socket.emit('subscribe_doc', { doctype, name })
  } else {
    console.log(`[Socket] Subscription for ${key} queued due to limits`)
  }
  
  return createCleanupFunction(key, callback)
}

function createCleanupFunction(key, callback) {
  return () => {
    console.log(`[Socket] Cleaning up subscription for ${key}`)
    const subs = subscriptions.get(key)
    if (subs) {
      subs.delete(callback)
      console.log(`[Socket] Removed callback for ${key}`)
      if (subs.size === 0) {
        console.log(`[Socket] No more callbacks for ${key}, removing subscription`)
        subscriptions.delete(key)
        subscriptionQueue.delete(key)
        const [doctype, name] = key.split(':')
        socket.emit('unsubscribe_doc', { doctype, name })
      }
    }
  }
}

function manageSubscriptions() {
  console.log(`[Socket] Managing subscriptions. Current count: ${subscriptions.size}`)
  // Sort subscriptions by priority
  const sortedSubs = Array.from(subscriptionQueue.entries())
    .sort(([, priorityA], [, priorityB]) => priorityB - priorityA)
  
  console.log(`[Socket] Subscription priorities:`, 
    sortedSubs.map(([key, priority]) => `${key}: ${priority}`).join(', '))
  
  // Unsubscribe from lowest priority items
  while (subscriptions.size >= MAX_SUBSCRIPTIONS) {
    const [key] = sortedSubs.pop()
    if (subscriptions.has(key)) {
      const [doctype, name] = key.split(':')
      console.log(`[Socket] Unsubscribing from ${key} due to priority`)
      socket.emit('unsubscribe_doc', { doctype, name })
      subscriptions.delete(key)
      subscriptionQueue.delete(key)
    }
  }
  console.log(`[Socket] Subscription management complete. New count: ${subscriptions.size}`)
}

// Update priorities based on viewport
export function updateSubscriptionPriorities(visibleDocs, adjacentDocs) {
  // Reset all priorities to background
  for (const [key] of subscriptionQueue) {
    subscriptionQueue.set(key, PRIORITY.BACKGROUND)
  }
  
  // Update priorities for visible docs
  visibleDocs.forEach(({ doctype, name }) => {
    const key = `${doctype}:${name}`
    subscriptionQueue.set(key, PRIORITY.VIEWPORT)
  })
  
  // Update priorities for adjacent docs
  adjacentDocs.forEach(({ doctype, name }) => {
    const key = `${doctype}:${name}`
    if (subscriptionQueue.get(key) !== PRIORITY.VIEWPORT) {
      subscriptionQueue.set(key, PRIORITY.ADJACENT)
    }
  })
  
  // Manage subscriptions after priority updates
  manageSubscriptions()
}

