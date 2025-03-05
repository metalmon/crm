import { io } from 'socket.io-client'
import { socketio_port } from '../../../../sites/common_site_config.json'
import { getCachedListResource } from 'frappe-ui/src/resources/listResource'
import { getCachedResource } from 'frappe-ui/src/resources/resources'
import { reactive, ref } from 'vue'

// Subscription management
const subscriptions = reactive(new Map()) // { doctype:name: Set of callbacks }
const subscriptionQueue = reactive(new Map()) // { doctype:name: priority }
const MAX_SUBSCRIPTIONS = 100

// Track last usage of subscriptions to detect inactive ones
const subscriptionLastUsed = new Map() // { doctype:name: timestamp }
const INACTIVE_SUBSCRIPTION_TIMEOUT = 10 * 60 * 1000 // 10 minutes

// Throttling for updates
const updateThrottles = new Map() // For throttling frequent updates
const pendingUpdates = new Map() // For batching updates
const THROTTLE_DELAY = 1000 // ms

// Priority levels
export const PRIORITY = {
  VIEWPORT: 3,    // Currently visible
  ADJACENT: 2,    // In adjacent columns/pages
  BACKGROUND: 1   // Not currently visible
}

const localTransactions = new Map()
// Track timestamps for expirations
const transactionTimestamps = new Map()
const LOCAL_TRANSACTION_TIMEOUT = 10000 // 10 seconds max for a transaction

// Last update timestamp to prevent too frequent priority updates
let lastPriorityUpdate = 0
const PRIORITY_UPDATE_THROTTLE = 500 // ms

// Socket metrics for diagnostics
const socketMetrics = {
  connected: false,
  connectionAttempts: 0,
  lastConnected: null,
  lastDisconnected: null,
  disconnectionReason: null,
  pendingSubscriptions: 0,
  successfulSubscriptions: 0,
  failedSubscriptions: 0,
  errors: []
}

// Export metrics for debugging
export function getSocketMetrics() {
  return { ...socketMetrics }
}

/**
 * Periodically clean up inactive subscriptions to prevent memory leaks
 * This runs every 5 minutes
 */
function cleanupInactiveSubscriptions() {
  console.log('[Socket] Checking for inactive subscriptions')
  const now = Date.now()
  let cleanupCount = 0
  
  // Find subscriptions that haven't been used recently
  for (const [key, lastUsed] of subscriptionLastUsed.entries()) {
    if (now - lastUsed > INACTIVE_SUBSCRIPTION_TIMEOUT) {
      // Skip high priority subscriptions
      if (subscriptionQueue.get(key) === PRIORITY.VIEWPORT) {
        console.log(`[Socket] Skipping cleanup of viewport subscription ${key}`)
        // Update timestamp to prevent repeated checks
        subscriptionLastUsed.set(key, now - INACTIVE_SUBSCRIPTION_TIMEOUT / 2)
        continue
      }
      
      console.log(`[Socket] Cleaning up inactive subscription ${key}`)
      const [doctype, name] = key.split(':')
      
      // Emit unsubscribe event
      socket.emit('unsubscribe_doc', { doctype, name })
      
      // Clean up subscription data
      subscriptions.delete(key)
      subscriptionQueue.delete(key)
      subscriptionLastUsed.delete(key)
      cleanupCount++
    }
  }
  
  console.log(`[Socket] Cleaned up ${cleanupCount} inactive subscriptions`)
  
  // Schedule next cleanup
  setTimeout(cleanupInactiveSubscriptions, 5 * 60 * 1000) // Every 5 minutes
}

// Start the cleanup process after a delay
setTimeout(cleanupInactiveSubscriptions, 10 * 60 * 1000) // First run after 10 minutes

// Update subscription last used timestamp when document is accessed
export function markDocumentAccessed(doctype, name) {
  const key = `${doctype}:${name}`
  if (subscriptions.has(key)) {
    subscriptionLastUsed.set(key, Date.now())
  }
}

/**
 * Generate a unique transaction ID combining timestamp and random string
 * @returns {string} Unique transaction ID
 */
function generateTransactionId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Clean expired transactions to prevent memory leaks
 */
