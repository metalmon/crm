<template>
  <LayoutHeader v-if="deal.data">
    <header
      class="relative flex h-10.5 items-center justify-between gap-2 py-2.5 pl-2"
    >
      <Breadcrumbs :items="breadcrumbs">
        <template #prefix="{ item }">
          <Icon v-if="item.icon" :icon="item.icon" class="mr-2 h-4" />
        </template>
      </Breadcrumbs>
      <div class="absolute right-0">
        <Dropdown
          v-if="document.doc"
          :options="
            statusOptions(
              'deal',
              document.statuses?.length
                ? document.statuses
                : deal.data._customStatuses,
              triggerStatusChange,
            )
          "
        >
          <template #default="{ open }">
            <Button :label="getDealStatus(document.doc.status).label">
              <template #prefix>
                <IndicatorIcon
                  :class="getDealStatus(document.doc.status).color"
                />
              </template>
              <template #suffix>
                <FeatherIcon
                  :name="open ? 'chevron-up' : 'chevron-down'"
                  class="h-4"
                />
              </template>
            </Button>
          </template>
        </Dropdown>
      </div>
    </header>
  </LayoutHeader>
  <div
    v-if="deal.data"
    class="flex h-12 items-center justify-between gap-2 border-b px-3 py-2.5"
  >
    <AssignTo
      v-model="assignees.data"
      :data="document.doc"
      doctype="CRM Deal"
    />
    <div class="flex items-center gap-2">
      <CustomActions
        v-if="deal.data._customActions?.length"
        :actions="deal.data._customActions"
      />
      <CustomActions
        v-if="document.actions?.length"
        :actions="document.actions"
      />
    </div>
  </div>
  <div v-if="deal.data" class="flex h-full overflow-hidden">
    <Tabs as="div" v-model="tabIndex" :tabs="tabs" class="overflow-auto pb-20">
      <TabList class="!px-3" />
      <TabPanel v-slot="{ tab }">
        <div v-if="tab.name == 'Details'">
          <SLASection
            v-if="deal.data.sla_status"
            v-model="deal.data"
            @updateField="updateField"
          />
          <div
            v-if="sections.data"
            class="flex flex-1 flex-col justify-between overflow-hidden"
          >
            <SidePanelLayout
              :sections="sections.data"
              doctype="CRM Deal"
              :docname="deal.data.name"
              @reload="sections.reload"
              @beforeFieldChange="beforeStatusChange"
              @afterFieldChange="reloadAssignees"
            >
              <template #actions="{ section }">
                <div v-if="section.name == 'contacts_section'" class="pr-2">
                  <Link
                    value=""
                    doctype="Contact"
                    @change="(e) => addContact(e)"
                    :onCreate="
                      (value, close) => {
                        _contact = {
                          first_name: value,
                          company_name: deal.data.organization,
                        }
                        showContactModal = true
                        close()
                      }
                    "
                  >
                    <template #target="{ togglePopover }">
                      <Button
                        class="h-7 px-3"
                        variant="ghost"
                        icon="plus"
                        @click="togglePopover()"
                      />
                    </template>
                  </Link>
                </div>
              </template>
              <template #default="{ section }">
                <div
                  v-if="section.name == 'contacts_section'"
                  class="contacts-area"
                >
                  <div
                    v-if="
                      dealContacts?.loading && dealContacts?.data?.length == 0
                    "
                    class="flex min-h-20 flex-1 items-center justify-center gap-3 text-base text-ink-gray-4"
                  >
                    <LoadingIndicator class="h-4 w-4" />
                    <span>{{ __('Loading...') }}</span>
                  </div>
                  <div
                    v-else-if="section.contacts.length"
                    v-for="(contact, i) in section.contacts"
                    :key="contact.name"
                  >
                    <div
                      class="px-2 pb-2.5"
                      :class="[i == 0 ? 'pt-5' : 'pt-2.5']"
                    >
                      <Section :opened="contact.opened">
                        <template #header="{ opened, toggle }">
                          <div
                            class="flex cursor-pointer items-center justify-between gap-2 pr-1 text-base leading-5 text-ink-gray-7"
                          >
                            <div
                              class="flex h-7 items-center gap-2 truncate"
                              @click="toggle()"
                            >
                              <Avatar
                                :label="contact.full_name"
                                :image="contact.image"
                                size="md"
                              />
                              <div class="truncate">
                                {{ contact.full_name }}
                              </div>
                              <Badge
                                v-if="contact.is_primary"
                                class="ml-2"
                                variant="outline"
                                :label="__('Primary')"
                                theme="green"
                              />
                            </div>
                            <div class="flex items-center">
                              <Dropdown :options="contactOptions(contact.name)">
                                <Button
                                  icon="more-horizontal"
                                  class="text-ink-gray-5"
                                  variant="ghost"
                                />
                              </Dropdown>
                              <Button
                                variant="ghost"
                                @click="
                                  router.push({
                                    name: 'Contact',
                                    params: { contactId: contact.name },
                                  })
                                "
                              >
                                <ArrowUpRightIcon class="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" @click="toggle()">
                                <FeatherIcon
                                  name="chevron-right"
                                  class="h-4 w-4 text-ink-gray-9 transition-all duration-300 ease-in-out"
                                  :class="{ 'rotate-90': opened }"
                                />
                              </Button>
                            </div>
                          </div>
                        </template>
                        <div
                          class="flex flex-col gap-1.5 text-base text-ink-gray-8"
                        >
                          <div class="flex items-center gap-3 pb-1.5 pl-1 pt-4">
                            <Email2Icon class="h-4 w-4" />
                            {{ contact.email }}
                          </div>
                          <div class="flex items-center gap-3 p-1 py-1.5">
                            <PhoneIcon class="h-4 w-4" />
                            {{ contact.mobile_no }}
                          </div>
                        </div>
                      </Section>
                    </div>
                    <div
                      v-if="i != section.contacts.length - 1"
                      class="mx-2 h-px border-t border-outline-gray-modals"
                    />
                  </div>
                  <div
                    v-else
                    class="flex h-20 items-center justify-center text-base text-ink-gray-5"
                  >
                    {{ __('No contacts added') }}
                  </div>
                </div>
              </template>
            </SidePanelLayout>
          </div>
        </div>
        <Activities
          v-else
          ref="activities"
          doctype="CRM Deal"
          :tabs="tabs"
          v-model:reload="reload"
          v-model:tabIndex="tabIndex"
          v-model="deal"
          @beforeSave="beforeStatusChange"
          @afterSave="reloadAssignees"
        />
      </TabPanel>
    </Tabs>
  </div>
  <div class="fixed bottom-0 left-0 right-0 flex justify-center gap-2 border-t bg-white dark:bg-gray-900 dark:border-gray-700 p-3">
    <div ref="bottomToolbar" class="flex gap-2 overflow-x-auto scrollbar-hide">
      <Button
        v-if="primaryContactMobileNo && ipTelephonyEnabled"
        size="lg"
        class="dark:text-white dark:hover:bg-gray-700 !h-10 !w-10 !p-0 flex items-center justify-center"
        @click="triggerCall"
      >
        <PhoneIcon class="h-5 w-5" />
      </Button>

      <Button
        v-if="primaryContactMobileNo && !ipTelephonyEnabled"
        size="lg"
        class="dark:text-white dark:hover:bg-gray-700 !h-10 !w-10 !p-0 flex items-center justify-center"
        @click="trackPhoneActivities('phone')"
      >
        <PhoneIcon class="h-5 w-5" />
      </Button>
      
      <Button
        v-if="primaryContactMobileNo"
        size="lg"
        class="dark:text-white dark:hover:bg-gray-700 !h-10 !w-10 !p-0 flex items-center justify-center"
        @click="trackPhoneActivities('whatsapp')"
      >
        <WhatsAppIcon class="h-5 w-5" />
      </Button>

      <Button
        v-if="dealContacts.data?.find(c => c.is_primary)?.mobile_no"
        size="lg"
        class="dark:text-white dark:hover:bg-gray-700 !h-10 !w-10 !p-0 flex items-center justify-center"
        @click="showEmailTemplateSelectorModal = true"
      >
        <CommentIcon class="h-5 w-5" />
      </Button>

      <Button
        size="lg"
        class="dark:text-white dark:hover:bg-gray-700 !h-10 !w-10 !p-0 flex items-center justify-center"
        @click="openWebsite"
      >
        <LinkIcon class="h-5 w-5" />
      </Button>
    </div>
  </div>
  <OrganizationModal
    v-if="showOrganizationModal"
    v-model="showOrganizationModal"
    :data="_organization"
    :options="{
      redirect: false,
      afterInsert: (doc) => updateField('organization', doc.name),
    }"
  />
  <ContactModal
    v-if="showContactModal"
    v-model="showContactModal"
    :contact="_contact"
    :options="{
      redirect: false,
      afterInsert: (doc) => addContact(doc.name),
    }"
  />
  <LostReasonModal
    v-if="showLostReasonModal"
    v-model="showLostReasonModal"
    :deal="document"
  />
  <EmailTemplateSelectorModal
    v-model="showEmailTemplateSelectorModal"
    :doctype="doctype"
    @apply="applyMessageTemplate"
  />
