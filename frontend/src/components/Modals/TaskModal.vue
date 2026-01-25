<template>
  <Dialog v-model="show" :options="{ size: 'xl' }">
    <template #body-title>
      <div class="flex items-center gap-3">
        <h3 class="text-2xl font-semibold leading-6 text-ink-gray-9">
          {{ editMode ? __('Edit task') : __('Create task') }}
        </h3>
        <Button
          v-if="_task?.reference_docname"
          size="sm"
          :label="
            task.reference_doctype == 'CRM Deal'
              ? __('Open deal')
              : __('Open lead')
          "
          :iconRight="ArrowUpRightIcon"
          @click="redirect()"
        />
      </div>
    </template>
    <template #body-content>
      <div class="flex flex-col gap-4">
        <div>
          <FormControl
            ref="title"
            :label="__('Title')"
            v-model="_task.title"
            :placeholder="__('Call with John Doe')"
            required
          />
        </div>
        <div>
          <div class="mb-1.5 text-xs text-ink-gray-5">
            {{ __('Description') }}
          </div>
          <TextEditor
            variant="outline"
            ref="description"
            editor-class="!prose-sm overflow-auto min-h-[180px] max-h-80 py-1.5 px-2 rounded border border-[--surface-gray-2] bg-surface-gray-2 placeholder-ink-gray-4 hover:border-outline-gray-modals hover:bg-surface-gray-3 hover:shadow-sm focus:bg-surface-white focus:border-outline-gray-4 focus:shadow-sm focus:ring-0 focus-visible:ring-2 focus-visible:ring-outline-gray-3 text-ink-gray-8 transition-colors"
            :bubbleMenu="true"
            :content="_task.description"
            @change="(val) => (_task.description = val)"
            :placeholder="
              __('Took a call with John Doe and discussed the new project.')
            "
          />
        </div>
        <div
          :class="[
            'gap-2',
            isMobileView
              ? 'grid grid-cols-2'
              : 'flex flex-wrap items-center'
          ]"
        >
          <div
            :class="[
              isMobileView && 'justify-self-start',
            ]"
          >
            <Dropdown :options="taskStatusOptions(updateTaskStatus)">
              <Button :label="translateTaskStatus(extractValue(_task.status))">
                <template #prefix>
                  <TaskStatusIcon :status="extractValue(_task.status)" />
                </template>
              </Button>
            </Dropdown>
          </div>
          <div
            :class="[
              !isMobileView && 'flex-1 min-w-0',
              isMobileView && 'justify-self-end flex justify-end',
            ]"
          >
            <Link
              class="form-control"
              :class="isMobileView && 'w-fit'"
              :value="getUser(_task.assigned_to).full_name"
              doctype="User"
              @change="(option) => (_task.assigned_to = option)"
              :placeholder="__('John Doe')"
              :filters="{
                name: ['in', users.data.crmUsers?.map((user) => user.name)],
              }"
              :hideMe="true"
            >
              <template #prefix>
                <UserAvatar class="mr-2 !h-4 !w-4" :user="_task.assigned_to" />
              </template>
              <template #item-prefix="{ option }">
                <UserAvatar class="mr-2" :user="option.value" size="sm" />
              </template>
              <template #item-label="{ option }">
                <Tooltip :text="option.value">
                  <div class="cursor-pointer">
                    {{ getUser(option.value).full_name }}
                  </div>
                </Tooltip>
              </template>
            </Link>
          </div>
          <div
            :class="[
              isMobileView && 'justify-self-start',
            ]"
          >
            <Dropdown :options="taskPriorityOptions(updateTaskPriority)">
              <Button :label="translateTaskPriority(extractValue(_task.priority))">
                <template #prefix>
                  <TaskPriorityIcon :priority="extractValue(_task.priority)" />
                </template>
              </Button>
            </Dropdown>
          </div>
          <div
            :class="[
              !isMobileView && 'w-36',
              isMobileView && 'justify-self-end flex justify-end',
            ]"
          >
            <input
              type="date"
              class="border border-[--surface-gray-2] bg-surface-gray-2 rounded px-2 py-1.5 text-ink-gray-8 focus:border-outline-gray-4 focus:ring-0"
              :class="isMobileView ? 'w-fit' : 'w-full'"
              v-model="_task.due_date"
              @click.stop
            />
          </div>
        </div>
        <ErrorMessage class="mt-4" v-if="error" :message="__(error)" />
      </div>
    </template>
    <template #actions>
      <div class="flex justify-end">
        <Button
          :label="editMode ? __('Update') : __('Create')"
          variant="solid"
          @click="updateTask"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import TaskStatusIcon from '@/components/Icons/TaskStatusIcon.vue'
