/**
 * Socket.js - WebSocket connection management module for CRM
 * 
 * This file contains the implementation of WebSocket connection for the CRM application,
 * including document subscriptions, transaction mechanisms, and metrics collection.
 * 
 * Logging is adaptively disabled in production environment to reduce
 * console output and improve performance.
 */

import { io } from 'socket.io-client'
import { socketio_port } from '../../../../sites/common_site_config.json'
import { getCachedListResource } from 'frappe-ui/src/resources/listResource'
import { getCachedResource } from 'frappe-ui/src/resources/resources'
import { reactive, ref } from 'vue'

// Create a logger to conditionally show logs based on environment
const isDevelopment = process.env.NODE_ENV !== 'production'
const logger = {
  log: (...args) => isDevelopment && console.log(...args),
  error: (...args) => isDevelopment && console.error(...args),
  warn: (...args) => isDevelopment && console.warn(...args),
  info: (...args) => isDevelopment && console.info(...args),
  time: (...args) => isDevelopment && console.time(...args),
  timeEnd: (...args) => isDevelopment && console.timeEnd(...args),
  // Always log critical errors and socket events regardless of environment
  critical: (...args) => console.error('[CRITICAL]', ...args),
  socket: (...args) => console.log('[SOCKET]', ...args),
  socketError: (...args) => console.error('[SOCKET ERROR]', ...args),
  socketWarn: (...args) => console.warn('[SOCKET WARN]', ...args)
}

// Cache for CRM settings
let crmSettings = null
let settingsLoaded = false

// Subscription management
const subscriptions = reactive(new Map()) // { doctype:name: Set of callbacks }
const subscriptionQueue = new Map() // { doctype:name: priority }
const subscriptionLastUsed = new Map() // { doctype:name: timestamp }
const updateThrottles = new Map() // { doctype:name: timeout }
const pendingUpdates = new Map() // { doctype:name: latest data }

// Transaction management
const localTransactions = new Map() // { doctype:name: transaction_id }
const transactionTimestamps = new Map() // { doctype:name: timestamp }

// Metrics tracking
let metricsInitialized = false
let lastMetricsTime = Date.now()
const socketMetrics = {
  connected: false,
  connectionAttempts: 0,
  lastConnected: null,
  lastDisconnected: null,
  disconnectionReason: null,
  pendingSubscriptions: 0,
  successfulSubscriptions: 0,
  failedSubscriptions: 0,
  errors: [],
  subscriptionRate: 0,
  messagesSent: 0,
  messagesReceived: 0
}

// Constants
const THROTTLE_DELAY = 1000 // ms between updates for the same document
const MAX_SUBSCRIPTIONS = 50 // Maximum active subscriptions
const INACTIVE_SUBSCRIPTION_TIMEOUT = 10 * 60 * 1000 // 10 minutes
const LOCAL_TRANSACTION_TIMEOUT = 10000 // 10 seconds max for a transaction
const PRIORITY_UPDATE_THROTTLE = 500 // ms

// Priority levels
export const PRIORITY = {
  VIEWPORT: 3,    // Currently visible
  ADJACENT: 2,    // In adjacent columns/pages
  BACKGROUND: 1   // Not currently visible
}

// Last update timestamp to prevent too frequent priority updates
let lastPriorityUpdate = 0

/**
 * Returns current socket metrics.
 * @returns {Object} - Object containing metrics
 */
export function getSocketMetrics() {
  return { ...socketMetrics }
}

/**
 * Periodically clean up inactive subscriptions to prevent memory leaks
 * This runs every 5 minutes
 */
