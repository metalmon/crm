<template>
  <div class="flex flex-col h-full gap-4 max-w-3xl mx-auto">
    <!-- title and desc -->
    <div role="heading" aria-level="1" class="flex flex-col gap-1 pr-12">
      <h5 class="text-xl font-semibold">{{ __('Setup Email') }}</h5>
      <p class="text-sm text-gray-600">
        {{ __('Choose the email service provider you want to configure.') }}
      </p>
    </div>
    <!-- email service provider selection -->
    <div class="flex flex-wrap items-center gap-4">
      <div v-for="s in services" :key="s.name" class="flex flex-col items-center gap-1 mt-4 w-[70px]"
        @click="handleSelect(s)">
        <EmailProviderIcon :service-name="s.name" :logo="s.icon" :selected="selectedService?.name === s?.name" />
      </div>
    </div>
    <div v-if="selectedService" class="flex flex-col gap-4">
      <!-- email service provider info -->
      <div class="flex items-center gap-2 p-3 rounded-lg bg-blue-50">
        <CircleAlert class="w-5 h-5 text-blue-500 flex-shrink-0" />
        <div class="text-sm text-gray-700">
          {{ selectedService.info }}
          <a :href="selectedService.link" target="_blank" class="text-blue-600 hover:text-blue-800 underline">{{ __('here') }}</a>
        </div>
      </div>
      <!-- service provider fields -->
      <div class="flex flex-col gap-4">
        <div class="grid grid-cols-1 gap-4">
          <div v-for="field in fields" :key="field.name" class="flex flex-col gap-1">
            <FormControl v-model="state[field.name]" :label="field.label" :name="field.name" :type="field.type"
              :placeholder="field.placeholder" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div v-for="field in incomingOutgoingFields" :key="field.name" class="flex flex-col gap-1">
            <FormControl v-model="state[field.name]" :label="field.label" :name="field.name" :type="field.type" />
            <p class="text-sm text-gray-500">{{ field.description }}</p>
          </div>
        </div>
        <ErrorMessage v-if="error" class="ml-1" :message="error" />
      </div>
    </div>
    <!-- action button -->
    <div v-if="selectedService" class="flex justify-between mt-auto">
      <Button :label="__('Back')" theme="gray" variant="outline" :disabled="addEmailRes.loading"
        @click="emit('update:step', 'email-list')" />
      <Button :label="__('Create')" variant="solid" :loading="addEmailRes.loading" @click="createEmailAccount" />
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from "vue";
import { createResource } from "frappe-ui";
import CircleAlert from "~icons/lucide/circle-alert";
import { createToast } from "@/utils";
import { validateEmail } from '../../utils'
import EmailProviderIcon from "./EmailProviderIcon.vue";

const LogoGmail = '/assets/crm/frontend/images/gmail.png'
const LogoOutlook = '/assets/crm/frontend/images/outlook.png'
const LogoSendgrid = '/assets/crm/frontend/images/sendgrid.png'
const LogoSparkpost = '/assets/crm/frontend/images/sparkpost.webp'
const LogoYahoo = '/assets/crm/frontend/images/yahoo.png'
const LogoYandex = '/assets/crm/frontend/images/yandex.png'
const LogoFrappeMail = '/assets/crm/frontend/images/frappe-mail.svg'

const fixedFields = [
  {
    label: __('Account Name'),
    name: 'email_account_name',
    type: 'text',
    placeholder: __('Support / Sales'),
  },
  {
    label: __('Email ID'),
    name: 'email_id',
    type: 'email',
    placeholder: __('johndoe@example.com'),
  },
]

const incomingOutgoingFields = [
  {
    label: __('Enable Incoming'),
    name: 'enable_incoming',
    type: 'checkbox',
    description: __('If enabled, tickets can be created from the incoming emails on this account.'),
  },
  {
    label: __('Enable Outgoing'),
    name: 'enable_outgoing',
    type: 'checkbox',
    description: __('If enabled, outgoing emails can be sent from this account.'),
  },
  {
    label: __('Default Incoming'),
    name: 'default_incoming',
    type: 'checkbox',
    description: __('If enabled, all replies to your company (eg: replies@yourcomany.com) will come to this account. Note: Only one account can be default incoming.'),
  },
  {
    label: __('Default Outgoing'),
    name: 'default_outgoing',
    type: 'checkbox',
    description: __('If enabled, all outgoing emails will be sent from this account. Note: Only one account can be default outgoing.'),
  },
]