</template>
<script setup>
import Icon from '@/components/Icon.vue'
import DetailsIcon from '@/components/Icons/DetailsIcon.vue'
import LoadingIndicator from '@/components/Icons/LoadingIndicator.vue'
import ActivityIcon from '@/components/Icons/ActivityIcon.vue'
import EmailIcon from '@/components/Icons/EmailIcon.vue'
import Email2Icon from '@/components/Icons/Email2Icon.vue'
import CommentIcon from '@/components/Icons/CommentIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import AttachmentIcon from '@/components/Icons/AttachmentIcon.vue'
import WhatsAppIcon from '@/components/Icons/WhatsAppIcon.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import ArrowUpRightIcon from '@/components/Icons/ArrowUpRightIcon.vue'
import SuccessIcon from '@/components/Icons/SuccessIcon.vue'
import LinkIcon from '@/components/Icons/LinkIcon.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import Activities from '@/components/Activities/Activities.vue'
import OrganizationModal from '@/components/Modals/OrganizationModal.vue'
import LostReasonModal from '@/components/Modals/LostReasonModal.vue'
import AssignTo from '@/components/AssignTo.vue'
import ContactModal from '@/components/Modals/ContactModal.vue'
import Section from '@/components/Section.vue'
import Link from '@/components/Controls/Link.vue'
import SidePanelLayout from '@/components/SidePanelLayout.vue'
import SLASection from '@/components/SLASection.vue'
import CustomActions from '@/components/CustomActions.vue'
import { setupCustomizations } from '@/utils'
import { getView } from '@/utils/view'
import { getSettings } from '@/stores/settings'
import { globalStore } from '@/stores/global'
import { statusesStore } from '@/stores/statuses'
import { getMeta } from '@/stores/meta'
import { useDocument } from '@/data/document'
import {
  whatsappEnabled,
  callEnabled,
  ipTelephonyEnabled,
  isMobileView,
} from '@/composables/settings'
import { useActiveTabManager } from '@/composables/useActiveTabManager'
import {
  createResource,
  Dropdown,
  Avatar,
  Tabs,
  TabList,
  TabPanel,
  Breadcrumbs,
  call,
  usePageMeta,
  toast,
} from 'frappe-ui'
import { ref, computed, h, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { trackCommunication } from '@/utils/communicationUtils'
import { normalizePhoneNumber } from '@/utils/phoneUtils'
import EmailTemplateSelectorModal from '@/components/Modals/EmailTemplateSelectorModal.vue'

const { brand } = getSettings()
const { $dialog, $socket } = globalStore()
const { statusOptions, getDealStatus } = statusesStore()
const { doctypeMeta } = getMeta('CRM Deal')
const route = useRoute()
const router = useRouter()

const props = defineProps({
  dealId: {
    type: String,
    required: true,
  },
})

const deal = createResource({
  url: 'crm.fcrm.doctype.crm_deal.api.get_deal',
  params: { name: props.dealId },
  cache: ['deal', props.dealId],
  auto: true,
  onSuccess: (data) => {
    if (data.organization) {
      organization.update({
        params: { doctype: 'CRM Organization', name: data.organization },
      })
      organization.fetch()
    }

    setupCustomizations(deal, {
      doc: data,
      $dialog,
      $socket,
      router,
      toast,
      updateField,
      createToast: toast.create,
      deleteDoc: deleteDeal,
      resource: {
        deal,
        dealContacts,
        sections,
      },
      call,
    })
  },
})

const organization = createResource({
  url: 'frappe.client.get',
  onSuccess: (data) => (deal.data._organizationObj = data),
})

onMounted(() => {
  if (deal.data) return
  deal.fetch()
})

const reload = ref(false)
const showOrganizationModal = ref(false)
const _organization = ref({})

function updateDeal(fieldname, value, callback) {
  value = Array.isArray(fieldname) ? '' : value

  if (validateRequired(fieldname, value)) return

  createResource({
    url: 'frappe.client.set_value',
    params: {
      doctype: 'CRM Deal',
      name: props.dealId,
      fieldname,
      value,
    },
    auto: true,
    onSuccess: () => {
      deal.reload()
      reload.value = true
      toast.success(__('Deal updated'))
      callback?.()
    },
    onError: (err) => {
      toast.error(err.messages?.[0] || __('Error updating deal'))
    },
  })
}

function validateRequired(fieldname, value) {
  let meta = deal.data.fields_meta || {}
  if (meta[fieldname]?.reqd && !value) {
    toast.error(__('{0} is a required field', [meta[fieldname].label]))
    return true
  }
  return false
}

const displayName = computed(() => {
  if (!deal.data) return __('Loading...')
  
  if (organization.data?.name) {
    return organization.data.name
  }
  
  if (dealContacts.data) {
    const primaryContact = dealContacts.data.find(c => c.is_primary)
    if (primaryContact?.full_name) {
      return primaryContact.full_name
    }
  }
  
  return __('Untitled')
})

const primaryContactMobileNo = computed(() => {
  if (!dealContacts.data) return null
  const primaryContact = dealContacts.data.find(c => c.is_primary)
  return primaryContact?.mobile_no || null
})

const breadcrumbs = computed(() => {
  let items = [{ label: __('Deals'), route: { name: 'Deals' } }]

  if (route.query.view || route.query.viewType) {
    let view = getView(route.query.view, route.query.viewType, 'CRM Deal')
    if (view) {
      items.push({
        label: __(view.label),
        icon: view.icon,
        route: {
          name: 'Deals',
          params: { viewType: route.query.viewType },
          query: { view: route.query.view },
        },
      })
    }
  }

  items.push({
    label: displayName.value,
    route: { name: 'Deal', params: { dealId: deal.data.name } },
  })
  return items
})

const title = computed(() => {
  let t = doctypeMeta['CRM Deal']?.title_field || 'name'
  return deal.data?.[t] || props.dealId
})

usePageMeta(() => {
  return {
    title: displayName.value,
    icon: brand.favicon,
  }
})

const tabs = computed(() => {
  let tabOptions = [
    {
      name: 'Details',
      label: __('Details'),
      icon: DetailsIcon,
      condition: () => isMobileView.value,
    },
    {
      name: 'Activity',
      label: __('Activity'),
      icon: ActivityIcon,
    },
    {
      name: 'Emails',
      label: __('Emails'),
      icon: EmailIcon,
    },
    {
      name: 'Comments',
      label: __('Comments'),
      icon: CommentIcon,
    },
    {
      name: 'Data',
      label: __('Data'),
      icon: DetailsIcon,
    },
    {
      name: 'Calls',
      label: __('Calls'),
      icon: PhoneIcon,
      condition: () => callEnabled.value,
    },
    {
      name: 'Tasks',
      label: __('Tasks'),
      icon: TaskIcon,
    },
    {
      name: 'Notes',
      label: __('Notes'),
      icon: NoteIcon,
    },
    {
      name: 'Attachments',
      label: __('Attachments'),
      icon: AttachmentIcon,
    },
    {
      name: 'WhatsApp',
      label: __('WhatsApp'),
      icon: WhatsAppIcon,
      condition: () => whatsappEnabled.value,
    },
  ]
  return tabOptions.filter((tab) => (tab.condition ? tab.condition() : true))
})
const { tabIndex } = useActiveTabManager(tabs, 'lastDealTab')

const sections = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_sidepanel_sections',
  cache: ['sidePanelSections', 'CRM Deal'],
  params: { doctype: 'CRM Deal' },
  auto: true,
  transform: (data) => getParsedFields(data),
})

