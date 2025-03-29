<template>
  <div class="flex flex-col gap-8 justify-center items-center h-full max-w-4xl mx-auto px-4">
    <!-- Welcome Header -->
    <div class="text-center">
      <div class="font-semibold text-3xl text-ink-gray-8 mb-2">
        {{ __('Welcome {0}, lets add your first lead', [name]) }}
      </div>
      <div class="text-ink-gray-6 text-lg">
        {{ __('Choose how you want to start with Frappe CRM') }}
      </div>
    </div>

    <!-- Main Options Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
      <!-- Sample Data Card -->
      <div
        class="flex flex-col px-8 py-6 justify-between bg-surface-gray-1 hover:bg-surface-gray-2 transition-colors duration-200 rounded-2xl items-center space-y-4 min-h-[280px] group cursor-pointer"
        @click="handleSampleData"
      >
        <div class="flex flex-col items-center gap-4">
          <div class="flex -space-x-4 scale-110">
            <div
              v-for="i in 3"
              :key="i"
              class="bg-surface-gray-3 ring-2 ring-outline-white p-3 rounded-full"
            >
              <AvatarIcon class="w-8 h-8" />
            </div>
          </div>
          <div class="text-xl font-medium text-ink-gray-8 text-center">
            {{ __('Start with sample leads') }}
          </div>
          <div class="text-ink-gray-6 text-center">
            {{ __('Get 10 sample leads to explore CRM features and functionality') }}
          </div>
        </div>
        <Button 
          variant="solid" 
          class="w-full group-hover:bg-primary"
          :label="__('Add sample data')" 
        />
      </div>

      <!-- Google Integration Card -->
      <div
        class="flex flex-col px-8 py-6 justify-between bg-surface-gray-1 hover:bg-surface-gray-2 transition-colors duration-200 rounded-2xl items-center space-y-4 min-h-[280px] group cursor-pointer"
        @click="handleGoogleConnect"
      >
        <div class="flex flex-col items-center gap-4">
          <div class="bg-white p-4 rounded-full shadow-sm">
            <GoogleIcon class="w-8 h-8" />
          </div>
          <div class="text-xl font-medium text-ink-gray-8 text-center">
            {{ __('Connect with Google') }}
          </div>
          <div class="text-ink-gray-6 text-center">
            {{ __('Import your contacts, sync emails and manage calendar events') }}
          </div>
        </div>
        <Button 
          variant="solid" 
          class="w-full group-hover:bg-primary"
          :label="__('Connect your email')" 
        />
      </div>
    </div>

    <!-- Manual Creation Option -->
    <div class="text-center">
      <Button
        variant="ghost"
        class="text-lg"
        :label="__('Or create leads manually')"
        @click="showLeadModal = true"
      >
        <template #prefix>
          <FeatherIcon name="plus" class="w-5 h-5" />
        </template>
      </Button>
      <div class="mt-2 text-ink-gray-6">
        {{ __('Start from scratch and add your leads one by one') }}
      </div>
    </div>
  </div>

  <LeadModal
    v-if="showLeadModal"
    v-model="showLeadModal"
    v-model:quickEntry="showQuickEntryModal"
  />
  <QuickEntryModal v-if="showQuickEntryModal" v-model="showQuickEntryModal" />
</template>

<script setup>
import AvatarIcon from '@/components/Icons/AvatarIcon.vue'
import GoogleIcon from '@/components/Icons/GoogleIcon.vue'
import LeadModal from '@/components/Modals/LeadModal.vue'
import QuickEntryModal from '@/components/Modals/QuickEntryModal.vue'
import { FeatherIcon } from 'frappe-ui'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usersStore } from '@/stores/users'

const router = useRouter()
const { getUser } = usersStore()

const name = computed(() => getUser().full_name)
const showLeadModal = ref(false)
const showQuickEntryModal = ref(false)

const handleSampleData = () => {
  // TODO: Implement sample data generation
  console.log('Adding sample data...')
}

const handleGoogleConnect = () => {
  // TODO: Implement Google integration
  console.log('Connecting to Google...')
}
</script>

<style scoped>
.group:hover .group-hover\:bg-primary {
  @apply bg-blue-500 text-white border-blue-500;
}
</style>
