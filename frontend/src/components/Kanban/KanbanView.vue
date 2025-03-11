<template>
  <div class="flex overflow-x-auto h-full dark-scrollbar">
    <Draggable
      v-if="columns"
      :list="columns"
      item-key="column"
      @end="updateColumn"
      :delay="isTouchScreenDevice() ? 200 : 0"
      class="flex sm:mx-2.5 mx-2 pb-3.5"
    >
      <template #item="{ element: column }">
        <div
          v-if="!column.column.delete"
          class="flex flex-col gap-2.5 min-w-72 w-72 hover:bg-surface-gray-2 rounded-lg p-2.5"
        >
          <div class="flex gap-2 items-center group justify-between">
            <div class="flex items-center text-base">
              <NestedPopover>
                <template #target>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="hover:!bg-surface-gray-2"
                  >
                    <IndicatorIcon :class="parseColor(column.column.color)" />
                  </Button>
                </template>
                <template #body="{ close }">
                  <div
                    class="flex flex-col gap-3 px-3 py-2.5 min-w-40 rounded-lg bg-surface-modal shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none"
                  >
                    <div class="flex gap-1">
                      <Button
                        variant="ghost"
                        v-for="color in colors"
                        :key="color"
                        @click="() => (column.column.color = color)"
                      >
                        <IndicatorIcon :class="parseColor(color)" />
                      </Button>
                    </div>
                    <div class="flex flex-row-reverse">
                      <Button
                        variant="solid"
                        :label="__('Apply')"
                        @click="updateColumn"
                      />
                    </div>
                  </div>
                </template>
              </NestedPopover>
              <div class="text-ink-gray-9">{{ __(column.column.name) }}</div>
            </div>
            <div class="flex">
              <Dropdown :options="actions(column)">
                <template #default>
                  <Button
                    class="hidden group-hover:flex"
                    icon="more-horizontal"
                    variant="ghost"
                  />
                </template>
              </Dropdown>
              <Button
                icon="plus"
                variant="ghost"
                @click="options.onNewClick(column)"
              />
            </div>
          </div>
          <div class="overflow-y-auto flex flex-col gap-2 h-full dark-scrollbar">
            <Draggable
              :list="column.data"
              group="fields"
              item-key="name"
              class="flex flex-col gap-3.5 flex-1"
              @end="updateColumn"
              :delay="isTouchScreenDevice() ? 200 : 0"
              :data-column="column.column.name"
              :animation="realtimeDisabled ? 0 : 150"
              :disabled="false"
            >
              <template #item="{ element: fields }">
                <component
                  :is="options.getRoute ? 'router-link' : 'div'"
                  class="relative pt-3 px-3.5 pb-2.5 rounded-lg border bg-surface-white text-base flex flex-col text-ink-gray-9 shadow-sm hover:shadow-md dark:bg-surface-gray-1 dark:border-surface-gray-3 hover:border-gray-300 dark:hover:border-surface-gray-4 dark:hover:bg-surface-gray-2"
                  :class="{ 'cursor-move': !realtimeDisabled }"
                  :data-name="fields.name"
                  v-bind="{
                    to: options.getRoute ? options.getRoute(fields) : undefined,
                    onClick: options.onClick
                      ? () => options.onClick(fields)
                      : undefined,
                  }"
                >
                  <div 
                    v-if="!realtimeDisabled && updatingCards.has(fields.name)"
                    class="absolute right-2 top-2 z-10"
                  >
                    <FeatherIcon 
                      name="refresh-cw" 
                      class="text-info-500 animate-spin h-4 w-4" 
                    />
                  </div>
                  <slot
                    name="title"
                    v-bind="{ fields, titleField, itemName: fields.name }"
                  >
                    <div class="h-5 flex items-center">
                      <div v-if="fields[titleField]">
                        {{ fields[titleField] }}
                      </div>
                      <div class="text-ink-gray-4" v-else>
                        {{ __('No Title') }}
                      </div>
                    </div>
                  </slot>
                  <div class="border-b h-px my-2.5" />

                  <div class="flex flex-col gap-3.5">
                    <template v-for="value in column.fields" :key="value">
                      <slot
                        name="fields"
                        v-bind="{
                          fields,
                          fieldName: value,
                          itemName: fields.name,
                        }"
                      >
                        <div v-if="fields[value]" class="truncate">
                          {{ fields[value] }}
                        </div>
                      </slot>
                    </template>
                  </div>
                  <div class="border-b h-px mt-2.5 mb-2" />
                  <slot name="actions" v-bind="{ itemName: fields.name }">
                    <div class="flex gap-2 items-center justify-between">
                      <div></div>
                      <Button icon="plus" variant="ghost" @click.stop.prevent />
                    </div>
                  </slot>
                </component>
              </template>
            </Draggable>
            <div
              v-if="column.column.count < column.column.all_count"
              class="flex items-center justify-center"
            >
              <Button
                :label="__('Load More')"
                @click="emit('loadMore', column.column.name)"
              />
            </div>
          </div>
        </div>
      </template>
    </Draggable>
    <div v-if="deletedColumns.length" class="shrink-0 min-w-64">
      <Autocomplete
        value=""
        :options="deletedColumns"
        @change="(e) => addColumn(e)"
      >
        <template #target="{ togglePopover }">
          <Button
            class="w-full mt-2.5 mb-1 mr-5"
            @click="togglePopover()"
            :label="__('Add Column')"
          >
            <template #prefix>
              <FeatherIcon name="plus" class="h-4" />
            </template>
          </Button>
        </template>
      </Autocomplete>
    </div>
  </div>
