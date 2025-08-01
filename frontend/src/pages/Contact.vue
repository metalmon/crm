<template>
  <LayoutHeader v-if="contact.doc">
    <template #left-header>
      <Breadcrumbs :items="breadcrumbs">
        <template #prefix="{ item }">
          <Icon v-if="item.icon" :icon="item.icon" class="mr-2 h-4" />
        </template>
      </Breadcrumbs>
    </template>
  </LayoutHeader>
  <div v-if="contact.doc" ref="parentRef" class="flex h-full">
    <Resizer
      v-if="contact.doc"
      :parent="$refs.parentRef"
      class="flex h-full flex-col overflow-hidden border-r"
    >
      <div class="border-b">
        <FileUploader
          @success="changeContactImage"
          :validateFile="validateIsImageFile"
        >
          <template #default="{ openFileSelector, error }">
            <div class="flex flex-col items-start justify-start gap-4 p-5">
              <div class="flex gap-4 items-center">
                <div class="group relative h-15.5 w-15.5">
                  <Avatar
                    size="3xl"
                    class="h-15.5 w-15.5"
                    :label="contact.doc.full_name"
                    :image="contact.doc.image"
                  />
                  <component
                    :is="contact.doc.image ? Dropdown : 'div'"
                    v-bind="
                      contact.doc.image
                        ? {
                            options: [
                              {
                                icon: 'upload',
                                label: contact.doc.image
                                  ? __('Change image')
                                  : __('Upload image'),
                                onClick: openFileSelector,
                              },
                              {
                                icon: 'trash-2',
                                label: __('Remove image'),
                                onClick: () => changeContactImage(''),
                              },
                            ],
                          }
                        : { onClick: openFileSelector }
                    "
                    class="!absolute bottom-0 left-0 right-0"
                  >
                    <div
                      class="z-1 absolute bottom-0 left-0 right-0 flex h-14 cursor-pointer items-center justify-center rounded-b-full bg-black bg-opacity-40 pt-5 opacity-0 duration-300 ease-in-out group-hover:opacity-100"
                      style="
                        -webkit-clip-path: inset(22px 0 0 0);
                        clip-path: inset(22px 0 0 0);
                      "
                    >
                      <CameraIcon class="h-6 w-6 cursor-pointer text-white" />
                    </div>
                  </component>
                </div>
                <div class="flex flex-col gap-2 truncate text-ink-gray-9">
                  <div class="truncate text-2xl font-medium">
                    <span v-if="contact.doc.salutation">
                      {{ contact.doc.salutation + '. ' }}
                    </span>
                    <span>{{ contact.doc.full_name }}</span>
                  </div>
                  <div
                    v-if="contact.doc.company_name"
                    class="flex items-center gap-1.5 text-base text-ink-gray-8"
                  >
                    <Avatar
                      size="xs"
                      :label="contact.doc.company_name"
                      :image="
                        getOrganization(contact.doc.company_name)
                          ?.organization_logo
                      "
                    />
                    <span class="">{{ contact.doc.company_name }}</span>
                  </div>
                  <ErrorMessage :message="__(error)" />
                </div>
              </div>
              <div class="flex p-3">
                <div class="flex gap-1.5">
                  <Button
                    v-if="contact.doc.mobile_no && ipTelephonyEnabled"
                    size="sm"
                    class="dark:text-white dark:hover:bg-gray-700"
                    @click="makeCall(contact.doc.mobile_no)"
                  >
                    <template #prefix>
                      <PhoneIcon class="h-4 w-4" />
                    </template>
                    {{ __('Make Call') }}
                  </Button>

                  <Button
                    v-if="contact.doc.mobile_no && !ipTelephonyEnabled"
                    size="sm"
                    class="dark:text-white dark:hover:bg-gray-700"
                    @click="trackPhoneActivities('phone')"
                  >
                    <template #prefix>
                      <PhoneIcon class="h-4 w-4" />
                    </template>
                    {{ __('Make Call') }}
                  </Button>

                  <Button
                    v-if="contact.doc.mobile_no"
                    size="sm"
                    class="dark:text-white dark:hover:bg-gray-700"
                    @click="trackPhoneActivities('whatsapp')"
                  >
                    <template #prefix>
                      <WhatsAppIcon class="h-4 w-4" />
                    </template>
                    {{ __('Chat') }}
                  </Button>
                </div>

                <Button
                  :label="__('Delete')"
                  variant="ghost"
                  theme="red"
                  size="sm"
                  class="dark:text-red-400 dark:hover:bg-gray-700"
                  @click="deleteContact"
                >
                  <template #prefix>
                    <FeatherIcon name="trash-2" class="h-4 w-4" />
                  </template>
                  {{ __('Delete') }}  
                </Button>
              </div>
            </div>
          </template>
        </FileUploader>
      </div>
      <div
        v-if="sections.data"
        class="flex flex-1 flex-col justify-between overflow-hidden"
      >
        <SidePanelLayout
          :sections="sections.data"
          doctype="Contact"
          :docname="contact.doc.name"
          @reload="sections.reload"
        />
      </div>
    </Resizer>
    <Tabs as="div" v-model="tabIndex" :tabs="tabs">
      <template #tab-item="{ tab, selected }">
        <button
          class="group flex items-center gap-2 border-b border-transparent py-2.5 text-base text-ink-gray-5 duration-300 ease-in-out hover:border-outline-gray-3 hover:text-ink-gray-9"
          :class="{ 'text-ink-gray-9': selected }"
        >
          <component v-if="tab.icon" :is="tab.icon" class="h-5" />
          {{ __(tab.label) }}
          <Badge
            class="group-hover:bg-surface-gray-7"
            :class="[selected ? 'bg-surface-gray-7' : 'bg-gray-600']"
            variant="solid"
            theme="gray"
            size="sm"
          >
            {{ tab.count }}
          </Badge>
        </button>
      </template>
      <template #tab-panel="{ tab }">
        <DealsListView
          v-if="tab.label === 'Deals' && rows.length"
          class="mt-4"
          :rows="rows"
          :columns="columns"
          :options="{ selectable: false, showTooltip: false }"
        />
        <div
          v-if="!rows.length"
          class="grid flex-1 place-items-center text-xl font-medium text-ink-gray-4"
        >
          <div class="flex flex-col items-center justify-center space-y-3">
            <component :is="tab.icon" class="!h-10 !w-10" />
            <div>{{ __('No Deals Found') }}</div>
          </div>
        </div>
      </template>
    </Tabs>
  </div>
  <ErrorPage
    v-else-if="errorTitle"
    :errorTitle="errorTitle"
    :errorMessage="errorMessage"
  />
  <DeleteLinkedDocModal
    v-if="showDeleteLinkedDocModal"
    v-model="showDeleteLinkedDocModal"
    :doctype="'Contact'"
    :docname="contact.doc.name"
    name="Contacts"
  />
