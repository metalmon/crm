<template>
  <div class="flex h-full flex-col gap-6 px-6 py-8 text-ink-gray-8">
    <div class="flex flex-col gap-1 px-2">
      <h2 class="flex gap-2 text-xl font-semibold leading-none h-5">
        {{ __('Realtime Settings') }}
      </h2>
      <p class="text-p-base text-ink-gray-6">
        {{
          __(
            'Configure realtime updates settings to optimize performance',
          )
        }}
      </p>
    </div>

    <div class="flex-1 flex flex-col overflow-y-auto">
      <div
        class="flex items-start justify-between py-3 px-2 cursor-pointer hover:bg-surface-menu-bar rounded gap-3"
        @click="toggleKanbanRealtime()"
      >
        <div class="flex flex-col flex-1 min-w-0">
          <div class="text-p-base font-medium text-ink-gray-7">
            {{ __('Disable Kanban Realtime Updates') }}
          </div>
          <div class="text-p-sm text-ink-gray-5 break-words">
            {{
              __(
                'When enabled, disables realtime updates in kanban boards only. Notifications and other real-time features will continue to work. This can improve performance on slow networks or with large datasets.',
              )
            }}
          </div>
        </div>
        <div class="flex-shrink-0">
          <Switch
            size="sm"
            v-model="settings.doc.disable_realtime_updates"
            @click.stop="toggleKanbanRealtime(settings.doc.disable_realtime_updates)"
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

function toggleKanbanRealtime(value) {
  settings.doc.disable_realtime_updates =
    value !== undefined ? value : !settings.doc.disable_realtime_updates

  settings.save.submit(null, {
    onSuccess: () => {
      toast.success(
        settings.doc.disable_realtime_updates
          ? __('Kanban realtime updates disabled successfully')
          : __('Kanban realtime updates enabled successfully'),
      )
    },
  })
}
</script>

