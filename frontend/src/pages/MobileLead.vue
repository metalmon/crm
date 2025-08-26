<template>
  <LayoutHeader>
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
          v-if="doc"
          :options="
            statusOptions(
              'lead',
              document.statuses?.length
                ? document.statuses
                : document._statuses,
              triggerStatusChange,
            )
          "
        >
          <template #default="{ open }">
            <Button
              v-if="doc.status"
              :label="getLeadStatus(doc.status).label"
              :iconRight="open ? 'chevron-up' : 'chevron-down'"
            >
              <template #prefix>
                <IndicatorIcon :class="getLeadStatus(doc.status).color" />
              </template>
            </Button>
          </template>
        </Dropdown>
      </div>
    </header>
  </LayoutHeader>
  <div
    v-if="doc.name"
    class="flex h-12 items-center justify-between gap-2 border-b px-3 py-2.5"
  >
    <AssignTo v-model="assignees.data" doctype="CRM Lead" :docname="leadId" />
    <div class="flex items-center gap-2">
      <CustomActions
        v-if="document._actions?.length"
        :actions="document._actions"
      />
      <CustomActions
        v-if="document.actions?.length"
        :actions="document.actions"
      />
      <Button
        :label="__('Convert')"
        variant="solid"
        @click="showConvertToDealModal = true"
      />
    </div>
  </div>
  <div v-if="doc.name" class="flex h-full overflow-hidden">
        <Tabs as="div" v-model="tabIndex" :tabs="tabs" class="overflow-auto">
      <TabList class="!px-3" />
      <TabPanel v-slot="{ tab }">
        <div v-if="tab.name == 'Details'">
          <SLASection
            v-if="doc.sla_status"
            v-model="doc"
            @updateField="updateField"
          />
          <div
            v-if="sections.data"
            class="flex flex-1 flex-col justify-between overflow-hidden"
          >
            <SidePanelLayout
              :sections="sections.data"
              doctype="CRM Lead"
              :docname="leadId"
              @reload="sections.reload"
              @afterFieldChange="reloadAssignees"
            />
          </div>
        </div>
        <Activities
          v-else
          ref="activities"
          doctype="CRM Lead"
          :docname="leadId"
          :tabs="tabs"
          v-model:reload="reload"
          v-model:tabIndex="tabIndex"
          @beforeSave="saveChanges"
          @afterSave="reloadAssignees"
        />
      </TabPanel>
    </Tabs>
  </div>
  <div class="fixed bottom-0 left-0 right-0 flex justify-center gap-2 border-t bg-white dark:bg-gray-900 dark:border-gray-700 p-3">
    <div class="flex gap-2 overflow-x-auto scrollbar-hide">
      <Button
        v-if="doc?.mobile_no && ipTelephonyEnabled"
        size="lg"
        class="dark:text-white dark:hover:bg-gray-700 !h-10 !w-10 !p-0 flex items-center justify-center"
        :icon="PhoneIcon"
        @click="triggerCall"
        :title="__('Make a call')"
      />

      <Button
        v-if="doc?.mobile_no && !ipTelephonyEnabled"
        size="lg"
        class="dark:text-white dark:hover:bg-gray-700 !h-10 !w-10 !p-0 flex items-center justify-center"
        :icon="PhoneIcon"
        @click="trackPhoneActivities('phone')"
        :title="__('Call via phone app')"
      />
      
      <Button
        v-if="doc?.mobile_no"
        size="lg"
        class="dark:text-white dark:hover:bg-gray-700 !h-10 !w-10 !p-0 flex items-center justify-center"
        :icon="WhatsAppIcon"
        @click="trackPhoneActivities('whatsapp')"
        :title="__('Open WhatsApp')"
      />

      <Button
        v-if="doc?.mobile_no"
        size="lg"
        class="dark:text-white dark:hover:bg-gray-700 !h-10 !w-10 !p-0 flex items-center justify-center"
        :icon="CommentIcon"
        @click="showEmailTemplateSelectorModal = true"
        :title="__('Send WhatsApp Template')"
      />

      <Button
        v-if="doc?.website"
        size="lg"
        class="dark:text-white dark:hover:bg-gray-700 !h-10 !w-10 !p-0 flex items-center justify-center"
        :icon="LinkIcon"
        @click="openWebsite(doc.website)"
        :title="__('Go to website')"
      />
    </div>
  </div>
  <ErrorPage
    v-if="errorTitle"
    :errorTitle="errorTitle"
    :errorMessage="errorMessage"
  />
  <Dialog
    v-model="showConvertToDealModal"
    :options="{
      title: __('Convert to Deal'),
      size: 'xl',
      actions: [
        {
          label: __('Convert'),
          variant: 'solid',
          onClick: convertToDeal,
        },
      ],
    }"
  >
    <template #body-content>
      <div class="mb-4 flex items-center gap-2 text-ink-gray-5">
        <OrganizationsIcon class="h-4 w-4" />
        <label class="block text-base">{{ __('Organization') }}</label>
      </div>
      <div class="ml-6">
        <div class="flex items-center justify-between text-base">
          <div>{{ __('Choose Existing') }}</div>
          <Switch v-model="existingOrganizationChecked" />
        </div>
        <Link
          v-if="existingOrganizationChecked"
          class="form-control mt-2.5"
          variant="outline"
          size="md"
          :value="existingOrganization"
          doctype="CRM Organization"
          @change="(data) => (existingOrganization = data)"
        />
        <div v-else class="mt-2.5 text-base">
          {{
            __(
              'New organization will be created based on the data in details section',
            )
          }}
        </div>
      </div>

      <div class="mb-4 mt-6 flex items-center gap-2 text-ink-gray-5">
        <ContactsIcon class="h-4 w-4" />
        <label class="block text-base">{{ __('Contact') }}</label>
      </div>
      <div class="ml-6">
        <div class="flex items-center justify-between text-base">
          <div>{{ __('Choose Existing') }}</div>
          <Switch v-model="existingContactChecked" />
        </div>
        <Link
          v-if="existingContactChecked"
          class="form-control mt-2.5"
          variant="outline"
          size="md"
          :value="existingContact"
          doctype="Contact"
          @change="(data) => (existingContact = data)"
        />
        <div v-else class="mt-2.5 text-base">
          {{ __("New contact will be created based on the person's details") }}
        </div>
      </div>

      <!-- Added divider and FieldLayout -->
      <div v-if="dealTabs.data?.length" class="h-px w-full border-t my-6" />

      <FieldLayout
        v-if="dealTabs.data?.length"
        :tabs="dealTabs.data"
        :data="deal"
        doctype="CRM Deal"
      />
    </template>
  </Dialog>
  <EmailTemplateSelectorModal
    v-model="showEmailTemplateSelectorModal"
    :doctype="'CRM Lead'"
    @apply="applyMessageTemplate"
  />
  <DeleteLinkedDocModal
    v-if="showDeleteLinkedDocModal"
    v-model="showDeleteLinkedDocModal"
    :doctype="'CRM Lead'"
    :docname="leadId"
    name="Leads"
  />
