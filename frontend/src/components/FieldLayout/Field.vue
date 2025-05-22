<template>
  <div v-if="field.visible" class="field">
    <div v-if="field.fieldtype != 'Check'" class="mb-2 text-sm text-ink-gray-5">
      {{ __(field.label) }}
      <span
        v-if="
          field.reqd ||
          (field.mandatory_depends_on && field.mandatory_via_depends_on)
        "
        class="text-ink-red-2"
        >*</span
      >
    </div>
    <FormControl
      v-if="
        field.read_only &&
        !['Int', 'Float', 'Currency', 'Percent', 'Check'].includes(
          field.fieldtype,
        )
      "
      type="text"
      :placeholder="getPlaceholder(field)"
      v-model="data[field.fieldname]"
      :disabled="true"
      :description="field.description"
    />
    <Grid
      v-else-if="field.fieldtype === 'Table'"
      v-model="data[field.fieldname]"
      v-model:parent="data"
      :doctype="field.options"
      :parentDoctype="doctype"
      :parentFieldname="field.fieldname"
    />
    <FormControl
      v-else-if="field.fieldtype === 'Select'"
      type="select"
      class="form-control"
      :class="field.prefix ? 'prefix' : ''"
      :options="translatedOptions"
      v-model="data[field.fieldname]"
      @change="(e) => fieldChange(e.target.value, field)"
      :placeholder="getPlaceholder(field)"
      :description="field.description"
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
        @change="(e) => fieldChange(e.target.checked, field)"
        :disabled="Boolean(field.read_only)"
        :description="field.description"
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
    <div
      class="flex gap-1"
      v-else-if="['Link', 'Dynamic Link'].includes(field.fieldtype)"
    >
      <Link
        class="form-control flex-1 truncate"
        :value="data[field.fieldname]"
        :doctype="
          field.fieldtype == 'Link' ? field.options : data[field.options]
        "
        :filters="field.filters"
        @change="(v) => fieldChange(v, field)"
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
      @change="(v) => fieldChange(v, field)"
    />

    <Link
      v-else-if="field.fieldtype === 'User'"
      class="form-control"
      :value="data[field.fieldname] && getUser(data[field.fieldname]).full_name"
      :doctype="field.options"
      :filters="field.filters"
      @change="(v) => fieldChange(v, field)"
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
      :value="data[field.fieldname]"
      :placeholder="getPlaceholder(field)"
      class="w-full rounded border border-gray-100 bg-surface-gray-2 px-2 py-1.5 text-base text-ink-gray-8 placeholder-ink-gray-4 transition-colors hover:border-outline-gray-modals hover:bg-surface-gray-3 focus:border-outline-gray-4 focus:bg-surface-white focus:shadow-sm focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-outline-gray-3"
      @change="(e) => fieldChange(e.target.value, field)"
    />
    <input
      v-else-if="field.fieldtype === 'Date'"
      type="date"
      :value="data[field.fieldname]"
      :placeholder="getPlaceholder(field)"
      class="w-full rounded border border-gray-100 bg-surface-gray-2 px-2 py-1.5 text-base text-ink-gray-8 placeholder-ink-gray-4 transition-colors hover:border-outline-gray-modals hover:bg-surface-gray-3 focus:border-outline-gray-4 focus:bg-surface-white focus:shadow-sm focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-outline-gray-3"
      @change="(e) => fieldChange(e.target.value, field)"
    />
    <FormControl
      v-else-if="
        ['Small Text', 'Text', 'Long Text', 'Code'].includes(field.fieldtype)
      "
      type="textarea"
      :value="data[field.fieldname]"
      :placeholder="getPlaceholder(field)"
      :description="field.description"
      @change="fieldChange($event.target.value, field)"
    />
    <Password
      v-else-if="field.fieldtype === 'Password'"
      :value="data[field.fieldname]"
      :placeholder="getPlaceholder(field)"
      :description="field.description"
      @change="fieldChange($event.target.value, field)"
    />
    <FormattedInput
      v-else-if="field.fieldtype === 'Int'"
      type="text"
      :placeholder="getPlaceholder(field)"
      :value="data[field.fieldname] || '0'"
      :disabled="Boolean(field.read_only)"
      :description="field.description"
      @change="fieldChange($event.target.value, field)"
    />
    <FormattedInput
      v-else-if="field.fieldtype === 'Percent'"
      type="text"
      :value="getFormattedPercent(field.fieldname, data)"
      :placeholder="getPlaceholder(field)"
      :disabled="Boolean(field.read_only)"
      :description="field.description"
      @change="fieldChange(flt($event.target.value), field)"
    />
    <FormattedInput
      v-else-if="field.fieldtype === 'Float'"
      type="text"
      :value="getFormattedFloat(field.fieldname, data)"
      :placeholder="getPlaceholder(field)"
      :disabled="Boolean(field.read_only)"
      :description="field.description"
      @change="fieldChange(flt($event.target.value), field)"
    />
    <FormattedInput
      v-else-if="field.fieldtype === 'Currency'"
      type="text"
      :value="getFormattedCurrency(field.fieldname, data, parentDoc)"
      :placeholder="getPlaceholder(field)"
      :disabled="Boolean(field.read_only)"
      :description="field.description"
      @change="fieldChange(flt($event.target.value), field)"
    />
    <div v-else-if="field.fieldtype === 'Attach Image'" class="w-full">
        <SingleImageUploader 
            :image-url="tempImages[field.fieldname] || data[field.fieldname]"
            :doctype="doctype"
            :docname="data.name"  
            @upload="(file_url) => { data[field.fieldname] = file_url; tempImages[field.fieldname] = null }" 
            @remove="() => { data[field.fieldname] = null; tempImages[field.fieldname] = null }" 
            @select="(file, tempUrl) => { tempImages[field.fieldname] = tempUrl }"
        />
    </div>
    <FormControl
      v-else
      type="text"
      :placeholder="getPlaceholder(field)"
      :value="data[field.fieldname]"
      :disabled="Boolean(field.read_only)"
      :description="field.description"
      @change="fieldChange($event.target.value, field)"
    />
  </div>
