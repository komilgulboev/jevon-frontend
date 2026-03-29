import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CCard, CCardBody, CCardHeader,
  CTable, CTableBody, CTableDataCell,
  CTableHead, CTableHeaderCell, CTableRow,
  CBadge, CButton, CSpinner, CAlert,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CForm, CFormInput, CFormLabel, CFormSelect,
  CRow, CCol, CInputGroup, CInputGroupText,
  CNav, CNavItem, CNavLink, CProgress, CTooltip,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSearch, cilCash, cilMoney, cilTrash, cilFolderOpen } from '@coreui/icons'
import {
  getClientsDebt, getClientOrders,
  getClientPayments, createClientPayment, deleteClientPayment,
} from '../../api/clients'
import { useAuth } from '../../AuthContext'

// ─── Константы ────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { value: 'cash',   label: 'Наличные' },
  { value: 'card',   label: 'Перевод на карту' },
  { value: 'bank',   label: 'Банковский перевод' },
  { value: 'wallet', label: 'Кошелёк' },
  { value: 'other',  label: 'Другое' },
]
const METHOD_LABEL = Object.fromEntries(PAYMENT_METHODS.map(m => [m.value, m.label]))

const ORDER_TYPE_LABEL = {
  workshop: 'Заказ цеха', cutting: 'Распил', painting: 'Покраска',
  cnc: 'ЧПУ', soft_fabric: 'Обивка', soft_furniture: 'Мягкая мебель',
}
const ORDER_TYPE_COLOR = {
  workshop: 'primary', cutting: 'warning', painting: 'danger',
  cnc: 'info', soft_fabric: 'success', soft_furniture: 'dark',
}
const PAY_STATUS_COLOR = { unpaid: 'danger', partial: 'warning', paid: 'success' }
const PAY_STATUS_LABEL = { unpaid: 'Не оплачен', partial: 'Частично', paid: 'Оплачен' }

const EMPTY_PAY = {
  amount: '', payment_method: 'cash',
  paid_at: new Date().toISOString().slice(0, 10), notes: '',
}

const DEBT_FILTERS = [
  { value: '',       label: 'Все клиенты' },
  { value: 'debt',   label: 'Есть долг' },
  { value: 'credit', label: 'Переплата' },
  { value: 'clear',  label: 'Без долга' },
]

