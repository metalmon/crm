<template>
  <div class="flex h-full flex-col gap-6 p-8">
    <div class="flex justify-between">
      <div class="flex flex-col gap-1 w-9/12">
        <h2
          class="flex gap-2 text-xl font-semibold leading-none h-5 text-ink-gray-8"
        >
          {{ __('Telephony settings') }}
          <Badge
            v-if="twilio.isDirty || exotel.isDirty || beeline.isDirty || mediumChanged"
            :label="__('Not Saved')"
            variant="subtle"
            theme="orange"
          />
        </h2>
        <p class="text-p-base text-ink-gray-6">
          {{ __('Configure telephony settings for your CRM') }}
        </p>
      </div>
      <div class="flex item-center space-x-2 w-3/12 justify-end">
        <Button
          :loading="twilio.save.loading || exotel.save.loading || beeline.save.loading"
          :label="__('Update')"
          variant="solid"
          @click="update"
        />
      </div>
    </div>
    <div
      v-if="!twilio.get.loading || !exotel.get.loading || !beeline.get.loading"
      class="flex-1 flex flex-col gap-8 overflow-y-auto dark-scrollbar"
    >
      <!-- General -->
      <FormControl
        type="select"
        v-model="defaultCallingMedium"
        :label="__('Default medium')"
        :options="callingMediumOptions"
        class="w-1/2"
        :description="__('Default calling medium for logged in user')"
      />

      <!-- Twilio -->
      <div v-if="isManager()" class="flex flex-col justify-between gap-4">
        <span class="text-base font-semibold text-ink-gray-8">
          {{ __('Twilio') }}
        </span>
        <FieldLayout
          v-if="twilio?.doc && twilioTabs"
          :tabs="twilioTabs"
          :data="twilio.doc"
          doctype="CRM Twilio Settings"
        />
      </div>

      <!-- Exotel -->
      <div v-if="isManager()" class="flex flex-col justify-between gap-4">
        <span class="text-base font-semibold text-ink-gray-8">
          {{ __('Exotel') }}
        </span>
        <FieldLayout
          v-if="exotel?.doc && exotelTabs"
          :tabs="exotelTabs"
          :data="exotel.doc"
          doctype="CRM Exotel Settings"
        />
      </div>

      <!-- Beeline -->
      <div v-if="isBeelineInstalled && isManager()" class="flex flex-col justify-between gap-4">
        <span class="text-base font-semibold text-ink-gray-8">
          {{ __('Beeline') }}
        </span>
        <FieldLayout
          v-if="beeline?.doc && beelineTabs"
          :tabs="beelineTabs"
          :data="beeline.doc"
          doctype="Beeline Settings"
        />
      </div>
    </div>
    <div v-else class="flex flex-1 items-center justify-center">
      <Spinner class="size-8" />
    </div>
    <ErrorMessage :message="twilio.save.error || exotel.save.error || beeline.save.error || error" />
  </div>
</template>
<script setup>
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import {
  createDocumentResource,
  createResource,
  FormControl,
  Spinner,
  Badge,
  ErrorMessage,
  Button,
  call,
} from 'frappe-ui'
import { defaultCallingMedium } from '@/composables/settings'
import { usersStore } from '@/stores/users'
import { toast } from 'frappe-ui'
import { getRandom } from '@/utils'
import { ref, computed, watch } from 'vue'

const { isManager, isTelephonyAgent } = usersStore()

// Resource to check if Beeline app is installed
const beelineInstalledResource = createResource({
  url: 'crm.api.telephony.is_beeline_installed',
  auto: true,
  cache: 'beeline_installed_status',
});

// Computed property based on the resource data
const isBeelineInstalled = computed(() => beelineInstalledResource.data === true);

