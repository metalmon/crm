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
            >
              <template #item="{ element: fields }">
                <component
                  :is="options.getRoute ? 'router-link' : 'div'"
                  class="relative pt-3 px-3.5 pb-2.5 rounded-lg border bg-surface-white text-base flex flex-col text-ink-gray-9 shadow-sm hover:shadow-md transition-all duration-200 dark:bg-surface-gray-1 dark:border-surface-gray-3 hover:border-gray-300 dark:hover:border-surface-gray-4 dark:hover:bg-surface-gray-2 dark:hover:shadow-lg dark:hover:shadow-gray-900/30"
                  :data-name="fields.name"
                  v-bind="{
                    to: options.getRoute ? options.getRoute(fields) : undefined,
                    onClick: options.onClick
                      ? () => options.onClick(fields)
                      : undefined,
                  }"
                >
                  <div 
                    v-if="updatingCards.has(fields.name)"
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
  animation: remote-update 2.5s ease;
}

@keyframes remote-update {
  0% {
    background: linear-gradient(45deg, transparent, var(--info-100), transparent);
    border-color: var(--info-300);
  }
  15% {
    background: linear-gradient(45deg, transparent, var(--info-200), transparent);
    border-color: var(--info-500);
  }
  85% {
    background: linear-gradient(45deg, transparent, var(--info-100), transparent);
    border-color: var(--info-300);
  }
  100% {
    background: transparent;
    border-color: var(--surface-border);
  }
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

// Store event handlers for cleanup
let docCreatedHandler = null
let docDeletedHandler = null

// Track current card states
const cardStates = reactive(new Map())

// Track subscription update state
const isUpdatingSubscriptions = ref(false)

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

// Separate subscription update logic
async function updateSubscriptions() {
  const doctype = kanban.value?.params?.doctype
  if (!doctype) {
    logger.log(`[KanbanView] Cannot update subscriptions - doctype not available`)
    return
  }

  if (isUpdatingSubscriptions.value) {
    logger.log(`[KanbanView] Subscription update already in progress, skipping`)
    return
  }

  try {
    isUpdatingSubscriptions.value = true
    logger.log(`[KanbanView] Starting subscription update`)

    // Get current visible cards
    const visibleCards = new Set()
    columns.value.forEach(column => {
      if (!column.column.delete) {
        column.data.forEach(card => visibleCards.add(card.name))
      }
    })

    // Remove obsolete subscriptions
    const obsoleteSubscriptions = []
    for (const [cardName, unsubscribe] of subscriptions.entries()) {
      if (!visibleCards.has(cardName)) {
        obsoleteSubscriptions.push([cardName, unsubscribe])
      }
    }

    // Unsubscribe in batch
    if (obsoleteSubscriptions.length > 0) {
      logger.log(`[KanbanView] Removing ${obsoleteSubscriptions.length} obsolete subscriptions`)
      obsoleteSubscriptions.forEach(([cardName, unsubscribe]) => {
        unsubscribe()
        subscriptions.delete(cardName)
      })
    }

    // Subscribe to new cards
    const newSubscriptions = []
    columns.value.forEach(column => {
      if (!column.column.delete) {
        column.data.forEach(card => {
          if (!subscriptions.has(card.name)) {
            newSubscriptions.push(card)
          }
        })
      }
    })

    // Subscribe in batch
    if (newSubscriptions.length > 0) {
      logger.log(`[KanbanView] Adding ${newSubscriptions.length} new subscriptions`)
      newSubscriptions.forEach(card => {
        const unsubscribe = socket.subscribeToDoc(doctype, card.name, async (data) => {
          if (data._transaction && isLocalTransaction(doctype, card.name, data._transaction)) {
            logger.log(`[KanbanView] Skipping local transaction update for ${card.name}`)
            return
          }
          
          if (data.event === 'deleted') {
            handleCardDeletion(card.name)
            return
          }
          
          if (data.event === 'modified') {
            processCardUpdate(doctype, card, data)
          }
        }, PRIORITY.VIEWPORT)
        
        subscriptions.set(card.name, unsubscribe)
      })
    }

    logger.log(`[KanbanView] Subscription update complete. Active subscriptions: ${subscriptions.size}`)
  } finally {
    isUpdatingSubscriptions.value = false
  }
}

// Handle card deletion separately
function handleCardDeletion(cardName) {
  logger.log(`[KanbanView] Processing deletion of card ${cardName}`)
  const sourceColumn = columns.value.find(col => 
    col.data.some(c => c.name === cardName)
  )
  
  if (sourceColumn) {
    logger.log(`[KanbanView] Removing deleted card ${cardName} from column ${sourceColumn.column.name}`)
    sourceColumn.data = sourceColumn.data.filter(c => c.name !== cardName)
    cardStates.delete(cardName)
  }
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

// Modified updateColumn function
async function updateColumn(d) {
  let toColumn = d?.to?.dataset.column
  let fromColumn = d?.from?.dataset.column
  let itemName = d?.item?.dataset.name

  logger.log(`[KanbanView] Updating column:`, {
    from: fromColumn,
    to: toColumn,
    item: itemName
  })

  let _columns = []
  columns.value.forEach((col) => {
    col.column['order'] = col.data.map((d) => d.name)
    if (col.column.page_length) {
      delete col.column.page_length
    }
    _columns.push(col.column)
  })

  let data = { kanban_columns: _columns }
  const doctype = kanban.value.params.doctype

  if (toColumn != fromColumn && itemName) {
    logger.log(`[KanbanView] Moving card ${itemName} from ${fromColumn} to ${toColumn}`)
    
    // Track pending move
    pendingMoves.set(itemName, {
      from: fromColumn,
      to: toColumn,
      timestamp: Date.now()
    })
    
    // Start transaction for card movement
    const transactionId = startTransaction(doctype, itemName)
    logger.log(`[KanbanView] Started transaction ${transactionId} for card movement`)
    
    data = { 
      item: itemName, 
      to: toColumn, 
      kanban_columns: _columns,
      _transaction: transactionId 
    }
    
    try {
      await emit('update', data)
      logger.log(`[KanbanView] Card movement update emitted successfully`)
    } catch (error) {
      logger.error(`[KanbanView] Error moving card:`, error)
      // Clean up pending move on error
      pendingMoves.delete(itemName)
    } finally {
      logger.log(`[KanbanView] Ending transaction ${transactionId}`)
      endTransaction(doctype, itemName, transactionId)
      
      // Remove pending move after a delay
      setTimeout(() => {
        if (pendingMoves.has(itemName)) {
          logger.log(`[KanbanView] Cleaning up stale pending move for ${itemName}`)
          pendingMoves.delete(itemName)
        }
      }, 5000) // 5 second timeout
    }
  } else {
    logger.log(`[KanbanView] Updating column order only`)
    emit('update', data)
  }
}

// Helper function to highlight remote updates
function highlightRemoteUpdate(element, cardName) {
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
  }, 2500)
}

