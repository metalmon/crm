<template>
  <LayoutHeader>
    <template #left-header>
      <Breadcrumbs
        :items="[
          { label: __('Notifications'), route: { name: 'Notifications' } },
        ]"
      />
    </template>
    <template #right-header>
      <Tooltip :text="__('Mark all as read')">
        <div>
          <Button
            :label="__('Mark all as read')"
            @click="() => mark_as_read.reload()"
          >
            <template #prefix>
              <MarkAsDoneIcon class="h-4 w-4" />
            </template>
          </Button>
        </div>
      </Tooltip>
    </template>
  </LayoutHeader>
  <div class="flex flex-col overflow-hidden text-ink-gray-9">
    <div
      v-if="notifications.data?.data?.length"
      class="divide-y divide-outline-gray-1 overflow-y-auto text-base"
      ref="scrollContainer"
      @scroll="handleScroll"
    >
      <template v-for="n in notifications.data.data" :key="n.comment">
        <div
          v-if="getRoute(n)"
          class="flex cursor-pointer items-start gap-3 px-2.5 py-3 hover:bg-surface-gray-2"
          @click="navigateToRoute(n)"
        >
          <div class="mt-1 flex items-center gap-2.5">
            <div
              class="size-[5px] rounded-full"
              :class="[n.read ? 'bg-transparent' : 'bg-surface-gray-7']"
            />
            <WhatsAppIcon v-if="n.type == 'WhatsApp'" class="size-7" />
            <UserAvatar v-else :user="n.from_user.name" size="lg" />
          </div>
          <div>
            <div v-if="n.notification_text" v-html="n.notification_text" />
            <div v-else class="mb-2 space-x-1 leading-5 text-ink-gray-5">
              <span class="font-medium text-ink-gray-9">
                {{ n.from_user.full_name }}
              </span>
              <span>
                {{ __('mentioned you in {0}', [n.reference_doctype]) }}
              </span>
              <span class="font-medium text-ink-gray-9">
                {{ n.reference_name }}
              </span>
            </div>
            <div class="text-sm text-ink-gray-5">
              {{ __(timeAgo(n.creation)) }}
            </div>
          </div>
        </div>
        <div
          v-else-if="n.notification_type_doctype === 'CRM Task' && n.notification_type_doc"
          class="flex cursor-pointer items-start gap-3 px-2.5 py-3 hover:bg-surface-gray-2"
          @click="handleTaskClick(n)"
        >
          <div class="mt-1 flex items-center gap-2.5">
            <div
              class="size-[5px] rounded-full"
              :class="[n.read ? 'bg-transparent' : 'bg-surface-gray-7']"
            />
            <UserAvatar :user="n.from_user.name" size="lg" />
          </div>
          <div>
            <div v-if="n.notification_text" v-html="n.notification_text" />
            <div v-else class="mb-2 space-x-1 leading-5 text-ink-gray-5">
              <span class="font-medium text-ink-gray-9">
                {{ n.from_user.full_name }}
              </span>
              <span>
                {{ __('mentioned you in {0}', [n.reference_doctype]) }}
              </span>
              <span class="font-medium text-ink-gray-9">
                {{ n.reference_name }}
              </span>
            </div>
            <div class="text-sm text-ink-gray-5">
              {{ __(timeAgo(n.creation)) }}
            </div>
          </div>
        </div>
        <div
          v-else
          class="flex cursor-pointer items-start gap-3 px-2.5 py-3"
        >
          <div class="mt-1 flex items-center gap-2.5">
            <div
              class="size-[5px] rounded-full"
              :class="[n.read ? 'bg-transparent' : 'bg-surface-gray-7']"
            />
            <WhatsAppIcon v-if="n.type == 'WhatsApp'" class="size-7" />
            <UserAvatar v-else :user="n.from_user.name" size="lg" />
          </div>
          <div>
            <div v-if="n.notification_text" v-html="n.notification_text" />
            <div v-else class="mb-2 space-x-1 leading-5 text-ink-gray-5">
              <span class="font-medium text-ink-gray-9">
                {{ n.from_user.full_name }}
              </span>
              <span>
                {{ __('mentioned you in {0}', [n.reference_doctype]) }}
              </span>
              <span class="font-medium text-ink-gray-9">
                {{ n.reference_name }}
              </span>
            </div>
            <div class="text-sm text-ink-gray-5">
              {{ __(timeAgo(n.creation)) }}
            </div>
          </div>
        </div>
      </template>
    </div>
    <div
      v-if="isLoadingMore"
      class="flex items-center justify-center py-4"
    >
      <LoadingIndicator class="h-6 w-6" />
      <span class="ml-2 text-ink-gray-4">{{ __('Loading more...') }}</span>
    </div>
    <div v-else-if="!notifications.data?.data?.length" class="flex flex-1 flex-col items-center justify-center gap-2">
      <NotificationsIcon class="h-20 w-20 text-ink-gray-2" />
      <div class="text-lg font-medium text-ink-gray-4">
        {{ __('No new notifications') }}
      </div>
    </div>
  </div>
  <TaskModal
    v-if="showTaskModal"
    :task="task"
    @close="showTaskModal = false"
  />