</template>

<script setup>
import ErrorPage from '@/components/ErrorPage.vue'
import Resizer from '@/components/Resizer.vue'
import Icon from '@/components/Icon.vue'
import SidePanelLayout from '@/components/SidePanelLayout.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import CameraIcon from '@/components/Icons/CameraIcon.vue'
import DealsIcon from '@/components/Icons/DealsIcon.vue'
import WhatsAppIcon from '@/components/Icons/WhatsAppIcon.vue'
import DealsListView from '@/components/ListViews/DealsListView.vue'
import { formatDate, timeAgo, validateIsImageFile } from '@/utils'
import { getView } from '@/utils/view'
import { useDocument } from '@/data/document'
import { getSettings } from '@/stores/settings'
import { getMeta } from '@/stores/meta'
import { globalStore } from '@/stores/global.js'
import { usersStore } from '@/stores/users.js'
import { organizationsStore } from '@/stores/organizations.js'
import { statusesStore } from '@/stores/statuses'
import { ipTelephonyEnabled } from '@/composables/settings'
import { showAddressModal, addressProps } from '@/composables/modals'
import { callEnabled } from '@/composables/settings'
import { trackCommunication } from '@/utils/communicationUtils'
import Activities from '@/components/Activities/Activities.vue'
import {
  Breadcrumbs,
  Avatar,
  FileUploader,
  Tabs,
  call,
  createResource,
  usePageMeta,
  Dropdown,
  toast,
} from 'frappe-ui'
import { ref, computed, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const { brand } = getSettings()
const { makeCall } = globalStore()

const { getUser } = usersStore()
const { getOrganization } = organizationsStore()
const { getDealStatus } = statusesStore()
const { doctypeMeta } = getMeta('Contact')

const props = defineProps({
  contactId: {
    type: String,
    required: true,
  },
})

const route = useRoute()
const activities = ref(null)

const errorTitle = ref('')
const errorMessage = ref('')

const { document: contact } = useDocument('Contact', props.contactId)

const breadcrumbs = computed(() => {
  let items = [{ label: __('Contacts'), route: { name: 'Contacts' } }]

  if (route.query.view || route.query.viewType) {
    let view = getView(route.query.view, route.query.viewType, 'Contact')
    if (view) {
      items.push({
        label: __(view.label),
        icon: view.icon,
        route: {
          name: 'Contacts',
          params: { viewType: route.query.viewType },
          query: { view: route.query.view },
        },
      })
    }
  }

  items.push({
    label: title.value,
    route: { name: 'Contact', params: { contactId: props.contactId } },
  })
  return items
})

const title = computed(() => {
  let t = doctypeMeta['Contact']?.title_field || 'name'
  return contact.doc?.[t] || props.contactId
})

usePageMeta(() => {
  return {
    title: title.value,
    icon: brand.favicon,
  }
})
const showDeleteLinkedDocModal = ref(false)

async function deleteContact() {
  showDeleteLinkedDocModal.value = true
}

function changeContactImage(file) {
  contact.doc.image = file?.file_url || ''
  contact.save.submit(null, {
    onSuccess: () => {
      toast.success(__('Contact image updated'))
    },
  })
}

const tabIndex = ref(0)
const tabs = [
  {
    label: 'Deals',
    icon: h(DealsIcon, { class: 'h-4 w-4' }),
    count: computed(() => deals.data?.length),
  },
]

const deals = createResource({
  url: 'crm.api.contact.get_linked_deals',
  cache: ['deals', props.contactId],
  params: {
    contact: props.contactId,
  },
  auto: true,
})

const rows = computed(() => {
  if (!deals.data || deals.data == []) return []

  return deals.data.map((row) => getDealRowObject(row))
})

const sections = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_sidepanel_sections',
  cache: ['sidePanelSections', 'Contact'],
  params: { doctype: 'Contact' },
  auto: true,
  transform: (data) => computed(() => getParsedSections(data)),
})