</template>

<style>
.remote-update-highlight {
  animation: remote-update 1s ease;
}

@keyframes remote-update {
  0% {
    background-color: var(--info-100);
  }
  100% {
    background-color: transparent;
  }
}

/* Add smooth transition for non-realtime mode */
.draggable-move {
  transition: transform 0.15s ease;
}
</style>

<script setup>
import Autocomplete from '@/components/frappe-ui/Autocomplete.vue'
import NestedPopover from '@/components/NestedPopover.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import { isTouchScreenDevice, colors, parseColor } from '@/utils'
import Draggable from 'vuedraggable'
import { Dropdown } from 'frappe-ui'
import { computed, onMounted, onUnmounted, watch, nextTick, ref, reactive } from 'vue'
import { useSocket, PRIORITY, startTransaction, endTransaction, isLocalTransaction } from '@/socket'
import { FeatherIcon, call } from 'frappe-ui'

// Create a logger to conditionally show logs based on environment
const isDevelopment = process.env.NODE_ENV !== 'production'
const logger = {
  log: (...args) => isDevelopment && console.log(...args),
  error: (...args) => isDevelopment && console.error(...args),
  warn: (...args) => isDevelopment && console.warn(...args),
  info: (...args) => isDevelopment && console.info(...args),
  time: (...args) => isDevelopment && console.time(...args),
  timeEnd: (...args) => isDevelopment && console.timeEnd(...args),
  // Always log critical errors regardless of environment
  critical: (...args) => console.error('[CRITICAL]', ...args)
}

// Debounce helper
function debounce(fn, wait) {
  let timeout
  return function(...args) {
    clearTimeout(timeout)
    timeout = setTimeout(() => fn.apply(this, args), wait)
  }
}

const props = defineProps({
  options: {
    type: Object,
    default: () => ({
      getRoute: null,
      onClick: null,
      onNewClick: null,
    }),
  },
})

const emit = defineEmits(['update', 'loadMore'])
const kanban = defineModel()
const socket = useSocket()

// Track active subscriptions
const subscriptions = new Map()

// Track cards being updated
const updatingCards = ref(new Set())

// Track pending updates to avoid duplicates
const pendingUpdates = new Map()

// Track pending card movements
const pendingMoves = reactive(new Map())

// Flag to track if view needs refresh
const needsRefresh = ref(false)

// Track current card states
const cardStates = reactive(new Map())

// Track subscription update state
const isUpdatingSubscriptions = ref(false)

// Track if socket is initialized
const socketInitialized = ref(false)

// Track document creation/deletion handlers
let docCreatedHandler = null;
let docDeletedHandler = null;

