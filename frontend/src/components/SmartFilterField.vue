<!-- Smart filter field component -->
<template>
  <div class="relative">
    <FormControl
      type="text"
      v-model="searchText"
      :placeholder="__('Search by phone, name or email...')"
      @input="handleInput"
    >
      <template #prefix>
        <FeatherIcon name="search" class="h-4 w-4 text-gray-500" />
      </template>
      <template #suffix v-if="searchText">
        <div class="flex items-center h-full">
          <Button
            variant="ghost"
            class="!p-1"
            @click="clearSearch"
          >
            <FeatherIcon name="x" class="h-4 w-4" />
          </Button>
        </div>
      </template>
    </FormControl>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { FormControl, Button, FeatherIcon } from 'frappe-ui'
import { useDebounceFn } from '@vueuse/core'
import { parseSmartFilter, formatSmartFilterParams } from '@/utils/smartFilter'

const searchText = ref('')
const emit = defineEmits(['update:filters'])

const debouncedSearch = useDebounceFn((value) => {
  if (!value) {
    emit('update:filters', {})
    return
  }
  const smartFilterParams = parseSmartFilter(value)
  const formattedParams = formatSmartFilterParams(smartFilterParams)
  emit('update:filters', formattedParams)
}, 300)

function handleInput(event) {
  debouncedSearch(event.target.value)
}

function clearSearch() {
  searchText.value = ''
  emit('update:filters', {})
}

defineExpose({
  clearSearch
})
</script> 