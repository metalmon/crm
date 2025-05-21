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
import { computed, reactive, ref } from 'vue'
import { createResource, toast } from 'frappe-ui'
import CircleAlert from '~icons/lucide/circle-alert'
import {
  customProviderFields,
  popularProviderFields,
  services,
  validateInputs,
  incomingOutgoingFields,
} from './emailConfig'
import EmailProviderIcon from './EmailProviderIcon.vue'

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

const addEmailRes = createResource({
  url: "crm.api.settings.create_email_account",
  makeParams: (val) => {
    return {
      ...val,
    };
  },
  onSuccess: () => {
    toast.success(__('Email account created successfully'))
    emit('update:step', 'email-list')
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