// Optimize subscription updates with improved throttle
const throttledSubscribe = (() => {
  let timeout = null
  let lastCall = 0
  let pendingUpdate = false
  let updateCount = 0
  const THROTTLE_DELAY = 2000 // 2 seconds
  const CONSECUTIVE_UPDATE_LIMIT = 1 // Maximum number of consecutive updates

  return () => {
    if (isUpdatingSubscriptions.value) {
      pendingUpdate = true
      return
    }

    updateCount++
    
    // Prevent consecutive updates beyond our limit
    if (updateCount > CONSECUTIVE_UPDATE_LIMIT) {
      logger.log(`[KanbanView] Too many consecutive updates (${updateCount}), limiting rate`)
      
      // Reset counter after some time to allow future updates
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        updateCount = 0
        if (pendingUpdate) {
          pendingUpdate = false
          updateSubscriptions()
        }
      }, THROTTLE_DELAY)
      return
    }

    const now = Date.now()
    if (lastCall && now - lastCall < THROTTLE_DELAY) {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        lastCall = now
        updateCount = 0
        if (pendingUpdate) {
          pendingUpdate = false
          updateSubscriptions()
        }
      }, THROTTLE_DELAY)
      return
    }

    lastCall = now
    pendingUpdate = false
    updateCount = 0
    updateSubscriptions()
  }
})()

// Optimize subscription management with batch processing
const BATCH_SIZE = 10 // Process subscriptions in batches of 10
const SUBSCRIPTION_DEBOUNCE = 1000 // Wait 1 second before processing subscription changes

// Optimize event handling with debounced updates
const debouncedEmit = debounce(async (eventData) => {
  try {
    await emit('update', eventData)
    logger.log(`[KanbanView] Debounced update emitted successfully`)
  } catch (error) {
    logger.error(`[KanbanView] Error in debounced emit:`, error)
  }
}, 100) // 100ms debounce

// Queue system for updates
const updateQueue = reactive(new Map())
const isProcessingQueue = ref(false)

// Process updates in queue
async function processUpdateQueue() {
  // Skip queue processing if realtime updates are disabled
  if (realtimeDisabled.value) return

  if (isProcessingQueue.value || updateQueue.size === 0) return

  isProcessingQueue.value = true
  const batchSize = 3 // Process 3 updates at a time

  try {
    const entries = Array.from(updateQueue.entries())
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize)
      await Promise.all(batch.map(async ([key, update]) => {
        try {
          await emit('update', update.data)
          logger.log(`[KanbanView] Processed queued update for ${update.itemName}`)
        } catch (error) {
          logger.error(`[KanbanView] Error processing queued update:`, error)
        } finally {
          updateQueue.delete(key)
          if (update.itemName) {
            updatingCards.value.delete(update.itemName)
          }
        }
      }))

      // Small delay between batches
      if (i + batchSize < entries.length) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }
  } finally {
    isProcessingQueue.value = false
    // Check if new updates arrived during processing
    if (updateQueue.size > 0) {
      processUpdateQueue()
    }
  }
}

// Queue update instead of immediate emit
function queueUpdate(data, itemName = null) {
  // If realtime updates are disabled, emit immediately without queueing
  if (realtimeDisabled.value) {
    emit('update', data)
    if (itemName) {
      updatingCards.value.delete(itemName)
    }
    return
  }

  const key = `${itemName || 'column'}-${Date.now()}`
  updateQueue.set(key, { data, itemName, timestamp: Date.now() })
  
  // Start processing queue on next tick
  nextTick(() => {
    if (!isProcessingQueue.value) {
      processUpdateQueue()
    }
  })
}

// Modified subscription update
async function updateSubscriptions() {
  // Double check realtime is not disabled
  if (realtimeDisabled.value) {
    logger.log('[KanbanView] Skipping subscription update - realtime updates disabled')
    cleanup() // Ensure cleanup
    return
  }

  const doctype = kanban.value?.params?.doctype
  if (!doctype || isUpdatingSubscriptions.value || !socketInitialized.value) {
    return
  }

  try {
    isUpdatingSubscriptions.value = true

    const visibleCards = new Set()
    const columnCards = new Map()
    
    // Collect visible cards
    columns.value.forEach(column => {
      if (!column.column.delete) {
        const cards = column.data.map(card => card.name)
        columnCards.set(column.column.name, cards)
        cards.forEach(card => visibleCards.add(card))
      }
    })

    // Process unsubscriptions
    const obsoleteSubscriptions = []
    for (const [cardName, unsubscribe] of subscriptions.entries()) {
      if (!visibleCards.has(cardName)) {
        obsoleteSubscriptions.push([cardName, unsubscribe])
      }
    }

    // Process new subscriptions
    const newSubscriptions = []
    for (const [columnName, cards] of columnCards.entries()) {
      cards.forEach(cardName => {
        if (!subscriptions.has(cardName)) {
          newSubscriptions.push({ cardName, columnName })
        }
      })
    }

    // Process in smaller batches
    await Promise.all([
      processBatch(obsoleteSubscriptions, async ([cardName, unsubscribe]) => {
        unsubscribe()
        subscriptions.delete(cardName)
      }),
      processBatch(newSubscriptions, async ({ cardName, columnName }) => {
        const unsubscribe = socket.subscribeToDoc(
          doctype, 
          cardName,
          data => handleCardUpdate(doctype, cardName, columnName, data),
          PRIORITY.VIEWPORT
        )
        subscriptions.set(cardName, unsubscribe)
      })
    ])

  } finally {
    isUpdatingSubscriptions.value = false
  }
}

