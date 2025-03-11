// Directive for progressive hydration
export const hydrate = {
  created(el, binding) {
    // Skip if not SSR or already hydrated
    if (!import.meta.env.SSR && !el._hydrated) {
      const hydrateComponent = () => {
        // Get the component instance
        const component = binding.instance
        if (!component) return

        // Mark as hydrated
        el._hydrated = true

        // Trigger hydration
        if (typeof binding.value === 'function') {
          binding.value(el)
        }
      }

      // Use Intersection Observer for lazy hydration
      if (binding.modifiers.lazy && 'IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) {
            hydrateComponent()
            observer.disconnect()
          }
        })
        observer.observe(el)
      } else {
        // Immediate hydration
        hydrateComponent()
      }
    }
  }
} 