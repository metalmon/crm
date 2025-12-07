<template>
  <div class="flex h-full flex-col gap-6 p-8 text-ink-gray-8">
    <div class="flex flex-col gap-1">
      <h2 class="flex gap-2 text-xl font-semibold leading-none h-5">
        {{ __('General') }}
      </h2>
      <p class="text-p-base text-ink-gray-6">
        {{ __('Configure general settings for your CRM') }}
      </p>
    </div>

    <div class="flex-1 flex flex-col overflow-y-auto dark-scrollbar">
      <div
        class="flex items-start justify-between p-3 cursor-pointer hover:bg-surface-menu-bar rounded gap-3"
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
      <div class="h-px border-t mx-2 border-outline-gray-modals" />
      
      <template v-for="(setting, i) in settingsList" :key="setting.name">
        <li
          class="flex items-start justify-between p-3 cursor-pointer hover:bg-surface-menu-bar rounded gap-3"
          @click="() => emit('updateStep', setting.name)"
        >
          <div class="flex flex-col flex-1 min-w-0">
            <div class="text-p-base font-medium text-ink-gray-7">
              {{ setting.label }}
            </div>
            <div class="text-p-sm text-ink-gray-5 break-words">
              {{ setting.description }}
            </div>
          </div>
          <div class="flex-shrink-0">
            <FeatherIcon name="chevron-right" class="text-ink-gray-7 size-4" />
          </div>
        </li>
        <div
          v-if="settingsList.length !== i + 1"
          class="h-px border-t mx-2 border-outline-gray-modals"
        />
      </template>
    </div>
  </div>
</template>

<script setup>
import { getSettings } from '@/stores/settings'
import { Switch, toast } from 'frappe-ui'

const emit = defineEmits(['updateStep'])

const { _settings: settings } = getSettings()

const settingsList = [
  {
    name: 'currency-settings',
    label: __('Currency & Exchange rate provider'),
    description:
      __('Configure the currency and exchange rate provider for your CRM'),
  },
  {
    name: 'brand-settings',
    label: __('Brand settings'),
    description: __('Configure your brand name, logo and favicon'),
  },
  {
    name: 'conversion-settings',
    label: __('Conversion settings'),
    description: __('Configure lead conversion settings'),
  },
  {
    name: 'home-actions',
    label: __('Home actions'),
    description: __('Configure actions that appear on the home dropdown'),
  },
]

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
