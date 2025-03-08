<template>
  <ActivityHeader
    v-model="tabIndex"
    v-model:showWhatsappTemplates="showWhatsappTemplates"
    v-model:showFilesUploader="showFilesUploader"
    :tabs="tabs"
    :title="title"
    :doc="doc"
    :emailBox="emailBox"
    :whatsappBox="whatsappBox"
    :avitoBox="avitoBox"
    :modalRef="modalRef"
  />
  <FadedScrollableDiv
    ref="scrollContainer"
    :maskHeight="30"
    class="flex flex-col flex-1 overflow-y-auto dark-scrollbar"
    @scroll="handleScroll"
  >
    <div
      v-if="isLoadingMore"
      class="flex items-center justify-center py-4"
    >
      <LoadingIndicator class="h-6 w-6" />
      <span class="ml-2 text-ink-gray-4">{{ __('Loading more...') }}</span>
    </div>

    <div
      v-if="all_activities?.loading && !activities?.length"
      class="flex flex-1 flex-col items-center justify-center gap-3 text-xl font-medium text-ink-gray-4"
    >
      <LoadingIndicator class="h-6 w-6" />
      <span>{{ __('Loading...') }}</span>
    </div>

    <div
      v-else-if="
        activities?.length ||
        (whatsappMessages.data?.length && title == 'WhatsApp') ||
        (avitoMessages.data?.length && title == 'Avito')
      "
      class="activities"
    >
      <div v-if="title == 'WhatsApp' && whatsappMessages.data?.length">
        <WhatsAppArea
          class="px-3 sm:px-10"
          v-model="whatsappMessages"
          v-model:reply="replyMessage"
          :messages="whatsappMessages.data"
        />
      </div>
      <div v-else-if="title == 'Avito' && avitoMessages.data?.length">
        <AvitoArea
          class="px-3 sm:px-10"
          v-model="avitoMessages"
          v-model:reply="replyMessage"
          :messages="avitoMessages.data"
        />
      </div>
      <div
        v-else-if="title == 'Notes'"
        class="grid grid-cols-1 gap-4 px-3 pb-3 sm:px-10 sm:pb-5 lg:grid-cols-2 xl:grid-cols-3"
      >
        <div v-for="note in activities" @click="modalRef.showNote(note)">
          <NoteArea :note="note" v-model="all_activities" />
        </div>
      </div>
      <div v-else-if="title == 'Comments'" class="pb-5">
        <div v-for="(comment, i) in activities">
          <div
            class="activity grid grid-cols-[30px_minmax(auto,_1fr)] gap-2 px-3 sm:gap-4 sm:px-10"
          >
            <div
              class="relative flex justify-center after:absolute after:left-[50%] after:top-0 after:-z-10 after:border-l after:border-outline-gray-modals"
              :class="i != activities.length - 1 ? 'after:h-full' : 'after:h-4'"
            >
              <div
                class="z-10 flex h-8 w-7 items-center justify-center bg-surface-white"
              >
                <CommentIcon class="text-ink-gray-8" />
              </div>
            </div>
            <CommentArea class="mb-4" :activity="comment" />
          </div>
        </div>
      </div>
      <div v-else-if="title == 'Tasks'" class="px-3 pb-3 sm:px-10 sm:pb-5">
        <TaskArea v-if="modalRef" :modalRef="modalRef" :tasks="activities" :doctype="doctype" />
      </div>
      <div v-else-if="title == 'Calls'" class="activity">
        <div v-for="(call, i) in activities">
          <div
            class="activity grid grid-cols-[30px_minmax(auto,_1fr)] gap-4 px-3 sm:px-10"
          >
            <div
              class="relative flex justify-center after:absolute after:left-[50%] after:top-0 after:-z-10 after:border-l after:border-outline-gray-modals"
              :class="i != activities.length - 1 ? 'after:h-full' : 'after:h-4'"
            >
              <div
                class="z-10 flex h-8 w-7 items-center justify-center bg-surface-white text-ink-gray-8"
              >
                <MissedCallIcon
                  v-if="call.status == 'No Answer'"
                  class="text-ink-red-4"
                />
                <DeclinedCallIcon v-else-if="call.status == 'Busy'" />
                <component
                  v-else
                  :is="
                    call.type == 'Incoming' ? InboundCallIcon : OutboundCallIcon
                  "
                />
              </div>
            </div>
            <CallArea class="mb-4" :activity="call" />
          </div>
        </div>
      </div>
      <div
        v-else-if="title == 'Attachments'"
        class="px-3 pb-3 sm:px-10 sm:pb-5"
      >
        <AttachmentArea
          :attachments="activities"
          @reload="all_activities.reload() && scroll()"
        />
      </div>
      <div
        v-else
        v-for="(activity, i) in activities"
        :key="activity.name || activity.creation"
        class="activity px-3 sm:px-10"
        :class="
          ['Activity', 'Emails'].includes(title)
            ? 'grid grid-cols-[30px_minmax(auto,_1fr)] gap-2 sm:gap-4'
            : ''
        "
      >
        <div
          v-if="['Activity', 'Emails'].includes(title)"
          class="relative flex justify-center before:absolute before:left-[50%] before:top-0 before:-z-10 before:border-l before:border-outline-gray-modals"
          :class="[i != activities.length - 1 ? 'before:h-full' : 'before:h-4']"
        >
          <div
            class="z-10 flex h-7 w-7 items-center justify-center bg-surface-white"
            :class="{
              'mt-2.5': ['communication'].includes(activity.activity_type),
              'bg-surface-white': ['added', 'removed', 'changed'].includes(
                activity.activity_type,
              ),
              'h-8': [
                'comment',
                'communication',
                'incoming_call',
                'outgoing_call',
              ].includes(activity.activity_type),
            }"
          >
            <UserAvatar
              v-if="activity.activity_type == 'communication'"
              :user="activity.data.sender"
              size="md"
            />
            <MissedCallIcon
              v-else-if="
                ['incoming_call', 'outgoing_call'].includes(
                  activity.activity_type,
                ) && activity.status == 'No Answer'
              "
              class="text-ink-red-4"
            />
            <DeclinedCallIcon
              v-else-if="
                ['incoming_call', 'outgoing_call'].includes(
                  activity.activity_type,
                ) && activity.status == 'Busy'
              "
            />
            <component
              v-else
              :is="activity.icon"
              :class="
                ['added', 'removed', 'changed'].includes(activity.activity_type)
                  ? 'text-ink-gray-4'
                  : 'text-ink-gray-8'
              "
            />
          </div>
        </div>
        <div
          v-if="activity.activity_type == 'communication'"
          class="pb-5 mt-px"
        >
          <EmailArea :activity="activity" :emailBox="emailBox" />
        </div>
        <div
          class="mb-4"
          :id="activity.name"
          v-else-if="activity.activity_type == 'comment'"
        >
          <CommentArea :activity="activity" />
        </div>
        <div
          class="mb-4 flex flex-col gap-2 py-1.5"
          :id="activity.name"
          v-else-if="activity.activity_type == 'attachment_log'"
        >
          <div class="flex items-center justify-stretch gap-2 text-base">
            <div
              class="inline-flex items-center flex-wrap gap-1.5 text-ink-gray-8 font-medium"
            >
              <span class="font-medium">{{ activity.owner_name }}</span>
              <span class="text-ink-gray-5">{{ __(activity.data.type) }}</span>
              <a
                v-if="activity.data.file_url"
                :href="activity.data.file_url"
                target="_blank"
              >
                <span>{{ activity.data.file_name }}</span>
              </a>
              <span v-else>{{ activity.data.file_name }}</span>
              <FeatherIcon
                v-if="activity.data.is_private"
                name="lock"
                class="size-3"
              />
            </div>
            <div class="ml-auto whitespace-nowrap">
              <Tooltip :text="formatActivityDate(activity.creation, 'MMM D, YYYY h:mm A')">
                <div class="text-sm text-ink-gray-5">
                  {{ timeAgo(activity.creation) }}
                </div>
              </Tooltip>
            </div>
          </div>
        </div>
        <div
          v-else-if="
            activity.activity_type == 'incoming_call' ||
            activity.activity_type == 'outgoing_call'
          "
          class="mb-4"
        >
          <CallArea :activity="activity" />
        </div>
        <div v-else class="mb-4 flex flex-col gap-2 py-1.5">
          <div class="flex items-center justify-stretch gap-2 text-base">
            <div
              v-if="activity.other_versions"
              class="inline-flex flex-wrap gap-1.5 text-ink-gray-8 font-medium"
            >
              <span>{{ activity.show_others ? __('Hide') : __('Show') }}</span>
              <span> +{{ activity.other_versions.length + 1 }} </span>
              <span>{{ __('changes from') }}</span>
              <span>{{ activity.owner_name }}</span>
              <Button
                class="!size-4"
                variant="ghost"
                @click="activity.show_others = !activity.show_others"
              >
                <template #icon>
                  <SelectIcon />
                </template>
              </Button>
            </div>
            <div
              v-else
              class="inline-flex items-center flex-wrap gap-1 text-ink-gray-5"
            >
              <span class="font-medium text-ink-gray-8">
                {{ activity.owner_name }}
              </span>
              <span v-if="activity.type">{{ activity.type }}</span>
              <span
                v-if="activity.data.field_label"
                class="max-w-xs truncate font-medium text-ink-gray-8"
              >
                {{ __(activity.data.field_label) }}
              </span>
              <span v-if="activity.value">{{ activity.value }}</span>
              <span
                v-if="activity.data.old_value"
                class="max-w-xs font-medium text-ink-gray-8"
              >
                <div
                  class="flex items-center gap-1"
                  v-if="activity.options == 'User'"
                >
                  <UserAvatar :user="activity.data.old_value" size="xs" />
                  {{ getUser(activity.data.old_value).full_name }}
                </div>
                <div class="truncate" v-else>
                  {{ activity.data.old_value }}
                </div>
              </span>
              <span v-if="activity.to">{{ __('to') }}</span>
              <span
                v-if="activity.data.value"
                class="max-w-xs font-medium text-ink-gray-8"
              >
                <div
                  class="flex items-center gap-1"
                  v-if="activity.options == 'User'"
                >
                  <UserAvatar :user="activity.data.value" size="xs" />
                  {{ getUser(activity.data.value).full_name }}
                </div>
                <div class="truncate" v-else>
                  {{ activity.data.value }}
                </div>
              </span>
            </div>

            <div class="ml-auto whitespace-nowrap">
              <Tooltip :text="formatActivityDate(activity.creation, 'MMM D, YYYY h:mm A')">
                <div class="text-sm text-ink-gray-5">
                  {{ timeAgo(activity.creation) }}
                </div>
              </Tooltip>
            </div>
          </div>
          <div
            v-if="activity.other_versions && activity.show_others"
            class="flex flex-col gap-0.5"
          >
            <div
              v-for="activity in [activity, ...activity.other_versions]"
              class="flex items-start justify-stretch gap-2 py-1.5 text-base"
            >
              <div class="inline-flex flex-wrap gap-1 text-ink-gray-5">
                <span
                  v-if="activity.data.field_label"
                  class="max-w-xs truncate text-ink-gray-5"
                >
                  {{ __(activity.data.field_label) }}
                </span>
                <FeatherIcon
                  name="arrow-right"
                  class="mx-1 h-4 w-4 text-ink-gray-5"
                />
                <span v-if="activity.type">
                  {{ startCase(__(activity.type)) }}
                </span>
                <span
                  v-if="activity.data.old_value"
                  class="max-w-xs font-medium text-ink-gray-8"
                >
                  <div
                    class="flex items-center gap-1"
                    v-if="activity.options == 'User'"
                  >
                    <UserAvatar :user="activity.data.old_value" size="xs" />
                    {{ getUser(activity.data.old_value).full_name }}
                  </div>
                  <div class="truncate" v-else>
                    {{ activity.data.old_value }}
                  </div>
                </span>
                <span v-if="activity.to">{{ __('to', 'change activityto') }}</span>
                <span
                  v-if="activity.data.value"
                  class="max-w-xs font-medium text-ink-gray-8"
                >
                  <div
                    class="flex items-center gap-1"
                    v-if="activity.options == 'User'"
                  >
                    <UserAvatar :user="activity.data.value" size="xs" />
                    {{ getUser(activity.data.value).full_name }}
                  </div>
                  <div class="truncate" v-else>
                    {{ activity.data.value }}
                  </div>
                </span>
              </div>

              <div class="ml-auto whitespace-nowrap">
                <Tooltip :text="formatActivityDate(activity.creation, 'MMM D, YYYY h:mm A')">
                  <div class="text-sm text-ink-gray-5">
                    {{ timeAgo(activity.creation) }}
                  </div>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="title == 'Data'" class="h-full flex flex-col px-3 sm:px-10">
      <DataFields :doctype="doctype" :docname="doc.data.name" />
    </div>
    <div
      v-else
      class="flex flex-1 flex-col items-center justify-center gap-3 text-xl font-medium text-ink-gray-4"
    >
      <component :is="emptyTextIcon" class="h-10 w-10" />
      <span>{{ __(emptyText) }}</span>
      <Button
        v-if="title == 'Calls'"
        :label="__('Make a Call')"
        @click="makeCall(doc.data.mobile_no)"
      />
      <Button
        v-else-if="title == 'Notes'"
        :label="__('Create Note')"
        @click="modalRef.showNote()"
      />
      <Button
        v-else-if="title == 'Emails'"
        :label="__('New Email')"
        @click="emailBox.show = true"
      />
      <Button
        v-else-if="title == 'Comments'"
        :label="__('New Comment')"
        @click="emailBox.showComment = true"
      />
      <Button
        v-else-if="title == 'Tasks'"
        :label="__('Create Task')"
        @click="modalRef.showTask()"
      />
      <Button
        v-else-if="title == 'Attachments'"
        :label="__('Upload Attachment')"
        @click="showFilesUploader = true"
      />
    </div>
  </FadedScrollableDiv>
  <div>
    <CommunicationArea
      ref="emailBox"
      v-if="['Emails', 'Comments', 'Activity'].includes(title)"
      v-model="doc"
      v-model:reload="reload_email"
      :doctype="doctype"
      @scroll="scroll"
    />
    <WhatsAppBox
      ref="whatsappBox"
      v-if="title == 'WhatsApp'"
      v-model="doc"
      v-model:reply="replyMessage"
      v-model:whatsapp="whatsappMessages"
      :doctype="doctype"
      @scroll="scroll"
    />
    <AvitoBox
      ref="avitoBox"
      v-if="title == 'Avito'"
      v-model="doc"
      v-model:reply="replyMessage"
      v-model:avito="avitoMessages"
      :doctype="doctype"
      @scroll="scroll"
    />
  </div>
  <WhatsappTemplateSelectorModal
    v-if="whatsappEnabled"
    v-model="showWhatsappTemplates"
    :doctype="doctype"
    @send="(t) => sendTemplate(t)"
  />
  <AllModals
    ref="modalRef"
    v-model="all_activities"
    :doctype="doctype"
    :doc="doc"
  />
  <FilesUploader
    v-if="doc.data?.name"
    v-model="showFilesUploader"
    :doctype="doctype"
    :docname="doc.data.name"
    @after="
      () => {
        all_activities.reload()
        changeTabTo('attachments')
      }
    "
  />
