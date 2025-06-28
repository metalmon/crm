/**
 * This code is based on frappe-ui v0.1.121
 * Source: frappe-ui/src/components/Onboarding/onboarding.js
 */

import { call } from 'frappe-ui'
import { createResource } from 'frappe-ui'
import { useStorage } from '@vueuse/core'
import { computed, reactive } from 'vue'
import { minimize } from './help'

const onboardings = reactive({})
const onboardingStatus = useStorage('onboardingStatus', {})

export function useOnboarding(appName) {
  const isOnboardingStepsCompleted = useStorage(
    'isOnboardingStepsCompleted' + appName,
    false,
  )

  if (!Array.isArray(onboardings[appName])) {
    onboardings[appName] = []
  }

  const onboardingSteps = computed(
    () => onboardingStatus.value?.[appName + '_onboarding_status'] || [],
  )

  if (!onboardingSteps.value.length && !isOnboardingStepsCompleted.value) {
    createResource({
      url: 'frappe.onboarding.get_onboarding_status',
      cache: 'onboarding_status',
      auto: true,
      onSuccess: (data) => {
        onboardingStatus.value = data
        syncStatus()
      },
    })
  }

  const stepsCompleted = computed(
    () => onboardings[appName]?.filter((step) => step.completed).length || 0,
  )
  const totalSteps = computed(() => onboardings[appName]?.length || 0)

  const completedPercentage = computed(() =>
    totalSteps.value > 0 ? Math.floor((stepsCompleted.value / totalSteps.value) * 100) : 0,
  )

  function skip(step, callback = null) {
    updateOnboardingStep(step, true, true, callback)
  }

  function skipAll(callback = null) {
    updateAll(true, callback)
  }

  function reset(step, callback = null) {
    updateOnboardingStep(step, false, false, callback)
  }

  function resetAll(callback = null) {
    updateAll(false, callback)
  }

  function updateOnboardingStep(
    stepName,
    value = true,
    skipped = false,
    callback = null,
  ) {
    if (isOnboardingStepsCompleted.value) return

    if (!Array.isArray(onboardingStatus.value[appName + '_onboarding_status'])) {
      onboardingStatus.value[appName + '_onboarding_status'] = [];
    }

    if (!Array.isArray(onboardings[appName])) {
        onboardings[appName] = [];
    }

    let statusIndex = onboardingStatus.value[appName + '_onboarding_status'].findIndex((s) => s.name === stepName)
    if (statusIndex !== -1) {
      onboardingStatus.value[appName + '_onboarding_status'][statusIndex].completed = value
    } else {
      onboardingStatus.value[appName + '_onboarding_status'].push({ name: stepName, completed: value })
    }

    let definitionIndex = onboardings[appName].findIndex((s) => s.name === stepName);
    let stepToUpdate = onboardings[appName][definitionIndex];

    if (definitionIndex !== -1) {
        if (stepToUpdate === undefined) {
            onboardings[appName].push({ name: stepName, completed: value });
        } else {
            stepToUpdate.completed = value;
        }
    } else {
        onboardings[appName].push({ name: stepName, completed: value });
    }

    updateUserOnboardingStatus(onboardingStatus.value[appName + '_onboarding_status'])

    callback?.(stepName, skipped)

    minimize.value = false
  }

  function updateAll(value, callback = null) {
    if (isOnboardingStepsCompleted.value && value) return

    if (!onboardingStatus.value[appName + '_onboarding_status']) {
      onboardingStatus.value[appName + '_onboarding_status'] = [];
    }

    if (onboardingStatus.value[appName + '_onboarding_status'].length === 0 && Array.isArray(onboardings[appName])) {
      onboardingStatus.value[appName + '_onboarding_status'] = onboardings[appName].map((s) => {
        return { name: s.name, completed: value }
      })
    } else {
      onboardingStatus.value[appName + '_onboarding_status'].forEach((s) => {
        s.completed = value
      })
    }

    if (Array.isArray(onboardings[appName])) {
      onboardings[appName].forEach((s) => {
        s.completed = value
      })
    }

    updateUserOnboardingStatus(onboardingStatus.value[appName + '_onboarding_status'])

    callback?.(value)
  }

  function updateUserOnboardingStatus(steps) {
    call('frappe.onboarding.update_user_onboarding_status', {
      steps: JSON.stringify(steps),
      appName,
    })
  }

  function syncStatus() {
    if (isOnboardingStepsCompleted.value) return

    if (onboardingSteps.value.length) {
      let _steps = onboardingSteps.value
      if (Array.isArray(onboardings[appName])) {
          _steps.forEach((s) => {
            const existingStep = onboardings[appName].find(oStep => oStep.name === s.name);
            if (existingStep) {
                existingStep.completed = s.completed;
            } else {
                onboardings[appName].push({ name: s.name, completed: s.completed });
            }
          });
      } else {
          onboardings[appName] = _steps.map(s => ({ name: s.name, completed: s.completed }));
      }

      isOnboardingStepsCompleted.value = _steps.every((step) => step.completed)
    } else {
      isOnboardingStepsCompleted.value = false
    }
  }

  function setUp(steps) {
    if (Array.isArray(steps)) {
        onboardings[appName] = steps;
        syncStatus();
    }
  }

  return {
    steps: onboardings[appName],
    stepsCompleted,
    totalSteps,
    completedPercentage,
    isOnboardingStepsCompleted,
    updateOnboardingStep,
    skip,
    skipAll,
    reset,
    resetAll,
    setUp,
    syncStatus,
  }
} 