</template>
<script setup>
import DeleteLinkedDocModal from '@/components/DeleteLinkedDocModal.vue'
import ErrorPage from '@/components/ErrorPage.vue'
import Icon from '@/components/Icon.vue'
import DetailsIcon from '@/components/Icons/DetailsIcon.vue'
import ActivityIcon from '@/components/Icons/ActivityIcon.vue'
import EmailIcon from '@/components/Icons/EmailIcon.vue'
import CommentIcon from '@/components/Icons/CommentIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import AttachmentIcon from '@/components/Icons/AttachmentIcon.vue'
import WhatsAppIcon from '@/components/Icons/WhatsAppIcon.vue'
import AvitoIcon from '@/components/Icons/AvitoIcon.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import LinkIcon from '@/components/Icons/LinkIcon.vue'
import OrganizationsIcon from '@/components/Icons/OrganizationsIcon.vue'
import ContactsIcon from '@/components/Icons/ContactsIcon.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import Activities from '@/components/Activities/Activities.vue'
import AssignTo from '@/components/AssignTo.vue'
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
import { avitoEnabled } from '@/composables/avito'
import { capture } from '@/telemetry'
import { useActiveTabManager } from '@/composables/useActiveTabManager'
import {
  createResource,
  Dropdown,
  Tabs,
  TabList,
  TabPanel,
  Switch,
  Breadcrumbs,
  call,
  usePageMeta,
  toast,
} from 'frappe-ui'
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { trackCommunication } from '@/utils/communicationUtils'
import { translateLeadStatus } from '@/utils/leadStatusTranslations'
import { translateDealStatus } from '@/utils/dealStatusTranslations'
import { findContactByEmail } from '@/utils/contactUtils'
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import EmailTemplateSelectorModal from '@/components/Modals/EmailTemplateSelectorModal.vue'

