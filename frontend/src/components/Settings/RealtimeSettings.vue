<template>
  <div class="flex h-full flex-col gap-6 py-8 px-6 text-ink-gray-8">
    <div class="flex flex-col gap-1 px-2">
      <h2 class="flex gap-2 text-xl font-semibold leading-none h-5">
        {{ __('Realtime Settings') }}
      </h2>
      <p class="text-p-base text-ink-gray-6">
        {{
          __(
            'Configure realtime updates for kanban boards and other features',
          )
        }}
      </p>
    </div>

    <div class="flex-1 flex flex-col overflow-y-auto">
      <div class="flex items-center justify-between gap-8 py-3 px-2">
        <div class="flex flex-col">
          <div class="text-p-base font-medium text-ink-gray-7 truncate">
            {{ __('Disable Realtime Updates') }}
          </div>
          <div class="text-p-sm text-ink-gray-5">
            {{
              __(
                'When enabled, disables all realtime updates in the kanban board. This can improve performance on slow networks or with large datasets.',
              )
            }}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Switch
            size="sm"
            v-model="settings.doc.disable_realtime_updates"
            @click.stop="toggleRealtimeUpdates"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { getSettings } from '@/stores/settings'
import { Switch, toast } from 'frappe-ui'

const { _settings: settings } = getSettings()

function toggleRealtimeUpdates() {
  settings.save.submit(null, {
    onSuccess: () => {
      toast.success(
        settings.doc.disable_realtime_updates
          ? __('Realtime updates disabled successfully')
          : __('Realtime updates enabled successfully'),
      )
    },
  })
}
</script>
