<template>
  <div class="flex flex-col gap-2 truncate">
    <div
      class="inline-flex items-center cursor-pointer transition-colors focus:outline-none shrink-0 text-ink-gray-8 bg-surface-white border border-outline-gray-2 hover:border-outline-gray-3 active:border-outline-gray-3 active:bg-surface-gray-4 focus-visible:ring focus-visible:ring-outline-gray-3 h-7 text-base px-2 rounded"
      @click="addShowNotifications"
    >
      <div class="truncate">
        {{ notificationSummary }}
      </div>
    </div>
    <div v-if="notifications?.length && show" class="flex flex-col gap-2">
      <div v-for="(notification, i) in notifications" :key="notification.name">
        <div v-if="isAllDay" class="flex gap-1">
          <div class="flex flex-col flex-1 items-center gap-2">
            <div class="flex items-center gap-2 w-full">
              <FormControl
                class="flex-1 shrink-0"
                type="select"
                :options="[
                  {
                    label: __('Notification'),
                    value: 'Notification',
                  },
                  {
                    label: __('Email'),
                    value: 'Email',
                  },
                ]"
                v-model="notification.type"
                variant="outline"
                :placeholder="__('Select type')"
              />
              <div>{{ getTimeSeparator() }}</div>
              <FormControl
                v-if="isAllDay"
                class="flex-1 shrink-0"
                type="time"
                v-model="notification.time"
                variant="outline"
                :placeholder="__('08:00')"
              />
            </div>
            <div class="flex items-center gap-2 w-full">
              <FormControl
                class="w-fit"
                type="number"
                :min="min(notification)"
                :max="max(notification)"
                @blur="handleIntervalChange(notification)"
                v-model.number="notification.before"
                variant="outline"
                :placeholder="__('10')"
              />
              <FormControl
                class="flex-1 shrink-0"
                type="select"
                :options="intervalOptions(notification)"
                v-model="notification.interval"
                @change="() => handleIntervalChange(notification)"
                variant="outline"
                :placeholder="__('minutes')"
              />
            </div>
            <Button
              v-if="i == notifications.length - 1"
              class="w-full"
              :icon-left="BellIcon"
              :label="__('Add notification')"
              variant="outline"
              size="sm"
              @click="addNotification"
            />
          </div>
          <Button
            icon="x"
            variant="ghost"
            @click="
              notifications.splice(notifications.indexOf(notification), 1)
            "
          />
        </div>
        <div v-else class="flex gap-1">
          <div class="flex flex-col flex-1 items-center gap-2">
            <div class="flex items-center gap-2 w-full">
              <FormControl
                class="flex-1 shrink-0"
                type="select"
                :options="[
                  {
                    label: __('Notification'),
                    value: 'Notification',
                  },
                  {
                    label: __('Email'),
                    value: 'Email',
                  },
                ]"
                v-model="notification.type"
                variant="outline"
                :placeholder="__('Select type')"
              />
            </div>
            <div class="flex items-center gap-2 w-full">
              <FormControl
                class="w-fit"
                type="number"
                :min="min(notification)"
                :max="max(notification)"
                :step="notification.interval === 'minutes' ? 5 : 1"
                @blur="handleIntervalChange(notification)"
                v-model.number="notification.before"
                variant="outline"
                :placeholder="__('10')"
              />
              <FormControl
                class="flex-1 shrink-0"
                type="select"
                :options="intervalOptions(notification)"
                v-model="notification.interval"
                @change="() => handleIntervalChange(notification)"
                variant="outline"
                :placeholder="__('minutes')"
              />
            </div>
            <Button
              v-if="i == notifications.length - 1"
              class="w-full"
              :icon-left="BellIcon"
              :label="__('Add notification')"
              variant="outline"
              size="sm"
              @click="addNotification"
            />
          </div>
          <Button
            icon="x"
            variant="ghost"
            @click="
              notifications.splice(notifications.indexOf(notification), 1)
            "
          />
        </div>
        <div
          v-if="i < notifications.length - 1"
          class="w-full h-px mt-3 mb-1 border-t border-outline-gray-1"
        />
      </div>
    </div>
  </div>
</template>
<script setup>
import BellIcon from '@/components/Icons/BellIcon.vue'
import { min, max, handleIntervalChange } from '@/components/Calendar/utils'
import { pluralForm } from '@/utils/pluralize'
import { FormControl } from 'frappe-ui'
import { computed, ref } from 'vue'

const props = defineProps({
  isAllDay: {
    type: Boolean,
    default: false,
  },
})

const notifications = defineModel()
const show = ref(false)

