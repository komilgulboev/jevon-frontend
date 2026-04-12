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

const STATUS_COLOR  = { new:'info', in_progress:'primary', on_hold:'warning', done:'success', cancelled:'danger' }
const PAYMENT_COLOR = { unpaid:'danger', partial:'warning', paid:'success', refund:'secondary' }

// Колонки канбана по статусам
const KANBAN_COLUMNS = [
  { key: 'new',         label: 'Новый',     color: 'info'    },
  { key: 'in_progress', label: 'В работе',  color: 'primary' },
  { key: 'on_hold',     label: 'Ожидание',  color: 'warning' },
  { key: 'done',        label: 'Готово',    color: 'success' },
]

const TYPE_COLOR = {
  workshop:'primary', cutting:'warning', painting:'danger',
  cnc:'info', soft_fabric:'success', soft_furniture:'dark',
}

const EMPTY_FORM = {
  order_type: 'workshop',
  client_id: '', client_name: '', client_phone: '',
  title: '', description: '', address: '',
  priority: 'medium', deadline: '', estimated_cost: '',
}

export default function Orders() {
  const { t }       = useTranslation()
  const { hasRole } = useAuth()
  const navigate    = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const clientIdFilter   = searchParams.get('client') || ''
  const clientNameFilter = searchParams.get('client_name') || ''

  const ORDER_TYPES = [
    { key: '',               label: t('orders.type_all')                               },
    { key: 'workshop',       label: t('orders.type_workshop'),  color: 'primary'       },
    { key: 'cutting',        label: t('orders.type_cutting'),   color: 'warning'       },
    { key: 'painting',       label: t('orders.type_painting'),  color: 'danger'        },
    { key: 'cnc',            label: t('orders.type_cnc'),       color: 'info'          },
    { key: 'soft_fabric',    label: t('orders.type_soft_fabric'),    color: 'success'  },
    { key: 'soft_furniture', label: t('orders.type_soft_furniture'), color: 'dark'     },
  ]

  const STAGE_LABELS = {
    intake: t('order_detail.stage_intake'), measure: t('order_detail.stage_measure'),
    design: t('order_detail.stage_design'), purchase: t('order_detail.stage_purchase'),
    production: t('order_detail.stage_production'), assembly: t('order_detail.stage_assembly'),
    delivery: t('order_detail.stage_delivery'), handover: t('order_detail.stage_handover'),
    material: t('order_detail.stage_material'), sawing: t('order_detail.stage_sawing'),
    edging: t('order_detail.stage_edging'), drilling: t('order_detail.stage_drilling'),
    packing: t('order_detail.stage_packing'), shipment: t('order_detail.stage_shipment'),
    calculate: t('order_detail.stage_calculate'), sanding: t('order_detail.stage_sanding'),
    priming: t('order_detail.stage_priming'), painting: t('order_detail.stage_painting'),
    cnc_work: t('order_detail.stage_cnc_work'), assign: t('order_detail.stage_assign'),
    work: t('order_detail.stage_work'),
  }

  const [orders,   setOrders]   = useState([])
  const [stats,    setStats]    = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [search,   setSearch]   = useState('')
  const [typeTab,  setTypeTab]  = useState('')
  const [statusF,  setStatusF]  = useState('')
  const [paymentF, setPaymentF] = useState('')
  const [viewMode, setViewMode] = useState('list') // 'list' | 'kanban'
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
      .catch(() => setError(t('common.loading')))
      .finally(() => setLoading(false))
  }, [typeTab, statusF, paymentF, t])

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
      const res = await api.post('/orders', {
        ...form,
        estimated_cost: form.estimated_cost ? parseFloat(form.estimated_cost) : 0,
      })
      setModal(false); setForm(EMPTY_FORM); resetClientSearch()
      if (res.data.id) navigate(`/orders/${res.data.id}`)
      else loadOrders()
    } catch (err) {
      setError(err.response?.data?.error || t('common.save'))
    } finally { setSaving(false) }
  }

  const handleModalClose = () => { setModal(false); setForm(EMPTY_FORM); resetClientSearch() }
  const clearClientFilter = () => setSearchParams({})

  const visible = orders.filter(o => {
    if (clientIdFilter && o.client_id !== clientIdFilter) return false
    const q = search.toLowerCase()
    return (
      String(o.order_number).includes(q) ||
      o.title?.toLowerCase().includes(q) ||
      o.client_name?.toLowerCase().includes(q) ||
      o.client_phone?.includes(q)
    )
  })

  // Группировка по статусам для канбана
  const byStatus = KANBAN_COLUMNS.reduce((acc, col) => {
    acc[col.key] = visible.filter(o => o.status === col.key)
    return acc
  }, {})

  // Карточка заказа для канбана
  const KanbanCard = ({ o }) => {
    const cost = o.final_cost || o.estimated_cost || 0
    const debt = cost - (o.paid_amount || 0)
    const typeDef = ORDER_TYPES.find(tp => tp.key === o.order_type)
    const isOverdue = o.deadline && new Date(o.deadline) < new Date() && o.status !== 'done'

    return (
      <div
        onClick={() => navigate(`/orders/${o.id}`)}
        style={{
          background: 'var(--cui-card-bg)',
          border: '1px solid var(--cui-border-color)',
          borderLeft: `3px solid var(--cui-${TYPE_COLOR[o.order_type] || 'secondary'})`,
          borderRadius: 8,
          padding: '10px 12px',
          cursor: 'pointer',
          marginBottom: 8,
          transition: 'box-shadow 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)'}
        onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
      >
        {/* Шапка карточки */}
        <div className="d-flex justify-content-between align-items-start mb-1">
          <CBadge color="secondary" style={{ fontSize: 10, fontWeight: 700 }}>
            #{o.order_number}
          </CBadge>
          <CBadge color={typeDef?.color || 'secondary'} style={{ fontSize: 9 }}>
            {typeDef?.label || o.order_type}
          </CBadge>
        </div>

        {/* Название */}
        <div className="fw-semibold small mb-1" style={{ lineHeight: 1.3 }}>
          {o.title}
        </div>

        {/* Клиент */}
        {o.client_name && (
          <div className="small text-body-secondary mb-1">
            👤 {o.client_name}
          </div>
        )}

        {/* Этап */}
        {o.current_stage && (
          <div className="mb-1">
            <CBadge color="light" className="text-dark" style={{ fontSize: 9 }}>
              {STAGE_LABELS[o.current_stage] || o.current_stage}
            </CBadge>
          </div>
        )}

        {/* Футер карточки */}
        <div className="d-flex justify-content-between align-items-center mt-2">
          {hasRole('admin') ? (
            <div>
              <div className="small fw-semibold">{cost.toLocaleString()} сом.</div>
              {debt > 0 && o.payment_status !== 'paid' && (
                <div className="small text-danger">Долг: {debt.toLocaleString()}</div>
              )}
            </div>
          ) : <div />}
          <div className="text-end">
            <CBadge color={PAYMENT_COLOR[o.payment_status] || 'secondary'} style={{ fontSize: 9 }}>
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

      {/* Баннер фильтра по клиенту */}
      {clientIdFilter && (
        <CAlert color="info" className="d-flex align-items-center justify-content-between py-2 mb-3">
          <span>👤 {t('orders.filter_client')}: <strong>{clientNameFilter || clientIdFilter}</strong></span>
          <CButton size="sm" color="info" variant="ghost" onClick={clearClientFilter}>
            <CIcon icon={cilX} className="me-1" />{t('orders.reset_filter')}
          </CButton>
        </CAlert>
      )}

      {/* Статистика */}
      {stats && !clientIdFilter && (
        <CRow className="g-3 mb-4">
          {[
            { label: t('orders.stat_active'),  value: stats.active_orders,               color: 'primary' },
            { label: t('orders.stat_done'),    value: stats.done_orders,                  color: 'success' },
            { label: t('orders.stat_unpaid'),  value: stats.unpaid_orders,                color: 'danger'  },
            { label: t('orders.stat_debt'),    value: stats.total_debt?.toLocaleString(), color: 'warning' },
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
        {/* Табы типов заказов */}
        {!clientIdFilter && (
          <CCardHeader className="pb-0">
            <CNav variant="tabs" className="card-header-tabs">
              {ORDER_TYPES.map(tp => (
                <CNavItem key={tp.key}>
                  <CNavLink active={typeTab === tp.key} onClick={() => setTypeTab(tp.key)}
                    style={{ cursor: 'pointer' }}>
                    {tp.label}
                    {tp.key && stats && (
                      <CBadge color={tp.color || 'secondary'} className="ms-1" style={{ fontSize: 10 }}>
                        {stats[`${tp.key}_count`] || ''}
                      </CBadge>
                    )}
                  </CNavLink>
                </CNavItem>
              ))}
            </CNav>
          </CCardHeader>
        )}

        <CCardBody>
          {/* Фильтры + переключатель вида */}
          <div className="d-flex gap-2 flex-wrap mb-3 align-items-center">
            <CInputGroup size="sm" style={{ width: 240 }}>
              <CInputGroupText><CIcon icon={cilSearch} /></CInputGroupText>
              <CFormInput placeholder={t('orders.search')} value={search}
                onChange={e => setSearch(e.target.value)} />
            </CInputGroup>
            {!clientIdFilter && viewMode === 'list' && (
              <>
                <CFormSelect size="sm" style={{ width: 150 }} value={statusF}
                  onChange={e => setStatusF(e.target.value)}>
                  <option value="">{t('orders.status_all')}</option>
                  <option value="new">{t('orders.status_new')}</option>
                  <option value="in_progress">{t('orders.status_in_progress')}</option>
                  <option value="on_hold">{t('orders.status_on_hold')}</option>
                  <option value="done">{t('orders.status_done')}</option>
                </CFormSelect>
                <CFormSelect size="sm" style={{ width: 160 }} value={paymentF}
                  onChange={e => setPaymentF(e.target.value)}>
                  <option value="">{t('orders.payment_all')}</option>
                  <option value="unpaid">{t('orders.payment_unpaid')}</option>
                  <option value="partial">{t('orders.payment_partial')}</option>
                  <option value="paid">{t('orders.payment_paid')}</option>
                </CFormSelect>
              </>
            )}
            <div className="ms-auto d-flex gap-2 align-items-center">
              {/* Переключатель вида */}
              <div className="btn-group btn-group-sm">
                <CButton
                  color={viewMode === 'list' ? 'primary' : 'secondary'}
                  variant={viewMode === 'list' ? undefined : 'outline'}
                  onClick={() => setViewMode('list')}
                  title="Список">
                  <CIcon icon={cilList} />
                </CButton>
                <CButton
                  color={viewMode === 'kanban' ? 'primary' : 'secondary'}
                  variant={viewMode === 'kanban' ? undefined : 'outline'}
                  onClick={() => setViewMode('kanban')}
                  title="Канбан">
                  <CIcon icon={cilColumns} />
                </CButton>
              </div>
              {hasRole('admin', 'supervisor', 'manager') && (
                <CButton color="primary" size="sm" onClick={() => setModal(true)}>
                  <CIcon icon={cilPlus} className="me-1" />{t('orders.new')}
                </CButton>
              )}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-4"><CSpinner /></div>
          ) : (
            <>
              {/* ── Список ── */}
              {viewMode === 'list' && (
                <CTable align="middle" hover responsive style={{ fontSize: 13 }}>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell style={{ width: 60 }}>#</CTableHeaderCell>
                      <CTableHeaderCell>{t('orders.col_type')}</CTableHeaderCell>
                      <CTableHeaderCell>{t('orders.col_order')}</CTableHeaderCell>
                      <CTableHeaderCell>{t('orders.col_stage')}</CTableHeaderCell>
                      <CTableHeaderCell>{t('orders.col_status')}</CTableHeaderCell>
                      {hasRole('admin') && <CTableHeaderCell>{t('orders.col_sum')}</CTableHeaderCell>}
                      <CTableHeaderCell>{t('orders.col_payment')}</CTableHeaderCell>
                      <CTableHeaderCell>{t('orders.col_deadline')}</CTableHeaderCell>
                      <CTableHeaderCell></CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {visible.length === 0 && (
                      <CTableRow>
                        <CTableDataCell colSpan={hasRole('admin') ? 9 : 8} className="text-center text-body-secondary py-4">
                          {t('orders.not_found')}
                        </CTableDataCell>
                      </CTableRow>
                    )}
                    {visible.map(o => {
                      const typeDef = ORDER_TYPES.find(tp => tp.key === o.order_type)
                      const cost    = o.final_cost || o.estimated_cost || 0
                      const debt    = cost - (o.paid_amount || 0)
                      return (
                        <CTableRow key={o.id} style={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/orders/${o.id}`)}>
                          <CTableDataCell>
                            <CBadge color="secondary" style={{ fontSize: 12, fontWeight: 700 }}>
                              #{o.order_number}
                            </CBadge>
                          </CTableDataCell>
                          <CTableDataCell>
                            <CBadge color={typeDef?.color || 'secondary'} style={{ fontSize: 11 }}>
                              {typeDef?.label || o.order_type}
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
                              ? <CBadge color="light" className="text-dark" style={{ fontSize: 11 }}>
                                  {STAGE_LABELS[o.current_stage] || o.current_stage}
                                </CBadge>
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
                                <div className="text-danger small">{t('orders.debt_label')}: {debt.toLocaleString()}</div>
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
                              <span className={
                                new Date(o.deadline) < new Date() && o.status !== 'done'
                                  ? 'text-danger fw-semibold' : 'text-body-secondary'
                              }>
                                {o.deadline}
                                {new Date(o.deadline) < new Date() && o.status !== 'done' && ' ⚠️'}
                              </span>
                            ) : '—'}
                          </CTableDataCell>
                          <CTableDataCell onClick={e => e.stopPropagation()}>
                            <CButton size="sm" color="primary" variant="ghost"
                              onClick={() => navigate(`/orders/${o.id}`)}>
                              <CIcon icon={cilFolderOpen} />
                            </CButton>
                          </CTableDataCell>
                        </CTableRow>
                      )
                    })}
                  </CTableBody>
                </CTable>
              )}

              {/* ── Канбан ── */}
              {viewMode === 'kanban' && (
                <div className="d-flex gap-3 overflow-auto pb-2" style={{ minHeight: 400 }}>
                  {KANBAN_COLUMNS.map(col => (
                    <div key={col.key} style={{ minWidth: 260, flex: '0 0 260px' }}>
                      {/* Заголовок колонки */}
                      <div className="d-flex align-items-center gap-2 mb-2 px-1">
                        <CBadge color={col.color} style={{ fontSize: 11 }}>{col.label}</CBadge>
                        <span className="small text-body-secondary fw-semibold">
                          {byStatus[col.key]?.length || 0}
                        </span>
                        {col.key !== 'done' && (
                          <span className="small text-body-secondary ms-auto">
                            {byStatus[col.key]?.reduce((s, o) => {
                              const cost = o.final_cost || o.estimated_cost || 0
                              return s + cost
                            }, 0).toLocaleString()} сом.
                          </span>
                        )}
                      </div>

                      {/* Карточки */}
                      <div style={{
                        background: 'var(--cui-tertiary-bg)',
                        borderRadius: 8,
                        padding: 8,
                        minHeight: 100,
                      }}>
                        {byStatus[col.key]?.length === 0 && (
                          <div className="text-center text-body-secondary small py-4">
                            Пусто
                          </div>
                        )}
                        {byStatus[col.key]?.map(o => (
                          <KanbanCard key={o.id} o={o} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CCardBody>
      </CCard>

      {/* Модал создания */}
      <CModal size="lg" visible={modal} onClose={handleModalClose}>
        <CModalHeader><CModalTitle>{t('orders.new')}</CModalTitle></CModalHeader>
        <CForm onSubmit={handleCreate}>
          <CModalBody>
            <CRow className="g-3">
              <CCol xs={12}>
                <CFormLabel>{t('orders.order_type_label')} *</CFormLabel>
                <div className="d-flex flex-wrap gap-2">
                  {ORDER_TYPES.filter(tp => tp.key).map(tp => (
                    <CButton key={tp.key} size="sm" type="button"
                      color={tp.color}
                      variant={form.order_type === tp.key ? undefined : 'outline'}
                      onClick={() => setForm({ ...form, order_type: tp.key })}>
                      {tp.label}
                    </CButton>
                  ))}
                </div>
              </CCol>
              <CCol xs={12}>
                <CFormLabel>{t('orders.order_title')} *</CFormLabel>
                <CFormInput required value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder={
                    form.order_type === 'workshop' ? 'Кухонный гарнитур, спальня...' :
                    form.order_type === 'cutting'  ? 'Распил ЛДСП 20 листов...'     :
                    form.order_type === 'painting' ? 'Покраска фасадов МДФ...'      :
                    form.order_type === 'cnc'      ? 'Фрезеровка деталей...'        :
                    t('orders.order_title')
                  }
                />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>{t('orders.client_phone')}</CFormLabel>
                <CInputGroup>
                  <CInputGroupText>
                    {phoneSearching ? <CSpinner size="sm" /> : <CIcon icon={cilSearch} />}
                  </CInputGroupText>
                  <CFormInput value={phoneSearch}
                    onChange={e => setPhoneSearch(e.target.value)}
                    placeholder="+992 XX XXX XX XX" />
                  {(foundClient || phoneNotFound) && (
                    <CButton color="secondary" variant="outline" type="button"
                      onClick={resetClientSearch}>×</CButton>
                  )}
                </CInputGroup>
                {foundClient && (
                  <div className="mt-2 p-2 rounded d-flex align-items-center gap-2"
                    style={{ background:'var(--cui-success-bg-subtle)', border:'1px solid var(--cui-success-border-subtle)' }}>
                    <CIcon icon={cilCheckCircle} className="text-success" />
                    <div>
                      <div className="small fw-semibold text-success">{t('orders.client_found')}</div>
                      <div className="fw-bold">{foundClient.full_name}</div>
                      <div className="small text-body-secondary">
                        📞 {foundClient.phone}
                        {foundClient.company && <span className="ms-2">🏢 {foundClient.company}</span>}
                      </div>
                    </div>
                  </div>
                )}
                {phoneNotFound && (
                  <div className="mt-2 p-2 rounded"
                    style={{ background:'var(--cui-warning-bg-subtle)', border:'1px solid var(--cui-warning-border-subtle)' }}>
                    <div className="small text-warning fw-semibold mb-2">{t('orders.client_not_found')}</div>
                    <CFormInput value={form.client_name}
                      onChange={e => setForm({ ...form, client_name: e.target.value })}
                      placeholder={t('orders.client_name_placeholder')} size="sm" />
                  </div>
                )}
              </CCol>
              <CCol xs={12} md={6}>
                <CFormLabel>{t('common.address')}</CFormLabel>
                <CFormInput value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  placeholder={t('orders.address_placeholder')} />
              </CCol>
              <CCol xs={6} md={3}>
                <CFormLabel>{t('orders.priority')}</CFormLabel>
                <CFormSelect value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  <option value="low">{t('orders.priority_low')}</option>
                  <option value="medium">{t('orders.priority_medium')}</option>
                  <option value="high">{t('orders.priority_high')}</option>
                  <option value="urgent">{t('orders.priority_urgent')} 🔴</option>
                </CFormSelect>
              </CCol>
              <CCol xs={6} md={3}>
                <CFormLabel>{t('orders.deadline')}</CFormLabel>
                <CFormInput type="date" value={form.deadline}
                  onChange={e => setForm({ ...form, deadline: e.target.value })} />
              </CCol>
              <CCol xs={12} md={6}>
                <CFormLabel>{t('orders.estimated_cost')}</CFormLabel>
                <CFormInput type="number" min="0" step="any" value={form.estimated_cost}
                  onChange={e => setForm({ ...form, estimated_cost: e.target.value })} placeholder="0" />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>{t('orders.description')}</CFormLabel>
                <CFormTextarea rows={2} value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder={t('orders.description_placeholder')} />
              </CCol>
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={handleModalClose}>
              {t('common.cancel')}
            </CButton>
            <CButton type="submit" color="primary" disabled={saving}>
              {saving ? <CSpinner size="sm" /> : t('orders.create_btn')}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>
    </>
  )
}