// Modified card update handling
function handleCardUpdate(doctype, cardName, columnName, data) {
  if (realtimeDisabled.value) {
    logger.log('[KanbanView] Skipping card update - realtime updates disabled')
    return
  }

  if (data._transaction && isLocalTransaction(doctype, cardName, data._transaction)) {
    return
  }

  if (pendingUpdates.has(cardName)) {
    return
  }

  const updateKey = `${cardName}-${Date.now()}`
  pendingUpdates.set(cardName, updateKey)
  
  requestAnimationFrame(() => {
    processCardUpdate(doctype, { name: cardName }, data)
      .finally(() => {
        pendingUpdates.delete(cardName)
        updatingCards.value.delete(cardName)
      })
  })
}

const titleField = computed(() => {
  return kanban.value?.data?.title_field
})

const columns = computed(() => {
  if (!kanban.value?.data?.data || kanban.value.data.view_type != 'kanban')
    return []
  let _columns = kanban.value.data.data

  let has_color = _columns.some((column) => column.column?.color)
  if (!has_color) {
    _columns.forEach((column, i) => {
      column.column['color'] = colors[i % colors.length]
    })
  }
  return _columns
})

// Helper function to log card updates
function logCardUpdate(action, cardName, details = {}) {
  logger.log(`[KanbanView] ${action} card ${cardName}:`, details)
}

// Modified getCardCurrentState function
function getCardCurrentState(cardName) {
  // Skip state tracking if realtime updates are disabled
  if (realtimeDisabled.value) return null

  let currentState = null
  columns.value.forEach(column => {
    if (column.data.some(card => card.name === cardName)) {
      currentState = column.column.name
    }
  })
  return currentState
}

// Add new function to handle direct card movement
function handleDirectCardMove(cardName, fromColumn, toColumn) {
  const sourceColumn = columns.value.find(col => 
    col.column.name === fromColumn
  )
  const targetColumn = columns.value.find(col => 
    col.column.name === toColumn
  )
  
  if (sourceColumn && targetColumn) {
    // Find the card in the source column
    const cardIndex = sourceColumn.data.findIndex(card => 
      card.name === cardName
    )
    
    if (cardIndex !== -1) {
      // Remove card from source column
      const [card] = sourceColumn.data.splice(cardIndex, 1)
      
      // Add card to target column
      targetColumn.data.push(card)
      
      // Sort if needed
      const order_by = kanban.value?.params?.order_by
      if (order_by) {
        const [field, direction] = order_by.split(' ')
        targetColumn.data.sort((a, b) => {
          if (direction === 'desc') {
            return a[field] > b[field] ? -1 : 1
          } else {
            return a[field] < b[field] ? -1 : 1
          }
        })
      }
      
      return true
    }
  }
  
  return false
}