import TaskPriorityIcon from '@/components/Icons/TaskPriorityIcon.vue'
import ArrowUpRightIcon from '@/components/Icons/ArrowUpRightIcon.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import Link from '@/components/Controls/Link.vue'
import { taskStatusOptions, taskPriorityOptions, extractValue } from '@/utils'
import { translateTaskStatus } from '@/utils/taskStatusTranslations'
import { translateTaskPriority } from '@/utils/taskPriorityTranslations'
import { usersStore } from '@/stores/users'
import { capture } from '@/telemetry'
import { TextEditor, Dropdown, Tooltip, call } from 'frappe-ui'
import { useOnboarding } from '@/components/custom-ui/onboarding/onboarding'
import { isMobileView } from '@/composables/settings'
import { ref, watch, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  task: {
    type: Object,
    default: {},
  },
  doctype: {
    type: String,
    default: 'CRM Lead',
  },
  doc: {
    type: String,
    default: '',
  },
})

const show = defineModel()
const tasks = defineModel('reloadTasks')

const emit = defineEmits(['updateTask', 'after'])

const router = useRouter()
const { users, getUser } = usersStore()
const { updateOnboardingStep } = useOnboarding('frappecrm')

const error = ref(null)
const title = ref(null)
const editMode = ref(false)
const _task = ref({
  title: '',
  description: '',
  assigned_to: '',
  due_date: '',
  status: 'Backlog',
  priority: 'Low',
  reference_doctype: props.doctype,
  reference_docname: null,
})

function updateTaskStatus(status) {
  _task.value.status = extractValue(status)
}

function updateTaskPriority(priority) {
  _task.value.priority = extractValue(priority)
}

function redirect() {
  if (!_task.value?.reference_docname) return
  let name = _task.value.reference_doctype == 'CRM Deal' ? 'Deal' : 'Lead'
  let params = { leadId: _task.value.reference_docname }
  if (name == 'Deal') {
    params = { dealId: _task.value.reference_docname }
  }
  router.push({ name: name, params: params })
}

async function updateTask() {
  if (!_task.value.assigned_to) {
    _task.value.assigned_to = getUser().name
  }
  if (_task.value.name) {
    let d = await call('frappe.client.set_value', {
      doctype: 'CRM Task',
      name: _task.value.name,
      fieldname: _task.value,
    })
    if (d.name) {
      tasks.value?.reload()
      emit('after', d)
    }
  } else {
    let d = await call(
      'frappe.client.insert',
      {
        doc: {
          doctype: 'CRM Task',
          ...(props.doc ? {
            reference_doctype: props.doctype,
            reference_docname: props.doc,
          } : {}),
          ..._task.value,
        },
      },
      {
        onError: (err) => {
          if (err.error.exc_type == 'MandatoryError') {
            error.value = __('Title is mandatory')
          }
        },
      },
    )
    if (d.name) {
      updateOnboardingStep('create_first_task')
      capture('task_created')
      tasks.value?.reload()
      emit('after', d, true)
    }
  }
  show.value = false
}

function render() {
  editMode.value = false
  nextTick(() => {
    title.value?.el?.focus?.()
    _task.value = { ...props.task }
    if (_task.value.title) {
      editMode.value = true
    }
  })
}

onMounted(() => show.value && render())

watch(show, (value) => {
  if (!value) return
  render()
})
</script>