function cleanupInactiveSubscriptions() {
  logger.log('[Socket] Checking for inactive subscriptions')
  const now = Date.now()
  let cleanupCount = 0
  
  // Find subscriptions that haven't been used recently
  for (const [key, lastUsed] of subscriptionLastUsed.entries()) {
    if (now - lastUsed > INACTIVE_SUBSCRIPTION_TIMEOUT) {
      // Skip high priority subscriptions
      if (subscriptionQueue.get(key) === PRIORITY.VIEWPORT) {
        logger.log(`[Socket] Skipping cleanup of viewport subscription ${key}`)
        // Update timestamp to prevent repeated checks
        subscriptionLastUsed.set(key, now - INACTIVE_SUBSCRIPTION_TIMEOUT / 2)
        continue
      }
      
      logger.log(`[Socket] Cleaning up inactive subscription ${key}`)
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
  
  logger.log(`[Socket] Cleaned up ${cleanupCount} inactive subscriptions`)
  
  // Schedule next cleanup
  setTimeout(cleanupInactiveSubscriptions, 5 * 60 * 1000) // Every 5 minutes
}

// Start the cleanup process after a delay
setTimeout(cleanupInactiveSubscriptions, 10 * 60 * 1000) // First run after 10 minutes

/**
 * Mark a document as accessed to prevent its subscription from being cleaned up
 */
export function markDocumentAccessed(doctype, name) {
  // Check if this is a kanban doctype and if realtime updates are disabled
  const kanbanDoctypes = ['CRM Lead', 'CRM Deal', 'Task']; // Doctypes that use kanban view
  const isKanbanDoctype = kanbanDoctypes.includes(doctype);
  
  if (isKanbanDoctype && isRealtimeDisabled()) {
    // Skip updating access timestamp for kanban items when disabled
    return;
  }
  
  const key = `${doctype}:${name}`
  subscriptionLastUsed.set(key, Date.now())
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
      logger.log(`[Socket] Transaction for ${key} expired`)
      localTransactions.delete(key)
      transactionTimestamps.delete(key)
    }
  }
}

/**
 * Check if realtime updates are disabled
 * @returns {boolean} True if realtime updates are disabled
 */
function isRealtimeDisabled() {
  return crmSettings?.disable_realtime_updates === 1;
}

/**
 * Start a new transaction for document modification
 * @param {string} doctype - Document type
 * @param {string} name - Document name
 * @returns {string} Transaction ID
 */
export function startTransaction(doctype, name) {
  // If realtime updates are disabled, return a dummy transaction ID
  if (isRealtimeDisabled()) {
    const dummyId = `disabled-${Math.random().toString(36).substring(2, 15)}`
    logger.log(`[Socket] Creating dummy transaction ${dummyId} for ${doctype}/${name} - realtime updates disabled`)
    return dummyId
  }
  
  // Clean up expired transactions periodically
  cleanupExpiredTransactions()
  
  const transactionId = generateTransactionId()
  const key = `${doctype}:${name}`
  logger.log(`[Socket] Starting transaction ${transactionId} for ${key}`)
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
  // If realtime updates are disabled, do nothing
  if (isRealtimeDisabled()) {
    logger.log(`[Socket] Ignoring end transaction ${transactionId} for ${doctype}/${name} - realtime updates disabled`)
    return
  }
  
  const key = `${doctype}:${name}`
  logger.log(`[Socket] Ending transaction ${transactionId} for ${key}`)
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
  // If realtime updates are disabled, all transactions are considered local
  if (isRealtimeDisabled()) {
    logger.log(`[Socket] All transactions considered local when realtime updates disabled`)
    return true
  }
  
  const key = `${doctype}:${name}`
  const isLocal = localTransactions.get(key) === transactionId
  logger.log(`[Socket] Checking transaction ${transactionId} for ${key}: ${isLocal ? 'local' : 'remote'}`)
  return isLocal
}

/**
 * Initialize and return a socket connection
 * Uses a singleton pattern to avoid multiple connections
 */
