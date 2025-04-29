<template>
  <div class="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
    <!-- avatar and name -->
    <div class="flex items-center gap-3">
      <div v-if="emailAccount.service && emailIcon[emailAccount.service]" class="flex-shrink-0">
        <EmailProviderIcon :logo="emailIcon[emailAccount.service]" />
      </div>
      <Avatar 
        v-else 
        size="md" 
        class="w-8 h-8" 
        :label="emailAccount.email_id.split('@')[0]" 
      />
      <div>
        <p class="text-sm font-medium text-gray-900 dark:text-white">
          {{ emailAccount.email_account_name }}
        </p>
        <div class="text-sm text-gray-500 dark:text-gray-300">{{ emailAccount.email_id }}</div>
      </div>
    </div>
    <div>
      <Badge variant="subtle" :label="badgeTitleColor[0]" :theme="badgeTitleColor[1]" />
    </div>
  </div>
</template>

<script setup>
import EmailProviderIcon from "./EmailProviderIcon.vue";
import { Avatar } from 'frappe-ui';
import { computed } from "vue";

const LogoGmail = '/assets/crm/frontend/images/gmail.png'
const LogoOutlook = '/assets/crm/frontend/images/outlook.png'
const LogoSendgrid = '/assets/crm/frontend/images/sendgrid.png'
const LogoSparkpost = '/assets/crm/frontend/images/sparkpost.webp'
const LogoYahoo = '/assets/crm/frontend/images/yahoo.png'
const LogoYandex = '/assets/crm/frontend/images/yandex.png'
const LogoFrappeMail = '/assets/crm/frontend/images/frappe-mail.svg'

const emailIcon = {
  GMail: LogoGmail,
  Outlook: LogoOutlook,
  Sendgrid: LogoSendgrid,
  SparkPost: LogoSparkpost,
  Yahoo: LogoYahoo,
  Yandex: LogoYandex,
  'Frappe Mail': LogoFrappeMail,
}

const props = defineProps({
  emailAccount: {
    type: Object,
    required: true
  }
});

const badgeTitleColor = computed(() => {
  if (
    props.emailAccount.default_incoming &&
    props.emailAccount.default_outgoing
  ) {
    const color =
      props.emailAccount.enable_incoming && props.emailAccount.enable_outgoing
        ? "blue"
        : "gray";
    return [__("Default Sending and Inbox"), color];
  } else if (props.emailAccount.default_incoming) {
    const color = props.emailAccount.enable_incoming ? "blue" : "gray";
    return [__("Default Inbox"), color];
  } else if (props.emailAccount.default_outgoing) {
    const color = props.emailAccount.enable_outgoing ? "blue" : "gray";
    return [__("Default Sending"), color];
  } else {
    const color = props.emailAccount.enable_incoming ? "blue" : "gray";
    return [__("Inbox"), color];
  }
});
</script>

<style scoped></style>
