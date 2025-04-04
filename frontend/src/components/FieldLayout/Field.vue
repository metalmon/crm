<template>
  <div v-if="field.visible" class="field">
    <div v-if="field.fieldtype != 'Check'" class="mb-2 text-sm text-ink-gray-5">
      {{ __(field.label) }}
      <span
        v-if="
          field.reqd ||
          (field.mandatory_depends_on && field.mandatory_via_depends_on)
        "
        class="text-ink-red-3"
        >*</span
      >
    </div>
    <FormControl
      v-if="field.read_only && field.fieldtype !== 'Check'"
      type="text"
      :placeholder="getPlaceholder(field)"
      v-model="data[field.fieldname]"
      :disabled="true"
    />
    <Grid
      v-else-if="field.fieldtype === 'Table'"
      v-model="data[field.fieldname]"
      :doctype="field.options"
      :parentDoctype="doctype"
    />
    <FormControl
      v-else-if="field.fieldtype === 'Select'"
      type="select"
      class="form-control"
      :class="field.prefix ? 'prefix' : ''"
      :options="field.options"
      v-model="data[field.fieldname]"
      :placeholder="getPlaceholder(field)"
    >
      <template v-if="field.prefix" #prefix>
        <IndicatorIcon :class="field.prefix" />
      </template>
    </FormControl>
    <div v-else-if="field.fieldtype == 'Check'" class="flex items-center gap-2">
      <FormControl
        class="form-control"
        type="checkbox"
        v-model="data[field.fieldname]"
        @change="(e) => (data[field.fieldname] = e.target.checked)"
        :disabled="Boolean(field.read_only)"
      />
      <label
        class="text-sm text-ink-gray-5"
        @click="
          () => {
            if (!Boolean(field.read_only)) {
              data[field.fieldname] = !data[field.fieldname]
            }
          }
        "
      >
        {{ __(field.label) }}
        <span class="text-ink-red-3" v-if="field.mandatory">*</span>
      </label>
    </div>
    <div class="flex gap-1" v-else-if="field.fieldtype === 'Link'">
      <Link
        class="form-control flex-1 truncate"
        :value="data[field.fieldname]"
        :doctype="field.options"
        :filters="field.filters"
        @change="(v) => (data[field.fieldname] = v)"
        :placeholder="getPlaceholder(field)"
        :onCreate="field.create"
      />
      <Button
        v-if="data[field.fieldname] && field.edit"
        class="shrink-0"
        :label="__('Edit')"
        @click="field.edit(data[field.fieldname])"
      >
        <template #prefix>
          <EditIcon class="h-4 w-4" />
        </template>
      </Button>
    </div>

    <TableMultiselectInput
      v-else-if="field.fieldtype === 'Table MultiSelect'"
      v-model="data[field.fieldname]"
      :doctype="field.options"
    />

    <Link
      v-else-if="field.fieldtype === 'User'"
      class="form-control"
      :value="data[field.fieldname] && getUser(data[field.fieldname]).full_name"
      :doctype="field.options"
      :filters="field.filters"
      @change="(v) => (data[field.fieldname] = v)"
      :placeholder="getPlaceholder(field)"
      :hideMe="true"
    >
      <template #prefix>
        <UserAvatar
          v-if="data[field.fieldname]"
          class="mr-2"
          :user="data[field.fieldname]"
          size="sm"
        />
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
    <input
      v-else-if="field.fieldtype === 'Datetime'"
      type="datetime-local"
      v-model="data[field.fieldname]"
      :placeholder="getPlaceholder(field)"
      class="w-full rounded border border-gray-100 bg-surface-gray-2 px-2 py-1.5 text-base text-ink-gray-8 placeholder-ink-gray-4 transition-colors hover:border-outline-gray-modals hover:bg-surface-gray-3 focus:border-outline-gray-4 focus:bg-surface-white focus:shadow-sm focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-outline-gray-3"
    />
    <input
      v-else-if="field.fieldtype === 'Date'"
      type="date"
      v-model="data[field.fieldname]"
      :placeholder="getPlaceholder(field)"
      class="w-full rounded border border-gray-100 bg-surface-gray-2 px-2 py-1.5 text-base text-ink-gray-8 placeholder-ink-gray-4 transition-colors hover:border-outline-gray-modals hover:bg-surface-gray-3 focus:border-outline-gray-4 focus:bg-surface-white focus:shadow-sm focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-outline-gray-3"
    />
    <FormControl
      v-else-if="
        ['Small Text', 'Text', 'Long Text', 'Code'].includes(field.fieldtype)
      "
      type="textarea"
      :placeholder="getPlaceholder(field)"
      v-model="data[field.fieldname]"
    />
    <FormControl
      v-else-if="['Int'].includes(field.fieldtype)"
      type="number"
      :placeholder="getPlaceholder(field)"
      v-model="data[field.fieldname]"
    />
    <FormControl
      v-else-if="field.fieldtype === 'Percent'"
      type="text"
      :value="getFormattedPercent(field.fieldname, data)"
      :placeholder="getPlaceholder(field)"
      :disabled="Boolean(field.read_only)"
      @change="data[field.fieldname] = flt($event.target.value)"
    />
    <FormControl
      v-else-if="field.fieldtype === 'Float'"
      type="text"
      :value="getFormattedFloat(field.fieldname, data)"
      :placeholder="getPlaceholder(field)"
      :disabled="Boolean(field.read_only)"
      @change="data[field.fieldname] = flt($event.target.value)"
    />
    <FormControl
      v-else-if="field.fieldtype === 'Currency'"
      type="text"
      :value="getFormattedCurrency(field.fieldname, data)"
      :placeholder="getPlaceholder(field)"
      :disabled="Boolean(field.read_only)"
      @change="data[field.fieldname] = flt($event.target.value)"
    />
    <div v-else-if="field.fieldtype === 'Attach Image'" class="w-full">
      <FileUploader
        @success="(file) => data[field.fieldname] = file.file_url"
        :validateFile="validateFile"
      >
        <template #default="{ openFileSelector }">
          <div class="flex flex-col gap-4">
            <div v-if="data[field.fieldname]" class="relative group">
              <img 
                :src="data[field.fieldname]" 
                class="w-full h-auto rounded-lg object-contain max-h-[300px]"
                alt=""
              />
              <div class="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center gap-2">
                <Button
                  variant="ghost"
                  class="text-white hover:text-white"
                  @click="openFileSelector"
                >
                  <template #prefix>
                    <CameraIcon class="h-4 w-4" />
                  </template>
                  {{ __('Change Image') }}
                </Button>
                <Button
                  variant="ghost"
                  class="text-white hover:text-white w-40"
                  @click="data[field.fieldname] = ''"
                >
                  <template #prefix>
                    <FeatherIcon name="trash-2" class="h-4 w-4" />
                  </template>
                  {{ __('Remove') }}
                </Button>
              </div>
            </div>
            <div 
              v-else
              class="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
              @click="openFileSelector"
            >
              <CameraIcon class="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <div class="text-sm text-gray-600">
                {{ __('Click to upload image') }}
              </div>
              <div class="text-xs text-gray-500 mt-1">
                {{ __('Supported formats: PNG, JPG, GIF, SVG, BMP, WebP') }}
              </div>
            </div>
          </div>
        </template>
      </FileUploader>
    </div>
    <FormControl
      v-else
      type="text"
      :placeholder="getPlaceholder(field)"
      v-model="data[field.fieldname]"
      :disabled="Boolean(field.read_only)"
    />
  </div>
