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
  <TimespanSelect
    v-else-if="['Date', 'Datetime'].includes(filter.fieldtype)"
    :value="filter.value"
    :placeholder="filter.label"
    @change.stop="updateFilter(filter, $event.target.value)"
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
import TimespanSelect from '@/components/Controls/TimespanSelect.vue'
import { FormControl } from 'frappe-ui'
import { useDebounceFn } from '@vueuse/core'

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