</template>
<script setup>
import ActivityHeader from '@/components/Activities/ActivityHeader.vue'
import EmailArea from '@/components/Activities/EmailArea.vue'
import CommentArea from '@/components/Activities/CommentArea.vue'
import CallArea from '@/components/Activities/CallArea.vue'
import NoteArea from '@/components/Activities/NoteArea.vue'
import TaskArea from '@/components/Activities/TaskArea.vue'
import AttachmentArea from '@/components/Activities/AttachmentArea.vue'
import DataFields from '@/components/Activities/DataFields.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import ActivityIcon from '@/components/Icons/ActivityIcon.vue'
import Email2Icon from '@/components/Icons/Email2Icon.vue'
import DetailsIcon from '@/components/Icons/DetailsIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import AttachmentIcon from '@/components/Icons/AttachmentIcon.vue'
import WhatsAppIcon from '@/components/Icons/WhatsAppIcon.vue'
import WhatsAppArea from '@/components/Activities/WhatsAppArea.vue'
import WhatsAppBox from '@/components/Activities/WhatsAppBox.vue'
import AvitoIcon from '@/components/Icons/AvitoIcon.vue'
import AvitoArea from '@/components/Activities/AvitoArea.vue'
import AvitoBox from '@/components/Activities/AvitoBox.vue'
import LoadingIndicator from '@/components/Icons/LoadingIndicator.vue'
import LeadsIcon from '@/components/Icons/LeadsIcon.vue'
import DealsIcon from '@/components/Icons/DealsIcon.vue'
import DotIcon from '@/components/Icons/DotIcon.vue'
import CommentIcon from '@/components/Icons/CommentIcon.vue'
import SelectIcon from '@/components/Icons/SelectIcon.vue'
import MissedCallIcon from '@/components/Icons/MissedCallIcon.vue'
import DeclinedCallIcon from '@/components/Icons/DeclinedCallIcon.vue'
import InboundCallIcon from '@/components/Icons/InboundCallIcon.vue'
import OutboundCallIcon from '@/components/Icons/OutboundCallIcon.vue'
import FadedScrollableDiv from '@/components/FadedScrollableDiv.vue'
import CommunicationArea from '@/components/CommunicationArea.vue'
import WhatsappTemplateSelectorModal from '@/components/Modals/WhatsappTemplateSelectorModal.vue'
import AllModals from '@/components/Activities/AllModals.vue'
import FilesUploader from '@/components/FilesUploader/FilesUploader.vue'
import { timeAgo, formatDate, startCase } from '@/utils'
import { globalStore } from '@/stores/global'
import { usersStore } from '@/stores/users'
import { contactsStore } from '@/stores/contacts'
import { whatsappEnabled } from '@/composables/settings'
import { avitoEnabled } from '@/composables/avito'
import { capture } from '@/telemetry'
import { Button, Tooltip, createResource } from 'frappe-ui'
import { useElementVisibility, useDebounceFn } from '@vueuse/core'
import {
  ref,
  computed,
  h,
  markRaw,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
} from 'vue'
import { useRoute } from 'vue-router'
import { filterEmailActivities } from '@/utils/activity_filters'
import { translateDealStatus } from '@/utils/dealStatusTranslations'
import { translateLeadStatus } from '@/utils/leadStatusTranslations'
import dayjs from '@/utils/dayjs'