const { brand } = getSettings()
const { $dialog, $socket, makeCall } = globalStore()
const { statusOptions, getLeadStatus, getDealStatus } = statusesStore()
const { doctypeMeta } = getMeta('CRM Lead')
const route = useRoute()
const router = useRouter()

const props = defineProps({
  leadId: {
    type: String,
    required: true,
  },
})

const errorTitle = ref('')
const errorMessage = ref('')
const showDeleteLinkedDocModal = ref(false)
const showEmailTemplateSelectorModal = ref(false)

const { triggerOnChange, assignees, document, scripts, error } = useDocument(
  'CRM Lead',
  props.leadId,
)

const doc = computed(() => document.doc || {})

watch(error, (err) => {
  if (err) {
    errorTitle.value = __(
      err.exc_type == 'DoesNotExistError'
        ? 'Document not found'
        : 'Error occurred',
    )
    errorMessage.value = __(err.messages?.[0] || 'An error occurred')
  } else {
    errorTitle.value = ''
    errorMessage.value = ''
  }
})

watch(
  () => document.doc,
  async (_doc) => {
    if (scripts.data?.length) {
      let s = await setupCustomizations(scripts.data, {
        doc: _doc,
        $dialog,
        $socket,
        router,
        toast,
        updateField,
        createToast: toast.create,
        deleteDoc: deleteLead,
        call,
      })
      document._actions = s.actions || []
      document._statuses = s.statuses || []
    }
  },
  { once: true },
)

const reload = ref(false)

const breadcrumbs = computed(() => {
  let items = [{ label: __('Leads'), route: { name: 'Leads' } }]

  if (route.query.view || route.query.viewType) {
    let view = getView(route.query.view, route.query.viewType, 'CRM Lead')
    if (view) {
      items.push({
        label: __(view.label),
        icon: view.icon,
        route: {
          name: 'Leads',
          params: { viewType: route.query.viewType },
          query: { view: route.query.view },
        },
      })
    }
  }

  items.push({
    label: title.value,
    route: { name: 'Lead', params: { leadId: props.leadId } },
  })
  return items
})

const title = computed(() => {
  let t = doctypeMeta['CRM Lead']?.title_field || 'name'
  return doc.value?.[t] || props.leadId
})

usePageMeta(() => {
  return {
    title: title.value,
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
    {
      name: 'Avito',
      label: __('Avito'),
      icon: AvitoIcon,
      condition: () => avitoEnabled.value,
    },
  ]
  return tabOptions.filter((tab) => (tab.condition ? tab.condition() : true))
})

const { tabIndex } = useActiveTabManager(tabs, 'lastLeadTab')

const sections = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_sidepanel_sections',
  cache: ['sidePanelSections', 'CRM Lead'],
  params: { doctype: 'CRM Lead' },
  auto: true,
})

function updateField(name, value) {
  value = Array.isArray(name) ? '' : value
  let oldValues = Array.isArray(name) ? {} : doc.value[name]

  if (Array.isArray(name)) {
    name.forEach((field) => (doc.value[field] = value))
  } else {
    doc.value[name] = value
  }

  document.save.submit(null, {
    onSuccess: () => (reload.value = true),
    onError: (err) => {
      if (Array.isArray(name)) {
        name.forEach((field) => (doc.value[field] = oldValues[field]))
      } else {
        doc.value[name] = oldValues
      }
      toast.error(err.messages?.[0] || __('Error updating field'))
    },
  })
}

function deleteLead() {
  showDeleteLinkedDocModal.value = true
}

// Convert to Deal
const showConvertToDealModal = ref(false)
const existingContactChecked = ref(false)
const existingOrganizationChecked = ref(false)

const existingContact = ref('')
const existingOrganization = ref('')

