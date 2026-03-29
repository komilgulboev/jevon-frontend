import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8181/api'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// ── Очередь запросов пока идёт refresh ───────────────────
let isRefreshing = false
let failedQueue  = []

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else       resolve(token)
  })
  failedQueue = []
}

// ── Attach access token ───────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Auto-refresh on 401 ───────────────────────────────────
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config

    // Не пробуем refresh для самого запроса refresh/login
    if (
      error.response?.status !== 401 ||
      original._retry ||
      original.url?.includes('/auth/refresh') ||
      original.url?.includes('/auth/login')
    ) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      // Ждём пока другой запрос обновит токен
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      })
        .then(token => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        })
        .catch(err => Promise.reject(err))
    }

    original._retry = true
    isRefreshing    = true

    try {
      const refreshToken = localStorage.getItem('refresh_token')
      if (!refreshToken) throw new Error('No refresh token')

      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      })

      const newToken = data.access_token
      localStorage.setItem('access_token', newToken)
      if (data.refresh_token) {
        localStorage.setItem('refresh_token', data.refresh_token)
      }

      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
      original.headers.Authorization = `Bearer ${newToken}`

      processQueue(null, newToken)
      return api(original)
    } catch (err) {
      processQueue(err, null)
      localStorage.clear()
      window.location.href = '/login'
      return Promise.reject(err)
    } finally {
      isRefreshing = false
    }
  },
)

export default api