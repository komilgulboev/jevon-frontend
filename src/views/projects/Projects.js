import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CCard, CCardBody, CCardHeader,
  CTable, CTableBody, CTableDataCell,
  CTableHead, CTableHeaderCell, CTableRow,
  CBadge, CButton, CSpinner, CAlert,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CForm, CFormInput, CFormLabel, CFormSelect,
  CRow, CCol, CInputGroup, CInputGroupText,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilSearch, cilFolderOpen, cilCheckCircle, cilX, cilUser } from '@coreui/icons'
import api from '../../api/client'
import { useAuth } from '../../AuthContext'
import { formatProjectNumber } from '../../utils/orderNumber'

const STATUS_COLOR = { new:'info', in_progress:'primary', on_hold:'warning', done:'success', cancelled:'danger' }
const STATUS_LABEL = { new:'Новый', in_progress:'В работе', on_hold:'Ожидание', done:'Готово', cancelled:'Отменён' }

const ORDER_TYPE_LABELS = {
  workshop:'Цех', cutting:'Распил', painting:'Покраска',
  cnc:'ЧПУ', soft_fabric:'Мягкая ткань', soft_furniture:'Мягкая мебель',
}

const EMPTY_FORM = {
  title:'', client_id:'', client_name:'', client_phone:'',
  priority:'medium', deadline:'', notes:'', order_ids:[],
}

