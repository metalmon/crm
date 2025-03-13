import { ref, reactive, watch, unref } from 'vue'
import { call } from 'frappe-ui'
import { emitSocketEvent, onSocketEvent } from '../socket'

// Create a logger to conditionally show logs based on environment
const isDevelopment = process.env.NODE_ENV !== 'production'
const logger = {
  log: (...args) => isDevelopment && console.log(...args),
  error: (...args) => isDevelopment && console.error(...args),
  warn: (...args) => isDevelopment && console.warn(...args),
  info: (...args) => isDevelopment && console.info(...args),
  // Always log critical errors regardless of environment
  critical: (...args) => console.error('[CRITICAL]', ...args)
}

// Constants
const THROTTLE_DELAY = 1000 // ms between updates for the same document
const MAX_SUBSCRIPTIONS = 100 // Maximum active subscriptions
const INACTIVE_SUBSCRIPTION_TIMEOUT = 10 * 60 * 1000 // 10 minutes
const LOCAL_TRANSACTION_TIMEOUT = 10000 // 10 seconds max for a transaction
const PRIORITY_UPDATE_THROTTLE = 500 // ms

// Priority levels for subscription management
export const PRIORITY = {
  VIEWPORT: 3,    // Currently visible
  ADJACENT: 2,    // In adjacent columns/pages
  BACKGROUND: 1   // Not currently visible
}

// Transaction management is handled at module level to ensure consistency
const localTransactions = new Map() // { doctype:name: transaction_id }
const transactionTimestamps = new Map() // { doctype:name: timestamp }

// Use a single shared interval for all transaction cleanups
let transactionCleanupInterval = null;

/**
 * Generate a unique transaction ID
 */
function generateTransactionId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Clean expired transactions
 */
function cleanupExpiredTransactions() {
  const now = Date.now()
  for (const [key, timestamp] of transactionTimestamps.entries()) {
    if (now - timestamp > LOCAL_TRANSACTION_TIMEOUT) {
      logger.log(`[Updates] Transaction for ${key} expired`)
      localTransactions.delete(key)
      transactionTimestamps.delete(key)
    }
  }
}

// Set up the transaction cleanup interval at module level, only once
function setupTransactionCleanup() {
  if (transactionCleanupInterval) return;
  
  transactionCleanupInterval = setInterval(() => {
    cleanupExpiredTransactions();
    
    // If running in an environment with no active composables, also clean up the interval
    if (typeof window !== 'undefined' && document.visibilityState === 'hidden' && 
        localTransactions.size === 0 && transactionTimestamps.size === 0) {
      clearInterval(transactionCleanupInterval);
      transactionCleanupInterval = null;
    }
  }, 60 * 1000); // Every minute
}

// Activate cleanup only when needed, prevents wasted resources
if (typeof window !== 'undefined' && document.visibilityState !== 'hidden') {
  setupTransactionCleanup();
}

// Setup visibility change listener to properly manage intervals
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      setupTransactionCleanup(); 
    } else if (document.visibilityState === 'hidden' && 
               localTransactions.size === 0 && transactionTimestamps.size === 0) {
      if (transactionCleanupInterval) {
        clearInterval(transactionCleanupInterval);
        transactionCleanupInterval = null;
      }
    }
  });
}

/**
 * Start a new transaction
 */
export function startTransaction(doctype, name) {
  const transactionId = generateTransactionId()
  const key = `${doctype}:${name}`
  logger.log(`[Updates] Starting transaction ${transactionId} for ${key}`)
  localTransactions.set(key, transactionId)
  transactionTimestamps.set(key, Date.now())
  return transactionId
}

/**
 * End transaction if it matches
 */
export function endTransaction(doctype, name, transactionId) {
  const key = `${doctype}:${name}`
  logger.log(`[Updates] Ending transaction ${transactionId} for ${key}`)
  if (localTransactions.get(key) === transactionId) {
    localTransactions.delete(key)
    transactionTimestamps.delete(key)
  }
}

/**
 * Check if update is from local transaction
 */