// Computed property for calling medium options
const callingMediumOptions = computed(() => {
  const options = [
    { label: __(''), value: '' },
    { label: __('Twilio'), value: 'Twilio' },
    { label: __('Exotel'), value: 'Exotel' },
  ];
  //if (isBeelineInstalled.value) {
  //  options.push({ label: __('Beeline'), value: 'Beeline' });
  //}
  return options;
});

const twilioFields = createResource({
  url: 'crm.api.doc.get_fields',
  cache: ['fields', 'CRM Twilio Settings'],
  params: {
    doctype: 'CRM Twilio Settings',
    allow_all_fieldtypes: true,
  },
  auto: true,
})

const exotelFields = createResource({
  url: 'crm.api.doc.get_fields',
  cache: ['fields', 'CRM Exotel Settings'],
  params: {
    doctype: 'CRM Exotel Settings',
    allow_all_fieldtypes: true,
  },
  auto: true,
})

const beelineFields = createResource({
  url: 'crm.api.doc.get_fields',
  cache: ['fields', 'Beeline Settings'],
  params: {
    doctype: 'Beeline Settings',
    allow_all_fieldtypes: true,
  },
  auto: true,
})

const twilio = createDocumentResource({
  doctype: 'CRM Twilio Settings',
  name: 'CRM Twilio Settings',
  fields: ['*'],
  auto: true,
  setValue: {
    onSuccess: () => {
      toast.success(__('Twilio settings updated successfully'))
    },
    onError: (err) => {
      toast.error(err.message + ': ' + err.messages[0])
    },
  },
})

const exotel = createDocumentResource({
  doctype: 'CRM Exotel Settings',
  name: 'CRM Exotel Settings',
  fields: ['*'],
  auto: true,
  setValue: {
    onSuccess: () => {
      toast.success(__('Exotel settings updated successfully'))
    },
    onError: (err) => {
      toast.error(err.message + ': ' + err.messages[0])
    },
  },
})

const beeline = createDocumentResource({
  doctype: 'Beeline Settings',
  name: 'Beeline Settings',
  fields: ['*'],
  auto: true,
  onLoad: (doc) => {
    try {
      console.log('Beeline Settings loaded:', doc);
      console.log('beeline.doc.enabled after load:', doc?.enabled);
    } catch (e) {
      console.error('Error in beeline onLoad:', e)
    }
  },
  setValue: {
    onSuccess: () => {
      toast.success(__('Beeline settings updated successfully'))
        // Try to update scheduler frequency but don't show error to user
        try {
          const result = call({
            method: "beeline.beeline.doctype.beeline_settings.beeline_settings.update_scheduler_frequency",
            args: {}
          });
          
          if (result?.message) {
            console.log("Scheduler frequency update successful:", result.message);
          }
        } catch (err) {
          // Just log the error to console without showing toast to user
          console.warn("Non-critical error updating scheduler frequency:", err);
        }
    },
    onError: (err) => {
      toast.error(err.message + ': ' + err.messages[0])    
    },
  }
})

const twilioTabs = computed(() => {
  if (!twilioFields.data) return []
  let _tabs = []
  let fieldsData = twilioFields.data

  if (fieldsData[0].type != 'Tab Break') {
    let _sections = []
    if (fieldsData[0].type != 'Section Break') {
      _sections.push({
        name: 'first_section',
        columns: [{ name: 'first_column', fields: [] }],
      })
    }
    _tabs.push({ name: 'first_tab', sections: _sections })
  }

  fieldsData.forEach((field) => {
    let last_tab = _tabs[_tabs.length - 1]
    let _sections = _tabs.length ? last_tab.sections : []
    if (field.fieldtype === 'Tab Break') {
      _tabs.push({
        label: field.label,
        name: field.fieldname,
        sections: [
          {
            name: 'section_' + getRandom(),
            columns: [{ name: 'column_' + getRandom(), fields: [] }],
          },
        ],
      })
    } else if (field.fieldtype === 'Section Break') {
      _sections.push({
        label: field.label,
        name: field.fieldname,
        hideBorder: field.hide_border,
        columns: [{ name: 'column_' + getRandom(), fields: [] }],
      })
    } else if (field.fieldtype === 'Column Break') {
      _sections[_sections.length - 1].columns.push({
        name: field.fieldname,
        fields: [],
      })
    } else {
      let last_section = _sections[_sections.length - 1]
      let last_column = last_section.columns[last_section.columns.length - 1]
      last_column.fields.push(field)
    }
  })

  return _tabs
})

