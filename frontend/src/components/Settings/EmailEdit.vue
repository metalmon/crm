<template>
  <div class="flex flex-col h-full gap-4 max-w-3xl mx-auto">
    <!-- title and desc -->
    <div role="heading" aria-level="1" class="flex justify-between gap-1 pr-12">
      <h5 class="text-lg font-semibold">{{ __('Edit Email') }}</h5>
    </div>
    <!-- avatar and info message in one row -->
    <div class="flex items-center gap-4">
      <div class="w-fit">
        <EmailProviderIcon v-if="accountData.service && emailIcon[accountData.service]" :logo="emailIcon[accountData.service]" :service-name="accountData.service" />
        <Avatar 
          v-else 
          size="md" 
          class="w-8 h-8" 
          :label="accountData.email_id.split('@')[0]" 
        />
      </div>
      <div class="flex items-center gap-2 p-3 rounded-lg bg-blue-50 flex-1">
        <CircleAlert class="w-5 h-5 text-blue-500 flex-shrink-0" />
        <div class="text-sm text-gray-700">
          {{ __('To know more about setting up email accounts, click') }}
          <a :href="info.link" target="_blank" class="text-blue-600 hover:text-blue-800 underline">{{ __('here') }}</a>
        </div>
      </div>
    </div>
    <!-- fields -->
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
    <!-- action buttons -->
    <div class="flex justify-between mt-auto">
      <Button :label="__('Back')" theme="gray" variant="outline" :disabled="loading"
        @click="emit('update:step', 'email-list')" />
      <Button :label="__('Update Account')" variant="solid" @click="updateAccount" :loading="loading" />
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from "vue";
import { call, Avatar } from "frappe-ui";
import EmailProviderIcon from "./EmailProviderIcon.vue";
import { createToast } from "@/utils";
import { validateEmail } from '../../utils'
import CircleAlert from "~icons/lucide/circle-alert";

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

const props = defineProps({
  accountData: null,
})

const emit = defineEmits();

const state = reactive({
  email_account_name: props.accountData.email_account_name || "",
  service: props.accountData.service || "",
  email_id: props.accountData.email_id || "",
  api_key: props.accountData?.api_key || null,
  api_secret: props.accountData?.api_secret || null,
  password: props.accountData?.password || null,
  frappe_mail_site: props.accountData?.frappe_mail_site || "",
  enable_incoming: props.accountData.enable_incoming || false,
  enable_outgoing: props.accountData.enable_outgoing || false,
  default_outgoing: props.accountData.default_outgoing || false,
  default_incoming: props.accountData.default_incoming || false,
});

const info = {
  description: __('To know more about setting up email accounts, click'),
  link: "https://docs.erpnext.com/docs/user/manual/en/email-account",
};

const isCustomService = computed(() => {
  return services.find((s) => s.name === props.accountData.service)?.custom;
});

const fields = computed(() => {
  if (isCustomService.value) {
    return customProviderFields;
  }
  return popularProviderFields;
});

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

const error = ref();
const loading = ref(false);
async function updateAccount() {
  error.value = validateInputs(state, isCustomService.value);
  if (error.value) return;
  const old = { ...props.accountData };
  const updatedEmailAccount = { ...state };

  const nameChanged =
    old.email_account_name !== updatedEmailAccount.email_account_name;
  delete old.email_account_name;
  delete updatedEmailAccount.email_account_name;

  const otherFieldsChanged = isDirty.value;
  const values = updatedEmailAccount;

  if (!nameChanged && !otherFieldsChanged) {
    createToast({
      title: __("No changes made"),
      icon: "info",
      iconClasses: "text-blue-600",
    });
    return;
  }

  if (nameChanged) {
    try {
      loading.value = true;
      await callRenameDoc();
      succesHandler();
    } catch (err) {
      errorHandler();
    }
  }
  if (otherFieldsChanged) {
    try {
      loading.value = true;
      await callSetValue(values);
      succesHandler();
    } catch (err) {
      errorHandler();
    }
  }
}

const isDirty = computed(() => {
  return (
    state.email_id !== props.accountData.email_id ||
    state.api_key !== props.accountData.api_key ||
    state.api_secret !== props.accountData.api_secret ||
    state.password !== props.accountData.password ||
    state.enable_incoming !== props.accountData.enable_incoming ||
    state.enable_outgoing !== props.accountData.enable_outgoing ||
    state.default_outgoing !== props.accountData.default_outgoing ||
    state.default_incoming !== props.accountData.default_incoming ||
    state.frappe_mail_site !== props.accountData.frappe_mail_site
  );
});

async function callRenameDoc() {
  const d = await call("frappe.client.rename_doc", {
    doctype: "Email Account",
    old_name: props.accountData.email_account_name,
    new_name: state.email_account_name,
  });
  return d;
}

async function callSetValue(values) {
  const d = await call("frappe.client.set_value", {
    doctype: "Email Account",
    name: state.email_account_name,
    fieldname: values,
  });
  return d.name;
}

function succesHandler() {
  emit("update:step", "email-list");
  createToast({
    title: __("Email account updated successfully"),
    icon: "check",
    iconClasses: "text-green-600",
  });
}

function errorHandler() {
  loading.value = false;
  error.value = __("Failed to update email account, Invalid credentials");
}
</script>
