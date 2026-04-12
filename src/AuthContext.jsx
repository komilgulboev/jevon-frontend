import { createContext, useContext, useState, useCallback } from 'react'
import api from './api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  })

  // login принимает phone (или email) + password
  const login = useCallback(async (phone, password) => {
    const { data } = await api.post('/auth/login', { phone, password })
    localStorage.setItem('access_token',  data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    localStorage.setItem('user',          JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {
        refresh_token: localStorage.getItem('refresh_token'),
      })
    } finally {
      localStorage.clear()
      setUser(null)
    }
  }, [])

  const hasRole = useCallback(
    (...roles) => roles.includes(user?.role_name),
    [user],
  )

  return (
    <AuthContext.Provider value={{ user, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)