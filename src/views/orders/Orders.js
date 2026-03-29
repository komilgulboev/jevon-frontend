import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
import { cilPlus, cilSearch, cilFolderOpen, cilCheckCircle, cilX } from '@coreui/icons'
import api from '../../api/client'
import { useAuth } from '../../AuthContext'

const ORDER_TYPES = [
  { key: '',               label: 'Все заказы'                          },
  { key: 'workshop',       label: 'Заказ цеха',    color: 'primary'    },
  { key: 'cutting',        label: 'Распил',         color: 'warning'   },
  { key: 'painting',       label: 'Покраска',       color: 'danger'    },
  { key: 'cnc',            label: 'ЧПУ',            color: 'info'      },
  { key: 'soft_fabric',    label: 'Обивка',         color: 'success'   },
  { key: 'soft_furniture', label: 'Мягкая мебель',  color: 'dark'      },
]

const STATUS_COLOR  = { new:'info', in_progress:'primary', on_hold:'warning', done:'success', cancelled:'danger' }
const STATUS_LABEL  = { new:'Новый', in_progress:'В работе', on_hold:'Ожидание', done:'Готово', cancelled:'Отменён' }
const PAYMENT_COLOR = { unpaid:'danger', partial:'warning', paid:'success', refund:'secondary' }
const PAYMENT_LABEL = { unpaid:'Не оплачен', partial:'Частично', paid:'Оплачен', refund:'Возврат' }

const STAGE_LABELS = {
  intake:'Приём', measure:'Замер', design:'Дизайн',
  purchase:'Закупка', production:'Производство', assembly:'Сборка',
  delivery:'Доставка', handover:'Сдача', material:'Материал',
  sawing:'Распил', edging:'Кромка', drilling:'Присадка',
  packing:'Упаковка', shipment:'Отгрузка', calculate:'Расчёт',
  sanding:'Шлифовка', priming:'Грунтовка', painting:'Покраска',
  cnc_work:'ЧПУ', assign:'Назначение', work:'Работа',
}

const EMPTY_FORM = {
  order_type: 'workshop',
  client_id: '', client_name: '', client_phone: '',
  title: '', description: '', address: '',
  priority: 'medium', deadline: '', estimated_cost: '',
}

