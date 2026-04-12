import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CCard, CCardBody, CCardHeader,
  CBadge, CButton, CSpinner, CAlert,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CFormInput, CFormLabel, CFormSelect,
  CTable, CTableHead, CTableBody, CTableRow,
  CTableHeaderCell, CTableDataCell,
  CProgress, CRow, CCol,
  CInputGroup, CInputGroupText,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilArrowLeft, cilPlus, cilTrash, cilSearch, cilFolderOpen, cilPencil } from '@coreui/icons'
import api from '../../api/client'
import { useAuth } from '../../AuthContext'

const STATUS_COLOR = { new:'info', in_progress:'primary', on_hold:'warning', done:'success', cancelled:'danger' }
const STATUS_LABEL = { new:'Новый', in_progress:'В работе', on_hold:'Ожидание', done:'Готово', cancelled:'Отменён' }
const PAYMENT_COLOR = { unpaid:'danger', partial:'warning', paid:'success' }
const PAYMENT_LABEL = { unpaid:'Не оплачен', partial:'Частично', paid:'Оплачен' }

const ORDER_TYPE_LABELS = {
  workshop: 'Цех', cutting: 'Распил', painting: 'Покраска',
  cnc: 'ЧПУ', soft_fabric: 'Мягкая ткань', soft_furniture: 'Мягкая мебель',
}

const STAGE_LABELS = {
  intake: 'Приём', measure: 'Замер', design: 'Дизайн',
  purchase: 'Закупка', production: 'Производство', assembly: 'Сборка',
  delivery: 'Доставка', handover: 'Сдача',
  material: 'Материал', sawing: 'Распил', edging: 'Кромка',
  drilling: 'Присадка', packing: 'Упаковка', shipment: 'Отгрузка',
  calculate: 'Расчёт', sanding: 'Шлифовка', priming: 'Грунтовка',
  painting: 'Покраска', cnc_work: 'ЧПУ работа',
}