const { makeCall, $socket } = globalStore()
const { getUser } = usersStore()
const { getContact, getLeadContact } = contactsStore()

const props = defineProps({
  doctype: {
    type: String,
    default: 'CRM Lead',
  },
  tabs: {
    type: Array,
    default: () => [],
  },
})

const route = useRoute()

const doc = defineModel()
const reload = defineModel('reload')
const tabIndex = defineModel('tabIndex')

const reload_email = ref(false)
const modalRef = ref(null)
const showFilesUploader = ref(false)

const title = computed(() => props.tabs?.[tabIndex.value]?.name || 'Activity')

const changeTabTo = (tabName) => {
  const tabNames = props.tabs?.map((tab) => tab.name?.toLowerCase())
  const index = tabNames?.indexOf(tabName)
  if (index == -1) return
  tabIndex.value = index
}

const scrollContainer = ref(null)
const isLoadingMore = ref(false)
const noMoreActivities = ref(false)

const all_activities = createResource({
  url: 'crm.api.activities.get_activities',
  params: { 
    name: doc.value.data.name,
    limit: 20,
    offset: 0
  },
  cache: ['activity', doc.value.data.name],
  auto: true,
  transform: ([versions, calls, notes, tasks, attachments]) => {
    return { versions, calls, notes, tasks, attachments }
  },
})

