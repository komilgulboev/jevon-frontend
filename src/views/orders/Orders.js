import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CCard, CCardBody, CCardHeader,
  CTable, CTableBody, CTableDataCell,
  CTableHead, CTableHeaderCell, CTableRow,
  CBadge, CButton, CSpinner, CAlert,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CForm, CFormInput, CFormLabel, CFormSelect, CFormTextarea,
  CRow, CCol, CInputGroup, CInputGroupText,
  CNav, CNavItem, CNavLink,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilSearch, cilFolderOpen, cilCheckCircle, cilX, cilList, cilColumns } from '@coreui/icons'
import api from '../../api/client'
import { useAuth } from '../../AuthContext'
import { formatOrderNumber } from '../../utils/orderNumber'

const STATUS_COLOR  = { new:'info', in_progress:'primary', on_hold:'warning', done:'success', cancelled:'danger' }
const PAYMENT_COLOR = { unpaid:'danger', partial:'warning', paid:'success', refund:'secondary' }

const KANBAN_COLUMNS = [
  { key: 'new',         label: 'Новый',    color: 'info'    },
  { key: 'in_progress', label: 'В работе', color: 'primary' },
  { key: 'on_hold',     label: 'Ожидание', color: 'warning' },
  { key: 'done',        label: 'Готово',   color: 'success' },
]

const ORDER_TABS = [
  { key: '',         label: 'Все заказы'                        },
  { key: 'workshop', label: 'Заказ цеха',    color: 'primary'  },
  { key: 'external', label: 'Заказ вне цеха', color: 'success' },
]

const ORDER_TYPE_LABELS = {
  workshop:       'Заказ цеха',
  external:       'Заказ вне цеха',
  cutting:        'Распил',
  painting:       'Покраска',
  cnc:            'ЧПУ',
  soft_fabric:    'Мягкая мебель',
  soft_furniture: 'Мягкая мебель',
}

const ORDER_TYPE_BADGE_COLOR = {
  workshop:       'primary',
  external:       'success',
  cutting:        'warning',
  painting:       'danger',
  cnc:            'info',
  soft_fabric:    'success',
  soft_furniture: 'success',
}

const ORDER_TYPE_OPTIONS = [
  { key: 'workshop', label: 'Заказ цеха',     color: '#1976d2' },
  { key: 'external', label: 'Заказ вне цеха', color: '#388e3c' },
]

const EMPTY_FORM = {
  order_type:     'workshop',
  client_id:      '',
  client_name:    '',
  client_phone:   '',
  title:          '',
  description:    '',
  address:        '',
  priority:       'medium',
  deadline:       '',
  estimated_cost: '',
}

const STAGE_LABELS = {
  intake:     'Приём заказа',
  measure:    'Замер',
  design:     'Дизайн/Смета',
  purchase:   'Закупка',
  production: 'Производство',
  assembly:   'Сборка',
  delivery:   'Доставка',
  handover:   'Сдача клиенту',
  material:   'Приём материала',
  sawing:     'Распил',
  edging:     'Кромкование',
  drilling:   'Присадка',
  packing:    'Упаковка',
  shipment:   'Отгрузка',
  calculate:  'Расчёт',
  sanding:    'Шлифовка',
  priming:    'Грунтовка',
  painting:   'Покраска',
  cnc_work:   'Фрезеровка',
  assign:     'Назначение',
  work:       'Работа',
}

