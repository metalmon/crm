<template>
  <div class="flex flex-col h-full gap-6 max-w-3xl mx-auto">
    <!-- header -->
    <div class="flex items-center justify-between pr-12">
      <h1 class="text-xl font-semibold">{{ __('Email Accounts') }}</h1>
      <Button :label="__('Add Account')" theme="gray" variant="solid" @click="emit('update:step', 'email-add')" class="flex items-center gap-2">
        <template #prefix>
          <LucidePlus class="w-4 h-4" />
        </template>
      </Button>
    </div>
    <!-- list accounts -->
    <div v-if="!emailAccounts.loading && Boolean(emailAccounts.data?.length)" class="flex flex-col divide-y divide-gray-200">
      <div v-for="emailAccount in emailAccounts.data" :key="emailAccount.name">
        <EmailAccountCard :emailAccount="emailAccount" @click="emit('update:step', 'email-edit', emailAccount)" />
      </div>
    </div>
    <!-- fallback if no email accounts -->
    <div v-else class="flex flex-col items-center justify-center flex-1 gap-4 text-gray-500">
      <div class="text-center">
        {{ __('Please add an email account to continue.') }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { createListResource } from "frappe-ui";
import EmailAccountCard from "./EmailAccountCard.vue";
import LucidePlus from "~icons/lucide/plus";

const emit = defineEmits(["update:step"]);

const emailAccounts = createListResource({
  doctype: "Email Account",
  cache: true,
  fields: ["name", "email_account_name", "email_id", "service", "owner", 
           "enable_incoming", "enable_outgoing", "default_incoming", "default_outgoing"],
  filters: {
    email_id: ["Not Like", "%example%"],
  },
  pageLength: 10,
  auto: true,
  onSuccess: (accounts) => {
    // convert 0 to false to handle boolean fields
    accounts.forEach((account) => {
      account.enable_incoming = Boolean(account.enable_incoming);
      account.enable_outgoing = Boolean(account.enable_outgoing);
      account.default_incoming = Boolean(account.default_incoming);
      account.default_outgoing = Boolean(account.default_outgoing);
    });
  },
});
</script>