function getParsedFields(sections) {
  sections.forEach((section) => {
    if (section.name == 'contacts_section') return
    section.columns[0].fields.forEach((field) => {
      if (field.name == 'organization') {
        field.create = (value, close) => {
          _organization.value.organization_name = value
          showOrganizationModal.value = true
          close()
        }
        field.link = (org) =>
          router.push({
            name: 'Organization',
            params: { organizationId: org },
          })
      }
    })
  })
  return sections
}

const showContactModal = ref(false)
const _contact = ref({})

function contactOptions(contact) {
  let options = [
    {
      label: __('Delete'),
      icon: 'trash-2',
      onClick: () => removeContact(contact),
    },
  ]

  if (!contact.is_primary) {
    options.push({
      label: __('Set as Primary Contact'),
      icon: h(SuccessIcon, { class: 'h-4 w-4' }),
      onClick: () => setPrimaryContact(contact.name),
    })
  }

  return options
}

async function addContact(contact) {
  if (dealContacts.data?.find((c) => c.name === contact)) {
    toast.error(__('Contact already added'))
    return
  }

  let d = await call('crm.fcrm.doctype.crm_deal.crm_deal.add_contact', {
    deal: props.dealId,
    contact,
  })
  if (d) {
    dealContacts.reload()
    toast.success(__('Contact added'))
  }
}

