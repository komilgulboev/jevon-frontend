import api from './client'

// ─── Единицы измерения ────────────────────────────────────────
export const getUnits      = ()     => api.get('/warehouse/units')
export const getCategories = ()     => api.get('/warehouse/categories')

// ─── Номенклатура ─────────────────────────────────────────────
export const getItems    = (params)   => api.get('/warehouse/items', { params })
export const getItem     = (id)       => api.get(`/warehouse/items/${id}`)
export const createItem  = (data)     => api.post('/warehouse/items', data)
export const updateItem  = (id, data) => api.put(`/warehouse/items/${id}`, data)
export const deleteItem  = (id)       => api.delete(`/warehouse/items/${id}`)

// ─── Поставщики ───────────────────────────────────────────────
export const getSuppliers   = (params)   => api.get('/warehouse/suppliers', { params })
export const getSupplier    = (id)       => api.get(`/warehouse/suppliers/${id}`)
export const createSupplier = (data)     => api.post('/warehouse/suppliers', data)
export const updateSupplier = (id, data) => api.patch(`/warehouse/suppliers/${id}`, data)
export const deleteSupplier = (id)       => api.delete(`/warehouse/suppliers/${id}`)

// Общий расчёт с поставщиком
export const getSupplierPayments    = (supplierId)           => api.get(`/warehouse/suppliers/${supplierId}/payments`)
export const createSupplierPayment  = (supplierId, data)     => api.post(`/warehouse/suppliers/${supplierId}/payments`, data)
export const deleteSupplierPayment  = (supplierId, paymentId) => api.delete(`/warehouse/suppliers/${supplierId}/payments/${paymentId}`)

// ─── Приходные накладные ──────────────────────────────────────
export const getReceipts       = (params)         => api.get('/warehouse/receipts', { params })
export const getReceipt        = (id)             => api.get(`/warehouse/receipts/${id}`)
export const createReceipt     = (data)           => api.post('/warehouse/receipts', data)
export const updateReceipt     = (id, data)       => api.patch(`/warehouse/receipts/${id}`, data)
export const deleteReceipt     = (id)             => api.delete(`/warehouse/receipts/${id}`)
export const addReceiptItem    = (id, data)       => api.post(`/warehouse/receipts/${id}/items`, data)
export const deleteReceiptItem = (id, itemId)     => api.delete(`/warehouse/receipts/${id}/items/${itemId}`)

// ─── Платежи по накладным ─────────────────────────────────────
export const createPayment = (receiptId, data)       => api.post(`/warehouse/receipts/${receiptId}/payments`, data)
export const deletePayment = (receiptId, paymentId)  => api.delete(`/warehouse/receipts/${receiptId}/payments/${paymentId}`)