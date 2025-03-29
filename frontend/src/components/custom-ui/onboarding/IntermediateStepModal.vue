<!--
  This component is based on frappe-ui v0.1.121
  Source: frappe-ui/src/components/Onboarding/IntermediateStepModal.vue
-->
<template>
  <Dialog v-model="show" :options="{ size: 'md' }">
    <template #body>
      <div class="flex flex-col items-center gap-6 p-6">
        <div class="text-xl font-medium text-ink-gray-9">
          {{ __(currentStep.title) }}
        </div>
        <video
          v-if="currentStep.videoURL"
          class="w-full rounded-lg"
          :src="currentStep.videoURL"
          autoplay
          loop
          muted
        />
        <Button
          :label="__(currentStep.buttonLabel)"
          variant="solid"
          @click="currentStep.onClick"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { Button, Dialog } from 'frappe-ui'

const props = defineProps({
  currentStep: {
    type: Object,
    default: () => ({}),
  },
})

const show = defineModel()
</script> 