export default function ProjectDetail() {
  const { id }      = useParams()
  const navigate    = useNavigate()
  const { hasRole } = useAuth()

  const [project,  setProject]  = useState(null)
  const [orders,   setOrders]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  // Модал добавления заказа
  const [addModal,       setAddModal]       = useState(false)
  const [workshopOrders, setWorkshopOrders] = useState([])
  const [ordersLoading,  setOrdersLoading]  = useState(false)
  const [orderSearch,    setOrderSearch]    = useState('')
  const [addingSaving,   setAddingSaving]   = useState(false)
  const [selectedOrder,  setSelectedOrder]  = useState('')

  // Модал редактирования
  const [editModal, setEditModal] = useState(false)
  const [editForm,  setEditForm]  = useState({})
  const [editSaving, setEditSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [projRes, ordersRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/projects/${id}/orders`),
      ])
      setProject(projRes.data)
      setOrders(ordersRes.data.data || [])
    } catch {
      setError('Ошибка загрузки проекта')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // Загрузка заказов цеха для добавления
  const openAddModal = async () => {
    setSelectedOrder('')
    setOrderSearch('')
    setAddModal(true)
    setOrdersLoading(true)
    try {
      const r = await api.get('/orders?order_type=workshop')
      const existing = orders.map(o => o.id)
      setWorkshopOrders((r.data.data || []).filter(o => !existing.includes(o.id)))
    } catch {} finally { setOrdersLoading(false) }
  }

  const handleAddOrder = async () => {
    if (!selectedOrder) return
    setAddingSaving(true)
    try {
      await api.post(`/projects/${id}/orders`, { order_id: selectedOrder })
      setAddModal(false)
      load()
    } catch (e) {
      setError(e.response?.data?.error || 'Ошибка добавления заказа')
    } finally { setAddingSaving(false) }
  }

  const handleRemoveOrder = async (orderId, orderNum) => {
    if (!window.confirm(`Удалить заказ #${orderNum} из проекта?`)) return
    try {
      await api.delete(`/projects/${id}/orders/${orderId}`)
      load()
    } catch { setError('Ошибка удаления') }
  }

  const openEditModal = () => {
    setEditForm({
      title:        project.title,
      status:       project.status,
      priority:     project.priority,
      deadline:     project.deadline || '',
      client_name:  project.client_name,
      client_phone: project.client_phone,
      notes:        project.notes,
    })
    setEditModal(true)
  }

  const handleEditSave = async (e) => {
    e.preventDefault()
    setEditSaving(true)
    try {
      await api.patch(`/projects/${id}`, editForm)
      setEditModal(false)
      load()
    } catch { setError('Ошибка сохранения') }
    finally { setEditSaving(false) }
  }

  const filteredWorkshopOrders = workshopOrders.filter(o => {
    if (!orderSearch) return true
    const q = orderSearch.toLowerCase()
    return (
      String(o.order_number).includes(q) ||
      (o.title || '').toLowerCase().includes(q) ||
      (o.client_name || '').toLowerCase().includes(q)
    )
  })

  // Общий прогресс проекта
  const totalProgress = orders.length > 0
    ? Math.round(orders.reduce((sum, o) => sum + (o.progress || 0), 0) / orders.length)
    : 0

  if (loading) return <div className="text-center mt-5"><CSpinner color="primary" /></div>
  if (!project) return <CAlert color="danger">Проект не найден</CAlert>

  const canManage = hasRole('admin', 'supervisor', 'manager')

  return (
    <>
      {error && <CAlert color="danger" dismissible onClose={() => setError('')}>{error}</CAlert>}

      {/* ── Шапка ── */}
      <div className="d-flex align-items-start gap-3 mb-3">
        <CButton color="secondary" variant="ghost" size="sm"
          onClick={() => navigate('/projects')} className="mt-1">
          <CIcon icon={cilArrowLeft} />
        </CButton>
        <div className="flex-grow-1">
          <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
            <CBadge color="secondary" style={{ fontSize: 14, fontWeight: 700 }}>
              #{project.project_number}
            </CBadge>
            <h5 className="mb-0">{project.title}</h5>
            <CBadge color={STATUS_COLOR[project.status] || 'secondary'}>
              {STATUS_LABEL[project.status] || project.status}
            </CBadge>
            {canManage && (
              <CButton size="sm" color="secondary" variant="ghost" onClick={openEditModal}>
                <CIcon icon={cilPencil} />
              </CButton>
            )}
          </div>
          <div className="d-flex flex-wrap gap-3 small text-body-secondary">
            {project.client_name  && <span>👤 {project.client_name}</span>}
            {project.client_phone && <span>📞 {project.client_phone}</span>}
            {project.deadline     && <span>📅 {project.deadline}</span>}
            {project.notes        && <span>📝 {project.notes}</span>}
          </div>
        </div>

        {/* Общий прогресс */}
        {orders.length > 0 && (
          <div style={{ minWidth: 160, textAlign: 'right' }}>
            <div className="small text-body-secondary mb-1">
              Общий прогресс: <strong>{totalProgress}%</strong>
            </div>
            <CProgress value={totalProgress} color="success" style={{ height: 8 }} />
            <div className="small text-body-secondary mt-1">
              {orders.filter(o => o.status === 'done').length} из {orders.length} заказов завершено
            </div>
          </div>
        )}
      </div>

      {/* ── Список заказов ── */}
      <CCard>
        <CCardHeader className="d-flex align-items-center justify-content-between">
          <strong>Заказы проекта ({orders.length})</strong>
          {canManage && (
            <CButton size="sm" color="primary" onClick={openAddModal}>
              <CIcon icon={cilPlus} className="me-1" />Добавить заказ
            </CButton>
          )}
        </CCardHeader>
        <CCardBody className="p-0">
          {orders.length === 0 ? (
            <div className="text-center text-body-secondary py-5">
              <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
              <div className="fw-semibold mb-1">Заказы не добавлены</div>
              <div className="small mb-3">Нажмите «Добавить заказ» чтобы связать заказы с проектом</div>
            </div>
          ) : (
            <CTable align="middle" hover responsive style={{ fontSize: 13 }} className="mb-0">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ width: 70 }}>№</CTableHeaderCell>
                  <CTableHeaderCell>Заказ</CTableHeaderCell>
                  <CTableHeaderCell>Тип</CTableHeaderCell>
                  <CTableHeaderCell>Статус</CTableHeaderCell>
                  <CTableHeaderCell>Этап</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 160 }}>Прогресс</CTableHeaderCell>
                  <CTableHeaderCell>Оплата</CTableHeaderCell>
                  <CTableHeaderCell>Дедлайн</CTableHeaderCell>
                  <CTableHeaderCell></CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {orders.map(o => {
                  const isOverdue = o.deadline && new Date(o.deadline) < new Date() && o.status !== 'done'
                  return (
                    <CTableRow key={o.id}>
                      <CTableDataCell>
                        <CBadge color="secondary" style={{ fontSize: 12, fontWeight: 600 }}>
                          #{o.order_number}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell>
                        <div className="fw-semibold"
                          style={{ cursor: 'pointer', color: 'var(--cui-primary)' }}
                          onClick={() => navigate(`/orders/${o.id}`)}>
                          {o.title}
                        </div>
                        {o.client_name && (
                          <div className="small text-body-secondary">👤 {o.client_name}</div>
                        )}
                      </CTableDataCell>
                      <CTableDataCell>
                        <CBadge color="light" className="text-dark" style={{ fontSize: 11 }}>
                          {ORDER_TYPE_LABELS[o.order_type] || o.order_type}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={STATUS_COLOR[o.status] || 'secondary'}>
                          {STATUS_LABEL[o.status] || o.status}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell>
                        {o.current_stage ? (
                          <CBadge color="info" style={{ fontSize: 11 }}>
                            {STAGE_LABELS[o.current_stage] || o.current_stage}
                          </CBadge>
                        ) : '—'}
                      </CTableDataCell>
                      <CTableDataCell>
                        <div className="d-flex align-items-center gap-2">
                          <CProgress
                            value={o.progress}
                            color={o.progress === 100 ? 'success' : 'primary'}
                            style={{ flex: 1, height: 6 }}
                          />
                          <span className="small text-body-secondary" style={{ minWidth: 32 }}>
                            {o.progress}%
                          </span>
                        </div>
                        <div className="small text-body-secondary mt-1">
                          {o.done_stages}/{o.total_stages} этапов
                        </div>
                      </CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={PAYMENT_COLOR[o.payment_status] || 'secondary'}>
                          {PAYMENT_LABEL[o.payment_status] || o.payment_status}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell className={`small ${isOverdue ? 'text-danger fw-semibold' : 'text-body-secondary'}`}>
                        {o.deadline ? `${o.deadline}${isOverdue ? ' ⚠️' : ''}` : '—'}
                      </CTableDataCell>
                      <CTableDataCell>
                        <div className="d-flex gap-1">
                          <CButton size="sm" color="primary" variant="ghost"
                            onClick={() => navigate(`/orders/${o.id}`)}>
                            <CIcon icon={cilFolderOpen} />
                          </CButton>
                          {canManage && (
                            <CButton size="sm" color="danger" variant="ghost"
                              onClick={() => handleRemoveOrder(o.id, o.order_number)}>
                              <CIcon icon={cilTrash} />
                            </CButton>
                          )}
                        </div>
                      </CTableDataCell>
                    </CTableRow>
                  )
                })}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>

      {/* ── Модал добавления заказа ── */}
      <CModal size="lg" visible={addModal} onClose={() => setAddModal(false)}>
        <CModalHeader><CModalTitle>Добавить заказ в проект</CModalTitle></CModalHeader>
        <CModalBody>
          <CInputGroup size="sm" className="mb-3">
            <CInputGroupText><CIcon icon={cilSearch} /></CInputGroupText>
            <CFormInput placeholder="Поиск заказов..."
              value={orderSearch} onChange={e => setOrderSearch(e.target.value)} autoFocus />
          </CInputGroup>
          {ordersLoading ? (
            <div className="text-center py-4"><CSpinner /></div>
          ) : (
            <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--cui-border-color)', borderRadius: 4 }}>
              {filteredWorkshopOrders.length === 0 ? (
                <div className="text-center text-body-secondary py-4 small">Заказы не найдены</div>
              ) : filteredWorkshopOrders.map(o => (
                <div key={o.id}
                  onClick={() => setSelectedOrder(o.id)}
                  style={{
                    padding: '10px 14px', cursor: 'pointer',
                    background: selectedOrder === o.id ? 'var(--cui-primary-bg-subtle)' : 'transparent',
                    borderBottom: '1px solid var(--cui-border-color)',
                    display: 'flex', alignItems: 'center', gap: 10,
                    borderLeft: selectedOrder === o.id ? '3px solid var(--cui-primary)' : '3px solid transparent',
                  }}
                  onMouseEnter={e => { if (selectedOrder !== o.id) e.currentTarget.style.background = 'var(--cui-tertiary-bg)' }}
                  onMouseLeave={e => { if (selectedOrder !== o.id) e.currentTarget.style.background = 'transparent' }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    background: selectedOrder === o.id ? 'var(--cui-primary)' : 'transparent',
                    border: `2px solid ${selectedOrder === o.id ? 'var(--cui-primary)' : 'var(--cui-border-color)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {selectedOrder === o.id && <span style={{ color:'#fff', fontSize:10 }}>✓</span>}
                  </div>
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center gap-2">
                      <CBadge color="secondary" style={{ fontSize: 11 }}>#{o.order_number}</CBadge>
                      <span className="fw-semibold small">{o.title}</span>
                    </div>
                    <div className="small text-body-secondary">
                      {o.client_name && <span>👤 {o.client_name}</span>}
                      {o.deadline && <span className="ms-2">📅 {o.deadline}</span>}
                    </div>
                  </div>
                  <CBadge color={STATUS_COLOR[o.status] || 'secondary'} style={{ fontSize: 10 }}>
                    {STATUS_LABEL[o.status] || o.status}
                  </CBadge>
                </div>
              ))}
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={() => setAddModal(false)}>Отмена</CButton>
          <CButton color="primary" disabled={!selectedOrder || addingSaving} onClick={handleAddOrder}>
            {addingSaving ? <CSpinner size="sm" /> : 'Добавить'}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* ── Модал редактирования ── */}
      <CModal visible={editModal} onClose={() => setEditModal(false)}>
        <CModalHeader><CModalTitle>Редактировать проект</CModalTitle></CModalHeader>
        <CModalBody>
          <CRow className="g-3">
            <CCol xs={12}>
              <CFormLabel>Название</CFormLabel>
              <CFormInput value={editForm.title || ''}
                onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
            </CCol>
            <CCol xs={6}>
              <CFormLabel>Статус</CFormLabel>
              <CFormSelect value={editForm.status || ''}
                onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                <option value="new">Новый</option>
                <option value="in_progress">В работе</option>
                <option value="on_hold">Ожидание</option>
                <option value="done">Готово</option>
              </CFormSelect>
            </CCol>
            <CCol xs={6}>
              <CFormLabel>Приоритет</CFormLabel>
              <CFormSelect value={editForm.priority || ''}
                onChange={e => setEditForm({ ...editForm, priority: e.target.value })}>
                <option value="low">Низкий</option>
                <option value="medium">Средний</option>
                <option value="high">Высокий</option>
              </CFormSelect>
            </CCol>
            <CCol xs={6}>
              <CFormLabel>Дедлайн</CFormLabel>
              <CFormInput type="date" value={editForm.deadline || ''}
                onChange={e => setEditForm({ ...editForm, deadline: e.target.value })} />
            </CCol>
            <CCol xs={6}>
              <CFormLabel>Телефон клиента</CFormLabel>
              <CFormInput value={editForm.client_phone || ''}
                onChange={e => setEditForm({ ...editForm, client_phone: e.target.value })} />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Примечание</CFormLabel>
              <CFormInput value={editForm.notes || ''}
                onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={() => setEditModal(false)}>Отмена</CButton>
          <CButton color="primary" disabled={editSaving} onClick={handleEditSave}>
            {editSaving ? <CSpinner size="sm" /> : 'Сохранить'}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}