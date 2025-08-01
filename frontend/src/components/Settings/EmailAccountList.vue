<template>
  <div class="flex flex-col h-full">
    <!-- header -->
    <div class="flex justify-between text-ink-gray-8 gap-4">
      <div class="flex flex-col gap-1 flex-1 min-w-0">
        <h2 class="flex gap-2 text-xl font-semibold leading-none h-5">
          {{ __('Email accounts') }}
        </h2>
        <p class="text-p-base text-ink-gray-6 break-words">
          {{
            __(
              'Manage your email accounts to send and receive emails directly from CRM. You can add multiple accounts and set one as default for incoming and outgoing emails.',
            )
          }}
        </p>
      </div>
      <div class="flex item-center space-x-2 flex-shrink-0">
        <Button
          :label="__('Add Account')"
          theme="gray"
          variant="solid"
          icon-left="plus"
          @click="emit('update:step', 'email-add')"
        />
      </div>
    </div>

    <!-- list accounts -->
    <div
      v-if="!emailAccounts.loading && Boolean(emailAccounts.data?.length)"
      class="mt-4 flex-1 overflow-y-auto dark-scrollbar"
    >
      <div
        v-for="(emailAccount, i) in emailAccounts.data"
        :key="emailAccount.name"
      >
        <EmailAccountCard
          :emailAccount="emailAccount"
          @click="emit('update:step', 'email-edit', emailAccount)"
        />
        <div
          v-if="emailAccounts.data.length !== i + 1"
          class="h-px border-t mx-2 border-outline-gray-modals"
        />
      </div>
    </div>
    <!-- fallback if no email accounts -->
    <div v-else class="flex items-center justify-center h-64 text-ink-gray-4 flex-1">
      {{ __('Please add an email account to continue.') }}
    </div>
  </div>
</template>

<script setup>
import { createListResource } from 'frappe-ui'
import EmailAccountCard from './EmailAccountCard.vue'

const emit = defineEmits(['update:step'])

const emailAccounts = createListResource({
  doctype: 'Email Account',
  cache: true,
  fields: ['*'],
  filters: {
    email_id: ['Not Like', '%example%'],
  },
  pageLength: 10,
  auto: true,
  onSuccess: (accounts) => {
    // convert 0 to false to handle boolean fields
    accounts.forEach((account) => {
      account.enable_incoming = Boolean(account.enable_incoming)
      account.enable_outgoing = Boolean(account.enable_outgoing)
      account.default_incoming = Boolean(account.default_incoming)
      account.default_outgoing = Boolean(account.default_outgoing)
    })
  },
})
</script>