</template>
<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import WhatsAppIcon from '@/components/Icons/WhatsAppIcon.vue'
import MarkAsDoneIcon from '@/components/Icons/MarkAsDoneIcon.vue'
import NotificationsIcon from '@/components/Icons/NotificationsIcon.vue'
import LoadingIndicator from '@/components/Icons/LoadingIndicator.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { notifications, notificationsStore } from '@/stores/notifications'
import { globalStore } from '@/stores/global'
import { timeAgo } from '@/utils'
import { Breadcrumbs, Tooltip, call } from 'frappe-ui'
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import TaskModal from '@/components/Modals/TaskModal.vue'

const { $socket } = globalStore()
const { mark_as_read, mark_doc_as_read, loadMore } = notificationsStore()

const scrollContainer = ref(null)
const isLoadingMore = ref(false)
const router = useRouter()

const showTaskModal = ref(false)
const task = ref({})

function handleTaskClick(n) {
  mark_doc_as_read(n.comment || n.notification_type_doc)
  showTask(n.notification_type_doc)
}

function navigateToRoute(notification) {
  // Mark notification as read
  mark_doc_as_read(notification.comment || notification.notification_type_doc)
  
  // Get route
  const route = getRoute(notification)
  if (!route) return
  
  // Use router.push with custom navigation approach
  if (route.name === router.currentRoute.value.name) {
    // If navigating to the same route type (e.g. Lead -> Lead), use a different approach
    const currentPath = router.currentRoute.value.fullPath
    const tmpPath = '/tmp-redirect-' + Date.now()
    
    // Two-step navigation: first to a temporary path, then to the target
    router.replace(tmpPath)
      .then(() => router.replace(route))
      .catch(err => {
        // If temporary navigation fails, try direct navigation with replacement
        console.error('Navigation error:', err)
        router.replace(route)
      })
  } else {
    // Normal navigation for different route types
    router.push(route)
  }
}

async function handleScroll(e) {
  const el = e.target
  const threshold = 100 // pixels from bottom
  const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold
  
  if (isNearBottom && !isLoadingMore.value) {
    isLoadingMore.value = true
    try {
      await loadMore()
    } finally {
      isLoadingMore.value = false
    }
  }
}

onBeforeUnmount(() => {
  $socket.off('crm_notification')
})

onMounted(() => {
  $socket.on('crm_notification', () => {
    notifications.reload()
  })
})

function showTask(taskId) {
  call('frappe.client.get', {
    doctype: 'CRM Task',
    name: taskId,
  }).then((t) => {
    task.value = {
      name: t.name,
      title: t.title,
      description: t.description,
      assigned_to: t.assigned_to,
      due_date: t.due_date,
      status: t.status,
      priority: t.priority,
      reference_doctype: t.reference_doctype,
      reference_docname: t.reference_docname,
    }
    showTaskModal.value = true
  })
}

function getRoute(notification) {
  let route = null;

  if (notification.notification_type_doctype === 'CRM Task' && notification.notification_type_doc) {
    return null
  } else if (notification.route_name && notification.reference_name) {
    // For other notifications, use the standard logic
    let params = {}
    if (notification.route_name === 'Lead') {
      params = {
        leadId: notification.reference_name,
      }
    } else if (notification.route_name === 'Deal') {
      params = {
        dealId: notification.reference_name,
      }
    }

    route = {
      name: notification.route_name,
      params: params,
      hash: notification.hash,
    }
  }

  if (route) {
    try {
      // Пробуем использовать маршрут
      router.resolve(route)
    } catch (error) {
      // Если возникла ошибка, выводим информацию о маршруте
      console.log('Error in route:', {
        notification_type: notification.type,
        notification_type_doctype: notification.notification_type_doctype,
        route_name: notification.route_name,
        reference_name: notification.reference_name,
        route: route,
        error: error.message
      })
      return null
    }
  }

  return route
}
</script>