export default function Clients() {
  const { hasRole } = useAuth()
  const navigate    = useNavigate()
  const canEdit     = hasRole('admin', 'supervisor', 'manager')

  const [clients,    setClients]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [search,     setSearch]     = useState('')
  const [debtFilter, setDebtFilter] = useState('')

  // Модал расчёта
  const [modal,      setModal]      = useState(false)
  const [selClient,  setSelClient]  = useState(null)
  const [orders,     setOrders]     = useState([])
  const [payments,   setPayments]   = useState([])
  const [detailLoad, setDetailLoad] = useState(false)
  const [activeTab,  setActiveTab]  = useState('pay')
  const [payForm,    setPayForm]    = useState(EMPTY_PAY)
  const [paySaving,  setPaySaving]  = useState(false)
  const [payResult,  setPayResult]  = useState(null)

  // ── Загрузка списка ───────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getClientsDebt({ search, filter: debtFilter })
      const data = res.data.data || []
      setClients(data)
      // Обновляем selClient если модал открыт
      if (selClient) {
        const updated = data.find(c => c.client_id === selClient.client_id)
        if (updated) setSelClient(updated)
      }
    } catch {
      setError('Ошибка загрузки клиентов')
    } finally {
      setLoading(false)
    }
  }, [search, debtFilter]) // selClient намеренно не в deps — избегаем цикла

  useEffect(() => { load() }, [load])

  // ── Открытие модала ───────────────────────────────────

  const openModal = async (client) => {
    setSelClient(client)
    setPayForm(EMPTY_PAY)
    setPayResult(null)
    setActiveTab('pay')
    setModal(true)
    await loadDetail(client.client_id)
  }

  const loadDetail = async (clientId) => {
    setDetailLoad(true)
    try {
      const [ordRes, payRes] = await Promise.all([
        getClientOrders(clientId),
        getClientPayments(clientId),
      ])
      setOrders(ordRes.data.data || [])
      setPayments(payRes.data.data || [])
    } catch {
      setError('Ошибка загрузки данных клиента')
    } finally {
      setDetailLoad(false)
    }
  }

  // ── Провести платёж ───────────────────────────────────

  const handlePayCreate = async (e) => {
    e.preventDefault()
    setPaySaving(true)
    setPayResult(null)
    try {
      const res = await createClientPayment(selClient.client_id, {
        amount:         parseFloat(payForm.amount),
        payment_method: payForm.payment_method,
        paid_at:        payForm.paid_at,
        notes:          payForm.notes,
      })
      setPayResult(res.data)
      setPayForm(EMPTY_PAY)
      // Обновляем детали и список
      await loadDetail(selClient.client_id)
      // Перегружаем список и обновляем selClient
      const listRes = await getClientsDebt({ search, filter: debtFilter })
      const data = listRes.data.data || []
      setClients(data)
      const updated = data.find(c => c.client_id === selClient.client_id)
      if (updated) setSelClient(updated)
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка платежа')
    } finally {
      setPaySaving(false)
    }
  }

  // ── Удалить платёж ────────────────────────────────────

  const handlePayDelete = async (paymentId) => {
    if (!window.confirm('Удалить этот платёж?')) return
    try {
      await deleteClientPayment(selClient.client_id, paymentId)
      await loadDetail(selClient.client_id)
      const listRes = await getClientsDebt({ search, filter: debtFilter })
      const data = listRes.data.data || []
      setClients(data)
      const updated = data.find(c => c.client_id === selClient.client_id)
      if (updated) setSelClient(updated)
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка удаления')
    }
  }

  // ── Перейти к заказам клиента ─────────────────────────

  const goToOrders = (c) => {
    navigate(`/orders?client=${c.client_id}&client_name=${encodeURIComponent(c.client_name)}`)
  }

  // ── Helpers ───────────────────────────────────────────

  const netDebtColor = (c) => {
    if (c.net_debt > 0)       return 'danger'
    if (c.credit_balance > 0) return 'success'
    return 'secondary'
  }

  const paidPercent = (c) =>
    c.total_amount > 0
      ? Math.min(100, Math.round((c.total_paid / c.total_amount) * 100))
      : 100

  // ── Render ────────────────────────────────────────────

  return (
    <>
      {error && (
        <CAlert color="danger" dismissible onClose={() => setError('')}>{error}</CAlert>
      )}

      <CCard>
        <CCardHeader>
          <div className="d-flex gap-2 flex-wrap align-items-center">
            <strong>Клиенты</strong>
            <CInputGroup size="sm" style={{ width: 240 }}>
              <CInputGroupText><CIcon icon={cilSearch} /></CInputGroupText>
              <CFormInput
                placeholder="Поиск по имени, телефону..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </CInputGroup>
            <CFormSelect size="sm" style={{ width: 160 }}
              value={debtFilter} onChange={e => setDebtFilter(e.target.value)}>
              {DEBT_FILTERS.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </CFormSelect>
          </div>
        </CCardHeader>

        <CCardBody className="p-0">
          {loading ? (
            <div className="text-center py-4"><CSpinner /></div>
          ) : (
            <CTable align="middle" hover responsive style={{ fontSize: 13 }} className="mb-0">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Клиент</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Заказов</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Сумма</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Оплачено</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Долг</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Баланс</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 120 }}>Статус</CTableHeaderCell>
                  <CTableHeaderCell></CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {clients.length === 0 && (
                  <CTableRow>
                    <CTableDataCell colSpan={8} className="text-center text-body-secondary py-4">
                      Клиенты не найдены
                    </CTableDataCell>
                  </CTableRow>
                )}
                {clients.map(c => (
                  <CTableRow key={c.client_id}>
                    <CTableDataCell>
                      <div className="fw-semibold">{c.client_name}</div>
                      {c.phone && <div className="text-body-secondary small">📞 {c.phone}</div>}
                    </CTableDataCell>
                    <CTableDataCell className="text-end text-body-secondary">
                      {c.total_orders || '—'}
                    </CTableDataCell>
                    <CTableDataCell className="text-end">
                      {c.total_amount > 0 ? `${c.total_amount.toLocaleString()} сом` : '—'}
                    </CTableDataCell>
                    <CTableDataCell className="text-end text-success">
                      {c.total_paid > 0 ? `${c.total_paid.toLocaleString()} сом` : '—'}
                    </CTableDataCell>

                    {/* Долг */}
                    <CTableDataCell className="text-end">
                      {c.net_debt > 0
                        ? <span className="fw-bold text-danger">{c.net_debt.toLocaleString()} сом</span>
                        : <span className="text-body-secondary">—</span>}
                    </CTableDataCell>

                    {/* Баланс (переплата) */}
                    <CTableDataCell className="text-end">
                      {c.credit_balance > 0
                        ? <span className="fw-bold text-success">+{c.credit_balance.toLocaleString()} сом</span>
                        : <span className="text-body-secondary">—</span>}
                    </CTableDataCell>

                    {/* Статус */}
                    <CTableDataCell>
                      {c.total_amount > 0 && (
                        <div>
                          <CProgress
                            value={paidPercent(c)}
                            color={c.net_debt > 0 ? 'danger' : 'success'}
                            style={{ height: 4, marginBottom: 4 }}
                          />
                          <CBadge
                            color={c.net_debt > 0 ? 'danger' : c.credit_balance > 0 ? 'success' : 'secondary'}
                            style={{ fontSize: 10 }}>
                            {c.net_debt > 0 ? 'Долг' : c.credit_balance > 0 ? 'Переплата' : 'Оплачен'}
                          </CBadge>
                        </div>
                      )}
                    </CTableDataCell>

                    {/* Действия */}
                    <CTableDataCell>
                      <div className="d-flex gap-1">
                        {canEdit && c.total_amount > 0 && (
                          <CTooltip content={c.net_debt > 0 ? 'Принять оплату' : 'История платежей'}>
                            <CButton size="sm"
                              color={c.net_debt > 0 ? 'success' : 'info'}
                              variant="ghost"
                              onClick={() => openModal(c)}>
                              <CIcon icon={c.net_debt > 0 ? cilCash : cilMoney} />
                            </CButton>
                          </CTooltip>
                        )}
                        <CTooltip content="Все заказы клиента">
                          <CButton size="sm" color="primary" variant="ghost"
                            onClick={() => goToOrders(c)}>
                            <CIcon icon={cilFolderOpen} />
                          </CButton>
                        </CTooltip>
                      </div>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>

      {/* ── Модал расчёта ── */}
      <CModal size="xl" visible={modal} onClose={() => { setModal(false); setPayResult(null) }}>
        <CModalHeader>
          <CModalTitle>💰 Расчёт — {selClient?.client_name}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {/* Сводка */}
          {selClient && (
            <div className="p-3 rounded mb-3"
              style={{ background: 'var(--cui-tertiary-bg)', border: '1px solid var(--cui-border-color)' }}>
              <CRow className="text-center g-2">
                <CCol xs={3}>
                  <div className="small text-body-secondary">Сумма заказов</div>
                  <div className="fw-bold">{selClient.total_amount?.toLocaleString()} сом</div>
                </CCol>
                <CCol xs={3}>
                  <div className="small text-body-secondary">Оплачено</div>
                  <div className="fw-bold text-success">{selClient.total_paid?.toLocaleString()} сом</div>
                </CCol>
                <CCol xs={3}>
                  <div className="small text-body-secondary">Долг</div>
                  <div className={`fw-bold text-${selClient.net_debt > 0 ? 'danger' : 'secondary'}`}>
                    {selClient.net_debt > 0 ? `${selClient.net_debt?.toLocaleString()} сом` : '—'}
                  </div>
                </CCol>
                <CCol xs={3}>
                  <div className="small text-body-secondary">Баланс</div>
                  <div className={`fw-bold text-${selClient.credit_balance > 0 ? 'success' : 'secondary'}`}>
                    {selClient.credit_balance > 0
                      ? `+${selClient.credit_balance?.toLocaleString()} сом`
                      : '—'}
                  </div>
                </CCol>
              </CRow>
              {selClient.total_amount > 0 && (
                <CProgress className="mt-2"
                  value={paidPercent(selClient)}
                  color={selClient.net_debt > 0 ? 'warning' : 'success'}
                  style={{ height: 6 }} />
              )}
            </div>
          )}

          {/* Вкладки */}
          <CNav variant="tabs" className="mb-3">
            {[
              { key: 'pay',     label: 'Новый платёж' },
              { key: 'orders',  label: `Заказы (${orders.length})` },
              { key: 'history', label: `История (${payments.length})` },
            ].map(t => (
              <CNavItem key={t.key}>
                <CNavLink active={activeTab === t.key} onClick={() => setActiveTab(t.key)}
                  style={{ cursor: 'pointer' }}>
                  {t.label}
                </CNavLink>
              </CNavItem>
            ))}
          </CNav>

          {detailLoad && <div className="text-center py-3"><CSpinner size="sm" /></div>}

          {/* ── Новый платёж ── */}
          {!detailLoad && activeTab === 'pay' && (
            <>
              {payResult && (
                <div className="mb-3 p-3 rounded"
                  style={{ background: 'var(--cui-success-bg-subtle)', border: '1px solid var(--cui-success-border-subtle)' }}>
                  <div className="fw-semibold text-success mb-2">
                    ✅ Платёж {payResult.total_paid?.toLocaleString()} сом проведён
                  </div>
                  <div className="small mb-2">
                    Долг: <strong>{payResult.debt_before?.toLocaleString()}</strong>
                    {' → '}
                    <strong className="text-success">{payResult.debt_after?.toLocaleString()} сом</strong>
                    {payResult.credit_balance > 0 && (
                      <span className="ms-2 text-success fw-semibold">
                        | На балансе: +{payResult.credit_balance?.toLocaleString()} сом
                      </span>
                    )}
                  </div>
                  {payResult.distribution?.map((d, idx) => (
                    <div key={idx}
                      className="small d-flex justify-content-between align-items-center border-top pt-1 mt-1">
                      <span>
                        {d.order_number ? `#${d.order_number} ${d.order_title}` : d.order_title}
                        {d.status === 'paid'    && <CBadge color="success" className="ms-1" style={{ fontSize: 10 }}>Закрыт</CBadge>}
                        {d.status === 'partial' && <CBadge color="warning" className="ms-1" style={{ fontSize: 10 }}>Частично</CBadge>}
                        {d.status === 'balance' && <CBadge color="info"    className="ms-1" style={{ fontSize: 10 }}>На баланс</CBadge>}
                      </span>
                      <span className="text-success fw-semibold">{d.applied?.toLocaleString()} сом</span>
                    </div>
                  ))}
                </div>
              )}

              <CForm onSubmit={handlePayCreate}>
                <CRow className="g-3">
                  <CCol xs={12} md={6}>
                    <CFormLabel>Сумма (сом) *</CFormLabel>
                    <CFormInput required type="number" min="0.01" step="any"
                      value={payForm.amount}
                      onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                      placeholder={selClient?.net_debt > 0
                        ? `Долг: ${selClient.net_debt?.toLocaleString()} сом`
                        : 'Сумма платежа'} />
                    {selClient?.net_debt > 0 && (
                      <div className="mt-1">
                        <CButton size="sm" color="secondary" variant="outline" type="button"
                          onClick={() => setPayForm({ ...payForm, amount: selClient.net_debt })}>
                          Погасить весь долг ({selClient.net_debt?.toLocaleString()} сом)
                        </CButton>
                      </div>
                    )}
                  </CCol>
                  <CCol xs={12} md={6}>
                    <CFormLabel>Метод оплаты *</CFormLabel>
                    <CFormSelect value={payForm.payment_method}
                      onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })}>
                      {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </CFormSelect>
                  </CCol>
                  <CCol xs={12} md={6}>
                    <CFormLabel>Дата</CFormLabel>
                    <CFormInput type="date" value={payForm.paid_at}
                      onChange={e => setPayForm({ ...payForm, paid_at: e.target.value })} />
                  </CCol>
                  <CCol xs={12} md={6}>
                    <CFormLabel>Примечание</CFormLabel>
                    <CFormInput value={payForm.notes}
                      onChange={e => setPayForm({ ...payForm, notes: e.target.value })}
                      placeholder="Чек №, комментарий..." />
                  </CCol>
                </CRow>
                <div className="mt-3 p-2 rounded small text-body-secondary"
                  style={{ background: 'var(--cui-tertiary-bg)' }}>
                  💡 Платёж распределится по заказам начиная со старых. Остаток останется на балансе клиента.
                </div>
                <div className="mt-3 d-flex justify-content-end">
                  <CButton type="submit" color="success" disabled={paySaving || !payForm.amount}>
                    {paySaving ? <CSpinner size="sm" /> : '💰 Провести платёж'}
                  </CButton>
                </div>
              </CForm>
            </>
          )}

          {/* ── Заказы ── */}
          {!detailLoad && activeTab === 'orders' && (
            <CTable size="sm" hover responsive style={{ fontSize: 12 }}>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>#</CTableHeaderCell>
                  <CTableHeaderCell>Тип</CTableHeaderCell>
                  <CTableHeaderCell>Название</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Сумма</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Оплачено</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Долг</CTableHeaderCell>
                  <CTableHeaderCell>Оплата</CTableHeaderCell>
                  <CTableHeaderCell></CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {orders.length === 0 && (
                  <CTableRow>
                    <CTableDataCell colSpan={8} className="text-center text-body-secondary">Заказов нет</CTableDataCell>
                  </CTableRow>
                )}
                {orders.map(o => (
                  <CTableRow key={o.id}>
                    <CTableDataCell><CBadge color="secondary">#{o.order_number}</CBadge></CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={ORDER_TYPE_COLOR[o.order_type] || 'secondary'} style={{ fontSize: 10 }}>
                        {ORDER_TYPE_LABEL[o.order_type] || o.order_type}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>{o.title}</CTableDataCell>
                    <CTableDataCell className="text-end">
                      {o.final_cost > 0 ? `${o.final_cost.toLocaleString()} сом` : '—'}
                    </CTableDataCell>
                    <CTableDataCell className="text-end text-success">
                      {o.paid_amount > 0 ? `${o.paid_amount.toLocaleString()} сом` : '—'}
                    </CTableDataCell>
                    <CTableDataCell className="text-end text-danger">
                      {o.debt > 0 ? `${o.debt.toLocaleString()} сом` : '—'}
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={PAY_STATUS_COLOR[o.payment_status] || 'secondary'} style={{ fontSize: 10 }}>
                        {PAY_STATUS_LABEL[o.payment_status] || o.payment_status}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CButton size="sm" color="primary" variant="ghost"
                        onClick={() => navigate(`/orders/${o.id}`)}>
                        <CIcon icon={cilFolderOpen} />
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                ))}
                {orders.length > 0 && (
                  <CTableRow>
                    <CTableDataCell colSpan={3} className="text-end fw-bold">Итого:</CTableDataCell>
                    <CTableDataCell className="text-end fw-bold">
                      {orders.reduce((s, o) => s + o.final_cost, 0).toLocaleString()} сом
                    </CTableDataCell>
                    <CTableDataCell className="text-end fw-bold text-success">
                      {orders.reduce((s, o) => s + o.paid_amount, 0).toLocaleString()} сом
                    </CTableDataCell>
                    <CTableDataCell className="text-end fw-bold text-danger">
                      {orders.reduce((s, o) => s + o.debt, 0).toLocaleString()} сом
                    </CTableDataCell>
                    <CTableDataCell colSpan={2}></CTableDataCell>
                  </CTableRow>
                )}
              </CTableBody>
            </CTable>
          )}

          {/* ── История платежей ── */}
          {!detailLoad && activeTab === 'history' && (
            <CTable size="sm" hover responsive style={{ fontSize: 12 }}>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Дата</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Сумма</CTableHeaderCell>
                  <CTableHeaderCell>Метод</CTableHeaderCell>
                  <CTableHeaderCell>Заказ</CTableHeaderCell>
                  <CTableHeaderCell>Примечание</CTableHeaderCell>
                  {canEdit && <CTableHeaderCell></CTableHeaderCell>}
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {payments.length === 0 && (
                  <CTableRow>
                    <CTableDataCell colSpan={6} className="text-center text-body-secondary">
                      Платежей нет
                    </CTableDataCell>
                  </CTableRow>
                )}
                {payments.map(p => (
                  <CTableRow key={p.id}>
                    <CTableDataCell>{p.paid_at}</CTableDataCell>
                    <CTableDataCell className="text-end fw-semibold text-success">
                      {p.amount?.toLocaleString()} сом
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color="light" className="text-dark">
                        {METHOD_LABEL[p.payment_method] || p.payment_method || '—'}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      {p.order_number
                        ? <span className="text-primary" style={{ cursor: 'pointer' }}
                            onClick={() => navigate(`/orders/${p.order_id}`)}>
                            #{p.order_number}
                          </span>
                        : <span className="text-body-secondary">На баланс</span>}
                      {p.is_client_payment && (
                        <CBadge color="info" className="ms-1" style={{ fontSize: 10 }}>общий</CBadge>
                      )}
                    </CTableDataCell>
                    <CTableDataCell className="text-body-secondary">{p.notes || '—'}</CTableDataCell>
                    {canEdit && (
                      <CTableDataCell>
                        <CButton size="sm" color="danger" variant="ghost"
                          onClick={() => handlePayDelete(p.id)}>
                          <CIcon icon={cilTrash} />
                        </CButton>
                      </CTableDataCell>
                    )}
                  </CTableRow>
                ))}
                {payments.length > 0 && (
                  <CTableRow>
                    <CTableDataCell className="fw-bold">Итого оплачено:</CTableDataCell>
                    <CTableDataCell className="text-end fw-bold text-success">
                      {payments.reduce((s, p) => s + (p.amount || 0), 0).toLocaleString()} сом
                    </CTableDataCell>
                    <CTableDataCell colSpan={canEdit ? 4 : 3}></CTableDataCell>
                  </CTableRow>
                )}
              </CTableBody>
            </CTable>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline"
            onClick={() => { setModal(false); setPayResult(null) }}>
            Закрыть
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}