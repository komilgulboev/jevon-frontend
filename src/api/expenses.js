import api from './client'

export const getExpenses          = (params) => api.get('/expenses', { params })
export const getExpenseCategories = ()       => api.get('/expenses/categories')
export const createExpense        = (data)   => api.post('/expenses', data)
export const updateExpense        = (id, data)=> api.patch(`/expenses/${id}`, data)
export const deleteExpense        = (id)     => api.delete(`/expenses/${id}`)

// Табель
export const getTimesheets        = (params) => api.get('/timesheets', { params })
export const getTimesheetSummary  = (params) => api.get('/timesheets/summary', { params })
export const createTimesheet      = (data)   => api.post('/timesheets', data)
export const deleteTimesheet      = (id)     => api.delete(`/timesheets/${id}`)
export const autoFillTimesheets   = (params) => api.post('/timesheets/auto-fill', null, { params })

// Выплаты зарплат
export const getSalaryPayments    = (params) => api.get('/salary-payments', { params })
export const createSalaryPayment  = (data)   => api.post('/salary-payments', data)
export const deleteSalaryPayment  = (id)     => api.delete(`/salary-payments/${id}`)

// Назначение на этапы
export const getOrderStageAssignees    = (orderId, stageId)          => api.get(`/orders/${orderId}/stages/${stageId}/assignees`)
export const syncOrderStageAssignees   = (orderId, stageId, userIds, percents) =>
  api.put(`/orders/${orderId}/stages/${stageId}/assignees`, { user_ids: userIds, assembly_percents: percents || [] })

export const getProjectStageAssignees  = (projectId, stageId)        => api.get(`/projects/${projectId}/stages/${stageId}/assignees`)
export const syncProjectStageAssignees = (projectId, stageId, userIds, percents) =>
  api.put(`/projects/${projectId}/stages/${stageId}/assignees`, { user_ids: userIds, assembly_percents: percents || [] })