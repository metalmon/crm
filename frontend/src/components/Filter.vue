<template>
  <NestedPopover>
    <template #target>
      <div class="flex items-center">
        <Button
          :label="__('Filter')"
          :class="filters?.size ? 'rounded-r-none' : ''"
        >
          <template #prefix><FilterIcon class="h-4" /></template>
          <template v-if="filters?.size" #suffix>
            <div
              class="flex h-5 w-5 items-center justify-center rounded-[5px] bg-surface-white pt-px text-xs font-medium text-ink-gray-8 shadow-sm"
            >
              {{ filters.size }}
            </div>
          </template>
        </Button>
        <Tooltip v-if="filters?.size" :text="__('Clear all Filter')">
          <div>
            <Button
              class="rounded-l-none border-l"
              icon="x"
              @click.stop="clearfilter(false)"
            />
          </div>
        </Tooltip>
      </div>
    </template>
    <template #body="{ close }">
      <div
        class="my-2 min-w-40 rounded-lg bg-surface-modal shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none"
      >
        <div class="min-w-72 p-2 sm:min-w-[400px]">
          <div
            v-if="filters?.size"
            v-for="(f, i) in filters"
            :key="i"
            id="filter-list"
            class="mb-4 sm:mb-3"
          >
            <div v-if="isMobileView" class="flex flex-col gap-2">
              <div class="-mb-2 flex w-full items-center justify-between">
                <div class="text-base text-ink-gray-5">
                  {{ i == 0 ? __('Where') : __('And') }}
                </div>
                <Button
                  class="flex"
                  variant="ghost"
                  icon="x"
                  @click="removeFilter(i)"
                />
              </div>
              <div id="fieldname" class="w-full">
                <Autocomplete
                  :value="f.field.fieldname"
                  :options="filterableFields.data"
                  @change="(e) => updateFilter(e, i)"
                  :placeholder="__('First Name')"
                />
              </div>
              <div id="operator">
                <FormControl
                  type="select"
                  v-model="f.operator"
                  @change="(e) => updateOperator(e, f)"
                  :options="getOperators(f.field.fieldtype, f.field.fieldname)"
                  :placeholder="__('Equals')"
                />
              </div>
              <div id="value" class="w-full">
                <component
                  :is="getValueControl(f)"
                  v-model="f.value"
                  @change="(v) => updateValue(v, f)"
                  :placeholder="__('John Doe')"
                />
              </div>
            </div>
            <div v-else class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <div class="w-13 pl-2 text-end text-base text-ink-gray-5">
                  {{ i == 0 ? __('Where') : __('And') }}
                </div>
                <div id="fieldname" class="!min-w-[140px]">
                  <Autocomplete
                    :value="f.field.fieldname"
                    :options="filterableFields.data"
                    @change="(e) => updateFilter(e, i)"
                    :placeholder="__('First Name')"
                  />
                </div>
                <div id="operator">
                  <FormControl
                    type="select"
                    v-model="f.operator"
                    @change="(e) => updateOperator(e, f)"
                    :options="
                      getOperators(f.field.fieldtype, f.field.fieldname)
                    "
                    :placeholder="__('Equals')"
                  />
                </div>
                <div id="value" class="!min-w-[140px]">
                  <component
                    :is="getValueControl(f)"
                    v-model="f.value"
                    @change="(v) => updateValue(v, f)"
                    :placeholder="__('John Doe')"
                  />
                </div>
              </div>
              <Button
                class="flex"
                variant="ghost"
                icon="x"
                @click="removeFilter(i)"
              />
            </div>
          </div>
          <div
            v-else
            class="mb-3 flex h-7 items-center px-3 text-sm text-ink-gray-5"
          >
            {{ __('Empty - Choose a field to filter by') }}
          </div>
          <div class="flex items-center justify-between gap-2">
            <Autocomplete
              value=""
              :options="availableFilters"
              @change="(e) => setfilter(e)"
              :placeholder="__('First name')"
            >
              <template #target="{ togglePopover }">
                <Button
                  class="!text-ink-gray-5"
                  variant="ghost"
                  @click="togglePopover()"
                  :label="__('Add Filter')"
                >
                  <template #prefix>
                    <FeatherIcon name="plus" class="h-4" />
                  </template>
                </Button>
              </template>
            </Autocomplete>
            <Button
              v-if="filters?.size"
              class="!text-ink-gray-5"
              variant="ghost"
              :label="__('Clear all Filter')"
              @click="clearfilter(close)"
            />
          </div>
        </div>
      </div>
    </template>
  </NestedPopover>
