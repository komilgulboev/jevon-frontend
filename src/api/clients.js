import api from './client'

// ─── Клиенты (CRUD) ───────────────────────────────────────────
export const getClients      = (params)   => api.get('/clients', { params })
export const createClient    = (data)     => api.post('/clients', data)
export const updateClient    = (id, data) => api.patch(`/clients/${id}`, data)

// ─── Баланс и долг ────────────────────────────────────────────
export const getClientsDebt  = (params)   => api.get('/clients/debt', { params })
export const getClientOrders = (id)       => api.get(`/clients/${id}/orders`)

// ─── Платежи клиента ─────────────────────────────────────────
export const getClientPayments    = (id)           => api.get(`/clients/${id}/payments`)
export const createClientPayment  = (id, data)     => api.post(`/clients/${id}/payments`, data)
export const deleteClientPayment  = (id, paymentId) => api.delete(`/clients/${id}/payments/${paymentId}`)