function cleanupExpiredTransactions() {
  const now = Date.now()
  for (const [key, timestamp] of transactionTimestamps.entries()) {
    if (now - timestamp > LOCAL_TRANSACTION_TIMEOUT) {
      console.log(`[Socket] Transaction for ${key} expired`)
      localTransactions.delete(key)
      transactionTimestamps.delete(key)
    }
  }
}

/**
 * Start a new transaction for document modification
 * @param {string} doctype - Document type
 * @param {string} name - Document name
 * @returns {string} Transaction ID
 */
export function startTransaction(doctype, name) {
  // Clean up expired transactions periodically
  cleanupExpiredTransactions()
  
  const transactionId = generateTransactionId()
  const key = `${doctype}:${name}`
  console.log(`[Socket] Starting transaction ${transactionId} for ${key}`)
  localTransactions.set(key, transactionId)
  transactionTimestamps.set(key, Date.now())
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
    transactionTimestamps.delete(key)
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
    reconnectionAttempts: 10, // Increased from 5
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000 // Increase timeout to 20s
  })

  // Store socket instance
  window._socketInstance = socket

  // Connection event handlers
  socket.on('connect', () => {
    console.log('[Socket] Connected successfully')
    console.log(`[Socket] Socket ID: ${socket.id}`)
    
    // Update metrics
    socketMetrics.connected = true
    socketMetrics.lastConnected = new Date().toISOString()
    
    // Show reconnection notification if this was a reconnection
    if (socketMetrics.connectionAttempts > 0) {
      // Optional: Show a notification to the user that connection was restored
      console.log('[Socket] Connection restored after disconnection')
      
      // Could dispatch an event for UI components to respond to
      window.dispatchEvent(new CustomEvent('socket:reconnected'))
    }
    
    // Reset error tracking on successful connection
    socketMetrics.errors = socketMetrics.errors.slice(-5) // Keep only last 5 errors
    
    // Resubscribe to all documents
    const batchResubscribe = async () => {
      const docs = Array.from(subscriptions.keys()).map(key => {
        const [doctype, name] = key.split(':')
        return { doctype, name }
      })
      
      console.log(`[Socket] Resubscribing to ${docs.length} documents`)
      
      // Prioritize viewport documents for immediate resubscription
      const viewportDocs = docs.filter(doc => {
        const key = `${doc.doctype}:${doc.name}`;
        return subscriptionQueue.get(key) === PRIORITY.VIEWPORT;
      });
      
      // Subscribe to viewport documents first
      if (viewportDocs.length > 0) {
        console.log(`[Socket] Resubscribing to ${viewportDocs.length} viewport documents first`);
        await Promise.all(
          viewportDocs.map(doc => {
            console.log(`[Socket] Resubscribing to viewport ${doc.doctype}/${doc.name}`)
            return socket.emit('subscribe_doc', doc)
          })
        );
      }
      
      // Delay subscription to background documents
      const backgroundDocs = docs.filter(doc => {
        const key = `${doc.doctype}:${doc.name}`;
        return subscriptionQueue.get(key) !== PRIORITY.VIEWPORT;
      });
      
      if (backgroundDocs.length > 0) {
        console.log(`[Socket] Scheduling resubscription for ${backgroundDocs.length} background documents`);
        setTimeout(() => {
          // Process background docs in smaller batches with delays
          for (let i = 0; i < backgroundDocs.length; i += 10) {
            const batch = backgroundDocs.slice(i, i + 10);
            const delay = i * 50; // Distribute subscriptions over time
            
            setTimeout(() => {
              console.log(`[Socket] Processing background batch ${i/10 + 1}`);
              Promise.all(
                batch.map(doc => socket.emit('subscribe_doc', doc))
              );
            }, delay);
          }
        }, 500); // Allow UI to initialize first
      }
    }
    
    batchResubscribe()
  })

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error)
    
    // Track error
    socketMetrics.errors.push({
      type: 'connect_error',
      message: error.message,
      timestamp: new Date().toISOString()
    })
    
    // Could show a user-friendly error
    if (socketMetrics.errors.length > 3) {
      // Optional: Show persistent error to user if connection keeps failing
      window.dispatchEvent(new CustomEvent('socket:connection_issues', { 
        detail: { message: 'Having trouble connecting to server' }
      }))
    }
  })

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Disconnected. Reason: ${reason}`)
    
    // Update metrics
    socketMetrics.connected = false
    socketMetrics.lastDisconnected = new Date().toISOString()
    socketMetrics.disconnectionReason = reason
    
    // Show a temporary disconnection message for certain reasons
    if (reason === 'io server disconnect' || reason === 'transport close') {
      // These are more serious disconnections
      window.dispatchEvent(new CustomEvent('socket:disconnected', {
        detail: { reason }
      }))
    }
  })

  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`[Socket] Reconnection attempt ${attemptNumber}`)
    socketMetrics.connectionAttempts = attemptNumber
  })

  socket.on('reconnect', (attemptNumber) => {
    console.log(`[Socket] Reconnected after ${attemptNumber} attempts`)
  })

  socket.on('error', (error) => {
    console.error('[Socket] Socket error:', error)
    
    // Track error
    socketMetrics.errors.push({
      type: 'socket_error',
      message: error.message || 'Unknown socket error',
      timestamp: new Date().toISOString()
    })
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
    
    // Check if this is a local transaction we initiated
    if (data._transaction && localTransactions.get(key) === data._transaction) {
      console.log(`[Socket] Ignoring update from our own transaction: ${data._transaction}`)
      return
    }
    
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
    
    // Handle regular document updates with throttling
    const callbacks = subscriptions.get(key)
    if (callbacks) {
      // Store the latest update for this document
      pendingUpdates.set(key, data)
      
      // If there's already a throttle timer, we don't need to do anything
      if (updateThrottles.has(key)) {
        console.log(`[Socket] Update for ${key} throttled, will use latest data`)
        return
      }
      
      // Set up a throttle timer
      console.log(`[Socket] Setting up throttle for ${key}`)
      updateThrottles.set(key, setTimeout(() => {
        // Process the update when the timer expires
        const latestData = pendingUpdates.get(key)
        console.log(`[Socket] Processing throttled update for ${key}`)
        
        if (callbacks && latestData) {
          console.log(`[Socket] Notifying ${callbacks.size} subscribers with latest data`)
          // Process callbacks in a separate microtask to avoid blocking the UI
          setTimeout(() => {
            callbacks.forEach(callback => callback(latestData))
          }, 0)
        }
        
        // Clean up
        updateThrottles.delete(key)
        pendingUpdates.delete(key)
      }, THROTTLE_DELAY))
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
  
  // Update metrics
  socketMetrics.pendingSubscriptions++
  
  // Track last usage time for this subscription
  subscriptionLastUsed.set(key, Date.now())
  
  // Update priority in queue
  const currentPriority = subscriptionQueue.get(key) || 0
  subscriptionQueue.set(key, Math.max(currentPriority, priority))
  console.log(`[Socket] Updated priority for ${key} to ${Math.max(currentPriority, priority)}`)
  
  // If we're already subscribed, just add the callback
  if (subscriptions.has(key)) {
    console.log(`[Socket] Already subscribed to ${key}, adding callback`)
    subscriptions.get(key).add(callback)
    socketMetrics.pendingSubscriptions--
    socketMetrics.successfulSubscriptions++
    return createCleanupFunction(key, callback)
  }
  
  // Handle high priority subscriptions immediately
  if (priority === PRIORITY.VIEWPORT) {
    console.log(`[Socket] Processing high priority subscription for ${key} immediately`)
    // Check if we need to manage subscriptions, but don't wait for the result
    if (subscriptions.size >= MAX_SUBSCRIPTIONS) {
      setTimeout(() => manageSubscriptions(), 0)
    }
    
    // Add subscription immediately for visible elements
    subscriptions.set(key, new Set([callback]))
    
    // Add timeout detection for subscription
    const subscriptionTimeout = setTimeout(() => {
      console.warn(`[Socket] Subscription timeout for ${key}`)
      socketMetrics.pendingSubscriptions--
      socketMetrics.failedSubscriptions++
      // Could add retry logic here
    }, 10000) // 10 second timeout
    
    // Emit subscription event and track success/failure
    socket.emit('subscribe_doc', { doctype, name }, (response) => {
      clearTimeout(subscriptionTimeout)
      socketMetrics.pendingSubscriptions--
      
      if (response && response.success) {
        console.log(`[Socket] Successfully subscribed to ${key}`)
        socketMetrics.successfulSubscriptions++
      } else {
        console.error(`[Socket] Failed to subscribe to ${key}:`, response?.error || 'Unknown error')
        socketMetrics.failedSubscriptions++
        // Optional: could retry or show notification
      }
    })
    
    return createCleanupFunction(key, callback)
  }
  
  // For non-high-priority subscriptions, process asynchronously
  setTimeout(() => {
    // If already subscribed in the meantime, just return
    if (subscriptions.has(key)) {
      if (!subscriptions.get(key).has(callback)) {
        subscriptions.get(key).add(callback)
      }
      socketMetrics.pendingSubscriptions--
      socketMetrics.successfulSubscriptions++
      return
    }
    
    // Check if we need to manage subscriptions
    if (subscriptions.size >= MAX_SUBSCRIPTIONS) {
      console.log(`[Socket] Reached max subscriptions (${MAX_SUBSCRIPTIONS}), managing subscriptions`)
      manageSubscriptions()
    }
    
    // Subscribe if we have room or it's adjacent (medium priority)
    if (subscriptions.size < MAX_SUBSCRIPTIONS || priority === PRIORITY.ADJACENT) {
      console.log(`[Socket] Creating new subscription for ${key}`)
      subscriptions.set(key, new Set([callback]))
      
      // Emit subscription event
      socket.emit('subscribe_doc', { doctype, name }, (response) => {
        socketMetrics.pendingSubscriptions--
        
        if (response && response.success) {
          console.log(`[Socket] Successfully subscribed to ${key}`)
          socketMetrics.successfulSubscriptions++
        } else {
          console.error(`[Socket] Failed to subscribe to ${key}:`, response?.error || 'Unknown error')
          socketMetrics.failedSubscriptions++
        }
      })
    } else {
      console.log(`[Socket] Subscription for ${key} queued due to limits`)
      socketMetrics.pendingSubscriptions--
    }
  }, 0)
  
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
  
  // Move to a separate microtask to prevent UI blocking
  setTimeout(() => {
    // Sort subscriptions by priority
    const sortedSubs = Array.from(subscriptionQueue.entries())
      .sort(([, priorityA], [, priorityB]) => priorityB - priorityA)
    
    console.log(`[Socket] Subscription priorities:`, 
      sortedSubs.map(([key, priority]) => `${key}: ${priority}`).join(', '))
    
    // Use recursive setTimeout pattern to avoid blocking the main thread
    function processNextUnsubscription() {
      if (subscriptions.size >= MAX_SUBSCRIPTIONS && sortedSubs.length > 0) {
        const [key] = sortedSubs.pop()
        if (subscriptions.has(key)) {
          const [doctype, name] = key.split(':')
          console.log(`[Socket] Unsubscribing from ${key} due to priority`)
          socket.emit('unsubscribe_doc', { doctype, name })
          subscriptions.delete(key)
          subscriptionQueue.delete(key)
          
          // Continue with next unsubscription in a new microtask
          setTimeout(processNextUnsubscription, 0)
        } else {
          // If key doesn't exist, continue with next
          processNextUnsubscription()
        }
      } else {
        console.log(`[Socket] Subscription management complete. New count: ${subscriptions.size}`)
      }
    }
    
    // Start the unsubscription process
    processNextUnsubscription()
  }, 0)
}

// Update priorities based on viewport
export function updateSubscriptionPriorities(visibleDocs, adjacentDocs) {
  // Throttle priority updates to prevent excessive processing
  const now = Date.now()
  if (now - lastPriorityUpdate < PRIORITY_UPDATE_THROTTLE) {
    // Skip frequent updates to reduce CPU load
    console.log('[Socket] Skipping priority update due to throttling')
    return
  }
  lastPriorityUpdate = now
  
  console.log('[Socket] Updating subscription priorities')
  console.time('updatePriorities')
  
  // Process in a microtask to prevent UI blocking
  setTimeout(() => {
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
    console.timeEnd('updatePriorities')
  }, 0)
}

