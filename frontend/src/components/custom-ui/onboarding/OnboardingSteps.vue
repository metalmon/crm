<!--
  This component is based on frappe-ui v0.1.121
  Source: frappe-ui/src/components/Onboarding/OnboardingSteps.vue
-->
<template>
  <div class="flex flex-col justify-center items-center gap-1 mt-4 mb-7">
    <component :is="logo" class="size-10 shrink-0 rounded mb-4" />
    <div class="text-base font-medium">
      {{ __('Welcome to {0}', [title]) }}
    </div>
    <div class="text-p-base font-normal">
      {{ __('{0}/{1} steps completed', [stepsCompleted, totalSteps]) }}
    </div>
  </div>
  <div class="flex flex-col gap-2.5 overflow-hidden">
    <div class="flex justify-between items-center py-0.5">
      <Badge
        :label="__('{0}% completed', [completedPercentage])"
        :theme="completedPercentage == 100 ? 'green' : 'orange'"
        size="sm"
        class="!text-[11px] !px-1.5"
      />
      <div class="flex gap-0.5">
        <Button
          v-if="completedPercentage != 0"
          variant="ghost"
          :label="__('Reset all')"
          class="!text-[11px] !px-1.5 !py-0.5"
          @click="() => resetAll(afterResetAll)"
        />
        <Button
          v-if="completedPercentage != 100"
          variant="ghost"
          :label="__('Skip all')"
          class="!text-[11px] !px-1.5 !py-0.5"
          @click="() => skipAll(afterSkipAll)"
        />
      </div>
    </div>
    <div class="flex flex-col gap-1.5 overflow-y-auto">
      <div
        v-for="step in steps"
        :key="step.title"
        class="group w-full flex gap-2 justify-between items-center hover:bg-surface-gray-1 rounded px-2 py-1.5 cursor-pointer"
        @click.stop="() => !step.completed && step.onClick()"
      >
        <div
          class="flex gap-2 items-center"
          :class="[step.completed ? 'text-ink-gray-5' : 'text-ink-gray-8']"
        >
          <component :is="step.icon" class="h-4" />
          <div class="text-base" :class="{ 'line-through': step.completed }">
            {{ __(step.title) }}
          </div>
        </div>
        <Button
          v-if="!step.completed"
          :label="__('Skip')"
          class="!h-4 text-xs !text-ink-gray-6 hidden group-hover:flex"
          @click="() => skip(step.name, afterSkip)"
        />
        <Button
          v-else
          :label="__('Reset')"
          class="!h-4 text-xs !text-ink-gray-6 hidden group-hover:flex"
          @click.stop="() => reset(step.name, afterReset)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { useOnboarding } from './onboarding'
import { Button, Badge } from 'frappe-ui'

const props = defineProps({
  appName: {
    type: String,
    default: 'frappecrm',
  },
  title: {
    type: String,
    default: 'Frappe CRM',
  },
  logo: {
    type: Object,
    required: true,
  },
  afterSkip: {
    type: Function,
    default: () => {},
  },
  afterSkipAll: {
    type: Function,
    default: () => {},
  },
  afterReset: {
    type: Function,
    default: () => {},
  },
  afterResetAll: {
    type: Function,
    default: () => {},
  },
})

const {
  steps,
  stepsCompleted,
  totalSteps,
  completedPercentage,
  skip,
  skipAll,
  reset,
  resetAll,
} = useOnboarding(props.appName)
</script> 