function getParsedSections(_sections) {
  return _sections.map((section) => {
    section.columns = section.columns.map((column) => {
      column.fields = column.fields.map((field) => {
        if (field.fieldname === 'email_id') {
          return {
            ...field,
            read_only: false,
            fieldtype: 'Dropdown',
            options:
              contact.doc?.email_ids?.map((email) => {
                return {
                  name: email.name,
                  value: email.email_id,
                  selected: email.email_id === contact.doc.email_id,
                  placeholder: 'john@doe.com',
                  onClick: () => {
                    setAsPrimary('email', email.email_id)
                  },
                  onSave: (option, isNew) => {
                    if (isNew) {
                      createNew('email', option.value)
                    } else {
                      editOption(
                        'Contact Email',
                        option.name,
                        'email_id',
                        option.value
                      )
                    }
                  },
                  onDelete: async (option, isNew) => {
                    contact.doc.email_ids = contact.doc.email_ids.filter(
                      (email) => email.name !== option.name,
                    )
                    !isNew && (await deleteOption('Contact Email', option.name))
                  },
                }
              }) || [],
            create: () => {
              contact.doc?.email_ids?.push({
                name: 'new-1',
                value: '',
                selected: false,
                isNew: true,
              })
            },
          }
        } else if (field.fieldname === 'mobile_no') {
          return {
            ...field,
            read_only: false,
            fieldtype: 'Dropdown',
            options:
              contact.doc?.phone_nos?.map((phone) => {
                return {
                  name: phone.name,
                  value: phone.phone,
                  selected: phone.phone === contact.doc.mobile_no,
                  onClick: () => {
                    setAsPrimary('mobile_no', phone.phone)
                  },
                  onSave: (option, isNew) => {
                    if (isNew) {
                      createNew('phone', option.value)
                    } else {
                      editOption(
                        'Contact Phone',
                        option.name,
                        'phone',
                        option.value
                      )
                    }
                  },
                  onDelete: async (option, isNew) => {
                    contact.doc.phone_nos = contact.doc.phone_nos.filter(
                      (phone) => phone.name !== option.name,
                    )
                    !isNew && (await deleteOption('Contact Phone', option.name))
                  },
                }
              }) || [],
            create: () => {
              contact.doc?.phone_nos?.push({
                name: 'new-1',
                value: '',
                selected: false,
                isNew: true,
              })
            },
          }
        } else if (field.fieldname === 'address') {
          return {
            ...field,
            create: (value, close) => {
              openAddressModal()
              close()
            },
            edit: (address) => openAddressModal(address),
          }
        } else {
          return field
        }
      })
      return column
    })
    return section
  })
}