</template>
<script setup>
import EditIcon from '@/components/Icons/EditIcon.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import TableMultiselectInput from '@/components/Controls/TableMultiselectInput.vue'
import Link from '@/components/Controls/Link.vue'
import Grid from '@/components/Controls/Grid.vue'
import { getFormat, evaluateDependsOnValue } from '@/utils'
import { flt } from '@/utils/numberFormat.js'
import { getMeta } from '@/stores/meta'
import { usersStore } from '@/stores/users'
import { Tooltip, FileUploader, Dropdown, Avatar, FeatherIcon } from 'frappe-ui'
import { computed, inject } from 'vue'
import CameraIcon from '@/components/Icons/CameraIcon.vue'

const props = defineProps({
  field: Object,
})

const data = inject('data')
const doctype = inject('doctype')
const preview = inject('preview')

const { getFormattedPercent, getFormattedFloat, getFormattedCurrency } =
  getMeta(doctype)
const { getUser } = usersStore()

function validateFile(file) {
  let extn = file.name.split('.').pop().toLowerCase()
  if (!['png', 'jpg', 'jpeg', 'gif', 'svg', 'bmp', 'webp'].includes(extn)) {
    return __('Only PNG, JPG, GIF, SVG, BMP and WebP images are allowed')
  }
}

const field = computed(() => {
  let field = props.field
  if (field.fieldtype == 'Select' && typeof field.options === 'string') {
    field.options = field.options.split('\n').map((option) => {
      return { label: option, value: option }
    })

    if (field.options[0].value !== '') {
      field.options.unshift({ label: '', value: '' })
    }
  }

  if (field.fieldtype === 'Link' && field.options === 'User') {
    field.fieldtype = 'User'
  }

  let _field = {
    ...field,
    filters: field.link_filters && JSON.parse(field.link_filters),
    placeholder: field.placeholder || field.label,
    display_via_depends_on: evaluateDependsOnValue(
      field.depends_on,
      data.value,
    ),
    mandatory_via_depends_on: evaluateDependsOnValue(
      field.mandatory_depends_on,
      data.value,
    ),
  }

  _field.visible = isFieldVisible(_field)
  return _field
})

function isFieldVisible(field) {
  if (preview.value) return true
  return (
    (field.fieldtype == 'Check' ||
      (field.read_only && data.value[field.fieldname]) ||
      !field.read_only) &&
    (!field.depends_on || field.display_via_depends_on) &&
    !field.hidden
  )
}

const getPlaceholder = (field) => {
  if (field.placeholder) {
    return __(field.placeholder)
  }
  if (['Select', 'Link'].includes(field.fieldtype)) {
    return __('Select {0}', [__(field.label)])
  } else {
    return __('Enter {0}', [__(field.label)])
  }
}
</script>
<style scoped>
:deep(.form-control.prefix select) {
  padding-left: 2rem;
}
</style>