const popularProviderFields = [
  ...fixedFields,
  {
    label: __('Password'),
    name: 'password',
    type: 'password',
    placeholder: '********',
  },
]

const customProviderFields = [
  ...fixedFields,
  {
    label: __('Frappe Mail Site'),
    name: 'frappe_mail_site',
    type: 'text',
    placeholder: __('https://frappemail.com'),
  },
  {
    label: __('API Key'),
    name: 'api_key',
    type: 'text',
    placeholder: '********',
  },
  {
    label: __('API Secret'),
    name: 'api_secret',
    type: 'password',
    placeholder: '********',
  },
]

const services = [
  {
    name: 'GMail',
    icon: LogoGmail,
    info: __('Setting up GMail requires you to enable two factor authentication and app specific passwords. Read more'),
    link: 'https://support.google.com/accounts/answer/185833',
    custom: false,
  },
  {
    name: 'Outlook',
    icon: LogoOutlook,
    info: __('Setting up Outlook requires you to enable two factor authentication and app specific passwords. Read more'),
    link: 'https://support.microsoft.com/en-us/account-billing/how-to-get-and-use-app-passwords-5896ed9b-4263-e681-128a-a6f2979a7944',
    custom: false,
  },
  {
    name: 'Sendgrid',
    icon: LogoSendgrid,
    info: __('Setting up Sendgrid requires you to enable two factor authentication and app specific passwords. Read more'),
    link: 'https://sendgrid.com/docs/ui/account-and-settings/two-factor-authentication/',
    custom: false,
  },
  {
    name: 'SparkPost',
    icon: LogoSparkpost,
    info: __('Setting up SparkPost requires you to enable two factor authentication and app specific passwords. Read more'),
    link: 'https://support.sparkpost.com/docs/my-account-and-profile/enabling-two-factor-authentication',
    custom: false,
  },
  {
    name: 'Yahoo',
    icon: LogoYahoo,
    info: __('Setting up Yahoo requires you to enable two factor authentication and app specific passwords. Read more'),
    link: 'https://help.yahoo.com/kb/SLN15241.html',
    custom: false,
  },
  {
    name: 'Yandex',
    icon: LogoYandex,
    info: __('Setting up Yandex requires you to enable two factor authentication and app specific passwords. Read more'),
    link: 'https://yandex.com/support/id/authorization/app-passwords.html',
    custom: false,
  },
  {
    name: 'Frappe Mail',
    icon: LogoFrappeMail,
    info: __('Setting up Frappe Mail requires you to have an API key and API Secret of your email account. Read more'),
    link: 'https://github.com/frappe/mail',
    custom: true,
  },
]

const emit = defineEmits();

const state = reactive({
  service: "",
  email_account_name: "",
  email_id: "",
  password: "",
  api_key: "",
  api_secret: "",
  frappe_mail_site: "",
  enable_incoming: false,
  enable_outgoing: false,
  default_incoming: false,
  default_outgoing: false,
});

const selectedService = ref(null);
const fields = computed(() =>
  selectedService.value?.custom ? customProviderFields : popularProviderFields
);

function handleSelect(service) {
  selectedService.value = service;
  state.service = service.name;
}

function validateInputs(state, isCustom) {
  if (!state.email_account_name) {
    return __('Please enter account name')
  }
  if (!state.email_id) {
    return __('Please enter email address')
  }
  const validEmail = validateEmail(state.email_id)
  if (!validEmail) {
    return __('Please enter valid email address')
  }
  if (!isCustom && !state.password) {
    return __('Please enter password')
  }
  if (isCustom) {
    if (!state.api_key) {
      return __('Please enter API key')
    }
    if (!state.api_secret) {
      return __('Please enter API secret')
    }
  }
  return null
}

const addEmailRes = createResource({
  url: "crm.api.settings.create_email_account",
  makeParams: (val) => {
    return {
      ...val,
    };
  },
  onSuccess: () => {
    createToast({
      title: __('Email account created successfully'),
      icon: "check",
      iconClasses: "text-green-600",
    });
    emit("update:step", "email-list");
  },
  onError: () => {
    error.value = __('Failed to create email account, Invalid credentials');
  },
});

const error = ref();
function createEmailAccount() {
  error.value = validateInputs(state, selectedService.value?.custom);
  if (error.value) return;

  addEmailRes.submit({ data: state });
}
</script>

<style scoped></style>