</template>
<script setup>
import NestedPopover from '@/components/NestedPopover.vue'
import FilterIcon from '@/components/Icons/FilterIcon.vue'
import Link from '@/components/Controls/Link.vue'
import Autocomplete from '@/components/frappe-ui/Autocomplete.vue'
import {
  FormControl,
  createResource,
  Tooltip,
  DateRangePicker,
} from 'frappe-ui'
import { h, computed, onMounted } from 'vue'
import { isMobileView } from '@/composables/settings'
import { timespanOptions } from '@/utils/timeOptions'

const typeCheck = ['Check']
const typeLink = ['Link', 'Dynamic Link']
const typeNumber = ['Float', 'Int', 'Currency', 'Percent']
const typeSelect = ['Select']
const typeString = ['Data', 'Long Text', 'Small Text', 'Text Editor', 'Text']
const typeDate = ['Date', 'Datetime']

const props = defineProps({
  doctype: {
    type: String,
    required: true,
  },
  default_filters: {
    type: Object,
    default: {},
  },
})

const emit = defineEmits(['update'])

const list = defineModel()

const filterableFields = createResource({
  url: 'crm.api.doc.get_filterable_fields',
  cache: ['filterableFields', props.doctype],
  params: { doctype: props.doctype },
})

onMounted(() => {
  if (filterableFields.data?.length) return
  filterableFields.fetch()
})

const filters = computed(() => {
  if (!list.value?.data) return new Set()
  let allFilters =
    list.value?.params?.filters || list.value.data?.params?.filters
  if (!allFilters || !filterableFields.data) return new Set()
  // remove default filters
  if (props.default_filters) {
    allFilters = removeCommonFilters(props.default_filters, allFilters)
  }
  return convertFilters(filterableFields.data, allFilters)
})

const availableFilters = computed(() => {
  if (!filterableFields.data) return []

  const selectedFieldNames = new Set()
  for (const filter of filters.value) {
    selectedFieldNames.add(filter.fieldname)
  }

  return filterableFields.data.filter(
    (field) => !selectedFieldNames.has(field.fieldname),
  )
})

function removeCommonFilters(commonFilters, allFilters) {
  for (const key in commonFilters) {
    if (commonFilters.hasOwnProperty(key) && allFilters.hasOwnProperty(key)) {
      if (commonFilters[key] === allFilters[key]) {
        delete allFilters[key]
      }
    }
  }
  return allFilters
}

function convertFilters(data, allFilters) {
  let f = []
  for (let [key, value] of Object.entries(allFilters)) {
    let field = data.find((f) => f.fieldname === key)
    if (typeof value !== 'object' || !value) {
      value = ['=', value]
      if (field?.fieldtype === 'Check') {
        value = ['equals', value[1] ? 'Yes' : 'No']
      }
    }

    if (field) {
      f.push({
        field,
        fieldname: key,
        operator: oppositeOperatorMap[value[0]],
        value: value[1],
      })
    }
  }
  return new Set(f)
}