export function initSocket() {
  // Singleton pattern
  if (window._socketInstance) {
    logger.log(`[Socket] Reusing existing socket connection`)
    return window._socketInstance
  }

  let host = window.location.hostname
  let siteName = window.site_name
  let port = window.location.port ? `:${socketio_port}` : ''
  let protocol = port ? 'http' : 'https'
  let url = `${protocol}://${host}${port}/${siteName}`
  
  logger.log(`[Socket] Initializing socket connection to ${url}`)
  
  const socket = io(url, {
    withCredentials: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnection: true,
    reconnectionAttempts: Infinity,
    timeout: 20000,
    transports: ['polling', 'websocket'],
  })
  
  // Store socket instance
  window._socketInstance = socket
  
  // Initialize socket metrics
  initSocketMetrics();
  
  // Connection event handlers
  socket.on('connect', () => {
    logger.socket('Connected successfully')
    logger.socket(`Socket ID: ${socket.id}`)
    logger.socket(`Current transport: ${socket.io.engine.transport.name}`)
    
    // Update metrics
    socketMetrics.connected = true
    socketMetrics.lastConnected = new Date().toISOString()
    
    // Show reconnection notification if this was a reconnection
    if (socketMetrics.connectionAttempts > 0) {
      logger.socket(`Connection restored after ${socketMetrics.connectionAttempts} attempts`)
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
      
      logger.log(`[Socket] Resubscribing to ${docs.length} documents`)
      
      // Prioritize viewport documents for immediate resubscription
      const viewportDocs = docs.filter(doc => {
        const key = `${doc.doctype}:${doc.name}`;
        return subscriptionQueue.get(key) === PRIORITY.VIEWPORT;
      });
      
      // Subscribe to viewport documents first
      if (viewportDocs.length > 0) {
        logger.log(`[Socket] Resubscribing to ${viewportDocs.length} viewport documents first`);
        await Promise.all(
          viewportDocs.map(doc => {
            logger.log(`[Socket] Resubscribing to viewport ${doc.doctype}/${doc.name}`)
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
        logger.log(`[Socket] Scheduling resubscription for ${backgroundDocs.length} background documents`);
        setTimeout(() => {
          // Process background docs in smaller batches with delays
          for (let i = 0; i < backgroundDocs.length; i += 10) {
            const batch = backgroundDocs.slice(i, i + 10);
            const delay = i * 50; // Distribute subscriptions over time
            
            setTimeout(() => {
              logger.log(`[Socket] Processing background batch ${i/10 + 1}`);
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
    logger.socketError('Connection error:', error)
    logger.socketError(`Current transport: ${socket.io.engine.transport.name}`)
    
    // Track error
    socketMetrics.errors.push({
      type: 'connect_error',
      message: error.message,
      transport: socket.io.engine.transport.name,
      timestamp: new Date().toISOString()
    })
    
    // Only show critical errors to user
    const isCriticalError = 
      error.message.includes('Connection refused') ||
      error.message.includes('Cannot connect to host') ||
      error.message.includes('Timeout') ||
      error.message.includes('Authentication failed')
    
    if (isCriticalError && socketMetrics.errors.length > 3) {
      window.dispatchEvent(new CustomEvent('socket:connection_issues', { 
        detail: { 
          message: 'Having trouble connecting to server',
          transport: socket.io.engine.transport.name,
          error: error.message,
          is_critical: true
        }
      }))
    }
  })

  socket.on('disconnect', (reason) => {
    logger.socket(`Disconnected. Reason: ${reason}`)
    logger.socket(`Last transport: ${socket.io.engine.transport.name}`)
    
    // Update metrics
    socketMetrics.connected = false
    socketMetrics.lastDisconnected = new Date().toISOString()
    socketMetrics.disconnectionReason = reason
    
    // Only show critical disconnection reasons
    const isCriticalReason = 
      reason === 'io server disconnect' || 
      reason === 'transport close' ||
      reason === 'ping timeout' ||
      reason === 'forced close'
    
    if (isCriticalReason) {
      window.dispatchEvent(new CustomEvent('socket:disconnected', {
        detail: { 
          reason,
          transport: socket.io.engine.transport.name,
          is_critical: true
        }
      }))
    }
  })

  socket.on('reconnect_attempt', (attemptNumber) => {
    logger.socket(`Reconnection attempt ${attemptNumber}`)
    logger.socket(`Current transport: ${socket.io.engine.transport.name}`)
    socketMetrics.connectionAttempts = attemptNumber
  })

  socket.on('reconnect', (attemptNumber) => {
    logger.socket(`Reconnected after ${attemptNumber} attempts`)
    logger.socket(`New transport: ${socket.io.engine.transport.name}`)
  })

  socket.on('error', (error) => {
    logger.socketError('Socket error:', error)
    logger.socketError(`Current transport: ${socket.io.engine.transport.name}`)
    
    // Track error
    socketMetrics.errors.push({
      type: 'socket_error',
      message: error.message || 'Unknown socket error',
      transport: socket.io.engine.transport.name,
      timestamp: new Date().toISOString()
    })
  })

  // Add transport switching event handler
  socket.io.engine.on('upgrade', (transport) => {
    logger.socket(`Transport upgraded to: ${transport.name}`)
    socketMetrics.errors.push({
      type: 'transport_upgrade',
      message: `Transport upgraded to ${transport.name}`,
      timestamp: new Date().toISOString()
    })
  })

  socket.io.engine.on('downgrade', (transport) => {
    logger.socketWarn(`Transport downgraded to: ${transport.name}`)
    socketMetrics.errors.push({
      type: 'transport_downgrade',
      message: `Transport downgraded to ${transport.name}`,
      timestamp: new Date().toISOString()
    })
  })

  // Handle resource updates
  socket.on('refetch_resource', (data) => {
    logger.log(`[Socket] Received refetch_resource event:`, data)
    if (data.cache_key) {
      let resource = getCachedResource(data.cache_key) || getCachedListResource(data.cache_key)
      if (resource) {
        logger.log(`[Socket] Reloading resource with cache key: ${data.cache_key}`)
        resource.reload()
      } else {
        logger.log(`[Socket] No cached resource found for key: ${data.cache_key}`)
      }
    }
  })

  // Handle doc update events from server
  socket.on('doc_update', ({ doctype, name, data }) => {
    const key = `${doctype}:${name}`
    logger.log(`[Socket] Received doc_update event for ${key}:`, data)
    
    // Check if this is a local transaction we initiated
    if (data._transaction && localTransactions.get(key) === data._transaction) {
      logger.log(`[Socket] Ignoring update from our own transaction: ${data._transaction}`)
      return
    }
    
    // Handle document creation events
    if (data.event === 'created') {
      logger.log(`[Socket] Document created: ${doctype}/${name}`);
      // Dispatch a custom event for document creation
      window.dispatchEvent(new CustomEvent('crm:doc_created', { 
        detail: { doctype, name } 
      }));
      return
    }
    
    // Handle document deletion events
    if (data.event === 'deleted') {
      logger.log(`[Socket] Document deleted: ${doctype}/${name}`);
      // If we have subscriptions for this document, notify them about deletion
      const callbacks = subscriptions.get(key)
      if (callbacks) {
        logger.log(`[Socket] Notifying ${callbacks.size} subscribers about deletion`)
        callbacks.forEach(callback => callback({ event: 'deleted' }))
        
        // Clean up subscriptions for deleted document
        subscriptions.delete(key)
        subscriptionQueue.delete(key)
        logger.log(`[Socket] Cleaned up subscriptions for ${key}`)
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
        logger.log(`[Socket] Update for ${key} throttled, will use latest data`)
        return
      }
      
      // Set up a throttle timer
      logger.log(`[Socket] Setting up throttle for ${key}`)
      updateThrottles.set(key, setTimeout(() => {
        // Process the update when the timer expires
        const latestData = pendingUpdates.get(key)
        logger.log(`[Socket] Processing throttled update for ${key}`)
        
        if (callbacks && latestData) {
          logger.log(`[Socket] Notifying ${callbacks.size} subscribers with latest data`)
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
      logger.log(`[Socket] No subscribers found for ${key}`)
    }
  })

  return socket
}

/**
 * Load FCRM Settings to check if realtime updates are disabled
 * This function is called when the socket module is imported
 */
function loadSettings() {
  if (settingsLoaded) return

  // Use frappe.call instead of createDocumentResource
  try {
    import('frappe-ui').then(({ call }) => {
      // Request current value
      call('frappe.client.get_value', {
        doctype: 'FCRM Settings',
        fieldname: 'disable_realtime_updates'
      })
        .then(response => {
          if (response && response.message) {
            crmSettings = response.message;
            settingsLoaded = true;
            logger.log('[Socket] Settings loaded:', crmSettings.disable_realtime_updates ? 'Realtime updates disabled' : 'Realtime updates enabled');
          }
        })
        .catch(error => {
          logger.error('[Socket] Failed to load settings:', error);
          // Consider realtime enabled by default
          settingsLoaded = true;
        });
      
      // Subscribe to settings changes if the function is available
      if (window.frappe?.realtime?.on) {
        logger.log('[Socket] Setting up subscription for FCRM Settings changes');
        window.frappe.realtime.on('doc_update', (data) => {
          if (data.doctype === 'FCRM Settings' && data.name === 'FCRM Settings') {
            logger.log('[Socket] Detected settings update');
            // Reload settings
            call('frappe.client.get_value', {
              doctype: 'FCRM Settings',
              fieldname: 'disable_realtime_updates'
            }).then(response => {
              if (response && response.message) {
                crmSettings = response.message;
                logger.log('[Socket] Settings updated:', crmSettings.disable_realtime_updates ? 'Kanban realtime updates disabled' : 'Kanban realtime updates enabled');
              }
            });
          }
        });
      }
    }).catch(err => {
      logger.error('[Socket] Failed to import frappe-ui:', err);
      settingsLoaded = true;
    });
  } catch (error) {
    logger.error('[Socket] Error in loadSettings:', error);
    settingsLoaded = true;
  }
}

// Load settings immediately when the module is imported
loadSettings()

// Get singleton socket instance
const socket = initSocket()

/**
 * Hook for using socket in Vue components.
 * Returns an object with socket instance and methods for document subscriptions.
 */
export function useSocket() {
  // Initialize socket if it hasn't been initialized yet
  const socket = initSocket()
  
  // Return object with socket and methods for working with it
  return {
    socket,
    
    /**
     * Subscribe to socket event.
     * @param {string} event - Event name
     * @param {Function} callback - Event handler function
     */
    on(event, callback) {
      socket.on(event, callback)
    },
    
    /**
     * Unsubscribe from socket event.
     * @param {string} event - Event name
     * @param {Function} callback - Event handler function
     */
    off(event, callback) {
      socket.off(event, callback)
    },
    
    /**
     * Emit event through socket.
     * @param {string} event - Event name
     * @param {*} data - Data to send
     */
    emit(event, data) {
      socket.emit(event, data)
    },
    
    /**
     * Subscribe to document updates.
     * If kanban updates are disabled and this is a kanban doctype,
     * it will return a no-op function.
     * @param {string} doctype - Document type
     * @param {string} name - Document name
     * @param {Function} callback - Function called on document update
     * @param {number} priority - Subscription priority
     * @returns {Function} - Function to unsubscribe from updates
     */
    subscribeToDoc(doctype, name, callback, priority = PRIORITY.BACKGROUND) {
      return subscribeToDoc(doctype, name, callback, priority)
    },
    
    /**
     * Start transaction for document.
     * @param {string} doctype - Document type
     * @param {string} name - Document name
     * @returns {string} - Transaction ID
     */
    startTransaction(doctype, name) {
      return startTransaction(doctype, name)
    },
    
    /**
     * End transaction for document.
     * @param {string} doctype - Document type
     * @param {string} name - Document name
     * @param {string} transactionId - Transaction ID
     */
    endTransaction(doctype, name, transactionId) {
      endTransaction(doctype, name, transactionId)
    },
    
    /**
     * Check if transaction is local.
     * @param {string} doctype - Document type
     * @param {string} name - Document name
     * @param {string} transactionId - Transaction ID
     * @returns {boolean} - true if transaction is local
     */
    isLocalTransaction(doctype, name, transactionId) {
      return isLocalTransaction(doctype, name, transactionId)
    }
  }
}

/**
 * Subscribe to document updates
 * If kanban realtime updates are disabled, it will return a no-op cleanup function
 * but only for document types that are used in kanban boards
 */
export function subscribeToDoc(doctype, name, callback, priority = PRIORITY.BACKGROUND) {
  const key = `${doctype}:${name}`
  logger.log(`[Socket] Attempting to subscribe to ${key} with priority ${priority}`)
  
  // Check if this doctype is used in kanban and if we should disable updates
  const kanbanDoctypes = ['CRM Lead', 'CRM Deal', 'Task']; // Doctypes that use kanban view
  const isKanbanDoctype = kanbanDoctypes.includes(doctype);
  
  // If this is a kanban doctype and realtime updates are disabled, return a no-op function
  if (isKanbanDoctype && isRealtimeDisabled()) {
    logger.log(`[Socket] Not subscribing to ${doctype}/${name} - kanban realtime updates disabled`)
    return () => {}
  }
  
  // Update metrics
  socketMetrics.pendingSubscriptions++
  
  // Update access timestamp
  subscriptionLastUsed.set(key, Date.now())
  
  // Update priority, preserving the highest one
  const currentPriority = subscriptionQueue.get(key) || 0
  subscriptionQueue.set(key, Math.max(currentPriority, priority))
  logger.log(`[Socket] Updated priority for ${key} to ${Math.max(currentPriority, priority)}`)
  
  // If we're already subscribed, just add the callback
  if (subscriptions.has(key)) {
    logger.log(`[Socket] Already subscribed to ${key}, adding callback`)
    subscriptions.get(key).add(callback)
    socketMetrics.pendingSubscriptions--
    socketMetrics.successfulSubscriptions++
    return createCleanupFunction(key, callback)
  }
  
  // Handle high priority subscriptions immediately
  if (priority === PRIORITY.VIEWPORT) {
    logger.log(`[Socket] Processing high priority subscription for ${key} immediately`)
    // Check if we need to manage subscriptions, but don't wait for the result
    if (subscriptions.size >= MAX_SUBSCRIPTIONS) {
      setTimeout(() => manageSubscriptions(), 0)
    }
    
    // Add subscription immediately for visible elements
    subscriptions.set(key, new Set([callback]))
    
    // Add timeout detection for subscription
    const subscriptionTimeout = setTimeout(() => {
      logger.warn(`[Socket] Subscription timeout for ${key}`)
      socketMetrics.pendingSubscriptions--
      socketMetrics.failedSubscriptions++
      // Could add retry logic here
    }, 10000) // 10 second timeout
    
    // Emit subscription event and track success/failure
    socket.emit('subscribe_doc', { doctype, name }, (response) => {
      clearTimeout(subscriptionTimeout)
      socketMetrics.pendingSubscriptions--
      
      if (response && response.success) {
        logger.log(`[Socket] Successfully subscribed to ${key}`)
        socketMetrics.successfulSubscriptions++
      } else {
        logger.error(`[Socket] Failed to subscribe to ${key}:`, response?.error || 'Unknown error')
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
      logger.log(`[Socket] Reached max subscriptions (${MAX_SUBSCRIPTIONS}), managing subscriptions`)
      manageSubscriptions()
    }
    
    // Subscribe if we have room or it's adjacent (medium priority)
    if (subscriptions.size < MAX_SUBSCRIPTIONS || priority === PRIORITY.ADJACENT) {
      logger.log(`[Socket] Creating new subscription for ${key}`)
      subscriptions.set(key, new Set([callback]))
      
      // Emit subscription event
      socket.emit('subscribe_doc', { doctype, name }, (response) => {
        socketMetrics.pendingSubscriptions--
        
        if (response && response.success) {
          logger.log(`[Socket] Successfully subscribed to ${key}`)
          socketMetrics.successfulSubscriptions++
        } else {
          logger.error(`[Socket] Failed to subscribe to ${key}:`, response?.error || 'Unknown error')
          socketMetrics.failedSubscriptions++
        }
      })
    } else {
      logger.log(`[Socket] Subscription for ${key} queued due to limits`)
      socketMetrics.pendingSubscriptions--
    }
  }, 0)
  
  return createCleanupFunction(key, callback)
}

function createCleanupFunction(key, callback) {
  return () => {
    logger.log(`[Socket] Cleaning up subscription for ${key}`)
    const subs = subscriptions.get(key)
    if (subs) {
      subs.delete(callback)
      logger.log(`[Socket] Removed callback for ${key}`)
      if (subs.size === 0) {
        logger.log(`[Socket] No more callbacks for ${key}, removing subscription`)
        subscriptions.delete(key)
        subscriptionQueue.delete(key)
        const [doctype, name] = key.split(':')
        socket.emit('unsubscribe_doc', { doctype, name })
      }
    }
  }
}

function manageSubscriptions() {
  logger.log(`[Socket] Managing subscriptions. Current count: ${subscriptions.size}`)
  
  // Move to a separate microtask to prevent UI blocking
  setTimeout(() => {
    // Sort subscriptions by priority
    const sortedSubs = Array.from(subscriptionQueue.entries())
      .sort(([, priorityA], [, priorityB]) => priorityB - priorityA)
    
    logger.log(`[Socket] Subscription priorities:`, 
      sortedSubs.map(([key, priority]) => `${key}: ${priority}`).join(', '))
    
    // Use recursive setTimeout pattern to avoid blocking the main thread
    function processNextUnsubscription() {
      if (subscriptions.size >= MAX_SUBSCRIPTIONS && sortedSubs.length > 0) {
        const [key] = sortedSubs.pop()
        if (subscriptions.has(key)) {
          const [doctype, name] = key.split(':')
          logger.log(`[Socket] Unsubscribing from ${key} due to priority`)
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
        logger.log(`[Socket] Subscription management complete. New count: ${subscriptions.size}`)
      }
    }
    
    // Start the unsubscription process
    processNextUnsubscription()
  }, 0)
}

/**
 * Update subscription priorities based on which documents are visible
 */
export function updateSubscriptionPriorities(visibleDocs, adjacentDocs) {
  // If kanban realtime updates are disabled, check if this update is for kanban items
  if (isRealtimeDisabled()) {
    // Check if this is a kanban update by examining the first document type
    if (visibleDocs?.length > 0) {
      const firstDocType = visibleDocs[0].doctype;
      const kanbanDoctypes = ['CRM Lead', 'CRM Deal', 'Task']; // Doctypes that use kanban view
      if (kanbanDoctypes.includes(firstDocType)) {
        logger.log('[Socket] Skipping kanban priority update - realtime updates disabled')
        return;
      }
    }
  }
  
  const now = Date.now()
  if (now - lastPriorityUpdate < PRIORITY_UPDATE_THROTTLE) {
    // Skip frequent updates to reduce CPU load
    logger.log('[Socket] Skipping priority update due to throttling')
    return
  }
  
  lastPriorityUpdate = now
  logger.log('[Socket] Updating subscription priorities')
  logger.time('updatePriorities')
  
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
    logger.timeEnd('updatePriorities')
  }, 0)
}

/**
 * Initialize socket metrics
 * Sets up interval for collecting metrics and cleanup routines
 */
export function initSocketMetrics() {
  // If realtime updates are disabled, do nothing
  if (isRealtimeDisabled()) {
    logger.log('[Socket] Metrics initialization skipped - realtime updates disabled')
    return
  }
  
  if (metricsInitialized) {
    logger.log('[Socket] Metrics already initialized')
    return
  }
  
  logger.log('[Socket] Initializing socket metrics')
  metricsInitialized = true
  
  // Collect metrics every 30 seconds
  setInterval(() => {
    // Calculate real-time metrics
    const currentTime = Date.now()
    const elapsed = (currentTime - lastMetricsTime) / 1000 // in seconds
    
    if (elapsed > 0) {
      // Calculate subscription rate
      socketMetrics.subscriptionRate = socketMetrics.successfulSubscriptions / elapsed
      // Reset counters
      socketMetrics.successfulSubscriptions = 0
      socketMetrics.failedSubscriptions = 0
      lastMetricsTime = currentTime
      
      // Log metrics only in dev mode
      logger.log('[Socket] Metrics update:', {
        activeSubscriptions: subscriptions.size,
        pendingSubscriptions: socketMetrics.pendingSubscriptions,
        subscriptionRate: socketMetrics.subscriptionRate.toFixed(2) + '/sec',
        connectionAttempts: socketMetrics.connectionAttempts,
        messagesSent: socketMetrics.messagesSent,
        messagesReceived: socketMetrics.messagesReceived,
        messageRate: (socketMetrics.messagesReceived / elapsed).toFixed(2) + '/sec'
      })
      
      // Reset message counters
      socketMetrics.messagesSent = 0
      socketMetrics.messagesReceived = 0
    }
  }, 30000)
  
  // Start cleanup of inactive subscriptions
  cleanupInactiveSubscriptions()
}

