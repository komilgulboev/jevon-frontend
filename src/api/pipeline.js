import api from './client'

// ── Projects ──────────────────────────────────────────────
export const projectsApi = {
  list:   (status) => api.get('/projects', { params: { status } }),
  create: (data)   => api.post('/projects', data),
  update: (id, data) => api.patch(`/projects/${id}`, data),
  delete: (id)     => api.delete(`/projects/${id}`),
}

// ── Pipeline ──────────────────────────────────────────────
export const pipelineApi = {
  // Этапы
  stages:         (projectId)          => api.get(`/projects/${projectId}/stages`),
  stage:          (projectId, stageId) => api.get(`/projects/${projectId}/stages/${stageId}`),
  updateStage:    (projectId, stageId, data) => api.patch(`/projects/${projectId}/stages/${stageId}`, data),
  completeStage:  (projectId, stageId, data) => api.post(`/projects/${projectId}/stages/${stageId}/complete`, data),

  // Операции
  operations:       (projectId)              => api.get(`/projects/${projectId}/operations`),
  createOperation:  (projectId, data)        => api.post(`/projects/${projectId}/operations`, data),
  updateOperation:  (projectId, opId, data)  => api.patch(`/projects/${projectId}/operations/${opId}`, data),
  deleteOperation:  (projectId, opId)        => api.delete(`/projects/${projectId}/operations/${opId}`),

  // Материалы
  materials:       (projectId)                    => api.get(`/projects/${projectId}/materials`),
  createMaterial:  (projectId, opId, data)        => api.post(`/projects/${projectId}/operations/${opId}/materials`, data),
  deleteMaterial:  (projectId, opId, materialId)  => api.delete(`/projects/${projectId}/operations/${opId}/materials/${materialId}`),

  // Файлы
  files:       (projectId, stageId)        => api.get(`/projects/${projectId}/stages/${stageId}/files`),
  createFile:  (projectId, stageId, data)  => api.post(`/projects/${projectId}/stages/${stageId}/files`, data),
  deleteFile:  (projectId, stageId, fileId) => api.delete(`/projects/${projectId}/stages/${stageId}/files/${fileId}`),

  // История
  history: (projectId) => api.get(`/projects/${projectId}/history`),

  // Каталог операций
  catalog: (category) => api.get('/catalog/operations', { params: { category } }),
}
