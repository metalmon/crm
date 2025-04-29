import { validateEmail } from '../../utils'

const LogoGmail = '/assets/crm/frontend/images/gmail.png'
const LogoOutlook = '/assets/crm/frontend/images/outlook.png'
const LogoSendgrid = '/assets/crm/frontend/images/sendgrid.png'
const LogoSparkpost = '/assets/crm/frontend/images/sparkpost.webp'
const LogoYahoo = '/assets/crm/frontend/images/yahoo.png'
const LogoYandex = '/assets/crm/frontend/images/yandex.png'
const LogoFrappeMail = '/assets/crm/frontend/images/frappe-mail.svg'

const fixedFields = [
  {
    label: __('Account Name'),
    name: 'email_account_name',
    type: 'text',
    placeholder: __('Support / Sales'),
  },
  {
    label: __('Email ID'),
    name: 'email_id',
    type: 'email',
    placeholder: __('johndoe@example.com'),
  },
]

export const incomingOutgoingFields = [
  {
    label: __('Enable Incoming'),
    name: 'enable_incoming',
    type: 'checkbox',
    description: __('If enabled, tickets can be created from the incoming emails on this account.'),
  },
  {
    label: __('Enable Outgoing'),
    name: 'enable_outgoing',
    type: 'checkbox',
    description: __('If enabled, outgoing emails can be sent from this account.'),
  },
  {
    label: __('Default Incoming'),
    name: 'default_incoming',
    type: 'checkbox',
    description: __('If enabled, all replies to your company (eg: replies@yourcomany.com) will come to this account. Note: Only one account can be default incoming.'),
  },
  {
    label: __('Default Outgoing'),
    name: 'default_outgoing',
    type: 'checkbox',
    description: __('If enabled, all outgoing emails will be sent from this account. Note: Only one account can be default outgoing.'),
  },
]

export const popularProviderFields = [
  ...fixedFields,
  {
    label: __('Password'),
    name: 'password',
    type: 'password',
    placeholder: '********',
  },
]

export const customProviderFields = [
  ...fixedFields,
  {
    label: __('Frappe Mail Site'),
    name: 'frappe_mail_site',
    type: 'text',
    placeholder: __('https://frappemail.com'),
  },
  {
    label: __('API Key'),
    name: 'api_key',
    type: 'text',
    placeholder: '********',
  },
  {
    label: __('API Secret'),
    name: 'api_secret',
    type: 'password',
    placeholder: '********',
  },
]

export const services = [
  {
    name: 'GMail',
    icon: LogoGmail,
    info: __('Setting up GMail requires you to enable two factor authentication and app specific passwords. Read more'),
    link: 'https://support.google.com/accounts/answer/185833',
    custom: false,
  },
  {
    name: 'Outlook',
    icon: LogoOutlook,
    info: __('Setting up Outlook requires you to enable two factor authentication and app specific passwords. Read more'),
    link: 'https://support.microsoft.com/en-us/account-billing/how-to-get-and-use-app-passwords-5896ed9b-4263-e681-128a-a6f2979a7944',
    custom: false,
  },
  {
    name: 'Sendgrid',
    icon: LogoSendgrid,
    info: __('Setting up Sendgrid requires you to enable two factor authentication and app specific passwords. Read more'),
    link: 'https://sendgrid.com/docs/ui/account-and-settings/two-factor-authentication/',
    custom: false,
  },
  {
    name: 'SparkPost',
    icon: LogoSparkpost,
    info: __('Setting up SparkPost requires you to enable two factor authentication and app specific passwords. Read more'),
    link: 'https://support.sparkpost.com/docs/my-account-and-profile/enabling-two-factor-authentication',
    custom: false,
  },
  {
    name: 'Yahoo',
    icon: LogoYahoo,
    info: __('Setting up Yahoo requires you to enable two factor authentication and app specific passwords. Read more'),
    link: 'https://help.yahoo.com/kb/SLN15241.html',
    custom: false,
  },
  {
    name: 'Yandex',
    icon: LogoYandex,
    info: __('Setting up Yandex requires you to enable two factor authentication and app specific passwords. Read more'),
    link: 'https://yandex.com/support/id/authorization/app-passwords.html',
    custom: false,
  },
  {
    name: 'Frappe Mail',
    icon: LogoFrappeMail,
    info: __('Setting up Frappe Mail requires you to have an API key and API Secret of your email account. Read more'),
    link: 'https://github.com/frappe/mail',
    custom: true,
  },
]

export const emailIcon = {
  GMail: LogoGmail,
  Outlook: LogoOutlook,
  Sendgrid: LogoSendgrid,
  SparkPost: LogoSparkpost,
  Yahoo: LogoYahoo,
  Yandex: LogoYandex,
  'Frappe Mail': LogoFrappeMail,
}

export function validateInputs(state, isCustom) {
  if (!state.email_account_name) {
    return __('Please enter account name')
  }
  if (!state.email_id) {
    return __('Please enter email address')
  }
  const validEmail = validateEmail(state.email_id)
  if (!validEmail) {
    return __('Please enter valid email address')
  }
  if (!isCustom && !state.password) {
    return __('Please enter password')
  }
  if (isCustom) {
    if (!state.api_key) {
      return __('Please enter API key')
    }
    if (!state.api_secret) {
      return __('Please enter API secret')
    }
  }
  return null
}
