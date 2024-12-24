<template>
  <button
    class="flex h-7 cursor-pointer items-center rounded text-ink-gray-7 duration-300 ease-in-out focus:outline-none focus:transition-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-outline-gray-3"
    :class="isActive ? 'bg-surface-selected shadow-sm' : 'hover:bg-surface-gray-2'"
    @click="handleClick"
  >
    <div
      class="flex w-full items-center justify-between duration-300 ease-in-out"
      :class="isCollapsed ? 'ml-[3px] p-1' : 'px-2 py-1'"
    >
      <div class="flex items-center truncate">
        <Tooltip :text="label" placement="right" :disabled="!isCollapsed">
          <slot name="icon">
            <span class="grid flex-shrink-0 place-items-center">
              <FeatherIcon
                v-if="typeof icon == 'string'"
                :name="icon"
                class="size-4 text-ink-gray-7"
              />
              <component v-else :is="icon" class="size-4 text-ink-gray-7" />
            </span>
          </slot>
        </Tooltip>
        <Tooltip
          :text="label"
          placement="right"
          :disabled="isCollapsed"
          :hoverDelay="1.5"
        >
          <span
            class="flex-1 flex-shrink-0 truncate text-sm duration-300 ease-in-out"
            :class="
              isCollapsed
                ? 'ml-0 w-0 overflow-hidden opacity-0'
                : 'ml-2 w-auto opacity-100'
            "
          >
            {{ label }}
          </span>
        </Tooltip>
      </div>
      <slot name="right" />
    </div>
  </button>
</template>

<script setup>
import { Tooltip } from 'frappe-ui'
import { computed, ref, onBeforeUpdate, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { isMobileView, mobileSidebarOpened } from '@/composables/settings'

const router = useRouter()
const route = useRoute()

// Diagnostic counters
const isActiveComputeCount = ref(0)

const props = defineProps({
  icon: {
    type: [Object, String, Function],
  },
  label: {
    type: String,
    default: '',
  },
  to: {
    type: [Object, String],
    default: '',
  },
  isCollapsed: {
    type: Boolean,
    default: false,
  },
})

function handleClick() {
  if (!props.to) return
  if (typeof props.to === 'object') {
    router.push(props.to)
  } else {
    router.push({ name: props.to })
  }
  if (isMobileView.value) {
    mobileSidebarOpened.value = false
  }
}

// Мемоизируем параметры маршрута
const routeInfo = computed(() => ({
  name: route.name,
  view: route.query?.view
}))

// Мемоизируем параметры компонента
const linkInfo = computed(() => ({
  name: typeof props.to === 'string' ? props.to : props.to?.name,
  view: props.to?.query?.view
}))

const isActive = computed(() => {
  const route = routeInfo.value
  const link = linkInfo.value
  
  const result = route.view 
    ? route.view === link.view 
    : route.name === link.name
  
  // Только для диагностики
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${props.label}] isActive compute:`, {
      count: ++isActiveComputeCount.value,
      result,
      routeName: route.name,
      routeView: route.view,
      toName: link.name,
      toView: link.view
    })
  }
  
  return result
})
</script>
