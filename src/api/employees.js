import api from './client'

export const getEmployees   = ()         => api.get('/users')
export const getEmployee    = (id)       => api.get(`/users/${id}`)
export const createEmployee = (data)     => api.post('/users', data)
export const updateEmployee = (id, data) => api.patch(`/users/${id}`, data)
export const toggleEmployee = (id)       => api.patch(`/users/${id}/toggle-active`)
export const getRoles       = ()         => api.get('/roles')