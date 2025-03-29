<!--
  This component is based on frappe-ui v0.1.121
  Source: frappe-ui/src/components/Onboarding/HelpCenter.vue
-->
<template>
  <div class="flex flex-col gap-2.5 overflow-y-auto">
    <div
      v-for="article in modelValue"
      :key="article.title"
      class="flex flex-col gap-1.5"
    >
      <div
        class="flex items-center justify-between px-2 py-1.5 cursor-pointer hover:bg-surface-gray-1 rounded"
        @click="article.opened = !article.opened"
      >
        <div class="text-base text-ink-gray-9">{{ __(article.title) }}</div>
        <FeatherIcon
          name="chevron-right"
          class="h-4 transition-all duration-300 ease-in-out"
          :class="{ 'rotate-90': article.opened }"
        />
      </div>
      <div v-if="article.opened" class="flex flex-col gap-1">
        <div
          v-for="subArticle in article.subArticles"
          :key="subArticle.name"
          class="flex items-center justify-between px-4 py-1.5 cursor-pointer hover:bg-surface-gray-1 rounded"
          @click="openArticle(subArticle.name)"
        >
          <div class="text-base text-ink-gray-8">
            {{ __(subArticle.title) }}
          </div>
          <FeatherIcon name="external-link" class="h-4" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { FeatherIcon } from 'frappe-ui'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
  docsLink: {
    type: String,
    default: '',
  },
})

function openArticle(name) {
  window.open(`${props.docsLink}/${name}`, '_blank')
}
</script> 