</template>
<script setup>
import Password from '@/components/Controls/Password.vue'
import FormattedInput from '@/components/Controls/FormattedInput.vue'
import EditIcon from '@/components/Icons/EditIcon.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import TableMultiselectInput from '@/components/Controls/TableMultiselectInput.vue'
import Link from '@/components/Controls/Link.vue'
import Grid from '@/components/Controls/Grid.vue'
import { createDocument } from '@/composables/document'
import { getFormat, evaluateDependsOnValue } from '@/utils'
import { flt } from '@/utils/numberFormat.js'
import { getMeta } from '@/stores/meta'
import { usersStore } from '@/stores/users'
import { useDocument } from '@/data/document'
import { Tooltip, DatePicker, DateTimePicker } from 'frappe-ui'
import { computed, provide, inject, ref } from 'vue'
import SingleImageUploader from '@/components/Controls/SingleImageUploader.vue'


const props = defineProps({
  field: Object,
})

const data = inject('data')
const doctype = inject('doctype')
const preview = inject('preview')
const isGridRow = inject('isGridRow')

const { getFormattedPercent, getFormattedFloat, getFormattedCurrency } =
  getMeta(doctype)

const { getUser } = usersStore()

let triggerOnChange
let parentDoc

if (!isGridRow) {
  const {
    triggerOnChange: trigger,
    triggerOnRowAdd,
    triggerOnRowRemove,
  } = useDocument(doctype, data.value.name)
  triggerOnChange = trigger

  provide('triggerOnChange', triggerOnChange)
  provide('triggerOnRowAdd', triggerOnRowAdd)
  provide('triggerOnRowRemove', triggerOnRowRemove)
} else {
  triggerOnChange = inject('triggerOnChange')
  parentDoc = inject('parentDoc')
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

  if (field.fieldtype === 'Link' && field.options !== 'User') {
    if (!field.create) {
      field.create = (value, close) => {
        const callback = (d) => {
          if (d) fieldChange(d.name, field)
        }
        createDocument(field.options, value, close, callback)
      }
    }
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
  return __(field.placeholder || field.label || field.fieldname)
}

const translatedOptions = computed(() => {
  const options = props.field.options;
  if (!options) {
      return []; // Return empty if no options
  }

  let processedOptions = [];

  if (typeof options === 'string') {
      // Handle newline-separated string options (common in Frappe)
      processedOptions = options.split('\n').filter(opt => opt.trim() !== '').map(opt => {
          const trimmedOpt = opt.trim();
          return { label: __(trimmedOpt), value: trimmedOpt }; // Add translation
      });
      // Attempt to parse if it's a string that looks like a JSON array (basic check)
      if (options.trim().startsWith('[') && options.trim().endsWith(']')) {
          try {
              const parsedOptions = JSON.parse(options);
              if (Array.isArray(parsedOptions)) {
                  processedOptions = parsedOptions.map(option => {
                      if (typeof option === 'string') {
                          return { label: __(option), value: option }; // Add translation
                      } else if (typeof option === 'object' && option !== null && 'label' in option && 'value' in option) {
                          return { label: __(option.label), value: option.value }; // Add translation
                      }
                      return option; // return unchanged if not string or {label, value}
                  });
              }
          } catch (e) {
              // If JSON parsing fails, stick with newline-separated logic result (or empty if split didn't work)
              console.warn(`Failed to parse options string as JSON for field ${props.field.fieldname}, treated as newline-separated string. Error:`, e);
          }
      }
  } else if (Array.isArray(options)) {
      // Process if it is already an array
      processedOptions = options.map(option => {
          if (typeof option === 'string') {
              // Handle simple string array element
              return { label: __(option), value: option }; // Add translation
          } else if (typeof option === 'object' && option !== null && 'label' in option && 'value' in option) {
              // Handle array of {label, value} objects
              return { label: __(option.label), value: option.value }; // Add translation
          }
          // Return other types unchanged
          return option;
      });
  } else {
       console.warn(`Unsupported options type for field ${props.field.fieldname}:`, options);
       return []; // Return empty for unsupported types
  }

   // Ensure the result is an array of {label, value} or similar structure expected by FormControl
   // Filter out any items that didn't conform
   return processedOptions.filter(opt => typeof opt === 'object' && opt !== null && 'label' in opt && 'value' in opt);
});

function fieldChange(value, df) {
  data.value[df.fieldname] = value

  if (isGridRow) {
    triggerOnChange(df.fieldname, data.value)
  } else {
    triggerOnChange(df.fieldname)
  }
}

const tempImages = ref({}) // { [fieldname]: tempUrl }
</script>
<style scoped>
:deep(.form-control.prefix select) {
  padding-left: 2rem;
}
</style>
