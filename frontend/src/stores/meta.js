import { createResource } from 'frappe-ui'
import { formatCurrency, formatNumber } from '@/utils/numberFormat.js'
import { reactive } from 'vue'

const doctypeMeta = reactive({})
const userSettings = reactive({})

export function getMeta(doctype) {
  const meta = createResource({
    url: 'frappe.desk.form.load.getdoctype',
    params: {
      doctype: doctype,
      with_parent: 1,
      cached_timestamp: null,
    },
    cache: ['Meta', doctype],
    onSuccess: (res) => {
      let dtMetas = res.docs
      for (let dtMeta of dtMetas) {
        doctypeMeta[dtMeta.name] = dtMeta
      }

      userSettings[doctype] = JSON.parse(res.user_settings)
    },
  })

  if (!doctypeMeta[doctype] && !meta.loading) {
    meta.fetch()
  }

  function getFormattedPercent(fieldname, doc) {
    let value = getFormattedFloat(fieldname, doc)
    return value + '%'
  }

  function getFormattedFloat(fieldname, doc) {
    let df = doctypeMeta[doctype]?.fields.find((f) => f.fieldname == fieldname)
    let precision = df?.precision || null
    return formatNumber(doc[fieldname], '', precision)
  }

  function getFormattedCurrency(fieldname, doc) {
    // Get system default currency
    let currency = window.sysdefaults.currency || 'USD'
    let df = doctypeMeta[doctype]?.fields.find((f) => f.fieldname == fieldname)
    let precision = df?.precision || null

    if (df && df.options) {
      if (df.options.indexOf(':') != -1) {
        // Currency specified in options with colon separator
        currency = currency
      } else if (doc && doc[df.options]) {
        // Check if document's currency field has an explicitly set value
        // and it's different from the system default
        const docCurrency = doc[df.options];
        
        // Only use document's currency if it's explicitly set (not empty)
        // This ensures system default is used when the field isn't set
        if (docCurrency && docCurrency.trim() !== '') {
          currency = docCurrency;
        }
      }
    }

    return formatCurrency(doc[fieldname], '', currency, precision)
  }

  function getGridSettings() {
    return doctypeMeta[doctype] || {}
  }

  function getGridViewSettings(parentDoctype, dt = null) {
    dt = dt || doctype
    if (!userSettings[parentDoctype]?.['GridView']?.[doctype]) return {}
    return userSettings[parentDoctype]['GridView'][doctype]
  }

  function getFields(dt = null) {
    dt = dt || doctype
    return doctypeMeta[dt]?.fields.map((f) => {
      if (f.fieldtype === 'Select' && typeof f.options === 'string') {
        f.options = f.options.split('\n').map((option) => {
          return {
            label: option,
            value: option,
          }
        })

        if (f.options[0]?.value !== '') {
          f.options.unshift({
            label: '',
            value: '',
          })
        }
      }
      if (f.fieldtype === 'Link' && f.options == 'User') {
        f.fieldtype = 'User'
      }
      return f
    })
  }

  function saveUserSettings(parentDoctype, key, value, callback) {
    let oldUserSettings = userSettings[parentDoctype] || {}
    let newUserSettings = JSON.parse(JSON.stringify(oldUserSettings))

    if (newUserSettings[key] === undefined) {
      newUserSettings[key] = { [doctype]: value }
    } else {
      newUserSettings[key][doctype] = value
    }

    if (JSON.stringify(oldUserSettings) !== JSON.stringify(newUserSettings)) {
      return createResource({
        url: 'frappe.model.utils.user_settings.save',
        params: {
          doctype: parentDoctype,
          user_settings: JSON.stringify(newUserSettings),
        },
        auto: true,
        onSuccess: () => {
          userSettings[parentDoctype] = newUserSettings
          callback?.()
        },
      })
    }
    userSettings[parentDoctype] = newUserSettings
    return callback?.()
  }

  return {
    meta,
    doctypeMeta,
    userSettings,
    getFields,
    getGridSettings,
    getGridViewSettings,
    saveUserSettings,
    getFormattedFloat,
    getFormattedPercent,
    getFormattedCurrency,
  }
}