function getOperators(fieldtype, fieldname) {
  let options = []
  if (typeString.includes(fieldtype)) {
    options.push(
      ...[
        { label: __('Equals','Filter operator'), value: 'equals' },
        { label: __('Not Equals','Filter operator'), value: 'not equals' },
        { label: __('Like','Filter operator'), value: 'like' },
        { label: __('Not Like','Filter operator'), value: 'not like' },
        { label: __('In','Filter operator'), value: 'in' },
        { label: __('Not In','Filter operator'), value: 'not in' },
        { label: __('Is','Filter operator'), value: 'is' },
      ],
    )
  }
  if (fieldname === '_assign') {
    // TODO: make equals and not equals work
    options = [
      { label: __('Like','Filter operator'), value: 'like' },
      { label: __('Not Like','Filter operator'), value: 'not like' },
      { label: __('Is','Filter operator'), value: 'is' },
    ]
  }
  if (typeNumber.includes(fieldtype)) {
    options.push(
      ...[
        { label: __('Equals','Filter operator'), value: 'equals' },
        { label: __('Not Equals','Filter operator'), value: 'not equals' },
        { label: __('Like','Filter operator'), value: 'like' },
        { label: __('Not Like','Filter operator'), value: 'not like' },
        { label: __('In','Filter operator'), value: 'in' },
        { label: __('Not In','Filter operator'), value: 'not in' },
        { label: __('Is','Filter operator'), value: 'is' },
        { label: __('<',), value: '<' },
        { label: __('>',), value: '>' },
        { label: __('<='), value: '<=' },
        { label: __('>='), value: '>=' },
      ],
    )
  }
  if (typeSelect.includes(fieldtype)) {
    options.push(
      ...[
        { label: __('Equals','Filter operator'), value: 'equals' },
        { label: __('Not Equals','Filter operator'), value: 'not equals' },
        { label: __('In','Filter operator'), value: 'in' },
        { label: __('Not In','Filter operator'), value: 'not in' },
        { label: __('Is','Filter operator'), value: 'is' },
      ],
    )
  }
  if (typeLink.includes(fieldtype)) {
    options.push(
      ...[
        { label: __('Equals','Filter operator'), value: 'equals' },
        { label: __('Not Equals','Filter operator'), value: 'not equals' },
        { label: __('Like','Filter operator'), value: 'like' },
        { label: __('Not Like','Filter operator'), value: 'not like' },
        { label: __('In','Filter operator'), value: 'in' },
        { label: __('Not In','Filter operator'), value: 'not in' },
        { label: __('Is','Filter operator'), value: 'is' },
      ],
    )
  }
  if (typeCheck.includes(fieldtype)) {
    options.push(...[{ label: __('Equals','Filter operator'), value: 'equals' }])
  }
  if (['Duration'].includes(fieldtype)) {
    options.push(
      ...[
        { label: __('Like','Filter operator'), value: 'like' },
        { label: __('Not Like','Filter operator'), value: 'not like' },
        { label: __('In','Filter operator'), value: 'in' },
        { label: __('Not In','Filter operator'), value: 'not in' },
        { label: __('Is','Filter operator'), value: 'is' },
      ],
    )
  }
  if (typeDate.includes(fieldtype)) {
    options.push(
      ...[
        { label: __('Equals','Filter operator'), value: 'equals' },
        { label: __('Not Equals','Filter operator'), value: 'not equals' },
        { label: __('Is','Filter operator'), value: 'is' },
        { label: __('>','Filter operator'), value: '>' },
        { label: __('<','Filter operator'), value: '<' },
        { label: __('>='), value: '>=' },
        { label: __('<='), value: '<=' },
        { label: __('Between','Filter operator'), value: 'between' },
        { label: __('Timespan','Filter operator'), value: 'timespan' },
      ],
    )
  }
  return options
}

function getValueControl(f) {
  const { field, operator } = f
  const { fieldtype, options } = field
  if (operator == 'is') {
    return h(FormControl, {
      type: 'select',
      options: [
        {
          label: __('Set','Filter operator'),
          value: 'set',
        },
        {
          label: __('Not Set','Filter operator'),
          value: 'not set',
        },
      ],
    })
  } else if (operator == 'timespan') {
    return h(FormControl, {
      type: 'select',
      options: timespanOptions,
    })
  } else if (['like', 'not like', 'in', 'not in'].includes(operator)) {
    return h(FormControl, { type: 'text' })
  } else if (typeSelect.includes(fieldtype) || typeCheck.includes(fieldtype)) {
    const _options =
      fieldtype == 'Check' ? ['Yes', 'No'] : getSelectOptions(options)
    return h(FormControl, {
      type: 'select',
      options: _options.map((o) => ({
        label: __(o),
        value: o,
      })),
    })
  } else if (typeLink.includes(fieldtype)) {
    if (fieldtype == 'Dynamic Link') {
      return h(FormControl, { type: 'text' })
    }
    return h(Link, { class: 'form-control', doctype: options, value: f.value })
  } else if (typeNumber.includes(fieldtype)) {
    return h(FormControl, { type: 'number' })
  } else if (typeDate.includes(fieldtype) && operator == 'between') {
    return h(DateRangePicker, { value: f.value, iconLeft: '' })
  } else if (typeDate.includes(fieldtype)) {
    return h('input', {
      type: fieldtype === 'Date' ? 'date' : 'datetime-local',
      value: f.value,
      class: 'w-full rounded border border-gray-100 bg-surface-gray-2 px-2 py-1.5 text-base text-ink-gray-8 placeholder-ink-gray-4 transition-colors hover:border-outline-gray-modals hover:bg-surface-gray-3 focus:border-outline-gray-4 focus:bg-surface-white focus:shadow-sm focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-outline-gray-3',
      onInput: (e) => f.value = e.target.value
    })
  } else {
    return h(FormControl, { type: 'text' })
  }
}

