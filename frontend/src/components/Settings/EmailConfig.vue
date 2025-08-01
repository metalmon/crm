<template>
  <div class="flex-1 p-8 overflow-hidden">
    <div v-if="step === 'email-add'" class="h-full overflow-hidden">
      <EmailAdd @update:step="updateStep" />
    </div>
    <div v-else-if="step === 'email-list'" class="h-full overflow-hidden">
      <EmailAccountList @update:step="updateStep" />
    </div>
    <div v-else-if="step === 'email-edit'" class="h-full overflow-hidden">
      <EmailEdit :account-data="accountData" @update:step="updateStep" />
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import EmailAdd from "./EmailAdd.vue";
import EmailAccountList from "./EmailAccountList.vue";
import EmailEdit from "./EmailEdit.vue";

const step = ref("email-list");
const accountData = ref(null);
function updateStep(newStep, data) {
  step.value = newStep;
  accountData.value = data;
}
</script>