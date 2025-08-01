<template>
    <div>
      <div class="flex flex-wrap gap-1">
        <Button
          ref="emails"
          v-for="value in values"
          :key="value"
          :label="value"
          theme="gray"
          variant="subtle"
          :class="{
            'rounded bg-surface-white hover:!bg-surface-gray-1 focus-visible:ring-outline-gray-4':
              variant === 'subtle',
          }"
          @keydown.delete.capture.stop="removeLastValue"
        >
          <template #suffix>
            <FeatherIcon
              class="h-3.5"
              name="x"
              @click.stop="removeValue(value)"
            />
          </template>
        </Button>
        <div class="flex-1">
          <Combobox v-model="selectedValue" nullable>
            <Popover class="w-full" v-model:show="showOptions">
              <template #target="{ togglePopover }">
                <ComboboxInput
                  ref="search"
                  class="search-input form-input w-full border-none focus:border-none focus:!shadow-none focus-visible:!ring-0"
                  :class="[
                    variant == 'ghost'
                      ? 'bg-surface-white hover:bg-surface-white'
                      : 'bg-surface-gray-2 hover:bg-surface-gray-3',
                    inputClass,
                  ]"
                  :placeholder="placeholder"
                  type="text"
                  :value="query"
                  @change="
                    (e) => {
                      query = e.target.value
                      showOptions = true
                    }
                  "
                  autocomplete="off"
                  @focus="() => togglePopover()"
                  @keydown.delete.capture.stop="removeLastValue"
                />
              </template>
              <template #body="{ isOpen }">
                <div v-show="isOpen">
                  <div
                    class="mt-1 rounded-lg bg-surface-modal shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none"
                  >
                    <ComboboxOptions
                      class="p-1.5 max-h-[12rem] overflow-y-auto"
                      static
                    >
                      <div
                        v-if="!options.length"
                        class="flex gap-2 rounded px-2 py-1 text-base text-ink-gray-5"
                      >
                        <FeatherIcon
                          v-if="fetchUsers"
                          name="search"
                          class="h-4"
                        />
                        {{
                          fetchUsers
                            ? __('No results found')
                            : __('Type an email address to invite')
                        }}
                      </div>
                      <ComboboxOption
                        v-for="option in options"
                        :key="option.value"
                        :value="option"
                        v-slot="{ active }"
                      >
                        <li
                          :class="[
                            'flex cursor-pointer items-center rounded px-2 py-1 text-base',
                            { 'bg-surface-gray-3': active },
                          ]"
                        >
                          <UserAvatar
                            class="mr-2"
                            :user="option.value"
                            size="lg"
                          />
                          <div class="flex flex-col gap-1 p-1 text-ink-gray-8">
                            <div class="text-base font-medium">
                              {{ option.label }}
                            </div>
                            <div class="text-sm text-ink-gray-5">
                              {{ option.value }}
                            </div>
                          </div>
                        </li>
                      </ComboboxOption>
                    </ComboboxOptions>
                  </div>
                </div>
              </template>
            </Popover>
          </Combobox>
        </div>
      </div>
      <ErrorMessage class="mt-2 pl-2" v-if="error" :message="error" />
      <div
        v-if="info"
        class="whitespace-pre-line text-sm text-ink-blue-3 mt-2 pl-2"
      >
        {{ info }}
      </div>
    </div>
  </template>
  
  <script setup>
  import {
    Combobox,
    ComboboxInput,
    ComboboxOptions,
    ComboboxOption,
  } from '@headlessui/vue'
  import UserAvatar from '@/components/UserAvatar.vue'
  import Popover from '@/components/frappe-ui/Popover.vue'
  import { usersStore } from '@/stores/users'
  import { ref, computed, nextTick } from 'vue'
  
  const props = defineProps({
    validate: {
      type: Function,
      default: null,
    },
    variant: {
      type: String,
      default: 'subtle',
    },
    placeholder: {
      type: String,
      default: '',
    },
    inputClass: {
      type: String,
      default: '',
    },
    errorMessage: {
      type: Function,
      default: (value) => __('{0} is an Invalid value', [value]),
    },
    fetchUsers: {
      type: Boolean,
      default: true,
    },
    existingEmails: {
      type: Array,
      default: () => [],
    },
  })
  
  const values = defineModel()
  
  const { users } = usersStore()
  
  const emails = ref([])
  const search = ref(null)
  const error = ref(null)
  const info = ref(null)
  const query = ref('')
  const showOptions = ref(false)
  
  const selectedValue = computed({
    get: () => query.value || '',
    set: (val) => {
      query.value = ''
      if (val) {
        showOptions.value = false
      }
      val?.value && addValue(val.value)
    },
  })
  
    const options = computed(() => {
    let userEmails = props.fetchUsers ? (users?.data?.allUsers || []) : []

    if (props.fetchUsers) {
      userEmails = userEmails.map((user) => ({
        label: user.full_name || user.name || user.email,
        value: user.email || user.name,
      }))

      if (props.existingEmails?.length) {
        userEmails = userEmails.filter((option) => {
          return !props.existingEmails.includes(option.value)
        })
      }

      if (query.value) {
        userEmails = userEmails.filter(
          (option) =>
            option.label.toLowerCase().includes(query.value.toLowerCase()) ||
            option.value.toLowerCase().includes(query.value.toLowerCase()),
        )
      }
    } else if (!userEmails?.length && query.value) {
      userEmails = [{
        label: query.value,
        value: query.value,
      }]
    }

    return userEmails || []
  })
  
  const addValue = (value) => {
    error.value = null
    info.value = null
    if (value) {
      const splitValues = value.split(',')
      splitValues.forEach((value) => {
        value = value.trim()
        if (value) {
          // check if value is not already in the values array
          if (!values.value?.includes(value)) {
            // check if value is valid
            if (value && props.validate && !props.validate(value)) {
              error.value = props.errorMessage(value)
              query.value = value
              return
            }
            // add value to values array
            if (!values.value) {
              values.value = [value]
            } else {
              values.value.push(value)
            }
            value = value.replace(value, '')
          } else {
            info.value = __('email already exists')
          }
        }
      })
      !error.value && (value = '')
    }
  }
  
  const removeValue = (value) => {
    values.value = values.value.filter((v) => v !== value)
  }
  
  const removeLastValue = () => {
    if (query.value) return
  
    let emailRef = emails.value[emails.value.length - 1]?.$el
    if (document.activeElement === emailRef) {
      values.value.pop()
      nextTick(() => {
        if (values.value.length) {
          emailRef = emails.value[emails.value.length - 1].$el
          emailRef?.focus()
        } else {
          setFocus()
        }
      })
    } else {
      emailRef?.focus()
    }
  }
  
  function setFocus() {
    search.value.$el.focus()
  }
  
  defineExpose({ setFocus })
  </script>