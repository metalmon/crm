import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import { capture } from '@/telemetry'
import { parseColor } from '@/utils'
import { defineStore } from 'pinia'
import { createListResource } from 'frappe-ui'
import { reactive, h } from 'vue'
import { translateDealStatus } from '@/utils/dealStatusTranslations'
import { translateLeadStatus } from '@/utils/leadStatusTranslations'

export const statusesStore = defineStore('crm-statuses', () => {
  let leadStatusesByName = reactive({})
  let dealStatusesByName = reactive({})
  let communicationStatusesByName = reactive({})

  const leadStatuses = createListResource({
    doctype: 'CRM Lead Status',
    fields: ['name', 'color', 'position'],
    orderBy: 'position asc',
    cache: 'lead-statuses',
    initialData: [],
    auto: true,
    transform(statuses) {
      for (let status of statuses) {
        status.kanbanColor = status.color
        status.color = parseColor(status.color)
        status.value = status.name
        status.label = translateLeadStatus(status.name)
        leadStatusesByName[status.name] = status
      }
      return statuses
    },
  })

  const dealStatuses = createListResource({
    doctype: 'CRM Deal Status',
    fields: ['name', 'color', 'position'],
    orderBy: 'position asc',
    cache: 'deal-statuses',
    initialData: [],
    auto: true,
    transform(statuses) {
      for (let status of statuses) {
        status.kanbanColor = status.color
        status.color = parseColor(status.color)
        status.value = status.name
        status.label = translateDealStatus(status.name)
        dealStatusesByName[status.name] = status
      }
      return statuses
    },
  })

  const communicationStatuses = createListResource({
    doctype: 'CRM Communication Status',
    fields: ['name'],
    cache: 'communication-statuses',
    initialData: [],
    auto: true,
    transform(statuses) {
      for (let status of statuses) {
        communicationStatusesByName[status.name] = status
      }
      return statuses
    },
  })

  function getLeadStatus(name) {
    if (!name) {
      name = leadStatuses.data[0].name
    }
    return leadStatusesByName[name]
  }

  function getDealStatus(name) {
    if (!name) {
      name = dealStatuses.data[0].name
    }
    return dealStatusesByName[name]
  }

  function getCommunicationStatus(name) {
    if (!name) {
      name = communicationStatuses.data[0].name
    }
    return communicationStatuses[name]
  }

  function statusOptions(doctype, document, statuses = []) {
    let statusesByName =
      doctype == 'deal' ? dealStatusesByName : leadStatusesByName

    if (document?.statuses?.length) {
      statuses = document.statuses
    }

    if (statuses.length) {
      statusesByName = statuses.reduce((acc, status) => {
        acc[status] = statusesByName[status]
        return acc
      }, {})
    }

    let options = []
    for (const statusName in statusesByName) {
      const statusObject = statusesByName[statusName]
      options.push({
        label: statusObject.label,
        value: statusObject.value,
        icon: () => h(IndicatorIcon, { class: statusObject.color }),
        onClick: () => {
          capture('status_changed', { doctype, status: statusObject.value })
          if (document) {
            document.doc.status = statusObject.value
            document.save.submit()
          }
        },
      })
    }
    return options
  }

  return {
    leadStatuses,
    dealStatuses,
    communicationStatuses,
    getLeadStatus,
    getDealStatus,
    getCommunicationStatus,
    statusOptions,
  }
})