// Helper function to get current card state
function getCardCurrentState(cardName) {
  let currentState = null
  columns.value.forEach(column => {
    if (column.data.some(card => card.name === cardName)) {
      currentState = column.column.name
    }
  })
  return currentState
}

// Modified processCardUpdate function
async function processCardUpdate(doctype, card, data) {
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

// Listen for document creation events
function setupDocCreationListener() {
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

// Listen for document deletion events
function setupDocDeletionListener() {
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

// Modified watch function
watch([
  () => columns.value.map(col => col.data.map(card => card.name)).flat(),
  () => kanban.value?.params?.doctype
], (newVal, oldVal) => {
  const doctype = kanban.value?.params?.doctype
  if (!doctype) return
  
  // Skip if only the order changed within columns
  if (oldVal && newVal?.length === oldVal?.length && 
      new Set(newVal).size === new Set(oldVal).size) {
    const newSet = new Set(newVal)
    const oldSet = new Set(oldVal)
    const hasChanges = [...newSet].some(card => !oldSet.has(card))
    if (!hasChanges) {
      logger.log(`[KanbanView] Skipping subscription update - only order changed`)
      return
    }
  }
  
  // Skip if we're in the middle of processing updates
  if (pendingUpdates.size > 0 || updatingCards.value.size > 0) {
    logger.log(`[KanbanView] Skipping subscription update - updates in progress`)
    return
  }
  
  // Update card states
  columns.value.forEach(column => {
    column.data.forEach(card => {
      cardStates.set(card.name, column.column.name)
    })
  })
  
  logger.log(`[KanbanView] Detected changes in visible cards or doctype, updating subscriptions`)
  throttledSubscribe()
}, { deep: true })

onMounted(() => {
  logger.log(`[KanbanView] Component mounted`)
  
  // Wait for doctype to be available
  watch(() => kanban.value?.params?.doctype, (doctype) => {
    if (doctype) {
      logger.log(`[KanbanView] Doctype ${doctype} is available, initializing`)
      updateSubscriptions()
      docCreatedHandler = setupDocCreationListener()
      docDeletedHandler = setupDocDeletionListener()
    }
  }, { immediate: true })
})

onUnmounted(() => {
  logger.log(`[KanbanView] Component unmounting, cleaning up subscriptions`)
  // Cleanup all subscriptions
  for (const unsubscribe of subscriptions.values()) {
    unsubscribe();
  }
  subscriptions.clear();
  
  // Remove document event listeners
  if (docCreatedHandler) {
    window.removeEventListener('crm:doc_created', docCreatedHandler);
  }
  if (docDeletedHandler) {
    window.removeEventListener('crm:doc_deleted', docDeletedHandler);
  }
  logger.log(`[KanbanView] Cleanup complete`)
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
</script>
