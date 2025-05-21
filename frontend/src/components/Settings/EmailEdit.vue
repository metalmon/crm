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
import { computed, reactive, ref } from 'vue'
import { call, toast } from 'frappe-ui'
import EmailProviderIcon from './EmailProviderIcon.vue'
import {
  emailIcon,
  services,
  popularProviderFields,
  customProviderFields,
  validateInputs,
  incomingOutgoingFields,
} from './emailConfig'
import CircleAlert from '~icons/lucide/circle-alert'

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
    toast.info(__('No changes made'))
    return
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
  emit('update:step', 'email-list')
  toast.success(__('Email account updated successfully'))
}

function errorHandler() {
  loading.value = false;
  error.value = __("Failed to update email account, Invalid credentials");
}
</script>