// Modified updateColumn function
async function updateColumn(d) {
  // If realtime is disabled, only handle local state
  if (realtimeDisabled.value) {
    let toColumn = d?.to?.dataset.column
    let fromColumn = d?.from?.dataset.column
    let itemName = d?.item?.dataset.name
    
    if (toColumn && fromColumn && itemName) {
      logger.log(`[KanbanView] Handling local move from ${fromColumn} to ${toColumn}`)
      handleDirectCardMove(itemName, fromColumn, toColumn)
    }
    return
  }
  
  let toColumn = d?.to?.dataset.column
  let fromColumn = d?.from?.dataset.column
  let itemName = d?.item?.dataset.name

  // Only collect data from affected columns
  let _columns = []
  columns.value.forEach((col) => {
    if (!col.column.delete && 
        ((!toColumn && !fromColumn) || // Column reorder
         col.column.name === toColumn || 
         col.column.name === fromColumn)) {
      
      col.column['order'] = col.data.map((d) => d.name)
      if (col.column.page_length) {
        delete col.column.page_length
      }
      _columns.push(col.column)
    }
  })

  let data = { kanban_columns: _columns }
  const doctype = kanban.value.params.doctype

  if (toColumn != fromColumn && itemName) {
    logger.log(`[KanbanView] Moving card ${itemName} from ${fromColumn} to ${toColumn}`)
    
    // Track pending move without blocking the UI
    pendingMoves.set(itemName, {
      from: fromColumn,
      to: toColumn,
      timestamp: Date.now()
    })
    
    // Start transaction for card movement
    const transactionId = startTransaction(doctype, itemName)
    
    data = { 
      item: itemName, 
      to: toColumn, 
      kanban_columns: _columns,
      _transaction: transactionId 
    }
    
    try {
      // Mark card as updating
      updatingCards.value.add(itemName)
      
      // Queue update instead of immediate emit
      queueUpdate(data, itemName)
      
      // Remove pending states quickly
      setTimeout(() => {
        endTransaction(doctype, itemName, transactionId)
        pendingMoves.delete(itemName)
      }, 100) // Very short timeout
    } catch (error) {
      logger.error(`[KanbanView] Error moving card:`, error)
      pendingMoves.delete(itemName)
      updatingCards.value.delete(itemName)
      endTransaction(doctype, itemName, transactionId)
    }
  } else {
    // Only queue update if columns actually changed
    if (_columns.length > 0) {
      if (realtimeDisabled.value) {
        // If realtime updates are disabled, just emit without queueing
        emit('update', data)
      } else {
        queueUpdate(data)
      }
    }
  }
}

