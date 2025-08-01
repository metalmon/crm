<template>
  <Dialog v-model="show" :options="{ size: 'sm' }">
    <template #body>
      <div class="p-4 pt-5">
        <div class="flex justify-center">
          <div class="flex flex-col items-center">
            <CRMLogo class="mb-3 size-12" />
            <h3 class="font-semibold text-xl text-ink-gray-9">Frappe CRM</h3>
            <div class="flex items-center mt-1">
              <div class="text-base text-ink-gray-6">
                <template v-if="appVersion && typeof appVersion === 'object'">
                  {{ appVersion.branch != 'main' ? appVersion.branch : '' }}
                  <template v-if="appVersion.branch != 'main'">
                    ({{ appVersion.commit }})
                  </template>
                  <template v-else>{{ appVersion.tag }}</template>
                </template>
                <template v-else>
                  {{ __('Version info unavailable') }}
                </template>
              </div>

              <Tooltip
                v-if="appVersion && typeof appVersion === 'object'"
                :text="`${appVersion.commit_message} - ${appVersion.commit_date}`"
                placement="top"
              >
                <LucideInfo class="size-3.5 text-ink-gray-8 ml-1" />
              </Tooltip>
            </div>
          </div>
        </div>
        <hr class="border-t my-3 mx-2" />
        <div>
          <a
            v-for="link in links"
            :key="link.label"
            class="flex py-2 px-2 hover:bg-surface-gray-1 rounded cursor-pointer"
            target="_blank"
            :href="link.url"
          >
            <component
              v-if="link.icon"
              :is="link.icon"
              class="size-4 mr-2 text-ink-gray-7"
            />
            <span class="text-base text-ink-gray-8">
              {{ link.label }}
            </span>
          </a>
        </div>
        <hr class="border-t my-3 mx-2" />
        <p class="text-sm text-ink-gray-6 px-2 mt-2">
          © Frappe Technologies Pvt. Ltd. and contributors
        </p>
      </div>
    </template>
  </Dialog>
</template>
<script setup>
import { Tooltip } from 'frappe-ui'
import CRMLogo from '@/components/Icons/CRMLogo.vue'
import LucideGlobe from '~icons/lucide/globe'
import LucideGitHub from '~icons/lucide/github'
import LucideHeadset from '~icons/lucide/headset'
import LucideBug from '~icons/lucide/bug'
import LucideBookOpen from '~icons/lucide/book-open'
import TelegramIcon from '@/components/Icons/TelegramIcon.vue'

let show = defineModel()

let links = [
  {
    label: __('Website'),
    url: 'https://frappe.io/crm',
    icon: LucideGlobe,
  },
  {
    label: __('GitHub Repository'),
    url: 'https://github.com/metalmon/crm',
    icon: LucideGitHub,
  },
  {
    label: __('Documentation'),
    url: 'https://docs.frappe.io/crm',
    icon: LucideBookOpen,
  },
  {
    label: __('Telegram Channel'),
    url: 'https://t.me/frappecrm',
    icon: TelegramIcon,
  },
  {
    label: __('Report an Issue'),
    url: 'https://github.com/metalmon/crm/issues',
    icon: LucideBug,
  },
  {
    label: __('Contact Support'),
    url: 'https://t.me/metalmonkey',
    icon: LucideHeadset,
  },
]

let appVersion = window.app_version
</script>
