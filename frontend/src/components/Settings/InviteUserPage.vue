<template>
    <div class="flex h-full flex-col gap-6 p-8 text-ink-gray-8">
      <div class="flex justify-between gap-4">
        <div class="flex flex-col gap-1 flex-1 min-w-0">
          <h2 class="flex gap-2 text-xl font-semibold leading-none h-5">
            {{ __('Send invites to') }}
          </h2>
          <p class="text-p-base text-ink-gray-6 break-words">
            {{
              __(
                'Invite users to access CRM. Specify their roles to control access and permissions',
              )
            }}
          </p>
        </div>
        <div class="flex item-center space-x-2 flex-shrink-0">
          <Button
            :label="__('Send Invites')"
            variant="solid"
            :disabled="!invitees.length"
            @click="inviteByEmail.submit()"
            :loading="inviteByEmail.loading"
          />
        </div>
      </div>
      <div class="flex-1 flex flex-col gap-8 overflow-y-auto dark-scrollbar">
        <div>
          <label class="block text-xs text-ink-gray-5 mb-1.5">
            {{ __('Invite by email') }}
          </label>
          <div
            class="p-2 group bg-surface-gray-2 hover:bg-surface-gray-3 rounded"
          >
            <MultiSelectUserInput
              class="flex-1"
              inputClass="!bg-surface-gray-2 hover:!bg-surface-gray-3 group-hover:!bg-surface-gray-3"
              :placeholder="__('john@doe.com')"
              v-model="invitees"
              :validate="validateEmail"
              :error-message="
                (value) => __('{0} is an invalid email address', [value])
              "
              :fetchUsers="false"
            />
          </div>
          <div
            v-if="userExistMessage || inviteeExistMessage"
            class="text-xs text-ink-red-3 mt-1.5 break-words"
          >
            {{ userExistMessage || inviteeExistMessage }}
          </div>
          <FormControl
            type="select"
            class="mt-4"
            v-model="role"
            :label="__('Invite as')"
            :options="roleOptions"
            :description="description"
          />
        </div>
        <template v-if="pendingInvitations.data?.length && !invitees.length">
          <div class="flex flex-col gap-4">
            <div
              class="flex items-center justify-between text-base font-semibold"
            >
              <div>{{ __('Pending Invites') }}</div>
            </div>
            <ul class="flex flex-col gap-1">
              <li
                class="flex items-center justify-between px-2 py-1 rounded-lg bg-surface-gray-2 gap-3"
                v-for="user in pendingInvitations.data"
                :key="user.name"
              >
                <div class="text-base flex-1 min-w-0">
                  <span class="text-ink-gray-8 truncate">
                    {{ user.email }}
                  </span>
                  <span class="text-ink-gray-5">
                    ({{ roleMap[user.role] }})
                  </span>
                </div>
                <div class="flex-shrink-0">
                  <Tooltip text="Delete Invitation">
                    <div>
                      <Button
                        icon="x"
                        variant="ghost"
                        :loading="
                          pendingInvitations.delete.loading &&
                          pendingInvitations.delete.params.name === user.name
                        "
                        @click="pendingInvitations.delete.submit(user.name)"
                      />
                    </div>
                  </Tooltip>
                </div>
              </li>
            </ul>
          </div>
        </template>
      </div>
      <ErrorMessage :message="error" />
    </div>
  </template>
  <script setup>
  import MultiSelectUserInput from '@/components/Controls/MultiSelectUserInput.vue'
  import { validateEmail, convertArrayToString } from '@/utils'
  import { usersStore } from '@/stores/users'
  import {
    createListResource,
    createResource,
    FormControl,
    Tooltip,
  } from 'frappe-ui'
  import { useOnboarding } from 'frappe-ui/frappe'
  import { ref, computed } from 'vue'
  
  const { updateOnboardingStep } = useOnboarding('frappecrm')
  const { users, isAdmin, isManager } = usersStore()
  
  const invitees = ref([])
  const role = ref('Sales User')
  const error = ref(null)
  
    const userExistMessage = computed(() => {
    const inviteesSet = new Set(invitees.value)
    if (!inviteesSet.size) return null

    if (!users.data?.crmUsers?.length) return null
    const existingEmails = users.data.crmUsers.map((user) => user.name)
    const existingUsersSet = new Set(existingEmails)

    const existingInvitees = new Set([...inviteesSet].filter(x => existingUsersSet.has(x)))
    if (existingInvitees.size === 0) return null

    return __('User with email {0} already exists', [
      Array.from(existingInvitees).join(', '),
    ])
  })
  
    const inviteeExistMessage = computed(() => {
    const inviteesSet = new Set(invitees.value)
    if (!inviteesSet.size) return null

    if (!pendingInvitations.data?.length) return null
    const existingEmails = pendingInvitations.data.map((user) => user.email)
    const existingUsersSet = new Set(existingEmails)

    const existingInvitees = new Set([...inviteesSet].filter(x => existingUsersSet.has(x)))
    if (existingInvitees.size === 0) return null

    return __('User with email {0} already invited', [
      Array.from(existingInvitees).join(', '),
    ])
  })
  
  const description = computed(() => {
    return {
      'System Manager':
        __('Can manage all aspects of the CRM, including user management, customizations and settings.'),
      'Sales Manager':
        __('Can manage and invite new users, and create public & private views (reports).'),
      'Sales User':
        __('Can work with leads and deals and create private views (reports).'),
    }[role.value]
  })
  
  const roleOptions = computed(() => {
    return [
      { value: 'Sales User', label: __('Sales User') },
      ...(isManager() ? [{ value: 'Sales Manager', label: __('Manager') }] : []),
      ...(isAdmin() ? [{ value: 'System Manager', label: __('Admin') }] : []),
    ]
  })
  
  const roleMap = {
    'Sales User': __('Sales User'),
    'Sales Manager': __('Manager'),
    'System Manager': __('Admin'),
  }
  
  const inviteByEmail = createResource({
    url: 'crm.api.invite_by_email',
    makeParams() {
      return {
        emails: convertArrayToString(invitees.value),
        role: role.value,
      }
    },
    onSuccess(data) {
      if (data?.existing_invites?.length) {
        error.value = __('User with email {0} already exists', [
          data.existing_invites.join(', '),
        ])
      } else {
        role.value = 'Sales User'
        error.value = null
      }
  
      invitees.value = []
      pendingInvitations.reload()
      updateOnboardingStep('invite_your_team')
    },
    onError(err) {
      error.value = err?.messages?.[0]
    },
  })
  
  const pendingInvitations = createListResource({
    type: 'list',
    doctype: 'CRM Invitation',
    filters: { status: 'Pending' },
    fields: ['name', 'email', 'role'],
    auto: true,
  })
  </script>