// Optimize batch processing
async function processBatch(items, processFn, batchSize = 3) {
  const chunks = []
  for (let i = 0; i < items.length; i += batchSize) {
    chunks.push(items.slice(i, i + batchSize))
  }

  for (const chunk of chunks) {
    await Promise.all(chunk.map(processFn))
    if (chunks.indexOf(chunk) < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }
}

// Modified processCardUpdate function
async function processCardUpdate(doctype, card, data) {
  // If realtime updates are disabled, just update the card data without visual effects
  if (realtimeDisabled.value) {
    try {
      const updatedDoc = await call('frappe.client.get', {
        doctype: doctype,
        name: card.name
      })
      Object.assign(card, updatedDoc)
    } catch (error) {
      logger.error(`[KanbanView] Error updating card data:`, error)
    }
    return
  }

  const updateKey = `${card.name}-${Date.now()}`
  
  if (pendingUpdates.has(card.name)) {
    logger.log(`[KanbanView] Update already pending for card ${card.name}, skipping`)
    return
  }
  
  // Check if this is a pending move
  const pendingMove = pendingMoves.get(card.name)
  if (pendingMove && Date.now() - pendingMove.timestamp < 5000) {
    logger.log(`[KanbanView] Skipping update for card ${card.name} - pending move in progress`)
    return
  }
  
  // Check if the card is already being updated visually
  if (updatingCards.value.has(card.name)) {
    logger.log(`[KanbanView] Card ${card.name} is already being updated visually, queueing update`)
    // Queue this update to run after the current one finishes
    setTimeout(() => {
      if (!pendingUpdates.has(card.name) && !updatingCards.value.has(card.name)) {
        processCardUpdate(doctype, card, data);
      }
    }, 3000);
    return;
  }
  
  pendingUpdates.set(card.name, updateKey)
  logger.log(`[KanbanView] Processing modification of card ${card.name}`)
  
  try {
    updatingCards.value.add(card.name)
    
    // Get current state before update
    const currentState = getCardCurrentState(card.name)
    
    logger.log(`[KanbanView] Fetching updated data for card ${card.name}`)
    const updatedDoc = await call('frappe.client.get', {
      doctype: doctype,
      name: card.name
    })
    
    if (pendingUpdates.get(card.name) !== updateKey) {
      logger.log(`[KanbanView] Newer update exists for ${card.name}, discarding this one`)
      updatingCards.value.delete(card.name)
      return
    }
    
    if (updatedDoc.status !== currentState) {
      logger.log(`[KanbanView] Card ${card.name} status changed from ${currentState} to ${updatedDoc.status}`)
      const targetColumn = columns.value.find(col => 
        col.column.name === updatedDoc.status
      )
      
      if (targetColumn) {
        const sourceColumn = columns.value.find(col => 
          col.data.some(c => c.name === card.name)
        )
        if (sourceColumn && sourceColumn.column.name !== targetColumn.column.name) {
          logger.log(`[KanbanView] Moving card ${card.name} from ${sourceColumn.column.name} to ${targetColumn.column.name}`)
          
          // Use Vue.set equivalent to ensure reactivity
          sourceColumn.data = sourceColumn.data.filter(c => 
            c.name !== card.name
          )
          
          // Update card data
          Object.assign(card, updatedDoc)
          
          // Add card to target column
          targetColumn.data.push(card)
          
          // Sort if needed
          const order_by = kanban.value?.params?.order_by
          if (order_by) {
            logger.log(`[KanbanView] Sorting column ${targetColumn.column.name} by ${order_by}`)
            const [field, direction] = order_by.split(' ')
            targetColumn.data.sort((a, b) => {
              if (direction === 'desc') {
                return a[field] > b[field] ? -1 : 1
              } else {
                return a[field] < b[field] ? -1 : 1
              }
            })
          }
        } else {
          logger.log(`[KanbanView] Card ${card.name} already in correct column ${targetColumn.column.name}`)
          Object.assign(card, updatedDoc)
        }
      } else {
        logger.log(`[KanbanView] Target column not found for status ${updatedDoc.status}`)
      }
    } else {
      logger.log(`[KanbanView] Updating card ${card.name} data without column change`)
      Object.assign(card, updatedDoc)
    }
    
    // Highlight updated card
    await nextTick()
    const cardElement = document.querySelector(`[data-name="${card.name}"]`)
    highlightRemoteUpdate(cardElement, card.name)
    
  } catch (error) {
    logger.error(`[KanbanView] Error processing card update:`, error)
    updatingCards.value.delete(card.name)
  } finally {
    pendingUpdates.delete(card.name)
  }
}

// Modified setupDocCreationListener function
function setupDocCreationListener() {
  if (realtimeDisabled.value) {
    logger.log('[KanbanView] Skipping doc creation listener - realtime updates disabled')
    return () => {}
  }

  const doctype = kanban.value?.params?.doctype;
  if (!doctype) {
    logger.log(`[KanbanView] Cannot setup creation listener - doctype not available`)
    return;
  }
  
  logger.log(`[KanbanView] Setting up document creation listener for ${doctype}`)
  
  // Listen for document creation events using CustomEvent
  const handleDocCreated = (event) => {
    const { doctype: eventDoctype, name } = event.detail;
    logger.log(`[KanbanView] Received document creation event: ${eventDoctype}/${name}`);
    
    if (eventDoctype === doctype) {
      // Set flag to refresh view on next user interaction or after a delay
      needsRefresh.value = true;
      logger.log(`[KanbanView] Setting refresh flag for ${doctype}`);
      
      // Refresh the view after a short delay to avoid too many refreshes
      // if multiple documents are created in quick succession
      setTimeout(() => {
        if (needsRefresh.value) {
          logger.log(`[KanbanView] Refreshing view for ${doctype}`);
          refreshView();
          needsRefresh.value = false;
        }
      }, 1000);
    }
  };
  
  // Add event listener
  window.addEventListener('crm:doc_created', handleDocCreated);
  logger.log(`[KanbanView] Document creation listener setup complete`);
  
  // Store the handler for cleanup
  return handleDocCreated;
}

// Modified setupDocDeletionListener function
function setupDocDeletionListener() {
  if (realtimeDisabled.value) {
    logger.log('[KanbanView] Skipping doc deletion listener - realtime updates disabled')
    return () => {}
  }

  const doctype = kanban.value?.params?.doctype;
  if (!doctype) {
    logger.log(`[KanbanView] Cannot setup deletion listener - doctype not available`)
    return;
  }
  
  logger.log(`[KanbanView] Setting up document deletion listener for ${doctype}`)
  
  // Listen for document deletion events using CustomEvent
  const handleDocDeleted = (event) => {
    const { doctype: eventDoctype, name } = event.detail;
    logger.log(`[KanbanView] Received document deletion event: ${eventDoctype}/${name}`);
    
    if (eventDoctype === doctype) {
      // Check if the document is in any column
      let found = false;
      
      columns.value.forEach(column => {
        if (!column.column.delete) {
          // Find the card in the column
          const cardIndex = column.data.findIndex(card => card.name === name);
          
          if (cardIndex !== -1) {
            logger.log(`[KanbanView] Removing deleted card ${name} from column ${column.column.name}`);
            // Remove the card from the column
            column.data.splice(cardIndex, 1);
            found = true;
          }
        }
      });
      
      // If we didn't find the card in any column, it might be outside our view
      // We'll refresh the view to ensure consistency
      if (!found) {
        logger.log(`[KanbanView] Deleted card ${name} not found in current view, refreshing`);
        needsRefresh.value = true;
        
        setTimeout(() => {
          if (needsRefresh.value) {
            refreshView();
            needsRefresh.value = false;
          }
        }, 1000);
      }
    }
  };
  
  // Add event listener
  window.addEventListener('crm:doc_deleted', handleDocDeleted);
  logger.log(`[KanbanView] Document deletion listener setup complete`);
  
  // Store the handler for cleanup
  return handleDocDeleted;
}

// Refresh the kanban view to get new documents
function refreshView() {
  logger.log(`[KanbanView] Reloading kanban view`);
  kanban.value.reload();
}

// Settings state
const realtimeDisabled = ref(false)

// Thoroughly clean up all socket-related features
function cleanup() {
  logger.log('[KanbanView] Cleaning up socket-related features');
  
  // Clear all subscriptions
  if (subscriptions.size > 0) {
    logger.log(`[KanbanView] Cleaning up ${subscriptions.size} subscriptions`);
    subscriptions.forEach((unsubscribe, cardName) => {
      unsubscribe();
    });
    subscriptions.clear();
  }
  
  // Reset states
  updatingCards.value.clear();
  pendingUpdates.clear();
  pendingMoves.clear();
  isUpdatingSubscriptions.value = false;
  updateQueue.clear();
  
  // Remove event listeners
  if (docCreatedHandler) {
    logger.log('[KanbanView] Removing document creation listener');
    window.removeEventListener('crm:doc_created', docCreatedHandler);
    docCreatedHandler = null;
  }
  
  if (docDeletedHandler) {
    logger.log('[KanbanView] Removing document deletion listener');
    window.removeEventListener('crm:doc_deleted', docDeletedHandler);
    docDeletedHandler = null;
  }
  
  logger.log('[KanbanView] Cleanup complete');
}

// Initialize component - load settings and set up socket if enabled
async function initialize() {
  logger.log('[KanbanView] Initializing component');
  
  // First load settings
  await loadSettings();
  
  if (!realtimeDisabled.value) {
    logger.log('[KanbanView] Real-time updates are enabled - initializing socket features');
    socketInitialized.value = true;
    updateSubscriptions();
    docCreatedHandler = setupDocCreationListener();
    docDeletedHandler = setupDocDeletionListener();
  } else {
    logger.log('[KanbanView] Real-time updates are disabled - skipping socket initialization');
    // Ensure socket features are not initialized
    socketInitialized.value = false;
    cleanup();
  }
}

// Modified loadSettings function
async function loadSettings() {
  try {
    logger.log('[KanbanView] Loading realtime settings')
    const response = await call('frappe.client.get_value', {
      doctype: 'FCRM Settings',
      fieldname: 'disable_realtime_updates'
    })
    
    if (response && response.message) {
      const wasEnabled = !realtimeDisabled.value
      const isDisabled = response.message.disable_realtime_updates === 1
      
      logger.log('[KanbanView] Settings loaded - realtime updates:', isDisabled ? 'disabled' : 'enabled')
      
      realtimeDisabled.value = isDisabled
      
      // If realtime was enabled and is now disabled, clean up
      if (isDisabled && wasEnabled) {
        logger.log('[KanbanView] Realtime was enabled and is now disabled - cleaning up')
        cleanup()
      }
      
      // Force cleanup if disabled
      if (isDisabled) {
        cleanup()
      }
    } else {
      logger.warn('[KanbanView] No settings found - defaulting to enabled')
      realtimeDisabled.value = false
    }
  } catch (error) {
    logger.error('[KanbanView] Failed to load settings:', error)
    // Default to enabled in case of error
    realtimeDisabled.value = false
  }
}

// Modified subscribeToSettings function
function subscribeToSettings() {
  // Listen for settings changes from socket.js
  const handleSettingsChange = (event) => {
    const { disabled } = event.detail
    logger.log('[KanbanView] Realtime settings changed:', disabled ? 'disabled' : 'enabled')
    
    const wasEnabled = !realtimeDisabled.value
    realtimeDisabled.value = disabled
    
    if (disabled && wasEnabled) {
      logger.log('[KanbanView] Realtime was enabled and is now disabled - cleaning up')
      cleanup()
    } else if (!disabled && !wasEnabled) {
      logger.log('[KanbanView] Realtime was disabled and is now enabled - initializing')
      socketInitialized.value = true
      updateSubscriptions()
      docCreatedHandler = setupDocCreationListener()
      docDeletedHandler = setupDocDeletionListener()
    }
  }
  
  window.addEventListener('crm:realtime_settings_changed', handleSettingsChange)
  
  // Store handler for cleanup
  return handleSettingsChange
}

// Store settings change handler
let settingsChangeHandler = null

// Modified component setup
onMounted(() => {
  initialize()
  settingsChangeHandler = subscribeToSettings()
})

onBeforeUnmount(() => {
  cleanup()
  // Remove settings change listener
  if (settingsChangeHandler) {
    window.removeEventListener('crm:realtime_settings_changed', settingsChangeHandler)
    settingsChangeHandler = null
  }
})

const deletedColumns = computed(() => {
  return columns.value
    .filter((col) => col.column['delete'])
    .map((col) => {
      return { label: col.column.name, value: col.column.name }
    })
})

function actions(column) {
  return [
    {
      group: __('Options'),
      hideLabel: true,
      items: [
        {
          label: __('Delete'),
          icon: 'trash-2',
          onClick: () => {
            column.column['delete'] = true
            updateColumn()
          },
        },
      ],
    },
  ]
}

function addColumn(e) {
  let column = columns.value.find((col) => col.column.name == e.value)
  column.column['delete'] = false
  updateColumn()
}

// Modified highlightRemoteUpdate function
function highlightRemoteUpdate(element, cardName) {
  // Skip highlighting if realtime updates are disabled
  if (realtimeDisabled.value) {
    updatingCards.value.delete(cardName)
    return
  }

  if (!element) {
    logger.log(`[KanbanView] Cannot highlight card ${cardName} - element not found`)
    return
  }
  
  logger.log(`[KanbanView] Highlighting remote update for card ${cardName}`)
  element.classList.add('remote-update-highlight')
  
  setTimeout(() => {
    logger.log(`[KanbanView] Removing highlight from card ${cardName}`)
    element.classList.remove('remote-update-highlight')
    updatingCards.value.delete(cardName)
  }, 1000) // Reduced from 2500ms to 1000ms
}

// Modified watch function
watch([
  () => columns.value.map(col => col.data.map(card => card.name)).flat(),
  () => kanban.value?.params?.doctype
], (newVal, oldVal) => {
  // Skip everything if realtime is disabled
  if (realtimeDisabled.value || !socketInitialized.value) {
    logger.log('[KanbanView] Skipping watch updates - realtime disabled or socket not initialized')
    return
  }
  
  const doctype = kanban.value?.params?.doctype
  if (!doctype) return
  
  // Skip unnecessary updates
  if (oldVal && newVal?.length === oldVal?.length && 
      new Set(newVal).size === new Set(oldVal).size) {
    return
  }
  
  // Skip if too many updates are in progress
  if (pendingUpdates.size > 5 || updatingCards.value.size > 5) {
    return
  }
  
  // Debounce subscription updates
  debounce(() => {
    columns.value.forEach(column => {
      column.data.forEach(card => {
        cardStates.set(card.name, column.column.name)
      })
    })
    
    throttledSubscribe()
  }, 100)()
}, { deep: true })
</script>