const intervalOptions = (n) => {
  if (props.isAllDay) {
    if (n.interval === 'minutes' || n.interval === 'hours') {
      n.interval = 'days'
    }

    if (!n.time) {
      n.time = '08:00'
    }

    return [
      {
        label: getIntervalBeforeOptionLabel(n.before, 'days'),
        value: 'days',
      },
      {
        label: getIntervalBeforeOptionLabel(n.before, 'weeks'),
        value: 'weeks',
      },
    ]
  }
  return [
    {
      label: getIntervalBeforeOptionLabel(n.before, 'minutes'),
      value: 'minutes',
    },
    {
      label: getIntervalBeforeOptionLabel(n.before, 'hours'),
      value: 'hours',
    },
    {
      label: getIntervalBeforeOptionLabel(n.before, 'days'),
      value: 'days',
    },
    {
      label: getIntervalBeforeOptionLabel(n.before, 'weeks'),
      value: 'weeks',
    },
  ]
}

function getIntervalBeforeOptionLabel(n, interval) {
  const form = pluralForm(n)

  if (interval === 'minutes') {
    if (form === 'one') return __('minute before', [], 'plural one: 1, 21, 31...')
    if (form === 'few') return __('minutes before', [], 'plural few: 2-4, 22-24...')
    return __('minutes before', [], 'plural many: 5-20, 25-30...')
  }

  if (interval === 'hours') {
    if (form === 'one') return __('hour before', [], 'plural one: 1, 21, 31...')
    if (form === 'few') return __('hours before', [], 'plural few: 2-4, 22-24...')
    return __('hours before', [], 'plural many: 5-20, 25-30...')
  }

  if (interval === 'days') {
    if (form === 'one') return __('day before', [], 'plural one: 1, 21, 31...')
    if (form === 'few') return __('days before', [], 'plural few: 2-4, 22-24...')
    return __('days before', [], 'plural many: 5-20, 25-30...')
  }

  if (interval === 'weeks') {
    if (form === 'one') return __('week before', [], 'plural one: 1, 21, 31...')
    if (form === 'few') return __('weeks before', [], 'plural few: 2-4, 22-24...')
    return __('weeks before', [], 'plural many: 5-20, 25-30...')
  }

  return ''
}

function addNotification() {
  notifications.value ??= []
  if (props.isAllDay) {
    notifications.value.push({
      type: 'Notification',
      before: 1,
      interval: 'days',
      time: '08:00',
    })
  } else {
    notifications.value.push({
      type: 'Notification',
      before: 10,
      interval: 'minutes',
    })
  }
}

function addShowNotifications() {
  if (!notifications.value?.length) {
    addNotification()
    show.value = true
  } else {
    show.value = !show.value
  }
}

const notificationSummary = computed(() => {
  if (!notifications.value?.length) return __('Add notification')
  return notifications.value
    .map((n) => {
      if (props.isAllDay) {
        const time = n.time || '08:00'
        return getIntervalBeforeAtLabel(n.before, n.interval, time)
      } else {
        return getIntervalBeforeLabel(n.before, n.interval)
      }
    })
    .join(', ')
})

function getIntervalBeforeLabel(n, interval) {
  const form = pluralForm(n)

  if (interval === 'minutes') {
    if (form === 'one')
      return __('{0} minute before', [n], 'plural one: 1, 21, 31...')
    if (form === 'few')
      return __('{0} minutes before', [n], 'plural few: 2-4, 22-24...')
    return __('{0} minutes before', [n], 'plural many: 5-20, 25-30...')
  }

  if (interval === 'hours') {
    if (form === 'one')
      return __('{0} hour before', [n], 'plural one: 1, 21, 31...')
    if (form === 'few')
      return __('{0} hours before', [n], 'plural few: 2-4, 22-24...')
    return __('{0} hours before', [n], 'plural many: 5-20, 25-30...')
  }

  if (interval === 'days') {
    if (form === 'one')
      return __('{0} day before', [n], 'plural one: 1, 21, 31...')
    if (form === 'few')
      return __('{0} days before', [n], 'plural few: 2-4, 22-24...')
    return __('{0} days before', [n], 'plural many: 5-20, 25-30...')
  }

  if (interval === 'weeks') {
    if (form === 'one')
      return __('{0} week before', [n], 'plural one: 1, 21, 31...')
    if (form === 'few')
      return __('{0} weeks before', [n], 'plural few: 2-4, 22-24...')
    return __('{0} weeks before', [n], 'plural many: 5-20, 25-30...')
  }

  return ''
}

function getIntervalBeforeAtLabel(n, interval, time) {
  const form = pluralForm(n)

  if (interval === 'days') {
    if (form === 'one')
      return __('{0} day before, at {1}', [n, time], 'plural one: 1, 21, 31...')
    if (form === 'few')
      return __('{0} days before, at {1}', [n, time], 'plural few: 2-4, 22-24...')
    return __('{0} days before, at {1}', [n, time], 'plural many: 5-20, 25-30...')
  }

  if (interval === 'weeks') {
    if (form === 'one')
      return __('{0} week before, at {1}', [n, time], 'plural one: 1, 21, 31...')
    if (form === 'few')
      return __('{0} weeks before, at {1}', [n, time], 'plural few: 2-4, 22-24...')
    return __('{0} weeks before, at {1}', [n, time], 'plural many: 5-20, 25-30...')
  }

  return ''
}

function getTimeSeparator() {
  return __(', at', [], 'time separator for event notifications')
}
</script>