export default function Orders() {
  const { t }       = useTranslation()
  const { hasRole } = useAuth()
  const navigate    = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const clientIdFilter   = searchParams.get('client') || ''
  const clientNameFilter = searchParams.get('client_name') || ''

  const [orders,   setOrders]   = useState([])
  const [stats,    setStats]    = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [search,   setSearch]   = useState('')
  const [typeTab,  setTypeTab]  = useState('')
  const [statusF,  setStatusF]  = useState('')
  const [paymentF, setPaymentF] = useState('')
  const [viewMode, setViewMode] = useState('list')
  const [modal,    setModal]    = useState(false)
  const [form,     setForm]     = useState(EMPTY_FORM)
  const [saving,   setSaving]   = useState(false)

  const [phoneSearch,    setPhoneSearch]    = useState('')
  const [foundClient,    setFoundClient]    = useState(null)
  const [phoneSearching, setPhoneSearching] = useState(false)
  const [phoneNotFound,  setPhoneNotFound]  = useState(false)

  const loadOrders = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (typeTab)  params.append('order_type',     typeTab)
    if (statusF)  params.append('status',         statusF)
    if (paymentF) params.append('payment_status', paymentF)
    const q = params.toString() ? `?${params}` : ''
    Promise.all([api.get(`/orders${q}`), api.get('/orders/stats')])
      .then(([ordersRes, statsRes]) => {
        setOrders(ordersRes.data.data || [])
        setStats(statsRes.data)
      })
      .catch(() => setError('Ошибка загрузки'))
      .finally(() => setLoading(false))
  }, [typeTab, statusF, paymentF])

  useEffect(() => { loadOrders() }, [loadOrders])

  const searchClientByPhone = useCallback(async (phone) => {
    if (phone.length < 7) { setFoundClient(null); setPhoneNotFound(false); return }
    setPhoneSearching(true)
    try {
      const res = await api.get(`/clients?search=${encodeURIComponent(phone)}`)
      const clients = res.data.data || []
      const found = clients.find(c =>
        c.phone?.replace(/\D/g, '').includes(phone.replace(/\D/g, '')) ||
        c.phone2?.replace(/\D/g, '').includes(phone.replace(/\D/g, ''))
      )
      if (found) {
        setFoundClient(found); setPhoneNotFound(false)
        setForm(prev => ({ ...prev, client_id: found.id, client_name: found.full_name, client_phone: found.phone }))
      } else {
        setFoundClient(null); setPhoneNotFound(true)
        setForm(prev => ({ ...prev, client_id: '', client_name: '', client_phone: phone }))
      }
    } catch { setFoundClient(null) }
    finally  { setPhoneSearching(false) }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => { searchClientByPhone(phoneSearch) }, 400)
    return () => clearTimeout(timer)
  }, [phoneSearch, searchClientByPhone])

  const resetClientSearch = () => {
    setPhoneSearch(''); setFoundClient(null); setPhoneNotFound(false)
    setForm(prev => ({ ...prev, client_id: '', client_name: '', client_phone: '' }))
  }

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const payload = {
        ...form,
        estimated_cost: form.order_type === 'workshop' && form.estimated_cost
          ? parseFloat(form.estimated_cost)
          : 0,
      }
      const res = await api.post('/orders', payload)
      setModal(false); setForm(EMPTY_FORM); resetClientSearch()
      if (res.data.id) navigate(`/orders/${res.data.id}`)
      else loadOrders()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка сохранения')
    } finally { setSaving(false) }
  }

  const handleModalClose = () => {
    setModal(false); setForm(EMPTY_FORM); resetClientSearch()
  }

  const clearClientFilter = () => setSearchParams({})

  const visible = orders.filter(o => {
    if (clientIdFilter && o.client_id !== clientIdFilter) return false
    const q = search.toLowerCase()
    return (
      String(o.order_number).includes(q) ||
      formatOrderNumber(o.order_type, o.order_number).toLowerCase().includes(q) ||
      o.title?.toLowerCase().includes(q) ||
      o.client_name?.toLowerCase().includes(q) ||
      o.client_phone?.includes(q)
    )
  })

  const byStatus = KANBAN_COLUMNS.reduce((acc, col) => {
    acc[col.key] = visible.filter(o => o.status === col.key)
    return acc
  }, {})

  // Группируем дочерние заказы по parent_order_id
  const childrenByParent = orders.reduce((acc, o) => {
    if (o.parent_order_id) {
      if (!acc[o.parent_order_id]) acc[o.parent_order_id] = []
      acc[o.parent_order_id].push(o)
    }
    return acc
  }, {})

  const KanbanCard = ({ o }) => {
    const cost      = o.final_cost || o.estimated_cost || 0
    const debt      = cost - (o.paid_amount || 0)
    const typeLabel = ORDER_TYPE_LABELS[o.order_type] || o.order_type
    const typeColor = ORDER_TYPE_BADGE_COLOR[o.order_type] || 'secondary'
    const isOverdue = o.deadline && new Date(o.deadline) < new Date() && o.status !== 'done'
    return (
      <div onClick={() => navigate(`/orders/${o.id}`)}
        style={{ background:'var(--cui-card-bg)', border:'1px solid var(--cui-border-color)', borderLeft:`3px solid var(--cui-${typeColor})`, borderRadius:8, padding:'10px 12px', cursor:'pointer', marginBottom:8, transition:'box-shadow 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)'}
        onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
        <div className="d-flex justify-content-between align-items-start mb-1">
          <CBadge color="secondary" style={{ fontSize:10, fontWeight:700 }}>
            {formatOrderNumber(o.order_type, o.order_number)}
          </CBadge>
          <CBadge color={typeColor} style={{ fontSize:9 }}>
            {typeLabel}
          </CBadge>
        </div>
        <div className="fw-semibold small mb-1" style={{ lineHeight:1.3 }}>{o.title}</div>
        {o.client_name && <div className="small text-body-secondary mb-1">👤 {o.client_name}</div>}
        {o.current_stage && (
          <div className="mb-1">
            <CBadge color="light" className="text-dark" style={{ fontSize:9 }}>
              {STAGE_LABELS[o.current_stage] || o.current_stage}
            </CBadge>
          </div>
        )}
        <div className="d-flex justify-content-between align-items-center mt-2">
          {hasRole('admin') ? (
            <div>
              <div className="small fw-semibold">{cost.toLocaleString()} сом.</div>
              {debt > 0 && o.payment_status !== 'paid' && <div className="small text-danger">Долг: {debt.toLocaleString()}</div>}
            </div>
          ) : <div />}
          <div className="text-end">
            <CBadge color={PAYMENT_COLOR[o.payment_status] || 'secondary'} style={{ fontSize:9 }}>
              {t(`orders.payment_${o.payment_status}`, { defaultValue: o.payment_status })}
            </CBadge>
            {o.deadline && (
              <div className={`small mt-1 ${isOverdue ? 'text-danger fw-semibold' : 'text-body-secondary'}`}>
                📅 {o.deadline}{isOverdue && ' ⚠️'}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {error && <CAlert color="danger" dismissible onClose={() => setError('')}>{error}</CAlert>}

      {clientIdFilter && (
        <CAlert color="info" className="d-flex align-items-center justify-content-between py-2 mb-3">
          <span>👤 Клиент: <strong>{clientNameFilter || clientIdFilter}</strong></span>
          <CButton size="sm" color="info" variant="ghost" onClick={clearClientFilter}>
            <CIcon icon={cilX} className="me-1" />Сбросить
          </CButton>
        </CAlert>
      )}

      {stats && !clientIdFilter && (
        <CRow className="g-3 mb-4">
          {[
            { label: 'Активных',    value: stats.active_orders,               color: 'primary' },
            { label: 'Завершено',   value: stats.done_orders,                  color: 'success' },
            { label: 'Не оплачено', value: stats.unpaid_orders,                color: 'danger'  },
            { label: 'Долг',        value: stats.total_debt?.toLocaleString(), color: 'warning' },
          ].map(s => (
            <CCol xs={6} md={3} key={s.label}>
              <CCard className="text-center">
                <CCardBody className="py-3">
                  <div className={`fs-4 fw-bold text-${s.color}`}>{s.value}</div>
                  <div className="small text-body-secondary">{s.label}</div>
                </CCardBody>
              </CCard>
            </CCol>
          ))}
        </CRow>
      )}

      <CCard>
        {!clientIdFilter && (
          <CCardHeader className="pb-0">
            <CNav variant="tabs" className="card-header-tabs">
              {ORDER_TABS.map(tp => (
                <CNavItem key={tp.key}>
                  <CNavLink active={typeTab === tp.key} onClick={() => setTypeTab(tp.key)} style={{ cursor:'pointer' }}>
                    {tp.label}
                    {tp.key && (
                      <CBadge color={tp.color || 'secondary'} className="ms-1" style={{ fontSize:10 }}>
                        {hasRole('admin','supervisor','manager')
                          ? (tp.key === 'workshop' ? stats?.workshop_count : tp.key === 'external' ? stats?.external_count : '') || ''
                          : orders.filter(o => o.order_type === tp.key).length || ''
                        }
                      </CBadge>
                    )}
                  </CNavLink>
                </CNavItem>
              ))}
            </CNav>
          </CCardHeader>
        )}

        <CCardBody>
          <div className="d-flex gap-2 flex-wrap mb-3 align-items-center">
            <CInputGroup size="sm" style={{ width:240 }}>
              <CInputGroupText><CIcon icon={cilSearch} /></CInputGroupText>
              <CFormInput placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)} />
            </CInputGroup>
            {!clientIdFilter && viewMode === 'list' && (
              <>
                <CFormSelect size="sm" style={{ width:150 }} value={statusF} onChange={e => setStatusF(e.target.value)}>
                  <option value="">Все статусы</option>
                  <option value="new">Новый</option>
                  <option value="in_progress">В работе</option>
                  <option value="on_hold">Ожидание</option>
                  <option value="done">Готово</option>
                </CFormSelect>
                <CFormSelect size="sm" style={{ width:160 }} value={paymentF} onChange={e => setPaymentF(e.target.value)}>
                  <option value="">Все оплаты</option>
                  <option value="unpaid">Не оплачено</option>
                  <option value="partial">Частично</option>
                  <option value="paid">Оплачено</option>
                </CFormSelect>
              </>
            )}
            <div className="ms-auto d-flex gap-2 align-items-center">
              <div className="btn-group btn-group-sm">
                <CButton color={viewMode==='list'?'primary':'secondary'} variant={viewMode==='list'?undefined:'outline'} onClick={() => setViewMode('list')} title="Список">
                  <CIcon icon={cilList} />
                </CButton>
                <CButton color={viewMode==='kanban'?'primary':'secondary'} variant={viewMode==='kanban'?undefined:'outline'} onClick={() => setViewMode('kanban')} title="Канбан">
                  <CIcon icon={cilColumns} />
                </CButton>
              </div>
              {hasRole('admin','supervisor','manager') && (
                <CButton color="primary" size="sm" onClick={() => setModal(true)}>
                  <CIcon icon={cilPlus} className="me-1" />Новый заказ
                </CButton>
              )}
            </div>
          </div>

          {loading ? <div className="text-center py-4"><CSpinner /></div> : (
            <>
              {viewMode === 'list' && (
                <CTable align="middle" hover responsive style={{ fontSize:13 }}>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell style={{ width:80 }}>№</CTableHeaderCell>
                      <CTableHeaderCell>Тип</CTableHeaderCell>
                      <CTableHeaderCell>Заказ</CTableHeaderCell>
                      <CTableHeaderCell>Этап</CTableHeaderCell>
                      <CTableHeaderCell>Статус</CTableHeaderCell>
                      {hasRole('admin') && <CTableHeaderCell>Сумма</CTableHeaderCell>}
                      <CTableHeaderCell>Оплата</CTableHeaderCell>
                      <CTableHeaderCell>Срок</CTableHeaderCell>
                      <CTableHeaderCell></CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {visible.length === 0 && (
                      <CTableRow>
                        <CTableDataCell colSpan={hasRole('admin')?9:8} className="text-center text-body-secondary py-4">
                          Заказы не найдены
                        </CTableDataCell>
                      </CTableRow>
                    )}
                    {visible
                      .filter(o => !o.parent_order_id)
                      .map(o => {
                        const cost     = o.final_cost || o.estimated_cost || 0
                        const debt     = cost - (o.paid_amount || 0)
                        const tLabel   = ORDER_TYPE_LABELS[o.order_type] || o.order_type
                        const tColor   = ORDER_TYPE_BADGE_COLOR[o.order_type] || 'secondary'
                        const children = childrenByParent[o.id] || []
                        return [
                          /* Основная строка заказа */
                          <CTableRow key={o.id} style={{ cursor:'pointer' }} onClick={() => navigate(`/orders/${o.id}`)}>
                            <CTableDataCell>
                              <CBadge color="secondary" style={{ fontSize:12, fontWeight:700 }}>
                                {formatOrderNumber(o.order_type, o.order_number)}
                              </CBadge>
                            </CTableDataCell>
                            <CTableDataCell>
                              <CBadge color={tColor} style={{ fontSize:11 }}>
                                {tLabel}
                              </CBadge>
                            </CTableDataCell>
                            <CTableDataCell>
                              <div className="fw-semibold">{o.title}</div>
                              <div className="text-body-secondary">
                                {o.client_name  && <span>👤 {o.client_name}</span>}
                                {o.client_phone && <span className="ms-2">📞 {o.client_phone}</span>}
                              </div>
                            </CTableDataCell>
                            <CTableDataCell>
                              {o.current_stage
                                ? <CBadge color="light" className="text-dark" style={{ fontSize:11 }}>{STAGE_LABELS[o.current_stage] || o.current_stage}</CBadge>
                                : '—'}
                            </CTableDataCell>
                            <CTableDataCell>
                              <CBadge color={STATUS_COLOR[o.status] || 'secondary'}>
                                {t(`orders.status_${o.status}`, { defaultValue: o.status })}
                              </CBadge>
                            </CTableDataCell>
                            {hasRole('admin') && (
                              <CTableDataCell>
                                <div className="fw-semibold">{cost.toLocaleString()} сом.</div>
                                {debt > 0 && o.payment_status !== 'paid' && (
                                  <div className="text-danger small">Долг: {debt.toLocaleString()}</div>
                                )}
                              </CTableDataCell>
                            )}
                            <CTableDataCell>
                              <CBadge color={PAYMENT_COLOR[o.payment_status] || 'secondary'}>
                                {t(`orders.payment_${o.payment_status}`, { defaultValue: o.payment_status })}
                              </CBadge>
                            </CTableDataCell>
                            <CTableDataCell className="small">
                              {o.deadline ? (
                                <span className={new Date(o.deadline) < new Date() && o.status !== 'done' ? 'text-danger fw-semibold' : 'text-body-secondary'}>
                                  {o.deadline}{new Date(o.deadline) < new Date() && o.status !== 'done' && ' ⚠️'}
                                </span>
                              ) : '—'}
                            </CTableDataCell>
                            <CTableDataCell onClick={e => e.stopPropagation()}>
                              <CButton size="sm" color="primary" variant="ghost" onClick={() => navigate(`/orders/${o.id}`)}>
                                <CIcon icon={cilFolderOpen} />
                              </CButton>
                            </CTableDataCell>
                          </CTableRow>,

                          /* Дочерние услуги — компактная строка под родителем */
                          ...(children.length > 0 ? [
                            <CTableRow key={`${o.id}-children`}
                              style={{ background:'var(--cui-tertiary-bg)', borderTop:'none' }}>
                              <CTableDataCell colSpan={hasRole('admin') ? 9 : 8}
                                style={{ paddingTop:0, paddingBottom:8, paddingLeft:16 }}>
                                <div style={{ display:'flex', flexWrap:'wrap', gap:6, paddingLeft:8, borderLeft:'2px solid var(--cui-border-color)' }}>
                                  {children.map(child => {
                                    const childLabel = ORDER_TYPE_LABELS[child.order_type] || child.order_type
                                    const childColor = ORDER_TYPE_BADGE_COLOR[child.order_type] || 'secondary'
                                    const BADGE_COLORS = {
                                      primary: '#321fdb', success: '#2eb85c', warning: '#f9b115',
                                      danger:  '#e55353', info:    '#3399ff', secondary:'#9da5b1',
                                    }
                                    const bgColor = BADGE_COLORS[childColor] || '#9da5b1'
                                    // Прогресс дочернего заказа из статуса
                                    const childProgress = child.status === 'done' ? 100
                                      : child.status === 'in_progress' ? 50
                                      : child.status === 'on_hold' ? 25
                                      : 0
                                    return (
                                      <div key={child.id}
                                        onClick={e => { e.stopPropagation(); navigate(`/orders/${child.id}`) }}
                                        title={`${formatOrderNumber(child.order_type, child.order_number)} — ${childLabel}`}
                                        style={{
                                          display:'inline-flex', alignItems:'center', gap:6,
                                          padding:'3px 10px 3px 8px',
                                          background:'var(--cui-card-bg)',
                                          border:`1px solid ${bgColor}44`,
                                          borderLeft:`3px solid ${bgColor}`,
                                          borderRadius:6, cursor:'pointer',
                                          fontSize:11, transition:'box-shadow 0.1s',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.12)'}
                                        onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                                        {/* Тип услуги */}
                                        <span style={{ fontWeight:600, color: bgColor }}>{childLabel}</span>
                                        {/* Прогресс-бар */}
                                        <div style={{ width:40, height:4, background:'var(--cui-secondary-bg)', borderRadius:2, overflow:'hidden' }}>
                                          <div style={{ width:`${childProgress}%`, height:'100%', background: bgColor, transition:'width 0.3s' }} />
                                        </div>
                                        {/* % */}
                                        <span style={{ color:'var(--cui-secondary-color)', fontSize:10 }}>{childProgress}%</span>
                                        {/* Статус если не новый */}
                                        {child.current_stage && (
                                          <span style={{ color:'var(--cui-secondary-color)', fontSize:10 }}>
                                            · {STAGE_LABELS[child.current_stage] || child.current_stage}
                                          </span>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </CTableDataCell>
                            </CTableRow>
                          ] : []),
                        ]
                      })}
                  </CTableBody>
                </CTable>
              )}

              {viewMode === 'kanban' && (
                <div className="d-flex gap-3 overflow-auto pb-2" style={{ minHeight:400 }}>
                  {KANBAN_COLUMNS.map(col => (
                    <div key={col.key} style={{ minWidth:260, flex:'0 0 260px' }}>
                      <div className="d-flex align-items-center gap-2 mb-2 px-1">
                        <CBadge color={col.color} style={{ fontSize:11 }}>{col.label}</CBadge>
                        <span className="small text-body-secondary fw-semibold">{byStatus[col.key]?.length || 0}</span>
                        {col.key !== 'done' && (
                          <span className="small text-body-secondary ms-auto">
                            {byStatus[col.key]?.reduce((s, o) => s + (o.final_cost || o.estimated_cost || 0), 0).toLocaleString()} сом.
                          </span>
                        )}
                      </div>
                      <div style={{ background:'var(--cui-tertiary-bg)', borderRadius:8, padding:8, minHeight:100 }}>
                        {byStatus[col.key]?.length === 0 && <div className="text-center text-body-secondary small py-4">Пусто</div>}
                        {byStatus[col.key]?.map(o => <KanbanCard key={o.id} o={o} />)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CCardBody>
      </CCard>

      {/* ── Модал создания ── */}
      <CModal size="lg" visible={modal} onClose={handleModalClose}>
        <CModalHeader><CModalTitle>Новый заказ</CModalTitle></CModalHeader>
        <CForm onSubmit={handleCreate}>
          <CModalBody>
            <CRow className="g-3">

              <CCol xs={12}>
                <CFormLabel>Тип заказа</CFormLabel>
                <div className="d-flex gap-2">
                  {ORDER_TYPE_OPTIONS.map(tp => (
                    <button key={tp.key} type="button"
                      onClick={() => setForm({ ...form, order_type: tp.key, estimated_cost: '' })}
                      style={{
                        padding:'8px 20px', borderRadius:6, cursor:'pointer', fontSize:13,
                        border:`2px solid ${form.order_type === tp.key ? tp.color : 'var(--cui-border-color)'}`,
                        background: form.order_type === tp.key ? tp.color + '18' : 'transparent',
                        color: form.order_type === tp.key ? tp.color : 'var(--cui-secondary-color)',
                        fontWeight: form.order_type === tp.key ? 600 : 400,
                        transition: 'all 0.15s',
                      }}>
                      {tp.label}
                    </button>
                  ))}
                </div>
                {form.order_type === 'workshop' && (
                  <div className="small text-body-secondary mt-1">📦 Смета = расход. Вкладка Расходы доступна.</div>
                )}
                {form.order_type === 'external' && (
                  <div className="small text-body-secondary mt-1">💰 Смета = приход. Вкладка Расходы недоступна.</div>
                )}
              </CCol>

              <CCol xs={12}>
                <CFormLabel>Название заказа *</CFormLabel>
                <CFormInput required value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder={form.order_type === 'workshop' ? 'Кухонный гарнитур, спальня...' : 'Название заказа...'} />
              </CCol>

              <CCol xs={12}>
                <CFormLabel>Телефон клиента</CFormLabel>
                <CInputGroup>
                  <CInputGroupText>
                    {phoneSearching ? <CSpinner size="sm" /> : <CIcon icon={cilSearch} />}
                  </CInputGroupText>
                  <CFormInput value={phoneSearch} onChange={e => setPhoneSearch(e.target.value)} placeholder="+992 XX XXX XX XX" />
                  {(foundClient || phoneNotFound) && (
                    <CButton color="secondary" variant="outline" type="button" onClick={resetClientSearch}>×</CButton>
                  )}
                </CInputGroup>
                {foundClient && (
                  <div className="mt-2 p-2 rounded d-flex align-items-center gap-2"
                    style={{ background:'var(--cui-success-bg-subtle)', border:'1px solid var(--cui-success-border-subtle)' }}>
                    <CIcon icon={cilCheckCircle} className="text-success" />
                    <div>
                      <div className="small fw-semibold text-success">Клиент найден</div>
                      <div className="fw-bold">{foundClient.full_name}</div>
                      <div className="small text-body-secondary">
                        📞 {foundClient.phone}
                        {foundClient.company && <span className="ms-2">🏢 {foundClient.company}</span>}
                      </div>
                    </div>
                  </div>
                )}
                {phoneNotFound && (
                  <div className="mt-2 p-2 rounded" style={{ background:'var(--cui-warning-bg-subtle)', border:'1px solid var(--cui-warning-border-subtle)' }}>
                    <div className="small text-warning fw-semibold mb-2">Клиент не найден — создастся новый</div>
                    <CFormInput value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })}
                      placeholder="Имя клиента" size="sm" />
                  </div>
                )}
              </CCol>

              <CCol xs={12} md={6}>
                <CFormLabel>Адрес</CFormLabel>
                <CFormInput value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Адрес объекта" />
              </CCol>

              <CCol xs={6} md={3}>
                <CFormLabel>Приоритет</CFormLabel>
                <CFormSelect value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  <option value="low">Низкий</option>
                  <option value="medium">Средний</option>
                  <option value="high">Высокий</option>
                  <option value="urgent">Срочный 🔴</option>
                </CFormSelect>
              </CCol>

              <CCol xs={6} md={2}>
                <CFormLabel>Срок (дней)</CFormLabel>
                <CFormInput type="number" min="1" max="365" placeholder="7"
                  onChange={e => {
                    const days = parseInt(e.target.value)
                    if (days > 0) {
                      const date = new Date()
                      date.setDate(date.getDate() + days)
                      setForm({ ...form, deadline: date.toISOString().slice(0, 10) })
                    }
                  }} />
              </CCol>

              <CCol xs={6} md={3}>
                <CFormLabel>Дата дедлайна</CFormLabel>
                <CFormInput type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} />
              </CCol>

              {form.order_type === 'workshop' && (
                <CCol xs={12} md={6}>
                  <CFormLabel>Сумма договора (сом.)</CFormLabel>
                  <CFormInput type="number" min="0" step="any" value={form.estimated_cost}
                    onChange={e => setForm({ ...form, estimated_cost: e.target.value })}
                    placeholder="0" />
                  <div className="small text-body-secondary mt-1">Договорная сумма с клиентом</div>
                </CCol>
              )}

              <CCol xs={12}>
                <CFormLabel>Описание</CFormLabel>
                <CFormTextarea rows={2} value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Детали заказа..." />
              </CCol>
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={handleModalClose}>Отмена</CButton>
            <CButton type="submit" color="primary" disabled={saving}>
              {saving ? <CSpinner size="sm" /> : 'Создать заказ'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>
    </>
  )
}