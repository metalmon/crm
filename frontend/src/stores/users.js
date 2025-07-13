import { defineStore } from 'pinia'
import { createResource } from 'frappe-ui'
import { sessionStore } from './session'
import { reactive } from 'vue'
import { useRouter } from 'vue-router'

export const usersStore = defineStore('crm-users', () => {
  const session = sessionStore()

  let usersByName = reactive({})
  const router = useRouter()

  const users = createResource({
    url: 'crm.api.session.get_users',
    cache: 'crm-users',
    initialData: [],
    auto: true,
    transform(users) {
      // Проверяем, что users является массивом
      if (!Array.isArray(users)) {
        console.error('Users data is not an array:', users)
        return { allUsers: [], crmUsers: [] }
      }
      
      for (let user of users) {
        usersByName[user.name] = user
        if (user.name === 'Administrator') {
          usersByName[user.email] = user
        }
      }
      
      // Разделяем всех пользователей и CRM пользователей
      const crmUsers = users.filter(user => user.enabled && user.user_type !== 'Website User')
      const allUsers = users
      
      return { allUsers, crmUsers }
    },
    onError(error) {
      if (error && error.exc_type === 'AuthenticationError') {
        router.push('/login')
      }
    },
  })

  function getUser(email) {
    if (!email || email === 'sessionUser') {
      email = session.user
    }
    if (!usersByName[email]) {
      usersByName[email] = {
        name: email,
        email: email,
        full_name: email.split('@')[0],
        first_name: email.split('@')[0],
        last_name: '',
        user_image: null,
        role: null,
      }
    }
    return usersByName[email]
  }

  function isAdmin(email) {
    return getUser(email).role === 'System Manager' || getUser(email).is_admin
  }

  function isManager(email) {
    const user = getUser(email)
    return user.is_manager || user.role === 'System Manager'
  }

  function isAgent(email) {
    return getUser(email).is_agent
  }

  function getUserRole(email) {
    const user = getUser(email)
    if (user && user.role) {
      return user.role
    }
    return null
  }

  return {
    users,
    getUser,
    isAdmin,
    isManager,
    isAgent,
    getUserRole,
  }
})