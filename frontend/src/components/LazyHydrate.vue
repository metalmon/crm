<template>
  <div v-hydrate.lazy="hydrate">
    <slot v-if="hydrated" />
    <slot v-else name="placeholder" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { hydrate as hydrateDirective } from '../directives/hydrate'

const hydrated = ref(false)

const hydrate = () => {
  hydrated.value = true
}

// Register the hydrate directive
const vHydrate = hydrateDirective
</script> 