async function setAsPrimary(field, value) {
  let d = await call('crm.api.contact.set_as_primary', {
    contact: contact.doc.name,
    field,
    value,
  })
  if (d) {
    contact.reload()
    toast.success(__('Contact updated'))
  }
}

async function createNew(field, value) {
  if (!value) return
  let d = await call('crm.api.contact.create_new', {
    contact: contact.doc.name,
    field,
    value,
  })
  if (d) {
    contact.reload()
    toast.success(__('Contact updated'))
  }
}

async function editOption(doctype, name, fieldname, value) {
  let d = await call('frappe.client.set_value', {
    doctype,
    name,
    fieldname,
    value,
  })
  if (d) {
    contact.reload()
    toast.success(__('Contact updated'))
  }
}

async function deleteOption(doctype, name) {
  await call('frappe.client.delete', {
    doctype,
    name,
  })
  await contact.reload()
  toast.success(__('Contact updated'))
}

const { getFormattedCurrency } = getMeta('CRM Deal')

const columns = computed(() => dealColumns)

function getDealRowObject(deal) {
  return {
    name: deal.name,
    organization: {
      label: deal.organization,
      logo: getOrganization(deal.organization)?.organization_logo,
    },
    annual_revenue: getFormattedCurrency('annual_revenue', deal),
    status: {
      label: deal.status,
      color: getDealStatus(deal.status)?.color,
    },
    email: deal.email,
    mobile_no: deal.mobile_no,
    deal_owner: {
      label: deal.deal_owner && getUser(deal.deal_owner).full_name,
      ...(deal.deal_owner && getUser(deal.deal_owner)),
    },
    modified: {
      label: formatDate(deal.modified),
      timeAgo: __(timeAgo(deal.modified)),
    },
  }
}

const dealColumns = [
  {
    label: __('Organization'),
    key: 'organization',
    width: '11rem',
  },
  {
    label: __('Amount'),
    key: 'annual_revenue',
    align: 'right',
    width: '9rem',
  },
  {
    label: __('Status'),
    key: 'status',
    width: '10rem',
  },
  {
    label: __('Email'),
    key: 'email',
    width: '12rem',
  },
  {
    label: __('Mobile no'),
    key: 'mobile_no',
    width: '11rem',
  },
  {
    label: __('Deal owner'),
    key: 'deal_owner',
    width: '10rem',
  },
  {
    label: __('Last modified'),
    key: 'modified',
    width: '8rem',
  },
]

function trackPhoneActivities(type = 'phone') {
  if (!contact.doc || !contact.doc.mobile_no) {
    toast.error(__('No phone number set'))
    return
  }

  trackCommunication({
    type,
    doctype: 'Contact',
    docname: contact.doc.name,
    phoneNumber: contact.doc.mobile_no,
    contactName: contact.doc.full_name,
  })
}

function openAddressModal(_address) {
  showAddressModal.value = true
  addressProps.value = {
    doctype: 'Address',
    address: _address,
  }
}
</script>
