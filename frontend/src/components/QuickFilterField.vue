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
  <div
    v-else-if="['Date', 'Datetime'].includes(filter.fieldtype)"
    class="date-time-select-wrapper"
  >
    <FormControl
      class="form-control cursor-pointer [&_select]:cursor-pointer"
      type="select"
      v-model="filter.value"
      :options="filter.options || timespanOptions"
      :placeholder="filter.label"
      @change.stop="updateFilter(filter, $event.target.value)"
    >
      <template #item-label="{ option }">
        {{ option.label || option.value }}
      </template>
    </FormControl>
  </div>
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
import { FormControl } from 'frappe-ui'
import { useDebounceFn } from '@vueuse/core'
import { timespanOptions } from '@/utils/timeOptions'
import { onMounted, onUpdated, ref } from 'vue'

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

// Add hooks that will be called after component mount and update
onMounted(fixPlaceholder)
onUpdated(fixPlaceholder)

// Function to fix placeholder visibility
function fixPlaceholder() {
  setTimeout(() => {
    const selects = document.querySelectorAll('.date-time-select-wrapper .form-control');
    selects.forEach(select => {
      // Find placeholder inside the component
      const placeholder = select.querySelector('div[class*="pointer-events-none"]');
      if (placeholder) {
        // Override visibility based on whether a value is selected
        const selectElement = select.querySelector('select');
        if (selectElement && selectElement.value) {
          placeholder.style.display = 'none';
        } else {
          placeholder.style.display = 'flex';
        }
      }
    });
  }, 0);
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
