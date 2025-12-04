<template>
  <div
    class="flex items-center justify-between px-2 py-3 border-outline-gray-modals cursor-pointer hover:bg-surface-menu-bar rounded gap-3"
  >
    <!-- avatar and name -->
    <div class="flex items-center gap-2 flex-1 min-w-0">
      <EmailProviderIcon :logo="emailIcon[emailAccount.service]" />
      <div class="flex flex-col min-w-0 flex-1">
        <div class="text-p-base text-ink-gray-8 truncate">
          {{ emailAccount.email_account_name }}
        </div>
        <div class="text-p-sm text-ink-gray-5 truncate">{{ emailAccount.email_id }}</div>
      </div>
    </div>
    <div class="flex-shrink-0">
      <Badge variant="subtle" :label="badgeTitle" theme="gray" />
    </div>
  </div>
</template>

<script setup>
import { emailIcon } from './emailConfig'
import EmailProviderIcon from './EmailProviderIcon.vue'
import { computed } from 'vue'

const props = defineProps({
  emailAccount: {
    type: Object,
    required: true,
  },
})

const badgeTitle = computed(() => {
  if (
    props.emailAccount.default_incoming &&
    props.emailAccount.default_outgoing
  ) {
    return __('Default Sending and Inbox')
  } else if (props.emailAccount.default_incoming) {
    return __('Default Inbox')
  } else if (props.emailAccount.default_outgoing) {
    return __('Default Sending')
  } else {
    return __('Inbox')
  }
})
</script>
