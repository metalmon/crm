import { defineStore } from 'pinia'
import { createResource } from 'frappe-ui'
import { computed, ref } from 'vue'

export const visible = ref(false)

export const notifications = createResource({
  url: 'crm.api.notifications.get_notifications',
  params: {
    limit: 20,
    offset: 0
  },
  initialData: [],
  auto: true,
})

export const unreadNotificationsCount = computed(
  () => notifications.data?.unread_count || notifications.data?.filter((n) => !n.read).length || 0,
)

export const notificationsStore = defineStore('crm-notifications', () => {
  const mark_as_read = createResource({
    url: 'crm.api.notifications.mark_as_read',
    onSuccess: () => {
      mark_as_read.params = {}
      if (notifications.data?.data) {
        notifications.data.data.forEach(n => n.read = true)
        notifications.data.unread_count = 0
      } else {
        notifications.reload()
      }
    },
  })

  function toggle() {
    visible.value = !visible.value
  }

  function mark_doc_as_read(doc) {
    mark_as_read.params = { doc: doc }
    mark_as_read.reload()
    toggle()
  }

  async function loadMore() {
    if (!notifications.data) return

    const currentLength = notifications.data.data.length
    if (currentLength >= notifications.data.total_count) return

    const result = await createResource({
      url: 'crm.api.notifications.get_notifications',
      params: {
        limit: 20,
        offset: currentLength
      }
    }).submit()

    notifications.data.data = [...notifications.data.data, ...(result.data || [])]
    notifications.data.total_count = result.total_count
    notifications.data.unread_count = result.unread_count
  }

  return {
    unreadNotificationsCount,
    mark_as_read,
    mark_doc_as_read,
    toggle,
    loadMore
  }
})
