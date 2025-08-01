<template>
  <div class="date-time-select-wrapper">
    <FormControl
      type="select"
      v-model="value"
      :options="timespanOptions"
      :placeholder="attrs.placeholder"
      :size="attrs.size || 'sm'"
      :variant="attrs.variant"
      :disabled="attrs.disabled"
      class="form-control cursor-pointer [&_select]:cursor-pointer focus-visible:ring-2 focus-visible:ring-outline-gray-3"
      @change="fixPlaceholder"
    >
      <template #item-label="{ option }">
        {{ option.label || option.value }}
      </template>
    </FormControl>
  </div>
</template>

<script setup>
import { FormControl } from 'frappe-ui'
import { timespanOptions } from '@/utils/timeOptions'
import { useAttrs, onMounted, onUpdated, computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
})

const attrs = useAttrs()

const valuePropPassed = computed(() => 'value' in attrs)

const value = computed({
  get: () => (valuePropPassed.value ? attrs.value : props.modelValue),
  set: (val) => {
    // Этот setter нужен для v-model, но реальное обновление происходит через событие @change в QuickFilterField
  }
})

// Add hooks that will be called after component mount and update
onMounted(fixPlaceholder)
onUpdated(fixPlaceholder)

// Function to fix placeholder visibility (точно как в старом коде)
function fixPlaceholder() {
  setTimeout(() => {
    const selects = document.querySelectorAll('.date-time-select-wrapper .form-control')
    selects.forEach(select => {
      // Find placeholder inside the component
      const placeholder = select.querySelector('div[class*="pointer-events-none"]')
      if (placeholder) {
        // Override visibility based on whether a value is selected
        const selectElement = select.querySelector('select')
        if (selectElement && selectElement.value) {
          placeholder.style.display = 'none'
        } else {
          placeholder.style.display = 'flex'
        }
      }
    })
  }, 0)
}
</script>

<style scoped>
.date-time-select-wrapper {
  position: relative;
}
</style>