const reloadDebounced = useDebounceFn(() => {
  all_activities.reload()
}, 1000)

function handleScroll(e) {
  const el = e.target
  const threshold = 100 // pixels from top
  const isNearTop = el.scrollTop <= threshold
  
  if (isNearTop && !isLoadingMore.value && !noMoreActivities.value) {
    loadMore()
  }
}

async function loadMore() {
  if (isLoadingMore.value || noMoreActivities.value) return
  
  // If we don't have any initial data and we're not in the Activity tab, 
  // we should mark as no more activities
  if (!all_activities.data && title.value !== 'Activity') {
    noMoreActivities.value = true
    return
  }
  
  isLoadingMore.value = true
  
  // Calculate total length based on the current tab
  let currentLength = 0
  if (title.value === 'Activity') {
    currentLength = (all_activities.data?.versions?.length || 0) + (all_activities.data?.calls?.length || 0)
  } else if (title.value === 'Emails') {
    currentLength = all_activities.data?.versions?.filter(a => 
      a.activity_type === 'communication' && 
      a.communication_medium !== 'Phone' && 
      a.communication_medium !== 'Chat'
    )?.length || 0
  } else if (title.value === 'Comments') {
    currentLength = all_activities.data?.versions?.filter(a => a.activity_type === 'comment')?.length || 0
  } else if (title.value === 'Calls') {
    currentLength = all_activities.data?.calls?.length || 0
  } else if (title.value === 'Tasks') {
    currentLength = all_activities.data?.tasks?.length || 0
  } else if (title.value === 'Notes') {
    currentLength = all_activities.data?.notes?.length || 0
  } else if (title.value === 'Attachments') {
    currentLength = all_activities.data?.attachments?.length || 0
  }
  
  try {
    const result = await createResource({
      url: 'crm.api.activities.get_activities',
      params: {
        name: doc.value.data.name,
        limit: 20,
        offset: currentLength
      }
    }).submit()

    const [versions, calls, notes, tasks, attachments] = result
    
    // Check if we have any new data based on the current tab
    let hasNewData = false
    if (title.value === 'Activity') {
      hasNewData = versions?.length > 0 || calls?.length > 0
    } else if (title.value === 'Emails') {
      hasNewData = versions?.some(a => 
        a.activity_type === 'communication' && 
        a.communication_medium !== 'Phone' && 
        a.communication_medium !== 'Chat'
      )
    } else if (title.value === 'Comments') {
      hasNewData = versions?.some(a => a.activity_type === 'comment')
    } else if (title.value === 'Calls') {
      hasNewData = calls?.length > 0
    } else if (title.value === 'Tasks') {
      hasNewData = tasks?.length > 0
    } else if (title.value === 'Notes') {
      hasNewData = notes?.length > 0
    } else if (title.value === 'Attachments') {
      hasNewData = attachments?.length > 0
    }

    if (!hasNewData) {
      noMoreActivities.value = true
      return
    }

    // Merge new activities with existing ones
    const mergeUniqueById = (existing = [], newItems = []) => {
      if (!Array.isArray(existing) || !Array.isArray(newItems)) return existing || []
      const merged = [...(existing || [])]
      newItems.forEach(item => {
        if (!merged.find(e => e.name === item.name)) {
          merged.push(item)
        }
      })
      return merged
    }

    // Save current scroll position
    const scrollEl = scrollContainer.value.$el
    const oldScrollHeight = scrollEl.scrollHeight
    const oldScrollTop = scrollEl.scrollTop

    all_activities.data = all_activities.data || {}
    all_activities.data.versions = mergeUniqueById(all_activities.data.versions, versions)
    all_activities.data.calls = mergeUniqueById(all_activities.data.calls, calls)
    all_activities.data.notes = mergeUniqueById(all_activities.data.notes, notes)
    all_activities.data.tasks = mergeUniqueById(all_activities.data.tasks, tasks)
    all_activities.data.attachments = mergeUniqueById(all_activities.data.attachments, attachments)

    // After data is updated and DOM is re-rendered, restore scroll position
  nextTick(() => {
      const newScrollHeight = scrollEl.scrollHeight
      const heightDiff = newScrollHeight - oldScrollHeight
      scrollEl.scrollTop = oldScrollTop + heightDiff
    })

  } catch (error) {
    console.error('Error loading more activities:', error)
  } finally {
    isLoadingMore.value = false
  }
}

