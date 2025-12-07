<template>
  <!-- Debug info for debugging -->
  <div v-if="['Date', 'Datetime'].includes(filter.fieldtype)" class="debug-info hidden">
    Value: "{{ filter.value }}" | Empty: {{ !filter.value }} | Type: {{ typeof filter.value }}
  </div>

  <FormControl
    v-if="filter.fieldtype == 'Check'"
    :label="filter.label"
    type="checkbox"
    v-model="filter.value"
    @change.stop="updateFilter(filter, $event.target.checked)"
  />

  <UserLink
    v-else-if="filter.fieldname === '_assign'"
    :value="filter.value"
    :placeholder="filter.label"
    @change="(data) => updateFilter(filter, data)"
  />
  <FormControl
    v-else-if="filter.fieldtype === 'Select'"
    class="form-control cursor-pointer [&_select]:cursor-pointer"
    type="select"
    v-model="filter.value"
    :options="filter.options"
    :placeholder="filter.label"
    @change.stop="updateFilter(filter, $event.target.value)"
  >
    <template #item-label="{ option }">
      {{ option.label || option.value }}
    </template>
  </FormControl>
  <Link
    v-else-if="filter.fieldtype === 'Link'"
    :value="filter.value"
    :doctype="filter.options"
    :placeholder="filter.label"
    @change="(data) => updateFilter(filter, data)"
  />
  <DatePicker
    v-else-if="filter.fieldtype === 'Date'"
    class="border-none"
    :value="filter.value"
    @change="(v) => updateFilter(filter, v)"
    :placeholder="filter.label"
  />
  <input
    v-else-if="filter.fieldtype === 'Datetime'"
    type="datetime-local"
    :value="formatDateTimeValue(filter.value)"
    @change="(e) => handleDateTimeChange(e, filter)"
    :placeholder="filter.label"
    class="w-full rounded border border-gray-100 bg-surface-gray-2 px-2 py-1.5 text-base text-ink-gray-8 placeholder-ink-gray-4 transition-colors hover:border-outline-gray-modals hover:bg-surface-gray-3 focus:border-outline-gray-4 focus:bg-surface-white focus:shadow-sm focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-outline-gray-3"
  />
  <FormControl
    v-else
    v-model="filter.value"
    type="text"
    :placeholder="filter.label"
    @input.stop="debouncedFn(filter, $event.target.value)"
  />
</template>
<script setup>
import Link from '@/components/Controls/Link.vue'
import UserLink from '@/components/Controls/UserLink.vue'
import { FormControl, DatePicker } from 'frappe-ui'
import { useDebounceFn } from '@vueuse/core'
import { toUserTimezone, toSystemTimezone } from '@/utils/dayjs'
import dayjs from 'dayjs'

const props = defineProps({
  filter: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['applyQuickFilter'])

const debouncedFn = useDebounceFn((f, value) => {
  emit('applyQuickFilter', f, value)
}, 500)

function updateFilter(f, value) {
  emit('applyQuickFilter', f, value)
}

function formatDateTimeValue(val) {
  if (!val) return ''
  try {
    return toUserTimezone(val).format('YYYY-MM-DDTHH:mm')
  } catch (e) {
    return val
  }
}

function handleDateTimeChange(e, filter) {
  const val = e.target.value
  if (!val) {
    updateFilter(filter, null)
    return
  }
  try {
    const localDate = dayjs(val)
    const systemDate = toSystemTimezone(localDate)
    updateFilter(filter, systemDate.format())
  } catch (err) {
    updateFilter(filter, val)
  }
}

</script>

<style scoped>
.hidden {
  display: none;
}

/* For debugging */
.debug-mode .debug-info {
  display: block;
  background-color: #f0f0f0;
  padding: 4px;
  margin-bottom: 4px;
  border: 1px solid #ddd;
  font-size: 12px;
}

.date-time-select-wrapper {
  position: relative;
}
</style>
