<template>
  <Dialog
    v-model="show"
    :options="{
      title: __('Assign To'),
      size: 'xl',
      actions: [
        {
          label: __('Cancel'),
          variant: 'subtle',
          onClick: () => {
            assignees = [...oldAssignees]
            show = false
          },
        },
        {
          label: __('Update'),
          variant: 'solid',
          onClick: () => updateAssignees(),
        },
      ],
    }"
    @close="
      () => {
        assignees = [...oldAssignees]
      }
    "
  >
    <template #body-content>
      <Link
        class="form-control"
        value=""
        doctype="User"
        @change="(option) => addValue(option) && ($refs.input.value = '')"
        :placeholder="__('John Doe')"
        :hideMe="true"
      >
        <template #item-prefix="{ option }">
          <UserAvatar class="mr-2" :user="option.value" size="sm" />
        </template>
        <template #item-label="{ option }">
          <Tooltip :text="option.value">
            <div class="cursor-pointer text-ink-gray-9">
              {{ getUser(option.value).full_name }}
            </div>
          </Tooltip>
        </template>
      </Link>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <Tooltip
          :text="assignee.name"
          v-for="assignee in assignees"
          :key="assignee.name"
        >
          <div>
            <Button :label="getUser(assignee.name).full_name" theme="gray">
              <template #prefix>
                <UserAvatar :user="assignee.name" size="sm" />
              </template>
              <template #suffix>
                <FeatherIcon
                  v-if="assignee.name !== owner"
                  class="h-3.5"
                  name="x"
                  @click.stop="removeValue(assignee.name)"
                />
              </template>
            </Button>
          </div>
        </Tooltip>
      </div>
      <ErrorMessage class="mt-2" v-if="error" :message="__(error)" />
    </template>
  </Dialog>
</template>

<script setup>
import UserAvatar from '@/components/UserAvatar.vue'
import Link from '@/components/Controls/Link.vue'
import { usersStore } from '@/stores/users'
import { capture } from '@/telemetry'
import { Tooltip, call } from 'frappe-ui'
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  doc: {
    type: Object,
    default: null,
  },
  docs: {
    type: Set,
    default: new Set(),
  },
  doctype: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['reload'])

const show = defineModel()
const assignees = defineModel('assignees')
const oldAssignees = ref([])

const error = ref('')

const { getUser } = usersStore()

const removeValue = (value) => {
  assignees.value = assignees.value.filter(
    (assignee) => assignee.name !== value,
  )
}

const owner = computed(() => {
  if (!props.doc) return ''
  if (props.doctype == 'CRM Lead') return props.doc.lead_owner
  return props.doc.deal_owner
})

const addValue = (value) => {
  error.value = ''
  let obj = {
    name: value,
    image: getUser(value).user_image,
    label: getUser(value).full_name,
  }
  if (!assignees.value.find((assignee) => assignee.name === value)) {
    assignees.value.push(obj)
  }
}

// Helper function to show error alerts
const showErrorAlert = (message) => {
  console.error(message)
  // Using __ function that is globally available in Frappe
  const errorMessage = window.__ ? window.__('Failed to update assignments. Please try again.') : 'Failed to update assignments. Please try again.'
  // Using the Frappe UI's toast/alert mechanism that is globally available
  if (window.frappe && window.frappe.show_alert) {
    window.frappe.show_alert({
      message: errorMessage,
      indicator: 'red'
    })
  }
}

function updateAssignees() {
  const removedAssignees = oldAssignees.value
    .filter(
      (assignee) => !assignees.value.find((a) => a.name === assignee.name),
    )
    .map((assignee) => assignee.name)

  const addedAssignees = assignees.value
    .filter(
      (assignee) => !oldAssignees.value.find((a) => a.name === assignee.name),
    )
    .map((assignee) => assignee.name)

  if (removedAssignees.length) {
    for (let a of removedAssignees) {
      call('crm.api.assignment.remove_with_retry', {
        doctype: props.doctype,
        name: props.doc.name,
        assign_to: a,
      })
        .catch(error => {
          console.error(__('Failed to unassign:'), error)
          showErrorAlert(__('Failed to unassign: {0}', [(error.message || __('Unknown error'))]))
        })
    }
  }

  if (addedAssignees.length) {
    if (props.docs.size) {
      capture('bulk_assign_to', { doctype: props.doctype })
      call('crm.api.assignment.add_multiple_with_retry', {
        doctype: props.doctype,
        name: JSON.stringify(Array.from(props.docs)),
        assign_to: addedAssignees,
        bulk_assign: true,
        re_assign: true,
      })
        .then(() => {
          emit('reload')
        })
        .catch(error => {
          console.error(__('Failed to assign:'), error)
          showErrorAlert(__('Failed to assign: {0}', [(error.message || __('Unknown error'))]))
        })
    } else {
      capture('assign_to', { doctype: props.doctype })
      call('crm.api.assignment.add_with_retry', {
        doctype: props.doctype,
        name: props.doc.name,
        assign_to: addedAssignees,
      })
        .catch(error => {
          console.error(__('Failed to assign:'), error)
          showErrorAlert(__('Failed to assign: {0}', [(error.message || __('Unknown error'))]))
        })
    }
  }
  show.value = false
}

onMounted(() => {
  oldAssignees.value = assignees.value ? [...assignees.value] : []
})
</script>