function sendTemplate(template) {
  showWhatsappTemplates.value = false
  capture('send_whatsapp_template', { doctype: props.doctype })
  createResource({
    url: 'crm.api.whatsapp.send_whatsapp_template',
    params: {
      reference_doctype: props.doctype,
      reference_name: doc.value.data.name,
      to: doc.value.data.mobile_no,
      template,
    },
    auto: true,
  })
}

const replyMessage = ref({})

function get_activities() {
  if (!all_activities.data?.versions) return []
  if (!all_activities.data?.calls.length)
    return all_activities.data.versions || []
  return [...all_activities.data.versions, ...all_activities.data.calls]
}

const activities = computed(() => {
  if (!all_activities.data) return []
  
  let _activities = []
  if (title.value == 'Activity') {
    _activities = get_activities()
  } else if (title.value == 'Emails') {
    _activities = all_activities.data.versions?.filter(
      (activity) => activity.activity_type === 'communication' && 
         activity.communication_medium !== 'Phone' && 
         activity.communication_medium !== 'Chat',
    ) || []
    if (!_activities.length) {
      noMoreActivities.value = true
    }
  } else if (title.value == 'Comments') {
    _activities = all_activities.data.versions?.filter(
      (activity) => activity.activity_type === 'comment',
    ) || []
    if (!_activities.length) {
      noMoreActivities.value = true
    }
  } else if (title.value == 'Calls') {
    const calls = sortByCreation(all_activities.data.calls || [])
    if (!calls.length) {
      noMoreActivities.value = true
    }
    return calls
  } else if (title.value == 'Tasks') {
    const tasks = sortByModified(all_activities.data.tasks || [])
    if (!tasks.length) {
      noMoreActivities.value = true
    }
    return tasks
  } else if (title.value == 'Notes') {
    const notes = sortByModified(all_activities.data.notes || [])
    if (!notes.length) {
      noMoreActivities.value = true
    }
    return notes
  } else if (title.value == 'Attachments') {
    const attachments = sortByModified(all_activities.data.attachments || [])
    if (!attachments.length) {
      noMoreActivities.value = true
    }
    return attachments
  }

  if (_activities.length) {
  _activities.forEach((activity) => {
    activity.icon = timelineIcon(activity.activity_type, activity.is_lead)

    if (
      activity.activity_type == 'incoming_call' ||
      activity.activity_type == 'outgoing_call' ||
      activity.activity_type == 'communication'
    )
      return

    update_activities_details(activity)

    if (activity.other_versions) {
      activity.show_others = false
      activity.other_versions.forEach((other_version) => {
        update_activities_details(other_version)
      })
    }
  })
  return sortByCreation(_activities)
  }
  
  noMoreActivities.value = true
  return []
})

