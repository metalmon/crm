import { ref } from 'vue'

const isDirty = ref(false)

export function useDirtyState() {
  const markAsDirty = () => {
    isDirty.value = true
  }

  const resetDirty = () => {
    isDirty.value = false
  }

  return {
    isDirty,
    markAsDirty,
    resetDirty,
  }
} 