export default function Orders() {
  const { hasRole } = useAuth()
  const navigate    = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Фильтр по клиенту из URL (?client=uuid&client_name=Иванов)
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
  const [modal,    setModal]    = useState(false)
  const [form,     setForm]     = useState(EMPTY_FORM)
  const [saving,   setSaving]   = useState(false)

  // Поиск клиента по телефону
  const [phoneSearch,    setPhoneSearch]    = useState('')
  const [foundClient,    setFoundClient]    = useState(null)
  const [phoneSearching, setPhoneSearching] = useState(false)
  const [phoneNotFound,  setPhoneNotFound]  = useState(false)

  // ── Загрузка ──────────────────────────────────────────

  const loadOrders = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (typeTab)       params.append('order_type',     typeTab)
    if (statusF)       params.append('status',         statusF)
    if (paymentF)      params.append('payment_status', paymentF)
    const q = params.toString() ? `?${params}` : ''

    Promise.all([
      api.get(`/orders${q}`),
      api.get('/orders/stats'),
    ])
      .then(([ordersRes, statsRes]) => {
        setOrders(ordersRes.data.data || [])
        setStats(statsRes.data)
      })
      .catch(() => setError('Ошибка загрузки заказов'))
      .finally(() => setLoading(false))
  }, [typeTab, statusF, paymentF])

  useEffect(() => { loadOrders() }, [loadOrders])

  // ── Поиск клиента по телефону ─────────────────────────

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
        setFoundClient(found)
        setPhoneNotFound(false)
        setForm(prev => ({ ...prev, client_id: found.id, client_name: found.full_name, client_phone: found.phone }))
      } else {
        setFoundClient(null)
        setPhoneNotFound(true)
        setForm(prev => ({ ...prev, client_id: '', client_name: '', client_phone: phone }))
      }
    } catch {
      setFoundClient(null)
    } finally {
      setPhoneSearching(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => { searchClientByPhone(phoneSearch) }, 400)
    return () => clearTimeout(timer)
  }, [phoneSearch, searchClientByPhone])

  const resetClientSearch = () => {
    setPhoneSearch('')
    setFoundClient(null)
    setPhoneNotFound(false)
    setForm(prev => ({ ...prev, client_id: '', client_name: '', client_phone: '' }))
  }

  // ── Создание заказа ───────────────────────────────────

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.post('/orders', {
        ...form,
        estimated_cost: form.estimated_cost ? parseFloat(form.estimated_cost) : 0,
      })
      setModal(false)
      setForm(EMPTY_FORM)
      resetClientSearch()
      if (res.data.id) navigate(`/orders/${res.data.id}`)
      else loadOrders()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка создания заказа')
    } finally {
      setSaving(false)
    }
  }

  const handleModalClose = () => {
    setModal(false)
    setForm(EMPTY_FORM)
    resetClientSearch()
  }

  // ── Сброс фильтра клиента ─────────────────────────────

  const clearClientFilter = () => {
    setSearchParams({})
  }

  // ── Фильтрация ────────────────────────────────────────

  const visible = orders.filter(o => {
    // Фильтр по конкретному клиенту
    if (clientIdFilter && o.client_id !== clientIdFilter) return false

    const q = search.toLowerCase()
    return (
      String(o.order_number).includes(q) ||
      o.title?.toLowerCase().includes(q) ||
      o.client_name?.toLowerCase().includes(q) ||
      o.client_phone?.includes(q)
    )
  })

  // ── Render ────────────────────────────────────────────

  return (
    <>
      {error && <CAlert color="danger" dismissible onClose={() => setError('')}>{error}</CAlert>}

      {/* Баннер фильтра по клиенту */}
      {clientIdFilter && (
        <CAlert color="info" className="d-flex align-items-center justify-content-between py-2 mb-3">
          <span>
            👤 Показаны заказы клиента: <strong>{clientNameFilter || clientIdFilter}</strong>
          </span>
          <CButton size="sm" color="info" variant="ghost" onClick={clearClientFilter}>
            <CIcon icon={cilX} className="me-1" />Сбросить фильтр
          </CButton>
        </CAlert>
      )}

      {/* ── Статистика ── */}
      {stats && !clientIdFilter && (
        <CRow className="g-3 mb-4">
          {[
            { label: 'Активных',    value: stats.active_orders,               color: 'primary' },
            { label: 'Готово',      value: stats.done_orders,                  color: 'success' },
            { label: 'Не оплачено', value: stats.unpaid_orders,                color: 'danger'  },
            { label: 'Долг (сом)',  value: stats.total_debt?.toLocaleString(),  color: 'warning' },
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
        {/* ── Табы ── */}
        {!clientIdFilter && (
          <CCardHeader className="pb-0">
            <CNav variant="tabs" className="card-header-tabs">
              {ORDER_TYPES.map(t => (
                <CNavItem key={t.key}>
                  <CNavLink active={typeTab === t.key} onClick={() => setTypeTab(t.key)}
                    style={{ cursor: 'pointer' }}>
                    {t.label}
                    {t.key && stats && (
                      <CBadge color={t.color || 'secondary'} className="ms-1" style={{ fontSize: 10 }}>
                        {stats[`${t.key}_count`] || ''}
                      </CBadge>
                    )}
                  </CNavLink>
                </CNavItem>
              ))}
            </CNav>
          </CCardHeader>
        )}

        <CCardBody>
          {/* ── Фильтры ── */}
          <div className="d-flex gap-2 flex-wrap mb-3 align-items-center">
            <CInputGroup size="sm" style={{ width: 240 }}>
              <CInputGroupText><CIcon icon={cilSearch} /></CInputGroupText>
              <CFormInput
                placeholder="Поиск по №, клиенту, названию..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </CInputGroup>
            {!clientIdFilter && (
              <>
                <CFormSelect size="sm" style={{ width: 150 }} value={statusF}
                  onChange={e => setStatusF(e.target.value)}>
                  <option value="">Все статусы</option>
                  <option value="new">Новый</option>
                  <option value="in_progress">В работе</option>
                  <option value="on_hold">Ожидание</option>
                  <option value="done">Готово</option>
                </CFormSelect>
                <CFormSelect size="sm" style={{ width: 160 }} value={paymentF}
                  onChange={e => setPaymentF(e.target.value)}>
                  <option value="">Все оплаты</option>
                  <option value="unpaid">Не оплачен</option>
                  <option value="partial">Частично</option>
                  <option value="paid">Оплачен</option>
                </CFormSelect>
              </>
            )}
            <div className="ms-auto">
              {hasRole('admin', 'supervisor', 'manager') && (
                <CButton color="primary" size="sm" onClick={() => setModal(true)}>
                  <CIcon icon={cilPlus} className="me-1" />Новый заказ
                </CButton>
              )}
            </div>
          </div>

          {/* ── Таблица ── */}
          {loading ? (
            <div className="text-center py-4"><CSpinner /></div>
          ) : (
            <CTable align="middle" hover responsive style={{ fontSize: 13 }}>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ width: 60 }}>#</CTableHeaderCell>
                  <CTableHeaderCell>Тип</CTableHeaderCell>
                  <CTableHeaderCell>Заказ / Клиент</CTableHeaderCell>
                  <CTableHeaderCell>Этап</CTableHeaderCell>
                  <CTableHeaderCell>Статус</CTableHeaderCell>
                  <CTableHeaderCell>Сумма</CTableHeaderCell>
                  <CTableHeaderCell>Оплата</CTableHeaderCell>
                  <CTableHeaderCell>Срок</CTableHeaderCell>
                  <CTableHeaderCell></CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {visible.length === 0 && (
                  <CTableRow>
                    <CTableDataCell colSpan={9} className="text-center text-body-secondary py-4">
                      Заказы не найдены
                    </CTableDataCell>
                  </CTableRow>
                )}
                {visible.map(o => {
                  const typeDef = ORDER_TYPES.find(t => t.key === o.order_type)
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
                          {STATUS_LABEL[o.status] || o.status}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell>
                        <div className="fw-semibold">{cost.toLocaleString()} сом.</div>
                        {debt > 0 && o.payment_status !== 'paid' && (
                          <div className="text-danger small">Долг: {debt.toLocaleString()}</div>
                        )}
                      </CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={PAYMENT_COLOR[o.payment_status] || 'secondary'}>
                          {PAYMENT_LABEL[o.payment_status]}
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
        </CCardBody>
      </CCard>

      {/* ── Модал создания ── */}
      <CModal size="lg" visible={modal} onClose={handleModalClose}>
        <CModalHeader><CModalTitle>Новый заказ</CModalTitle></CModalHeader>
        <CForm onSubmit={handleCreate}>
          <CModalBody>
            <CRow className="g-3">
              <CCol xs={12}>
                <CFormLabel>Тип заказа *</CFormLabel>
                <div className="d-flex flex-wrap gap-2">
                  {ORDER_TYPES.filter(t => t.key).map(t => (
                    <CButton key={t.key} size="sm" type="button"
                      color={t.color}
                      variant={form.order_type === t.key ? undefined : 'outline'}
                      onClick={() => setForm({ ...form, order_type: t.key })}>
                      {t.label}
                    </CButton>
                  ))}
                </div>
              </CCol>

              <CCol xs={12}>
                <CFormLabel>Название заказа *</CFormLabel>
                <CFormInput required value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder={
                    form.order_type === 'workshop' ? 'Кухонный гарнитур, спальня...' :
                    form.order_type === 'cutting'  ? 'Распил ЛДСП 20 листов...'     :
                    form.order_type === 'painting' ? 'Покраска фасадов МДФ...'      :
                    form.order_type === 'cnc'      ? 'Фрезеровка деталей...'        :
                    'Название заказа'
                  }
                />
              </CCol>

              <CCol xs={12}>
                <CFormLabel>Телефон клиента</CFormLabel>
                <CInputGroup>
                  <CInputGroupText>
                    {phoneSearching ? <CSpinner size="sm" /> : <CIcon icon={cilSearch} />}
                  </CInputGroupText>
                  <CFormInput
                    value={phoneSearch}
                    onChange={e => setPhoneSearch(e.target.value)}
                    placeholder="+992 XX XXX XX XX — введите для поиска"
                  />
                  {(foundClient || phoneNotFound) && (
                    <CButton color="secondary" variant="outline" type="button" onClick={resetClientSearch}>×</CButton>
                  )}
                </CInputGroup>
                {foundClient && (
                  <div className="mt-2 p-2 rounded d-flex align-items-center gap-2"
                    style={{ background: 'var(--cui-success-bg-subtle)', border: '1px solid var(--cui-success-border-subtle)' }}>
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
                  <div className="mt-2 p-2 rounded"
                    style={{ background: 'var(--cui-warning-bg-subtle)', border: '1px solid var(--cui-warning-border-subtle)' }}>
                    <div className="small text-warning fw-semibold mb-2">Клиент не найден — введите имя вручную</div>
                    <CFormInput value={form.client_name}
                      onChange={e => setForm({ ...form, client_name: e.target.value })}
                      placeholder="Имя клиента" size="sm" />
                  </div>
                )}
              </CCol>

              <CCol xs={12} md={6}>
                <CFormLabel>Адрес объекта</CFormLabel>
                <CFormInput value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  placeholder="Адрес доставки или объекта" />
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
              <CCol xs={6} md={3}>
                <CFormLabel>Срок</CFormLabel>
                <CFormInput type="date" value={form.deadline}
                  onChange={e => setForm({ ...form, deadline: e.target.value })} />
              </CCol>
              <CCol xs={12} md={6}>
                <CFormLabel>Предв. стоимость (сом.)</CFormLabel>
                <CFormInput type="number" min="0" step="any" value={form.estimated_cost}
                  onChange={e => setForm({ ...form, estimated_cost: e.target.value })} placeholder="0" />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Описание</CFormLabel>
                <CFormTextarea rows={2} value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Детали заказа, пожелания клиента..." />
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