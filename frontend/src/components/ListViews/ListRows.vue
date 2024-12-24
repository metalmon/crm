<template>
  <div 
    class="mx-3 mt-2 h-full overflow-y-auto dark-scrollbar sm:mx-5" 
    v-if="showGroupedRows"
  >
    <div v-for="group in rows" :key="group.group">
      <ListGroupHeader :group="group">
        <div
          class="my-2 flex items-center gap-2 text-base font-medium text-ink-gray-8"
        >
          <div>{{ __(group.label) }} -</div>
          <div class="flex items-center gap-1">
            <component v-if="group.icon" :is="group.icon" />
            <div v-if="group.group == ' '" class="text-ink-gray-4">
              {{ __('Empty') }}
            </div>
            <div v-else>{{ __(group.group) }}</div>
          </div>
        </div>
      </ListGroupHeader>
      <ListGroupRows :group="group" id="list-rows">
        <ListRow
          v-for="row in group.rows"
          :key="row.name"
          v-slot="{ idx, column, item }"
          :row="row"
        >
          <slot v-bind="{ idx, column, item: translateItem(item, column), row }" />
        </ListRow>
      </ListGroupRows>
    </div>
  </div>
  <ListRows 
    class="mx-3 dark-scrollbar sm:mx-5" 
    v-else 
    id="list-rows"
  >
    <ListRow
      v-for="row in rows"
      :key="row.name"
      v-slot="{ idx, column, item }"
      :row="row"
    >
      <slot v-bind="{ idx, column, item: translateItem(item, column), row }" />
    </ListRow>
  </ListRows>
</template>

<script setup>
import { ListRows, ListRow, ListGroupHeader, ListGroupRows } from 'frappe-ui'
import { computed } from 'vue'

const props = defineProps({
  rows: {
    type: Array,
    required: true,
  },
})

const showGroupedRows = computed(() => {
  return props.rows.every(
    (row) => row.group && row.rows && Array.isArray(row.rows)
  )
})

function translateItem(item, column) {
  if (!column) return item
  if (column.key === 'status' && item?.label) {
    return {
      ...item,
      label: __(item.label)
    }
  }
  return item
}
</script>