// Added dealStatuses computed property
const dealStatuses = computed(() => {
  let statuses = statusOptions('deal')
  if (!deal.status) {
    deal.status = statuses[0].value
  }
  return statuses
})

// Added dealTabs resource
const dealTabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['RequiredFields', 'CRM Deal'],
  params: { doctype: 'CRM Deal', type: 'Required Fields' },
  auto: true,
  transform: (_tabs) => {
    let hasFields = false;
    
    const parsedTabs = _tabs.map((tab) => {
      tab.sections.forEach((section) => {
        section.columns.forEach((column) => {
          column.fields.forEach((field) => {
            hasFields = true;
            if (field.fieldname == 'status') {
              field.fieldtype = 'Select';
              field.options = dealStatuses.value.map(status => ({
                ...status,
                label: translateDealStatus(status.label)
              }));
              field.prefix = getDealStatus(deal.status).color;
            }

            if (field.fieldtype === 'Table') {
              deal[field.fieldname] = [];
            }
          });
        });
      });
      return tab;
    });
    
    return hasFields ? parsedTabs : [];
  },
})

// Watch for the modal opening
watch(showConvertToDealModal, async (newValue) => {
  if (newValue && doc.value?.email) { // Check when modal opens & email exists
    const contactName = await findContactByEmail(doc.value.email);
    if (contactName) {
      existingContact.value = contactName;
      existingContactChecked.value = true;
    } else {
      // Reset if no contact is found this time
      existingContact.value = '';
      existingContactChecked.value = false;
    }
  } else if (!newValue) {
    // Optional: Reset when modal closes, if desired
    // existingContact.value = '';
    // existingContactChecked.value = false;
  }
});

async function convertToDeal() {
  if (existingContactChecked.value && !existingContact.value) {
    toast.error(__('Please select an existing contact'))
    return
  }

  if (existingOrganizationChecked.value && !existingOrganization.value) {
    toast.error(__('Please select an existing organization'))
    return
  }

  if (!existingContactChecked.value && existingContact.value) {
    existingContact.value = ''
  }

  if (!existingOrganizationChecked.value && existingOrganization.value) {
    existingOrganization.value = ''
  }

  let deal = await call('crm.fcrm.doctype.crm_lead.crm_lead.convert_to_deal', {
    lead: props.leadId,
    deal: {},
    existing_contact: existingContact.value,
    existing_organization: existingOrganization.value,
  })
  .catch((err) => {
    toast.error(__('Error converting to deal') + ': ' + __(err.messages?.[0]))
  })

  if (_deal) {
    showConvertToDealModal.value = false
    existingContactChecked.value = false
    existingOrganizationChecked.value = false
    existingContact.value = ''
    existingOrganization.value = ''
    capture('convert_lead_to_deal')
    router.push({ name: 'Deal', params: { dealId: _deal } })
  }
}

function trackPhoneActivities(type) {
  if (!doc.value?.mobile_no) {
    toast.error(__('No phone number set'))
    return
  }
  
  trackCommunication({
    type,
    doctype: 'CRM Lead',
    docname: doc.value.name,
    phoneNumber: doc.value.mobile_no,
    activities: activities.value,
    contactName: doc.value.lead_name,
  })
}

function openWebsite(url) {
  if (!url.startsWith('http')) {
    url = 'https://' + url
  }
  window.open(url, '_blank')
}

const showMessageTemplateModal = ref(false)
const activities = ref(null)

function applyMessageTemplate(template) {
  if (!doc.value.lead_name) return errorMessage(__('Contact name not set'))
  
  trackCommunication({
    type: 'whatsapp',
    doctype: 'CRM Lead',
    docname: doc.value.name,
    phoneNumber: doc.value.mobile_no,
    activities: activities.value,
    contactName: doc.value.lead_name,
    message: template,
    modelValue: doc.value
  })
  showEmailTemplateSelectorModal.value = false
}

function triggerCall() {
  makeCall(doc.value.mobile_no)
}

async function triggerStatusChange(value) {
  await triggerOnChange('status', value)
  document.save.submit()
}

function saveChanges(data) {
  document.save.submit(null, {
    onSuccess: () => reloadAssignees(data),
  })
}

function reloadAssignees(data) {
  if (data?.hasOwnProperty('lead_owner')) {
    assignees.reload()
  }
}
</script>