async function removeContact(contact) {
  let d = await call('crm.fcrm.doctype.crm_deal.crm_deal.remove_contact', {
    deal: props.dealId,
    contact,
  })
  if (d) {
    dealContacts.reload()
    toast.success(__('Contact removed'))
  }
}

async function setPrimaryContact(contact) {
  let d = await call('crm.fcrm.doctype.crm_deal.crm_deal.set_primary_contact', {
    deal: props.dealId,
    contact,
  })
  if (d) {
    dealContacts.reload()
    toast.success(__('Primary contact set'))
  }
}

const dealContacts = createResource({
  url: 'crm.fcrm.doctype.crm_deal.api.get_deal_contacts',
  params: { name: props.dealId },
  cache: ['deal_contacts', props.dealId],
  auto: true,
  onSuccess: (data) => {
    let contactSection = sections.data?.find(
      (section) => section.name == 'contacts_section',
    )
    if (!contactSection) return
    contactSection.contacts = data.map((contact) => {
      return {
        name: contact.name,
        full_name: contact.full_name,
        email: contact.email,
        mobile_no: contact.mobile_no,
        image: contact.image,
        is_primary: contact.is_primary,
        opened: false,
      }
    })
  },
})

function updateField(name, value, callback) {
  updateDeal(name, value, () => {
    deal.data[name] = value
    callback?.()
  })
}