function sortByCreation(list) {
  return list.sort((a, b) => new Date(a.creation) - new Date(b.creation))
}
function sortByModified(list) {
  return list.sort((b, a) => new Date(a.modified) - new Date(b.modified))
}

function update_activities_details(activity) {
  activity.owner_name = getUser(activity.owner).full_name
  activity.type = ''
  activity.value = ''
  activity.to = ''

  if (activity.activity_type == 'creation') {
    activity.type = activity.data
  } else if (activity.activity_type == 'added') {
    activity.type = __('added', 'activity type')
    activity.value = __('as', 'activity value')
  } else if (activity.activity_type == 'removed') {
    activity.type = __('removed', 'activity type')
    activity.value = __('value', 'activity value' )
  } else if (activity.activity_type == 'changed') {
    activity.type = __('changed', 'activity type')
    activity.value = __('from', 'activity value')
    activity.to = __('to', 'activity value')

    // Translate status values if the field is 'status'
    if (activity.data.field_label === 'Status') {
      if (activity.data.old_value) {
        activity.data.old_value = props.doctype === 'CRM Lead' 
          ? translateLeadStatus(activity.data.old_value)
          : translateDealStatus(activity.data.old_value)
      }
      if (activity.data.value) {
        activity.data.value = props.doctype === 'CRM Lead'
          ? translateLeadStatus(activity.data.value)
          : translateDealStatus(activity.data.value)
      }
    }
  }
}

