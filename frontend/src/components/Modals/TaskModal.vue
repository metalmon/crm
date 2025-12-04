<template>
  <Dialog v-model="show" :options="{ size: 'xl' }">
    <template #body-title>
      <div class="flex items-baseline gap-3">
        <h3 class="text-2xl font-semibold leading-6 text-ink-gray-9 mr-2">
          {{ editMode ? __('Edit Task') : __('Create Task') }}
        </h3>
        <Button
          v-if="task?.reference_docname"
          size="sm"
          :label="
            task.reference_doctype == 'CRM Deal'
              ? __('Open Deal')
              : __('Open Lead')
          "
          :iconRight="ArrowUpRightIcon"
          @click="redirect()"
        />
      </div>
    </template>
    <template #body-content>
      <div :class="[
        'flex flex-col gap-4 w-full',
        isMobileView && 'space-y-2'
      ]">
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
        <div :class="[
          'w-full',
          isMobileView 
            ? 'grid grid-cols-12 grid-rows-2 gap-2' 
            : 'flex items-center gap-2'
        ]">
          <Dropdown 
            :options="taskStatusOptions(updateTaskStatus)" 
            :class="[
              'min-w-0',
              isMobileView 
                ? 'col-span-5 row-start-1' 
                : 'flex'
            ]"
          >
            <Button :label="extractLabel(_task.status, translateTaskStatus)" class="justify-between w-full">
              <template #prefix>
                <TaskStatusIcon :status="extractValue(_task.status)" />
              </template>
            </Button>
          </Dropdown>
          <Link
            class="form-control min-w-0"
            :class="[
              isMobileView 
                ? 'col-span-7 row-start-1 w-full' 
                : 'flex max-w-[200px] min-w-0'
            ]"
            :value="getUser(_task.assigned_to).full_name"
            doctype="User"
            @change="(option) => (_task.assigned_to = option)"
            :placeholder="__('John Doe')"
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
                <div class="cursor-pointer text-ink-gray-9 truncate">
                  {{ getUser(option.value).full_name }}
                </div>
              </Tooltip>
            </template>
          </Link>
          <Dropdown 
            :options="taskPriorityOptions(updateTaskPriority)" 
            :class="[
              'min-w-0',
              isMobileView 
                ? 'col-span-4 row-start-2' 
                : 'flex'
            ]"
          >
            <Button :label="extractLabel(_task.priority, translateTaskPriority)" class="justify-between w-full">
              <template #prefix>
                <TaskPriorityIcon :priority="extractValue(_task.priority)" />
              </template>
            </Button>
          </Dropdown>
          <div 
            :class="[
              'min-w-0',
              isMobileView 
                ? 'col-span-8 row-start-2 w-full' 
                : 'w-36'
            ]"
          >
            <DateTimePicker
              class="datepicker"
              v-model="_task.due_date"
              :placeholder="__('01/04/2024 11:30 PM')"
              :formatter="(date) => getFormat(date, '', true, true)"
              input-class="border-none"
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
import { taskStatusOptions, taskPriorityOptions, extractValue, extractLabel, getFormat } from '@/utils'
import { usersStore } from '@/stores/users'
import { capture } from '@/telemetry'
import { TextEditor, Dropdown, Tooltip, call, DateTimePicker, ErrorMessage, FormControl, Button, Dialog } from 'frappe-ui'
import { useOnboarding } from '@/components/custom-ui/onboarding/onboarding'
import { ref, watch, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { translateTaskStatus } from '@/utils/taskStatusTranslations'
import { translateTaskPriority } from '@/utils/taskPriorityTranslations'
import { isMobileView } from '@/composables/settings'

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
  autoClose: {
    type: Boolean,
    default: true,
  },
})

const show = defineModel()
const tasks = defineModel('reloadTasks')

const emit = defineEmits(['updateTask', 'after'])

const router = useRouter()
const { getUser } = usersStore()
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
  if (!props.task?.reference_docname) return
  let name = props.task.reference_doctype == 'CRM Deal' ? 'Deal' : 'Lead'
  let params = { leadId: props.task.reference_docname }
  if (name == 'Deal') {
    params = { dealId: props.task.reference_docname }
  }
  router.push({ name: name, params: params })
}

async function updateTask() {
  if (!_task.value.assigned_to) {
    _task.value.assigned_to = getUser().name
  }
  if (_task.value.name) {
    // Extract values for select fields to ensure we send only the value, not the full object
    const updateData = {
      title: _task.value.title,
      description: _task.value.description,
      assigned_to: _task.value.assigned_to,
      due_date: _task.value.due_date,
      status: extractValue(_task.value.status),
      priority: extractValue(_task.value.priority),
    }
    
    let d = await call('frappe.client.set_value', {
      doctype: 'CRM Task',
      name: _task.value.name,
      fieldname: updateData,
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
          reference_doctype: props.doctype,
          reference_docname: props.doc || null,
          title: _task.value.title,
          description: _task.value.description,
          assigned_to: _task.value.assigned_to,
          due_date: _task.value.due_date,
          status: extractValue(_task.value.status),
          priority: extractValue(_task.value.priority),
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
  if (props.autoClose) {
    show.value = false
  }
}

function render() {
  editMode.value = false
  nextTick(() => {
    title.value?.el?.focus?.()
    // Copy task data and ensure select fields have proper values
    _task.value = { 
      ...props.task,
      status: extractValue(props.task.status),
      priority: extractValue(props.task.priority)
    }
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

<style scoped>
:deep(.datepicker svg) {
  width: 0.875rem;
  height: 0.875rem;
}
</style>