function getDefaultValue(field) {
  if (typeSelect.includes(field.fieldtype)) {
    return getSelectOptions(field.options)[0]
  }
  if (typeCheck.includes(field.fieldtype)) {
    return 'Yes'
  }
  if (typeDate.includes(field.fieldtype)) {
    return null
  }
  return ''
}

function getDefaultOperator(fieldtype) {
  if (typeSelect.includes(fieldtype)) {
    return 'equals'
  }
  if (typeCheck.includes(fieldtype) || typeNumber.includes(fieldtype)) {
    return 'equals'
  }
  if (typeDate.includes(fieldtype)) {
    return 'between'
  }
  return 'like'
}

function getSelectOptions(options) {
  return options.split('\n')
}

function setfilter(data) {
  if (!data) return
  filters.value.add({
    field: {
      label: data.label,
      fieldname: data.fieldname,
      fieldtype: data.fieldtype,
      options: data.options,
    },
    fieldname: data.fieldname,
    operator: getDefaultOperator(data.fieldtype),
    value: getDefaultValue(data),
  })
  apply()
}

function updateFilter(data, index) {
  if (!data.fieldname) return

  filters.value.delete(Array.from(filters.value)[index])
  filters.value.add({
    fieldname: data.fieldname,
    operator: getDefaultOperator(data.fieldtype),
    value: getDefaultValue(data),
    field: {
      label: data.label,
      fieldname: data.fieldname,
      fieldtype: data.fieldtype,
      options: data.options,
    },
  })
  apply()
}

function removeFilter(index) {
  filters.value.delete(Array.from(filters.value)[index])
  apply()
}

function clearfilter(close) {
  filters.value.clear()
  apply()
  close && close()
}

function updateValue(value, filter) {
  value = value.target ? value.target.value : value
  if (filter.operator === 'between') {
    filter.value = [value.split(',')[0], value.split(',')[1]]
  } else {
    filter.value = value
  }
  apply()
}

function updateOperator(event, filter) {
  let oldOperatorValue = event.target._value
  let newOperatorValue = event.target.value
  filter.operator = event.target.value
  if (!isSameTypeOperator(oldOperatorValue, newOperatorValue)) {
    filter.value = getDefaultValue(filter.field)
  }
  if (newOperatorValue === 'is' || newOperatorValue === 'is not') {
    filter.value = 'set'
  }
  apply()
}

function isSameTypeOperator(oldOperator, newOperator) {
  let textOperators = [
    'equals',
    'not equals',
    'in',
    'not in',
    '>',
    '<',
    '>=',
    '<=',
  ]
  if (
    textOperators.includes(oldOperator) &&
    textOperators.includes(newOperator)
  )
    return true
  return false
}

function apply() {
  let _filters = []
  filters.value.forEach((f) => {
    _filters.push({
      fieldname: f.fieldname,
      operator: f.operator,
      value: f.value,
    })
  })
  emit('update', parseFilters(_filters))
}

function parseFilters(filters) {
  const filtersArray = Array.from(filters)
  const obj = filtersArray.map(transformIn).reduce((p, c) => {
    if (['equals', '='].includes(c.operator)) {
      p[c.fieldname] =
        c.value == 'Yes' ? true : c.value == 'No' ? false : c.value
    } else {
      p[c.fieldname] = [operatorMap[c.operator.toLowerCase()], c.value]
    }
    return p
  }, {})
  const merged = { ...obj }
  return merged
}

function transformIn(f) {
  if (f.operator.includes('like') && !f.value.includes('%')) {
    f.value = `%${f.value}%`
  }
  return f
}

const operatorMap = {
  is: 'is',
  'is not': 'is not',
  in: 'in',
  'not in': 'not in',
  equals: '=',
  'not equals': '!=',
  yes: true,
  no: false,
  like: 'LIKE',
  'not like': 'NOT LIKE',
  '>': '>',
  '<': '<',
  '>=': '>=',
  '<=': '<=',
  between: 'between',
  timespan: 'timespan',
}

const oppositeOperatorMap = {
  is: 'is',
  '=': 'equals',
  '!=': 'not equals',
  equals: 'equals',
  'is not': 'is not',
  true: 'yes',
  false: 'no',
  LIKE: 'like',
  'NOT LIKE': 'not like',
  in: 'in',
  'not in': 'not in',
  '>': '>',
  '<': '<',
  '>=': '>=',
  '<=': '<=',
  between: 'between',
  timespan: 'timespan',
}
</script>