export default function Projects() {
  const { hasRole } = useAuth()
  const navigate    = useNavigate()

  const [projects,  setProjects]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [search,    setSearch]    = useState('')
  const [filter,    setFilter]    = useState('')
  const [modal,     setModal]     = useState(false)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [saving,    setSaving]    = useState(false)

  const [clientSearch,   setClientSearch]   = useState('')
  const [clientResults,  setClientResults]  = useState([])
  const [clientLoading,  setClientLoading]  = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [showNewClient,  setShowNewClient]  = useState(false)
  const [newClientForm,  setNewClientForm]  = useState({ full_name:'', phone:'' })
  const [clientSaving,   setClientSaving]   = useState(false)

  const [workshopOrders, setWorkshopOrders] = useState([])
  const [ordersLoading,  setOrdersLoading]  = useState(false)
  const [orderSearch,    setOrderSearch]    = useState('')

  const loadProjects = useCallback(() => {
    setLoading(true)
    const q = filter ? `?status=${filter}` : ''
    api.get(`/projects${q}`)
      .then(r => setProjects(r.data.data || []))
      .catch(() => setError('Ошибка загрузки проектов'))
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => { loadProjects() }, [loadProjects])

  useEffect(() => {
    if (clientSearch.length < 2) { setClientResults([]); return }
    const timer = setTimeout(async () => {
      setClientLoading(true)
      try {
        const r = await api.get(`/clients?search=${encodeURIComponent(clientSearch)}`)
        setClientResults(r.data.data || [])
      } catch {} finally { setClientLoading(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [clientSearch])

  const loadWorkshopOrders = async () => {
    setOrdersLoading(true)
    try {
      const r = await api.get('/orders?order_type=workshop')
      setWorkshopOrders(r.data.data || [])
    } catch {} finally { setOrdersLoading(false) }
  }

  const openModal = () => {
    setForm(EMPTY_FORM); setSelectedClient(null); setClientSearch(''); setClientResults([])
    setOrderSearch(''); setShowNewClient(false); setNewClientForm({ full_name:'', phone:'' })
    loadWorkshopOrders(); setModal(true)
  }

  const selectClient = (client) => {
    setSelectedClient(client); setClientSearch(''); setClientResults([]); setShowNewClient(false)
    setForm(prev => ({ ...prev, client_id: client.id, client_name: client.full_name||client.name||'', client_phone: client.phone||'' }))
  }

  const clearClient = () => {
    setSelectedClient(null); setClientSearch(''); setShowNewClient(false)
    setForm(prev => ({ ...prev, client_id:'', client_name:'', client_phone:'' }))
  }

  const handleCreateClient = async () => {
    if (!newClientForm.full_name || !newClientForm.phone) return
    setClientSaving(true)
    try {
      const r = await api.post('/clients', newClientForm)
      selectClient({ id: r.data.id, full_name: newClientForm.full_name, phone: newClientForm.phone })
      setShowNewClient(false); setNewClientForm({ full_name:'', phone:'' })
    } catch (e) { setError(e.response?.data?.error || 'Ошибка создания клиента') }
    finally { setClientSaving(false) }
  }

  const toggleOrder = (orderId) => {
    setForm(prev => ({
      ...prev,
      order_ids: prev.order_ids.includes(orderId)
        ? prev.order_ids.filter(id => id !== orderId)
        : [...prev.order_ids, orderId],
    }))
  }

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const res = await api.post('/projects', form)
      setModal(false)
      if (res.data.id) navigate(`/projects/${res.data.id}`)
      else loadProjects()
    } catch (err) { setError(err.response?.data?.error || 'Ошибка создания проекта') }
    finally { setSaving(false) }
  }

  const filteredOrders = workshopOrders.filter(o => {
    if (!orderSearch) return true
    const q = orderSearch.toLowerCase()
    return String(o.order_number).includes(q) || (o.title||'').toLowerCase().includes(q) || (o.client_name||'').toLowerCase().includes(q)
  })

  const visible = projects.filter(p =>
    p.title?.toLowerCase().includes(search.toLowerCase()) ||
    p.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    String(p.project_number).includes(search) ||
    formatProjectNumber(p.project_number).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      {error && <CAlert color="danger" dismissible onClose={() => setError('')}>{error}</CAlert>}

      <CCard>
        <CCardHeader className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <strong>Проекты</strong>
          <div className="d-flex gap-2 align-items-center flex-wrap">
            <CFormSelect size="sm" style={{ width:160 }} value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="">Все статусы</option>
              <option value="new">Новые</option>
              <option value="in_progress">В работе</option>
              <option value="on_hold">Ожидание</option>
              <option value="done">Готовые</option>
            </CFormSelect>
            <CInputGroup size="sm" style={{ width:220 }}>
              <CInputGroupText><CIcon icon={cilSearch} /></CInputGroupText>
              <CFormInput placeholder="Поиск по названию, клиенту..." value={search} onChange={e => setSearch(e.target.value)} />
            </CInputGroup>
            {hasRole('admin','supervisor','manager') && (
              <CButton color="primary" size="sm" onClick={openModal}>
                <CIcon icon={cilPlus} className="me-1" />Новый проект
              </CButton>
            )}
          </div>
        </CCardHeader>

        <CCardBody className="p-0">
          {loading ? <div className="text-center py-4"><CSpinner /></div> : (
            <CTable align="middle" hover responsive style={{ fontSize:13 }} className="mb-0">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ width:70 }}>#</CTableHeaderCell>
                  <CTableHeaderCell>Название</CTableHeaderCell>
                  <CTableHeaderCell>Клиент</CTableHeaderCell>
                  <CTableHeaderCell className="text-center">Заказов</CTableHeaderCell>
                  <CTableHeaderCell>Статус</CTableHeaderCell>
                  <CTableHeaderCell>Дедлайн</CTableHeaderCell>
                  <CTableHeaderCell></CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {visible.length === 0 && (
                  <CTableRow><CTableDataCell colSpan={7} className="text-center text-body-secondary py-4">Проекты не найдены</CTableDataCell></CTableRow>
                )}
                {visible.map(p => (
                  <CTableRow key={p.id} style={{ cursor:'pointer' }} onClick={() => navigate(`/projects/${p.id}`)}>
                    <CTableDataCell>
                      <CBadge color="secondary" style={{ fontSize:12, fontWeight:600 }}>
                        {formatProjectNumber(p.project_number)}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className="fw-semibold">{p.title}</div>
                      {p.notes && <div className="small text-body-secondary">{p.notes}</div>}
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className="fw-semibold">{p.client_name||'—'}</div>
                      {p.client_phone && <div className="small text-body-secondary">{p.client_phone}</div>}
                    </CTableDataCell>
                    <CTableDataCell className="text-center">
                      <CBadge color="primary">{p.order_count}</CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={STATUS_COLOR[p.status]||'secondary'}>{STATUS_LABEL[p.status]||p.status}</CBadge>
                    </CTableDataCell>
                    <CTableDataCell className="small text-body-secondary">{p.deadline||'—'}</CTableDataCell>
                    <CTableDataCell onClick={e => e.stopPropagation()}>
                      <CButton size="sm" color="primary" variant="ghost" onClick={() => navigate(`/projects/${p.id}`)}>
                        <CIcon icon={cilFolderOpen} />
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>

      <CModal size="xl" visible={modal} onClose={() => setModal(false)}>
        <CModalHeader><CModalTitle>Новый проект</CModalTitle></CModalHeader>
        <CForm onSubmit={handleCreate}>
          <CModalBody>
            <CRow className="g-3">
              <CCol xs={12}>
                <CFormLabel>Название проекта *</CFormLabel>
                <CFormInput required value={form.title} onChange={e => setForm({ ...form, title:e.target.value })} placeholder="Кухонный гарнитур, спальня..." />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Клиент</CFormLabel>
                {selectedClient ? (
                  <div className="p-2 rounded d-flex align-items-center gap-2"
                    style={{ background:'var(--cui-success-bg-subtle)', border:'1px solid var(--cui-success-border-subtle)' }}>
                    <CIcon icon={cilCheckCircle} className="text-success" />
                    <div className="flex-grow-1">
                      <div className="fw-semibold">{selectedClient.full_name||selectedClient.name}</div>
                      <div className="small text-body-secondary">{selectedClient.phone}</div>
                    </div>
                    <CButton size="sm" color="secondary" variant="ghost" onClick={clearClient}><CIcon icon={cilX} /></CButton>
                  </div>
                ) : (
                  <div>
                    <div style={{ position:'relative' }}>
                      <CInputGroup>
                        <CInputGroupText>{clientLoading ? <CSpinner size="sm" /> : <CIcon icon={cilSearch} />}</CInputGroupText>
                        <CFormInput placeholder="Поиск клиента по имени или телефону..." value={clientSearch}
                          onChange={e => { setClientSearch(e.target.value); setShowNewClient(false) }} />
                      </CInputGroup>
                      {clientResults.length > 0 && (
                        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:1050, background:'var(--cui-body-bg)', border:'1px solid var(--cui-border-color)', borderRadius:4, boxShadow:'0 4px 12px rgba(0,0,0,0.15)', maxHeight:200, overflowY:'auto' }}>
                          {clientResults.map(c => (
                            <div key={c.id} onClick={() => selectClient(c)}
                              style={{ padding:'8px 12px', cursor:'pointer', borderBottom:'1px solid var(--cui-border-color)' }}
                              onMouseEnter={e => e.currentTarget.style.background='var(--cui-secondary-bg)'}
                              onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                              <div className="fw-semibold">{c.full_name||c.name}</div>
                              <div className="small text-body-secondary">{c.phone}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {clientSearch.length >= 2 && clientResults.length === 0 && !clientLoading && (
                      <div className="mt-2">
                        {!showNewClient ? (
                          <CButton size="sm" color="warning" variant="outline"
                            onClick={() => { setShowNewClient(true); setNewClientForm({ full_name:clientSearch, phone:'' }) }}>
                            <CIcon icon={cilUser} className="me-1" />Клиент не найден — создать нового
                          </CButton>
                        ) : (
                          <div className="p-3 rounded" style={{ background:'var(--cui-warning-bg-subtle)', border:'1px solid var(--cui-warning-border-subtle)' }}>
                            <div className="small fw-semibold text-warning mb-2">Новый клиент</div>
                            <CRow className="g-2">
                              <CCol xs={12} md={6}>
                                <CFormInput size="sm" placeholder="Имя клиента *" value={newClientForm.full_name} onChange={e => setNewClientForm({ ...newClientForm, full_name:e.target.value })} />
                              </CCol>
                              <CCol xs={12} md={6}>
                                <CFormInput size="sm" placeholder="Телефон *" value={newClientForm.phone} onChange={e => setNewClientForm({ ...newClientForm, phone:e.target.value })} />
                              </CCol>
                              <CCol xs={12} className="d-flex gap-2">
                                <CButton size="sm" color="success" disabled={clientSaving||!newClientForm.full_name||!newClientForm.phone} onClick={handleCreateClient}>
                                  {clientSaving ? <CSpinner size="sm" /> : '✓ Создать клиента'}
                                </CButton>
                                <CButton size="sm" color="secondary" variant="outline" onClick={() => setShowNewClient(false)}>Отмена</CButton>
                              </CCol>
                            </CRow>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CCol>
              <CCol xs={6} md={3}>
                <CFormLabel>Приоритет</CFormLabel>
                <CFormSelect value={form.priority} onChange={e => setForm({ ...form, priority:e.target.value })}>
                  <option value="low">Низкий</option>
                  <option value="medium">Средний</option>
                  <option value="high">Высокий</option>
                </CFormSelect>
              </CCol>
              <CCol xs={6} md={2}>
                <CFormLabel>Срок (дней)</CFormLabel>
                <CFormInput type="number" min="1" max="365" placeholder="30"
                  onChange={e => {
                    const days = parseInt(e.target.value)
                    if (days > 0) {
                      const date = new Date()
                      date.setDate(date.getDate() + days)
                      setForm(prev => ({ ...prev, deadline: date.toISOString().slice(0,10) }))
                    }
                  }} />
              </CCol>
              <CCol xs={6} md={3}>
                <CFormLabel>Дедлайн</CFormLabel>
                <CFormInput type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline:e.target.value })} />
              </CCol>
              <CCol xs={6} md={4}>
                <CFormLabel>Примечание</CFormLabel>
                <CFormInput value={form.notes} onChange={e => setForm({ ...form, notes:e.target.value })} placeholder="Описание проекта..." />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>
                  Заказы цеха
                  {form.order_ids.length > 0 && <CBadge color="primary" className="ms-2">{form.order_ids.length} выбрано</CBadge>}
                </CFormLabel>
                <CInputGroup size="sm" className="mb-2">
                  <CInputGroupText><CIcon icon={cilSearch} /></CInputGroupText>
                  <CFormInput placeholder="Поиск заказов..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
                </CInputGroup>
                {ordersLoading ? <div className="text-center py-3"><CSpinner size="sm" /></div> : (
                  <div style={{ maxHeight:240, overflowY:'auto', border:'1px solid var(--cui-border-color)', borderRadius:4 }}>
                    {filteredOrders.length === 0 ? (
                      <div className="text-center text-body-secondary py-3 small">Заказы цеха не найдены</div>
                    ) : filteredOrders.map(o => {
                      const isSelected = form.order_ids.includes(o.id)
                      return (
                        <div key={o.id} onClick={() => toggleOrder(o.id)}
                          style={{ padding:'8px 12px', cursor:'pointer', background: isSelected?'var(--cui-primary-bg-subtle)':'transparent', borderBottom:'1px solid var(--cui-border-color)', display:'flex', alignItems:'center', gap:10 }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background='var(--cui-tertiary-bg)' }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background='transparent' }}>
                          <div style={{ width:18, height:18, borderRadius:4, flexShrink:0, background:isSelected?'var(--cui-primary)':'transparent', border:`2px solid ${isSelected?'var(--cui-primary)':'var(--cui-border-color)'}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            {isSelected && <span style={{ color:'#fff', fontSize:12, lineHeight:1 }}>✓</span>}
                          </div>
                          <div className="flex-grow-1">
                            <div className="d-flex align-items-center gap-2">
                              <CBadge color="secondary" style={{ fontSize:11 }}>B-{o.order_number}</CBadge>
                              <span className="fw-semibold small">{o.title}</span>
                            </div>
                            <div className="small text-body-secondary">
                              {o.client_name && <span>👤 {o.client_name}</span>}
                              {o.deadline && <span className="ms-2">📅 {o.deadline}</span>}
                            </div>
                          </div>
                          <CBadge color="primary" style={{ fontSize:10 }}>{ORDER_TYPE_LABELS[o.order_type]||o.order_type}</CBadge>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CCol>
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setModal(false)}>Отмена</CButton>
            <CButton type="submit" color="primary" disabled={saving}>
              {saving ? <CSpinner size="sm" /> : 'Создать проект'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>
    </>
  )
}