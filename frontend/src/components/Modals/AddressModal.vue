<template>
  <Dialog v-model="show" :options="dialogOptions">
    <template #body>
      <div class="bg-surface-modal px-4 pb-6 pt-5 sm:px-6">
        <div class="mb-5 flex items-center justify-between">
          <div>
            <h3 class="text-2xl font-semibold leading-6 text-ink-gray-9">
              {{ __(dialogOptions.title) || __('Untitled') }}
            </h3>
          </div>
          <div class="flex items-center gap-1">
            <Button
              v-if="isManager() && !isMobileView"
              :tooltip="__('Edit fields layout')"
              variant="ghost"
              :icon="EditIcon"
              class="w-7"
              @click="openQuickEntryModal"
            />
            <Button
              icon="x"
              variant="ghost"
              class="w-7"
              @click="show = false"
            />
          </div>
        </div>
        <div v-if="tabs.data && _address.doc">
          <FieldLayout
            :tabs="tabs.data"
            :data="_address.doc"
            doctype="Address"
          />
          <ErrorMessage class="mt-2" :message="error" />
        </div>
      </div>
      <div class="px-4 pb-7 pt-4 sm:px-6">
        <div class="space-y-2">
          <Button
            class="w-full"
            v-for="action in dialogOptions.actions"
            :key="action.label"
            v-bind="action"
            :label="__(action.label)"
            :loading="loading"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import EditIcon from '@/components/Icons/EditIcon.vue'
import { usersStore } from '@/stores/users'
import { isMobileView } from '@/composables/settings'
import { showQuickEntryModal, quickEntryProps } from '@/composables/modals'
import { useDocument } from '@/data/document'
import { capture } from '@/telemetry'
import { FeatherIcon, createResource, ErrorMessage } from 'frappe-ui'
import { ref, nextTick, computed, onMounted, watch } from 'vue'

const props = defineProps({
  address: {
    type: String,
    default: '',
  },
  options: {
    type: Object,
    default: {
      afterInsert: () => {},
    },
  },
})

const { isManager } = usersStore()

const show = defineModel()
const loading = ref(false)
const error = ref(null)
const editMode = ref(false)


const countryCodeMap = {
  'RU': 'Russian Federation',
  'US': 'United States',
  'GB': 'United Kingdom',
  // Add more as needed
}

const defaultCountry = createResource({
  url: 'crm.api.address.get_default_country',
  transform(data) {
    if (data) return data
    try {
      const locale = new Intl.Locale(navigator.language)
      const region = locale.maximize().region
      return countryCodeMap[region] || 'Russian Federation'
    } catch (e) {
      return 'Russian Federation'
    }
  },
  auto: true
})

const countryMap = createResource({
  url: 'frappe.desk.search.search_link',
  method: 'POST',
  params: {
    doctype: 'Country',
    txt: '',
    filters: null
  },
  transform(data) {
    // Create a map where key is translated name and value is original name
    const translationMap = {}
    data.forEach(country => {
      translationMap[__(country.value)] = country.value
    })
    return translationMap
  },
  auto: true
})
const { document: _address, triggerOnBeforeCreate } = useDocument(
  'Address',
  props.address || '',
)

const dialogOptions = computed(() => {
  let title = !editMode.value
    ? __('New Address')
    : __(_address.doc?.address_title)
  let size = 'xl'
  let actions = [
    {
      label: editMode.value ? __('Save') : __('Create'),
      variant: 'solid',
      onClick: () => (editMode.value ? updateAddress() : createAddress()),
    },
  ]

  return { title, size, actions }
})

const tabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['QuickEntry', 'Address'],
  params: { doctype: 'Address', type: 'Quick Entry' },
  auto: true,
  transform(data) {
    return data.map(tab => {
      if (tab.sections) {
        tab.sections = tab.sections.map(section => {
          if (section.fields) {
            section.fields = section.fields.map(field => {
              // Get translated field label
              const translatedLabel = __(field.label || field.name.split('_').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)).join(' '))

              // Determine placeholder verb based on field type
              const getPlaceholderVerb = (fieldtype) => {
                switch(fieldtype?.toLowerCase()) {
                  case 'select':
                  case 'link':
                    return __('Select')
                  case 'date':
                  case 'datetime':
                    return __('Set')
                  default:
                    return __('Enter')
                }
              }

              const verb = getPlaceholderVerb(field.fieldtype)
              return {
                ...field,
                placeholder: `${verb} ${translatedLabel}`,
                mandatory: field.name === 'address_type' ? false : field.mandatory
              }
            })
          }
          return section
        })
      }
      return tab
    })
  }
})

const callBacks = {
  onSuccess: (doc) => {
    loading.value = false
    handleAddressUpdate(doc)
  },
  onError: (err) => {
    loading.value = false
    if (err.exc_type == 'MandatoryError') {
      const errorMessage = err.messages
        .map((msg) => {
          let arr = msg.split(': ')
          return arr[arr.length - 1].trim()
        })
        .join(', ')
      error.value = __('These fields are required: {0}', [errorMessage])
      return
    }
    error.value = err
  },
}

async function updateAddress() {
  loading.value = true
  try {
    const doc = await _address.save()
    if (doc.name) {
      // Call afterInsert callback before closing modal
      if (props.options?.afterInsert) {
        props.options.afterInsert(doc)
      }
      show.value = false
    }
  } catch (err) {
    loading.value = false
    if (err.exc_type == 'MandatoryError') {
      const errorMessage = err.messages
        .map((msg) => msg.split(': ')[2].trim())
        .join(', ')
      error.value = __('These fields are required: {0}', [errorMessage])
      return
    }
    error.value = err
  }
}

async function createAddress() {
  loading.value = true
  error.value = null

  await triggerOnBeforeCreate?.()

  await _createAddress.submit({
    doc: {
      doctype: 'Address',
      ..._address.doc,
    },
  })
}

const _createAddress = createResource({
  url: 'frappe.client.insert',
  makeParams() {
    if (!_address.doc.address_line1) {
      error.value = __('Address Line 1 is mandatory')
      return
    }

    // Get original country name from translation map
    const originalCountry = countryMap.data?.[_address.doc.country] || _address.doc.country

    // Create default address title from city and address line 1
    const defaultTitle = _address.doc.city ? 
      `${_address.doc.city}, ${_address.doc.address_line1}` : 
      _address.doc.address_line1

    return {
      doc: {
        doctype: 'Address',
        ..._address.doc,
        country: originalCountry,
        address_title: _address.doc.address_title || defaultTitle,
      },
    }
  },
  onSuccess(doc) {
    loading.value = false
    if (doc.name) {
      capture('address_created')
      // Call afterInsert callback before closing modal
      if (props.options?.afterInsert) {
        props.options.afterInsert(doc)
      }
      show.value = false
    }
  },
  async onError(err) {
    // Try to handle duplicate entry error
    const handled = await handleDuplicateEntry(err, 'Address', () => createAddress.submit())
    if (!handled) {
      loading.value = false
      error.value = err
    }
  },
})

function handleAddressUpdate(doc) {
  show.value = false
  props.options.afterInsert && props.options.afterInsert(doc)
}

watch(
  () => show.value,
  async (value) => {
    if (value) {
      editMode.value = !!props.address
      
      // Wait for both resources to load
      if (!defaultCountry.data) {
        await defaultCountry.reload()
      }
      if (!countryMap.data) {
        await countryMap.reload()
      }

      // Initialize address document
      _address.doc = {
        address_type: 'Billing',
        ...(props.address ? {} : {
          // For new address, set default country
          country: __(countryMap.data?.[defaultCountry.data] || defaultCountry.data || 'Russian Federation')
        }),
        ...props.address
      }
    } else {
      // Reset address document when the modal closes
      _address.doc = {}
    }
  },
  { immediate: true }
)

function openQuickEntryModal() {
  showQuickEntryModal.value = true
  quickEntryProps.value = { doctype: 'Address' }
  nextTick(() => {
    show.value = false
  })
}
</script>