const emptyText = computed(() => {
  let text = __('No Activities')
  if (title.value == 'Emails') {
    text = __('No Email Communications')
  } else if (title.value == 'Comments') {
    text = __('No Comments')
  } else if (title.value == 'Data') {
    text = __('No Data')
  } else if (title.value == 'Calls') {
    text = __('No Call Logs')
  } else if (title.value == 'Notes') {
    text = __('No Notes')
  } else if (title.value == 'Tasks') {
    text = __('No Tasks')
  } else if (title.value == 'Attachments') {
    text = __('No Attachments')
  } else if (title.value == 'WhatsApp') {
    text = __('No WhatsApp Messages')
  } else if (title.value == 'Avito') {
    text = __('No Avito Messages')
  }
  return text
})

const emptyTextIcon = computed(() => {
  let icon = ActivityIcon
  if (title.value == 'Emails') {
    icon = Email2Icon
  } else if (title.value == 'Comments') {
    icon = CommentIcon
  } else if (title.value == 'Data') {
    icon = DetailsIcon
  } else if (title.value == 'Calls') {
    icon = PhoneIcon
  } else if (title.value == 'Notes') {
    icon = NoteIcon
  } else if (title.value == 'Tasks') {
    icon = TaskIcon
  } else if (title.value == 'Attachments') {
    icon = AttachmentIcon
  } else if (title.value == 'WhatsApp') {
    icon = WhatsAppIcon
  } else if (title.value == 'Avito') {
    icon = AvitoIcon
  }
  return h(icon, { class: 'text-ink-gray-4' })
})