const exotelTabs = computed(() => {
  if (!exotelFields.data) return []
  let _tabs = []
  let fieldsData = exotelFields.data

  if (fieldsData[0].type != 'Tab Break') {
    let _sections = []
    if (fieldsData[0].type != 'Section Break') {
      _sections.push({
        name: 'first_section',
        columns: [{ name: 'first_column', fields: [] }],
      })
    }
    _tabs.push({ name: 'first_tab', sections: _sections })
  }

  fieldsData.forEach((field) => {
    let last_tab = _tabs[_tabs.length - 1]
    let _sections = _tabs.length ? last_tab.sections : []
    if (field.fieldtype === 'Tab Break') {
      _tabs.push({
        label: field.label,
        name: field.fieldname,
        sections: [
          {
            name: 'section_' + getRandom(),
            columns: [{ name: 'column_' + getRandom(), fields: [] }],
          },
        ],
      })
    } else if (field.fieldtype === 'Section Break') {
      _sections.push({
        label: field.label,
        name: field.fieldname,
        hideBorder: field.hide_border,
        columns: [{ name: 'column_' + getRandom(), fields: [] }],
      })
    } else if (field.fieldtype === 'Column Break') {
      _sections[_sections.length - 1].columns.push({
        name: field.fieldname,
        fields: [],
      })
    } else {
      let last_section = _sections[_sections.length - 1]
      let last_column = last_section.columns[last_section.columns.length - 1]
      last_column.fields.push(field)
    }
  })

  return _tabs
})

const beelineTabs = computed(() => {
  if (!beelineFields.data || beelineFields.data.length === 0) {
    return [];
  }

  const fieldsData = beelineFields.data;
  let _tabs = []

  // Add a default tab and section if the data doesn't start with Tab Break or Section Break
  if (fieldsData[0].fieldtype != 'Tab Break') {
    let _sections = []
    if (fieldsData[0].fieldtype != 'Section Break') {
      _sections.push({
        name: 'first_section_' + getRandom(),
        columns: [{ name: 'first_column_' + getRandom(), fields: [] }],
      })
    }
    _tabs.push({ name: 'beeline_main_tab', sections: _sections })
  }

  fieldsData.forEach((field) => {
    // Ensure there's always a tab to work with
    if (_tabs.length === 0) {
         _tabs.push({ name: 'beeline_main_tab', sections: [{ name: 'section_' + getRandom(), columns: [{ name: 'column_' + getRandom(), fields: [] }] }] })
    }
    let last_tab = _tabs[_tabs.length - 1]
    let _sections = last_tab.sections

    // Ensure there's always a section to work with
    if (_sections.length === 0) {
        _sections.push({ name: 'section_' + getRandom(), columns: [{ name: 'column_' + getRandom(), fields: [] }] })
    }

    if (field.fieldtype === 'Tab Break') {
        // Note: Beeline currently doesn't use Tab Breaks in its settings definition, but keeping for consistency
      _tabs.push({
        label: field.label,
        name: field.fieldname || 'tab_' + getRandom(),
        sections: [
          {
            name: 'section_' + getRandom(),
            columns: [{ name: 'column_' + getRandom(), fields: [] }],
          },
        ],
      })
    } else if (field.fieldtype === 'Section Break') {
      _sections.push({
        label: field.label,
        name: field.fieldname || 'section_' + getRandom(),
        hideBorder: field.hide_border,
        columns: [{ name: 'column_' + getRandom(), fields: [] }],
      })
    } else if (field.fieldtype === 'Column Break') {
      // Add a new column to the last section
      let last_section = _sections[_sections.length - 1]
      // Ensure the last section has columns array
      if (!last_section.columns) {
          last_section.columns = []
      }
      last_section.columns.push({
        name: field.fieldname || 'column_' + getRandom(),
        fields: [],
      })
    } else {
      // Add field to the last column of the last section
      let last_section = _sections[_sections.length - 1]
       // Ensure the last section has columns array
      if (!last_section.columns || last_section.columns.length === 0) {
          last_section.columns = [{ name: 'column_' + getRandom(), fields: [] }]
      }
      let last_column = last_section.columns[last_section.columns.length - 1]
      // Ensure the last column has fields array
      if (!last_column.fields) {
          last_column.fields = []
      }
      last_column.fields.push(field)
    }
  })

  // Filter out empty sections and columns potentially created by initial setup
   _tabs.forEach(tab => {
        tab.sections = tab.sections.filter(section =>
            section.columns && section.columns.some(col => col.fields && col.fields.length > 0)
        );
        tab.sections.forEach(section => {
            if (section.columns) {
                // section.columns = section.columns.filter(col => col.fields && col.fields.length > 0);
            }
        });
    });

    // Filter out empty tabs
    _tabs = _tabs.filter(tab => tab.sections && tab.sections.length > 0);


  return _tabs;
})