async function deleteDeal(name) {
  await call('frappe.client.delete', {
    doctype: 'CRM Deal',
    name,
  })
  router.push({ name: 'Deals' })
}

function trackPhoneActivities(type) {
  const primaryContact = dealContacts.data?.find(c => c.is_primary)
  if (!primaryContact?.mobile_no) {
    errorMessage(__('No phone number set'))
    return
  }
  
  trackCommunication({
    type,
    doctype: 'CRM Deal',
    docname: deal.data.name,
    phoneNumber: primaryContact.mobile_no,
    activities: activities.value,
    contactName: primaryContact.name
  })
}

function triggerCall() {
  const primaryContact = dealContacts.data?.find((c) => c.is_primary)
  const mobile_no = primaryContact?.mobile_no || null

  if (!primaryContact) {
    errorMessage(__('No primary contact set'))
    return
  }

  if (!mobile_no) {
    errorMessage(__('No mobile number set'))
    return
  }

  makeCall(mobile_no)
}

const showMessageTemplateModal = ref(false)
const activities = ref(null)

function applyMessageTemplate(template) {
  const primaryContact = dealContacts.data?.find(c => c.is_primary)
  if (!primaryContact) return errorMessage(__('No primary contact set'))
  
  trackCommunication({
    type: 'whatsapp',
    doctype: 'CRM Deal',
    docname: deal.data.name,
    phoneNumber: primaryContactMobileNo.value,
    activities: activities.value,
    contactName: primaryContact.full_name,
    message: template,
    modelValue: deal.data
  })
  showEmailTemplateSelectorModal.value = false
}


const { assignees, document, triggerOnChange } = useDocument('CRM Deal', props.dealId)

async function triggerStatusChange(value) {
  await triggerOnChange('status', value)
  setLostReason()
}

const showLostReasonModal = ref(false)

function setLostReason() {
  if (
    getDealStatus(document.doc.status).type !== 'Lost' ||
    (document.doc.lost_reason && document.doc.lost_reason !== 'Other') ||
    (document.doc.lost_reason === 'Other' && document.doc.lost_notes)
  ) {
    document.save.submit()
    return
  }

  showLostReasonModal.value = true
}

function beforeStatusChange(data) {
  if (data?.hasOwnProperty('status') && getDealStatus(data.status).type == 'Lost') {
    setLostReason()
  } else {
    document.save.submit(null, {
      onSuccess: () => reloadAssignees(data),
    })
  }
}

function reloadAssignees(data) {
  if (data?.hasOwnProperty('deal_owner')) {
    assignees.reload()
  }
}
</script>

<style scoped>
.bottom-toolbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.bottom-toolbar::-webkit-scrollbar {
  display: none;
}
</style>