function timelineIcon(activity_type, is_lead) {
  let icon
  switch (activity_type) {
    case 'creation':
      icon = is_lead ? LeadsIcon : DealsIcon
      break
    case 'deal':
      icon = DealsIcon
      break
    case 'comment':
      icon = CommentIcon
      break
    case 'incoming_call':
      icon = InboundCallIcon
      break
    case 'outgoing_call':
      icon = OutboundCallIcon
      break
    case 'attachment_log':
      icon = AttachmentIcon
      break
    default:
      icon = DotIcon
  }

  return markRaw(icon)
}

const emailBox = ref(null)
const whatsappBox = ref(null)
const avitoBox = ref(null)

watch([reload, reload_email], ([reload_value, reload_email_value]) => {
  if (reload_value || reload_email_value) {
    all_activities.reload()
    reload.value = false
    reload_email.value = false
  }
})

function scroll(hash) {
  if (['tasks', 'notes'].includes(route.hash?.slice(1))) return
  setTimeout(() => {
    let el
    if (!hash) {
      let e = document.getElementsByClassName('activity')
      el = e[e.length - 1]
    } else {
      el = document.getElementById(hash)
    }
    if (el && !useElementVisibility(el).value) {
      el.scrollIntoView({ behavior: 'smooth' })
      el.focus()
    }
  }, 500)
}

function formatActivityDate(date, format) {
  if (!date) return ''
  return dayjs(date).format(format)
}

const showWhatsappTemplates = ref(false)

const whatsappMessages = createResource({
  url: 'crm.api.whatsapp.get_whatsapp_messages',
  cache: ['whatsapp_messages', doc.value.data.name],
  params: {
    reference_doctype: props.doctype,
    reference_name: doc.value.data.name,
  },
  auto: true,
  transform: (data) => sortByCreation(data),
  onSuccess: () => nextTick(() => scroll()),
})

const avitoMessages = createResource({
  url: 'crm.api.avito.get_avito_messages',
  cache: ['avito_messages', doc.value.data.name],
  params: {
    reference_doctype: props.doctype,
    reference_name: doc.value.data.name,
  },
  auto: true,
  transform: (data) => sortByCreation(data),
  onSuccess: () => nextTick(() => scroll()),
})

onBeforeUnmount(() => {
  $socket.off('whatsapp_message')
  $socket.off('avito_message')
  $socket.off('activity_update')
})

onMounted(() => {
  // Setup socket event handlers
  const handleWhatsAppMessage = (data) => {
    if (data.reference_doctype === props.doctype && 
        data.reference_name === doc.value.data.name) {
      whatsappMessages.reload()
      reloadDebounced()
    }
  }

  const handleAvitoMessage = (data) => {
    if (data.reference_doctype === props.doctype && 
        data.reference_name === doc.value.data.name) {
      avitoMessages.reload()
      reloadDebounced()
    }
  }

  // Attach event listeners
  $socket.on('whatsapp_message', handleWhatsAppMessage)
  $socket.on('avito_message', handleAvitoMessage)

  // Initial scroll setup
  nextTick(() => {
    const hash = route.hash.slice(1) || null
    let tabNames = props.tabs?.map((tab) => tab.name)
    if (!tabNames?.includes(hash)) {
      scroll(hash)
    }
  })

  // Scroll to bottom to show latest activities
  nextTick(() => {
    if (scrollContainer.value) {
      const el = scrollContainer.value.$el
      el.scrollTop = el.scrollHeight
    }
  })
})

// Update scroll position after tab change
watch(title, () => {
  noMoreActivities.value = false
  isLoadingMore.value = false
  nextTick(() => {
    if (scrollContainer.value) {
      const el = scrollContainer.value.$el
      el.scrollTop = el.scrollHeight
    }
  })
})

defineExpose({ emailBox, all_activities })
</script>

<style>
.activities {
  scroll-behavior: smooth;
}
</style>