const mediumChanged = ref(false)

watch(defaultCallingMedium, () => {
  mediumChanged.value = true
})

function update() {
  if (!validateIfDefaultMediumIsEnabled()) return
  if (mediumChanged.value) {
    updateMedium()
  }

  if (!isManager()) return

  if (twilio.isDirty) {
    twilio.save.submit()
  }
  if (exotel.isDirty) {
    exotel.save.submit()
  }
  if (beeline.isDirty) {
    // Log value just before saving
    console.log('Saving Beeline Settings...');
    console.log('beeline.doc.enabled before save:', beeline.doc?.enabled);
    beeline.save.submit()
  }
}

async function updateMedium() {
  await call('crm.integrations.api.set_default_calling_medium', {
    medium: defaultCallingMedium.value,
  })
  mediumChanged.value = false
  error.value = ''
  toast.success(__('Default calling medium updated successfully'))
}

const error = ref('')
const twilioEnabled = ref(false)
const exotelEnabled = ref(false)
const beelineEnabled = ref(false)
const callEnabled = ref(false)

function validateIfDefaultMediumIsEnabled() {
  if (isTelephonyAgent() && !isManager()) return true

  if (defaultCallingMedium.value === 'Twilio' && !twilio.doc?.enabled) {
    error.value = __('Twilio is not enabled')
    return false
  }
  if (defaultCallingMedium.value === 'Exotel' && !exotel.doc?.enabled) {
    error.value = __('Exotel is not enabled')
    return false
  }
  if (defaultCallingMedium.value === 'Beeline' && !beeline.doc?.enabled) {
    error.value = __('Beeline is not enabled')
    return false
  }
  error.value = '';
  return true
}

createResource({
  url: 'crm.integrations.api.is_call_integration_enabled',
  cache: 'Is Call Integration Enabled',
  auto: true,
  onSuccess: (data) => {
    twilioEnabled.value = Boolean(data.twilio_enabled)
    exotelEnabled.value = Boolean(data.exotel_enabled)
    beelineEnabled.value = Boolean(data.beeline_enabled)
    defaultCallingMedium.value = data.default_calling_medium
    callEnabled.value = twilioEnabled.value || exotelEnabled.value || beelineEnabled.value
  },
  onError: (err) => {
    twilioEnabled.value = false;
    exotelEnabled.value = false;
    beelineEnabled.value = false;
    callEnabled.value = false;
  }
})
</script>