export function isLocalTransaction(doctype, name, transactionId) {
  const key = `${doctype}:${name}`
  const isLocal = localTransactions.get(key) === transactionId
  logger.log(`[Updates] Checking transaction ${transactionId} for ${key}: ${isLocal ? 'local' : 'remote'}`)
  return isLocal
}

/**
 * Composable for handling realtime updates in views
 */
export function useRealtimeUpdates(options = {}) {
  // Handle both boolean and ref/reactive for isRealtimeEnabled
  const isRealtimeEnabled = ref(false);
  
  // Set initial value based on options
  if (options.isRealtimeEnabled !== undefined) {
    isRealtimeEnabled.value = unref(options.isRealtimeEnabled);
  }
  
  // Watch for changes in isRealtimeEnabled if it's a ref
  if (options.isRealtimeEnabled && typeof options.isRealtimeEnabled === 'object' && 'value' in options.isRealtimeEnabled) {
    watch(options.isRealtimeEnabled, (newValue) => {
      logger.log(`[Updates] Realtime enabled setting changed to: ${newValue}`);
      isRealtimeEnabled.value = newValue;
    });
  }

  // Track active subscriptions
  const subscriptions = new Map() // { key: cleanup function }
  const subscriptionQueue = new Map() // { key: priority }
  const subscriptionLastUsed = new Map() // { key: timestamp }
  
  // Track cards being updated
  const updatingItems = ref(new Set())
  
  // Track pending updates to avoid duplicates
  const pendingUpdates = new Map()
  
  // Track pending item movements
  const pendingMoves = reactive(new Map())
  
  // Flag to track if view needs refresh
  const needsRefresh = ref(false)
  
  // Track current item states
  const itemStates = reactive(new Map())
  
  // Track subscription update state
  const isUpdatingSubscriptions = ref(false)

  // Last update timestamp to prevent too frequent priority updates
  let lastPriorityUpdate = 0
  
  // Store this composable instance's interval
  let instanceCleanupInterval = null;

  /**
   * Process an item update (e.g. card in Kanban)
   */
  async function processItemUpdate(doctype, item, data, options = {}) {
    // Skip updates if realtime is disabled
    if (!isRealtimeEnabled.value) {
      logger.log(`[Updates] Realtime updates disabled, skipping update for ${item.name}`);
      return;
    }
    
    const {
      getItemCurrentState,
      findTargetColumn,
      moveItemToColumn,
      updateItemData,
      highlightUpdatedItem
    } = options

    const updateKey = `${item.name}-${Date.now()}`
    
    if (pendingUpdates.has(item.name)) {
      logger.log(`[Updates] Update already pending for item ${item.name}, skipping`)
      return
    }
    
    // Check if this is a pending move
    const pendingMove = pendingMoves.get(item.name)
    if (pendingMove && Date.now() - pendingMove.timestamp < 5000) {
      logger.log(`[Updates] Skipping update for item ${item.name} - pending move in progress`)
      return
    }
    
    // Check if the item is already being updated visually
    if (updatingItems.value.has(item.name)) {
      logger.log(`[Updates] Item ${item.name} is already being updated visually, queueing update`)
      // Use a simple timeout instead of queueing recursive calls
      setTimeout(() => {
        pendingUpdates.delete(item.name);
      }, 3000);
      return
    }
    
    pendingUpdates.set(item.name, updateKey)
    logger.log(`[Updates] Processing modification of item ${item.name}`)
    
    // Get current state before update - do this outside of the try-catch
    const currentState = getItemCurrentState(item.name)
    if (!currentState) {
      logger.error(`[Updates] Cannot find current state for item ${item.name}`);
      pendingUpdates.delete(item.name);
      return;
    }
    
    // Add item to updating set
    updatingItems.value.add(item.name)
    
    try {
      logger.log(`[Updates] Fetching updated data for item ${item.name}`)
      
      // Fetch updated document with a timeout to prevent indefinite waiting
      let updatedDoc;
      try {
        const fetchPromise = call('frappe.client.get', {
          doctype: doctype,
          name: item.name
        });
        
        // Set a timeout for the fetch operation
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 5000);
        });
        
        updatedDoc = await Promise.race([fetchPromise, timeoutPromise]);
      } catch (error) {
        logger.error(`[Updates] Error fetching data for ${item.name}:`, error);
        updatingItems.value.delete(item.name);
        pendingUpdates.delete(item.name);
        return;
      }
      
      // Check if a newer update has come in while we were fetching
      if (pendingUpdates.get(item.name) !== updateKey) {
        logger.log(`[Updates] Newer update exists for ${item.name}, discarding this one`);
        updatingItems.value.delete(item.name);
        return;
      }
      
      // Process the update
      if (updatedDoc.status !== currentState) {
        logger.log(`[Updates] Item ${item.name} status changed from ${currentState} to ${updatedDoc.status}`);
        const targetColumn = findTargetColumn(updatedDoc.status);
        
        if (targetColumn) {
          try {
            await moveItemToColumn(item, currentState, targetColumn, updatedDoc);
          } catch (moveError) {
            logger.error(`[Updates] Error moving item ${item.name}:`, moveError);
          }
        } else {
          logger.log(`[Updates] Target column not found for status ${updatedDoc.status}`);
        }
      } else {
        // Just update data without column change
        logger.log(`[Updates] Updating item ${item.name} data without column change`);
        updateItemData(item, updatedDoc);
      }
      
      // Highlight updated item
      try {
        await highlightUpdatedItem(item.name);
      } catch (highlightError) {
        logger.error(`[Updates] Error highlighting item ${item.name}:`, highlightError);
      }
      
    } catch (error) {
      logger.error(`[Updates] Error processing item update:`, error);
    } finally {
      // Always clean up
      updatingItems.value.delete(item.name);
      pendingUpdates.delete(item.name);
    }
  }

  /**
   * Handle item deletion
   */
  function handleItemDeletion(itemName, options = {}) {
    // Skip if realtime is disabled
    if (!isRealtimeEnabled.value) {
      logger.log(`[Updates] Realtime updates disabled, skipping deletion for ${itemName}`);
      return;
    }
    
    const { removeItemFromView, cleanupItemState } = options
    
    logger.log(`[Updates] Processing deletion of item ${itemName}`)
    removeItemFromView(itemName)
    cleanupItemState(itemName)
  }

  /**
   * Mark a document as accessed to prevent cleanup
   */
  function markDocumentAccessed(doctype, name) {
    const key = `${doctype}:${name}`
    subscriptionLastUsed.set(key, Date.now())
  }

  /**
   * Clean up inactive subscriptions
   * This is a standalone function that uses closure over the subscriptions maps
   */
  function cleanupInactiveSubscriptions() {
    // Skip when realtime is disabled
    if (!isRealtimeEnabled.value) {
      return;
    }
    
    logger.log('[Updates] Checking for inactive subscriptions')
    const now = Date.now()
    let cleanupCount = 0
    
    for (const [key, lastUsed] of subscriptionLastUsed.entries()) {
      if (now - lastUsed > INACTIVE_SUBSCRIPTION_TIMEOUT) {
        if (subscriptionQueue.get(key) === PRIORITY.VIEWPORT) {
          logger.log(`[Updates] Skipping cleanup of viewport subscription ${key}`)
          subscriptionLastUsed.set(key, now - INACTIVE_SUBSCRIPTION_TIMEOUT / 2)
          continue
        }
        
        logger.log(`[Updates] Cleaning up inactive subscription ${key}`)
        const [doctype, name] = key.split(':')
        
        if (subscriptions.has(key)) {
          // Call the cleanup function for this subscription
          const unsubscribe = subscriptions.get(key)
          unsubscribe()
          subscriptions.delete(key)
        }
        
        subscriptionQueue.delete(key)
        subscriptionLastUsed.delete(key)
        cleanupCount++
      }
    }
    
    logger.log(`[Updates] Cleaned up ${cleanupCount} inactive subscriptions`)
  }

  /**
   * Update subscription priorities
   */
  function updateSubscriptionPriorities(visibleDocs, adjacentDocs) {
    // Skip if realtime is disabled
    if (!isRealtimeEnabled.value) {
      logger.log(`[Updates] Realtime updates disabled, skipping priority update`);
      return;
    }
    
    const now = Date.now()
    if (now - lastPriorityUpdate < PRIORITY_UPDATE_THROTTLE) {
      logger.log('[Updates] Skipping priority update due to throttling')
      return
    }
    
    lastPriorityUpdate = now
    logger.log('[Updates] Updating subscription priorities')
    
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

  /**
   * Manage subscriptions based on priority
   */
  function manageSubscriptions() {
    // Skip if realtime is disabled
    if (!isRealtimeEnabled.value) {
      logger.log(`[Updates] Realtime updates disabled, skipping subscription management`);
      return;
    }
    
    logger.log(`[Updates] Managing subscriptions. Current count: ${subscriptions.size}`)
    
    if (subscriptions.size < MAX_SUBSCRIPTIONS) {
      return
    }
    
    // Sort subscriptions by priority
    const sortedSubs = Array.from(subscriptionQueue.entries())
      .sort(([, priorityA], [, priorityB]) => priorityB - priorityA)
    
    logger.log(`[Updates] Subscription priorities:`, 
      sortedSubs.map(([key, priority]) => `${key}: ${priority}`).join(', '))
    
    // Remove lowest priority subscriptions without recursive setTimeout calls
    // which can lead to main thread blocking
    const toRemove = sortedSubs.slice(MAX_SUBSCRIPTIONS - 10);
    
    if (toRemove.length > 0) {
      logger.log(`[Updates] Removing ${toRemove.length} lowest priority subscriptions`);
      
      // Process at most 10 removals at a time to avoid blocking
      toRemove.slice(0, 10).forEach(([key]) => {
        if (subscriptions.has(key)) {
          logger.log(`[Updates] Unsubscribing from ${key} due to priority`);
          const unsubscribe = subscriptions.get(key);
          unsubscribe();
          // cleanup function handles removal from collections
        }
      });
    }
    
    logger.log(`[Updates] Subscription management complete. New count: ${subscriptions.size}`);
  }

  /**
   * Subscribe to document updates with priority management
   */
  function subscribeToDocWithPriority(doctype, name, callback, priority = PRIORITY.BACKGROUND) {
    // Skip if realtime is disabled
    if (!isRealtimeEnabled.value) {
      logger.log(`[Updates] Realtime updates disabled, skipping subscription to ${doctype}:${name}`);
      return () => {}; // Return empty cleanup function
    }
    
    const key = `${doctype}:${name}`
    logger.log(`[Updates] Attempting to subscribe to ${key} with priority ${priority}`)
    
    // Update access timestamp
    markDocumentAccessed(doctype, name)
    
    // Update priority, preserving the highest one
    const currentPriority = subscriptionQueue.get(key) || 0
    subscriptionQueue.set(key, Math.max(currentPriority, priority))
    
    // If we're already subscribed, just update the callback
    if (subscriptions.has(key)) {
      logger.log(`[Updates] Already subscribed to ${key}, updating callback`)
      const oldUnsubscribe = subscriptions.get(key)
      oldUnsubscribe()
    }
    
    // Subscribe to document updates
    const unsubscribe = onSocketEvent('doc:updated', (event) => {
      const { detail } = event
      if (detail.doctype === doctype && detail.name === name) {
        callback(detail.data)
      }
    })
    
    // Subscribe to document on server
    emitSocketEvent('subscribe_doc', { doctype, name }, (response) => {
      if (response?.success) {
        logger.log(`[Updates] Successfully subscribed to ${key}`)
      } else {
        logger.error(`[Updates] Failed to subscribe to ${key}:`, response?.error || 'Unknown error')
      }
    })
    
    // Create cleanup function
    const cleanupFunction = () => {
      logger.log(`[Updates] Cleaning up subscription for ${key}`)
      unsubscribe()
      emitSocketEvent('unsubscribe_doc', { doctype, name })
      subscriptions.delete(key)
      subscriptionQueue.delete(key)
      subscriptionLastUsed.delete(key)
    }
    
    // Store subscription cleanup
    subscriptions.set(key, cleanupFunction)
    
    // Manage subscriptions if needed
    if (subscriptions.size >= MAX_SUBSCRIPTIONS) {
      manageSubscriptions()
    }
    
    // Return cleanup function
    return cleanupFunction
  }

  /**
   * Create a throttled function for subscription updates that won't block the UI
   */
  function createThrottledSubscribe(updateSubscriptionsFn) {
    let isThrottled = false;
    let pendingCall = false;
    const THROTTLE_TIME = 1000; // 1 second between calls

    return () => {
      // If we're already throttled, just mark that we want to run again
      if (isThrottled) {
        pendingCall = true;
        return;
      }

      // If updating subscriptions is already in progress, defer
      if (isUpdatingSubscriptions.value) {
        pendingCall = true;
        return;
      }

      // Run the function now
      isThrottled = true;
      updateSubscriptionsFn();

      // Set up the throttle timeout
      setTimeout(() => {
        isThrottled = false;
        
        // If we have a pending call, run again once
        if (pendingCall && !isUpdatingSubscriptions.value) {
          pendingCall = false;
          updateSubscriptionsFn();
        }
      }, THROTTLE_TIME);
    };
  }

  /**
   * Subscribe to updates for multiple items
   */
  async function updateSubscriptions(doctype, visibleItems, options = {}) {
    // Skip updates if realtime is disabled or required parameters are missing
    if (!isRealtimeEnabled.value) {
      logger.log(`[Updates] Realtime updates disabled, skipping subscription updates`);
      return;
    }
    
    if (!doctype) {
      logger.log(`[Updates] Cannot update subscriptions - doctype not available`);
      return;
    }

    if (isUpdatingSubscriptions.value) {
      logger.log(`[Updates] Subscription update already in progress, skipping`);
      return;
    }

    try {
      isUpdatingSubscriptions.value = true;
      logger.log(`[Updates] Starting subscription update`);

      // Get current visible items - limit to a reasonable number to prevent blocking
      const maxVisibleItems = 50; // Limit the number of items we process at once
      const limitedVisibleItems = visibleItems.slice(0, maxVisibleItems);
      const visibleItemNames = new Set(limitedVisibleItems.map(item => item.name));

      // Remove obsolete subscriptions - collect them first
      const obsoleteSubscriptions = [];
      for (const [key, unsubscribe] of subscriptions.entries()) {
        const [itemDoctype, itemName] = key.split(':');
        
        // Only manage subscriptions for this doctype
        if (itemDoctype === doctype && !visibleItemNames.has(itemName)) {
          obsoleteSubscriptions.push([key, unsubscribe]);
        }
      }

      // Unsubscribe in smaller batches if there are many
      if (obsoleteSubscriptions.length > 0) {
        logger.log(`[Updates] Removing ${obsoleteSubscriptions.length} obsolete subscriptions`);
        
        // Process in smaller chunks to avoid blocking
        const chunkSize = 10;
        for (let i = 0; i < Math.min(obsoleteSubscriptions.length, 30); i += chunkSize) {
          const chunk = obsoleteSubscriptions.slice(i, i + chunkSize);
          chunk.forEach(([key, unsubscribe]) => {
            unsubscribe(); // This will handle cleanup correctly
          });
          
          // Give UI thread a chance to breathe between chunks
          if (i + chunkSize < obsoleteSubscriptions.length) {
            await new Promise(resolve => setTimeout(resolve, 1));
          }
        }
      }

      // Find new items that need subscriptions
      const newItems = limitedVisibleItems.filter(item => {
        const key = `${doctype}:${item.name}`;
        return !subscriptions.has(key);
      }).slice(0, 20); // Limit to 20 new subscriptions at once to avoid blocking

      // Subscribe in small batches to avoid blocking the UI
      if (newItems.length > 0) {
        logger.log(`[Updates] Adding ${newItems.length} new subscriptions`);
        
        // Process a few items at a time
        const batchSize = 5;
        for (let i = 0; i < newItems.length; i += batchSize) {
          const batch = newItems.slice(i, i + batchSize);
          
          // Process each batch sequentially to reduce load
          for (const item of batch) {
            // Skip if component was unmounted during this process
            if (!isRealtimeEnabled.value) break;
            
            const key = `${doctype}:${item.name}`;
            
            try {
              // Create subscription with proper callback
              subscribeToDocWithPriority(
                doctype, 
                item.name, 
                (data) => {
                  if (data._transaction && isLocalTransaction(doctype, item.name, data._transaction)) {
                    logger.log(`[Updates] Skipping local transaction update for ${item.name}`);
                    return;
                  }
                  
                  if (data.event === 'deleted') {
                    handleItemDeletion(item.name, options);
                    return;
                  }
                  
                  if (data.event === 'modified') {
                    processItemUpdate(doctype, item, data, options);
                  }
                }, 
                PRIORITY.VIEWPORT
              );
            } catch (err) {
              logger.error(`[Updates] Error subscribing to ${key}:`, err);
            }
          }
          
          // Short pause between batches
          if (i + batchSize < newItems.length) {
            await new Promise(resolve => setTimeout(resolve, 5));
          }
        }
      }

      logger.log(`[Updates] Subscription update complete. Active subscriptions: ${subscriptions.size}`);
    } finally {
      isUpdatingSubscriptions.value = false;
    }
  }

  /**
   * Track a pending move operation
   */
  function trackItemMove(itemName, fromColumn, toColumn) {
    logger.log(`[Updates] Tracking move of item ${itemName} from ${fromColumn} to ${toColumn}`)
    pendingMoves.set(itemName, {
      from: fromColumn,
      to: toColumn,
      timestamp: Date.now()
    })
    
    // Clean up pending move after timeout
    setTimeout(() => {
      if (pendingMoves.has(itemName)) {
        logger.log(`[Updates] Cleaning up stale pending move for ${itemName}`)
        pendingMoves.delete(itemName)
      }
    }, 5000)
  }

  /**
   * Clean up all subscriptions
   */
  function cleanup() {
    logger.log(`[Updates] Cleaning up all subscriptions`);
    
    // Call unsubscribe for all active subscriptions
    for (const unsubscribe of subscriptions.values()) {
      try {
        unsubscribe();
      } catch (e) {
        logger.error(`[Updates] Error during cleanup:`, e);
      }
    }
    
    // Clear all maps and collections
    subscriptions.clear();
    subscriptionQueue.clear();
    subscriptionLastUsed.clear();
    updatingItems.value.clear();
    pendingUpdates.clear();
    pendingMoves.clear();
    itemStates.clear();
    
    logger.log(`[Updates] Cleanup completed`);
  }

  // Cleanup when component is unmounted or page is unloaded
  const cleanupFn = function() {
    cleanup();
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', cleanupFn);
    }
  };
  
  // Only set up beforeunload handler in browser context
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', cleanupFn);
  }
  
  // No separate cleanup interval for each composable instance
  // Instead, use the shared transaction cleanup interval
  
  return {
    // State
    updatingItems,
    needsRefresh,
    isUpdatingSubscriptions,
    isRealtimeEnabled,
    
    // Methods
    processItemUpdate,
    handleItemDeletion,
    createThrottledSubscribe,
    updateSubscriptions,
    trackItemMove,
    cleanup,
    
    // Transaction helpers
    startTransaction: (doctype, name) => startTransaction(doctype, name),
    endTransaction: (doctype, name, id) => endTransaction(doctype, name, id),
    isLocalTransaction: (doctype, name, id) => isLocalTransaction(doctype, name, id),
    updateSubscriptionPriorities,
    markDocumentAccessed,
    
    // Add the cleanup function to the return object for component unmounting
    dispose: cleanupFn
  }
} 