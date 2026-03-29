import { useEffect, useState, useCallback } from 'react'
import {
  CCard, CCardBody, CCardHeader,
  CTable, CTableBody, CTableDataCell,
  CTableHead, CTableHeaderCell, CTableRow,
  CBadge, CButton, CSpinner, CAlert,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CForm, CFormInput, CFormLabel, CFormSelect, CFormTextarea,
  CRow, CCol, CInputGroup, CInputGroupText,
  CTooltip, CProgress, CNav, CNavItem, CNavLink,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilSearch, cilPencil, cilTrash, cilMoney, cilCash } from '@coreui/icons'
import {
  getSuppliers, createSupplier, updateSupplier, deleteSupplier,
  getSupplierPayments, createSupplierPayment, deleteSupplierPayment,
} from '../../api/warehouse'
import { useAuth } from '../../AuthContext'

// ─── SVG иконки ───────────────────────────────────────────────

const WhatsAppIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#25D366">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

const TelegramIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#229ED9">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
)

// ─── Утилиты ─────────────────────────────────────────────────

const cleanPhone = (phone) => phone.replace(/[\s\-()]/g, '')
const whatsappUrl = (phone) => `https://wa.me/${cleanPhone(phone).replace('+', '')}`
const telegramUrl = (contact) => {
  if (contact.startsWith('@')) return `https://t.me/${contact.slice(1)}`
  const clean = cleanPhone(contact)
  if (clean.match(/^\+?\d+$/)) return `https://t.me/+${clean.replace('+', '')}`
  return `https://t.me/${contact}`
}

const PAYMENT_METHODS = [
  { value: 'cash',   label: 'Наличные' },
  { value: 'card',   label: 'Перевод на карту' },
  { value: 'bank',   label: 'Банковский перевод' },
  { value: 'wallet', label: 'Кошелёк' },
  { value: 'other',  label: 'Другое' },
]
const METHOD_LABEL = Object.fromEntries(PAYMENT_METHODS.map(m => [m.value, m.label]))

const EMPTY_FORM = {
  name: '', phone: '', email: '', address: '',
  whatsapp: '', telegram: '', notes: '', is_active: true,
}
const EMPTY_PAY = {
  amount: '', payment_method: 'cash',
  paid_at: new Date().toISOString().slice(0, 10), notes: '',
}

export default function Suppliers() {
  const { hasRole } = useAuth()
  const canEdit = hasRole('admin', 'supervisor')

  const [suppliers,  setSuppliers]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [search,     setSearch]     = useState('')

  // Модал создания/редактирования
  const [modal,    setModal]    = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form,     setForm]     = useState(EMPTY_FORM)
  const [saving,   setSaving]   = useState(false)

  // Модал расчёта с поставщиком
  const [settleModal,    setSettleModal]    = useState(false)
  const [settleSupplier, setSettleSupplier] = useState(null)
  const [payHistory,     setPayHistory]     = useState([])
  const [payLoading,     setPayLoading]     = useState(false)
  const [payForm,        setPayForm]        = useState(EMPTY_PAY)
  const [paySaving,      setPaySaving]      = useState(false)
  const [payResult,      setPayResult]      = useState(null) // результат распределения
  const [activeTab,      setActiveTab]      = useState('pay') // 'pay' | 'history'

  // ── Загрузка ──────────────────────────────────────────

  const load = useCallback(() => {
    setLoading(true)
    const params = {}
    if (search) params.search = search
    getSuppliers(params)
      .then(res => setSuppliers(res.data.data || []))
      .catch(() => setError('Ошибка загрузки поставщиков'))
      .finally(() => setLoading(false))
  }, [search])

  useEffect(() => { load() }, [load])

  // ── CRUD поставщиков ──────────────────────────────────

  const openCreate = () => { setEditItem(null); setForm(EMPTY_FORM); setModal(true) }

  const openEdit = (s) => {
    setEditItem(s)
    setForm({
      name: s.name, phone: s.phone, email: s.email,
      address: s.address, whatsapp: s.whatsapp, telegram: s.telegram,
      notes: s.notes, is_active: s.is_active,
    })
    setModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editItem) await updateSupplier(editItem.id, form)
      else          await createSupplier(form)
      setModal(false)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (s) => {
    if (!window.confirm(`Удалить поставщика "${s.name}"?`)) return
    try {
      const res = await deleteSupplier(s.id)
      load()
      if (res.data.message?.includes('деактивировано')) setError('ℹ️ ' + res.data.message)
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка удаления')
    }
  }

  // ── Расчёт с поставщиком ──────────────────────────────

  const openSettle = async (s) => {
    setSettleSupplier(s)
    setPayForm(EMPTY_PAY)
    setPayResult(null)
    setActiveTab('pay')
    setSettleModal(true)
    await loadPayHistory(s.id)
  }

  const loadPayHistory = async (supplierId) => {
    setPayLoading(true)
    try {
      const res = await getSupplierPayments(supplierId)
      setPayHistory(res.data.data || [])
    } catch {
      setError('Ошибка загрузки истории платежей')
    } finally {
      setPayLoading(false)
    }
  }

  const handlePayCreate = async (e) => {
    e.preventDefault()
    setPaySaving(true)
    setPayResult(null)
    try {
      const res = await createSupplierPayment(settleSupplier.id, {
        amount:         parseFloat(payForm.amount),
        payment_method: payForm.payment_method,
        paid_at:        payForm.paid_at,
        notes:          payForm.notes,
      })
      setPayResult(res.data)
      setPayForm(EMPTY_PAY)
      await loadPayHistory(settleSupplier.id)
      load() // обновляем список поставщиков (долг)
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка платежа')
    } finally {
      setPaySaving(false)
    }
  }

  const handlePayDelete = async (paymentId) => {
    if (!window.confirm('Удалить этот платёж?')) return
    try {
      await deleteSupplierPayment(settleSupplier.id, paymentId)
      await loadPayHistory(settleSupplier.id)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка удаления')
    }
  }

  // ── Helpers ───────────────────────────────────────────

  const debtColor = (debt) => {
    if (debt <= 0) return 'success'
    return 'danger'
  }

  const statusBadge = (s) => {
    if (!s.total_amount || s.total_amount === 0) return null
    if (s.total_debt <= 0)    return <CBadge color="success">Без долга</CBadge>
    if (s.total_debt < s.total_amount) return <CBadge color="warning">Частично</CBadge>
    return <CBadge color="danger">Долг</CBadge>
  }

  // ─── Render ────────────────────────────────────────────

  return (
    <>
      {error && (
        <CAlert color={error.startsWith('ℹ️') ? 'info' : 'danger'} dismissible onClose={() => setError('')}>
          {error}
        </CAlert>
      )}

      <CCard>
        <CCardHeader>
          <div className="d-flex gap-2 flex-wrap align-items-center">
            <strong>Поставщики</strong>
            <CInputGroup size="sm" style={{ width: 240 }}>
              <CInputGroupText><CIcon icon={cilSearch} /></CInputGroupText>
              <CFormInput
                placeholder="Поиск по имени, телефону..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </CInputGroup>
            <div className="ms-auto">
              {canEdit && (
                <CButton color="primary" size="sm" onClick={openCreate}>
                  <CIcon icon={cilPlus} className="me-1" />Добавить
                </CButton>
              )}
            </div>
          </div>
        </CCardHeader>

        <CCardBody className="p-0">
          {loading ? (
            <div className="text-center py-4"><CSpinner /></div>
          ) : (
            <CTable align="middle" hover responsive style={{ fontSize: 13 }} className="mb-0">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Наименование</CTableHeaderCell>
                  <CTableHeaderCell>Контакты</CTableHeaderCell>
                  <CTableHeaderCell>Мессенджеры</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Общий долг</CTableHeaderCell>
                  <CTableHeaderCell>Статус</CTableHeaderCell>
                  <CTableHeaderCell></CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {suppliers.length === 0 && (
                  <CTableRow>
                    <CTableDataCell colSpan={6} className="text-center text-body-secondary py-4">
                      Поставщики не найдены
                    </CTableDataCell>
                  </CTableRow>
                )}
                {suppliers.map(s => (
                  <CTableRow key={s.id}>
                    <CTableDataCell>
                      <div className="fw-semibold">{s.name}</div>
                      {s.address && <div className="text-body-secondary small">{s.address}</div>}
                    </CTableDataCell>

                    <CTableDataCell>
                      {s.phone && <div className="small">📞 {s.phone}</div>}
                      {s.email && <div className="small text-body-secondary">✉️ {s.email}</div>}
                      {!s.phone && !s.email && '—'}
                    </CTableDataCell>

                    <CTableDataCell>
                      <div className="d-flex gap-2 align-items-center">
                        {s.whatsapp ? (
                          <CTooltip content={`WhatsApp: ${s.whatsapp}`} placement="top">
                            <a href={whatsappUrl(s.whatsapp)} target="_blank" rel="noopener noreferrer"
                              style={{ lineHeight: 1, display: 'inline-flex' }}>
                              <WhatsAppIcon size={22} />
                            </a>
                          </CTooltip>
                        ) : (
                          <span style={{ opacity: 0.2 }}><WhatsAppIcon size={22} /></span>
                        )}
                        {s.telegram ? (
                          <CTooltip content={`Telegram: ${s.telegram}`} placement="top">
                            <a href={telegramUrl(s.telegram)} target="_blank" rel="noopener noreferrer"
                              style={{ lineHeight: 1, display: 'inline-flex' }}>
                              <TelegramIcon size={22} />
                            </a>
                          </CTooltip>
                        ) : (
                          <span style={{ opacity: 0.2 }}><TelegramIcon size={22} /></span>
                        )}
                      </div>
                    </CTableDataCell>

                    {/* Долг */}
                    <CTableDataCell className="text-end">
                      {s.total_amount > 0 ? (
                        <div>
                          <div className={`fw-bold text-${debtColor(s.total_debt)}`}>
                            {s.total_debt > 0
                              ? `${s.total_debt.toLocaleString()} сом`
                              : '—'}
                          </div>
                          <div className="text-body-secondary small">
                            из {s.total_amount.toLocaleString()} сом
                          </div>
                          {s.unpaid_count > 0 && (
                            <div className="text-danger small">
                              {s.unpaid_count} накл.
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-body-secondary">—</span>
                      )}
                    </CTableDataCell>

                    <CTableDataCell>{statusBadge(s)}</CTableDataCell>

                    <CTableDataCell>
                      <div className="d-flex gap-1">
                        {/* Кнопка расчёта — только если есть долг */}
                        {canEdit && s.total_debt > 0 && (
                          <CTooltip content="Расчёт с поставщиком" placement="top">
                            <CButton size="sm" color="success" variant="ghost"
                              onClick={() => openSettle(s)}>
                              <CIcon icon={cilCash} />
                            </CButton>
                          </CTooltip>
                        )}
                        {canEdit && s.total_amount > 0 && s.total_debt <= 0 && (
                          <CTooltip content="История платежей" placement="top">
                            <CButton size="sm" color="info" variant="ghost"
                              onClick={() => openSettle(s)}>
                              <CIcon icon={cilMoney} />
                            </CButton>
                          </CTooltip>
                        )}
                        {canEdit && (
                          <>
                            <CButton size="sm" color="primary" variant="ghost"
                              onClick={() => openEdit(s)}>
                              <CIcon icon={cilPencil} />
                            </CButton>
                            <CButton size="sm" color="danger" variant="ghost"
                              onClick={() => handleDelete(s)}>
                              <CIcon icon={cilTrash} />
                            </CButton>
                          </>
                        )}
                      </div>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>

      {/* ── Модал расчёта с поставщиком ── */}
      <CModal size="lg" visible={settleModal} onClose={() => { setSettleModal(false); setPayResult(null) }}>
        <CModalHeader>
          <CModalTitle>
            💰 Расчёт с поставщиком — {settleSupplier?.name}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {/* Сводка долга */}
          {settleSupplier && (
            <div className="p-3 rounded mb-3"
              style={{ background: 'var(--cui-tertiary-bg)', border: '1px solid var(--cui-border-color)' }}>
              <CRow className="text-center">
                <CCol xs={4}>
                  <div className="small text-body-secondary">Всего накладных</div>
                  <div className="fw-bold fs-5">{settleSupplier.total_amount?.toLocaleString()} сом</div>
                </CCol>
                <CCol xs={4}>
                  <div className="small text-body-secondary">Оплачено</div>
                  <div className="fw-bold fs-5 text-success">{settleSupplier.total_paid?.toLocaleString()} сом</div>
                </CCol>
                <CCol xs={4}>
                  <div className="small text-body-secondary">Долг</div>
                  <div className={`fw-bold fs-5 text-${settleSupplier.total_debt > 0 ? 'danger' : 'success'}`}>
                    {settleSupplier.total_debt?.toLocaleString()} сом
                  </div>
                </CCol>
              </CRow>
              {settleSupplier.total_amount > 0 && (
                <CProgress
                  className="mt-2"
                  value={Math.min(100, Math.round((settleSupplier.total_paid / settleSupplier.total_amount) * 100))}
                  color={settleSupplier.total_debt <= 0 ? 'success' : 'warning'}
                  style={{ height: 6 }}
                />
              )}
            </div>
          )}

          {/* Вкладки */}
          <CNav variant="tabs" className="mb-3">
            <CNavItem>
              <CNavLink active={activeTab === 'pay'} onClick={() => setActiveTab('pay')}
                style={{ cursor: 'pointer' }}>
                Новый платёж
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink active={activeTab === 'history'} onClick={() => setActiveTab('history')}
                style={{ cursor: 'pointer' }}>
                История ({payHistory.length})
              </CNavLink>
            </CNavItem>
          </CNav>

          {/* ── Вкладка: Новый платёж ── */}
          {activeTab === 'pay' && (
            <>
              {/* Результат распределения */}
              {payResult && (
                <div className="mb-3 p-3 rounded"
                  style={{ background: 'var(--cui-success-bg-subtle)', border: '1px solid var(--cui-success-border-subtle)' }}>
                  <div className="fw-semibold text-success mb-2">
                    ✅ Платёж {payResult.total_paid?.toLocaleString()} сом распределён
                  </div>
                  <div className="small mb-1">
                    Долг: <strong>{payResult.total_debt_before?.toLocaleString()}</strong> → <strong className="text-success">{payResult.total_debt_after?.toLocaleString()} сом</strong>
                  </div>
                  {payResult.distribution?.map((d, idx) => (
                    <div key={idx} className="small d-flex justify-content-between align-items-center border-top pt-1 mt-1">
                      <span>
                        {d.receipt_number || 'Переплата'}
                        {d.status === 'paid' && <CBadge color="success" className="ms-1" style={{ fontSize: 10 }}>Закрыта</CBadge>}
                        {d.status === 'partial' && <CBadge color="warning" className="ms-1" style={{ fontSize: 10 }}>Частично</CBadge>}
                        {d.status === 'overpaid' && <CBadge color="info" className="ms-1" style={{ fontSize: 10 }}>Переплата</CBadge>}
                      </span>
                      <span className="text-success fw-semibold">
                        {d.applied?.toLocaleString()} сом
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <CForm onSubmit={handlePayCreate}>
                <CRow className="g-3">
                  <CCol xs={12} md={6}>
                    <CFormLabel>Сумма платежа (сом) *</CFormLabel>
                    <CFormInput
                      required type="number" min="0.01" step="any"
                      value={payForm.amount}
                      onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                      placeholder={`Долг: ${settleSupplier?.total_debt?.toLocaleString()} сом`}
                    />
                    {settleSupplier?.total_debt > 0 && (
                      <div className="mt-1">
                        <CButton size="sm" color="secondary" variant="outline" type="button"
                          onClick={() => setPayForm({ ...payForm, amount: settleSupplier.total_debt })}>
                          Оплатить весь долг ({settleSupplier.total_debt?.toLocaleString()} сом)
                        </CButton>
                      </div>
                    )}
                  </CCol>
                  <CCol xs={12} md={6}>
                    <CFormLabel>Метод оплаты *</CFormLabel>
                    <CFormSelect value={payForm.payment_method}
                      onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })}>
                      {PAYMENT_METHODS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </CFormSelect>
                  </CCol>
                  <CCol xs={12} md={6}>
                    <CFormLabel>Дата оплаты</CFormLabel>
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
                  💡 Платёж автоматически распределится по накладным начиная со старых
                </div>

                <div className="mt-3 d-flex justify-content-end">
                  <CButton type="submit" color="success" disabled={paySaving || !payForm.amount}>
                    {paySaving ? <CSpinner size="sm" /> : '💰 Провести платёж'}
                  </CButton>
                </div>
              </CForm>
            </>
          )}

          {/* ── Вкладка: История платежей ── */}
          {activeTab === 'history' && (
            <>
              {payLoading ? (
                <div className="text-center py-3"><CSpinner size="sm" /></div>
              ) : payHistory.length === 0 ? (
                <div className="text-center text-body-secondary py-3">Платежей не найдено</div>
              ) : (
                <CTable size="sm" hover responsive style={{ fontSize: 12 }}>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Дата</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Сумма</CTableHeaderCell>
                      <CTableHeaderCell>Метод</CTableHeaderCell>
                      <CTableHeaderCell>Накладная</CTableHeaderCell>
                      <CTableHeaderCell>Примечание</CTableHeaderCell>
                      {canEdit && <CTableHeaderCell></CTableHeaderCell>}
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {payHistory.map(p => (
                      <CTableRow key={p.id}>
                        <CTableDataCell>{p.paid_at}</CTableDataCell>
                        <CTableDataCell className="text-end fw-semibold text-success">
                          {p.amount?.toLocaleString()} сом
                        </CTableDataCell>
                        <CTableDataCell>
                          <CBadge color="light" className="text-dark">
                            {METHOD_LABEL[p.payment_method] || p.payment_method}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell>
                          {p.receipt_number
                            ? <CBadge color="secondary">{p.receipt_number}</CBadge>
                            : <span className="text-body-secondary">—</span>}
                          {p.is_supplier_payment && (
                            <CBadge color="info" className="ms-1" style={{ fontSize: 10 }}>общий</CBadge>
                          )}
                        </CTableDataCell>
                        <CTableDataCell className="text-body-secondary">
                          {p.notes || '—'}
                        </CTableDataCell>
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

                    {/* Итог */}
                    <CTableRow>
                      <CTableDataCell className="fw-bold">Итого оплачено:</CTableDataCell>
                      <CTableDataCell className="text-end fw-bold text-success">
                        {payHistory.reduce((s, p) => s + (p.amount || 0), 0).toLocaleString()} сом
                      </CTableDataCell>
                      <CTableDataCell colSpan={canEdit ? 4 : 3}></CTableDataCell>
                    </CTableRow>
                  </CTableBody>
                </CTable>
              )}
            </>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline"
            onClick={() => { setSettleModal(false); setPayResult(null) }}>
            Закрыть
          </CButton>
        </CModalFooter>
      </CModal>

      {/* ── Модал создания/редактирования поставщика ── */}
      <CModal visible={modal} onClose={() => setModal(false)}>
        <CModalHeader>
          <CModalTitle>{editItem ? 'Редактировать поставщика' : 'Новый поставщик'}</CModalTitle>
        </CModalHeader>
        <CForm onSubmit={handleSave}>
          <CModalBody>
            <CRow className="g-3">
              <CCol xs={12}>
                <CFormLabel>Наименование *</CFormLabel>
                <CFormInput required value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="ООО Лесторг..." />
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Телефон</CFormLabel>
                <CFormInput value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="+992 XX XXX XX XX" />
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Email</CFormLabel>
                <CFormInput type="email" value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="info@supplier.com" />
              </CCol>
              <CCol xs={6}>
                <CFormLabel><WhatsAppIcon size={14} /> WhatsApp</CFormLabel>
                <CFormInput value={form.whatsapp}
                  onChange={e => setForm({ ...form, whatsapp: e.target.value })}
                  placeholder="+992 XX XXX XX XX" />
              </CCol>
              <CCol xs={6}>
                <CFormLabel><TelegramIcon size={14} /> Telegram</CFormLabel>
                <CFormInput value={form.telegram}
                  onChange={e => setForm({ ...form, telegram: e.target.value })}
                  placeholder="@username или номер" />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Адрес</CFormLabel>
                <CFormInput value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  placeholder="Город, улица..." />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Примечание</CFormLabel>
                <CFormInput value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })} />
              </CCol>
              {editItem && (
                <CCol xs={12}>
                  <CFormLabel>Статус</CFormLabel>
                  <CFormSelect value={form.is_active ? 'true' : 'false'}
                    onChange={e => setForm({ ...form, is_active: e.target.value === 'true' })}>
                    <option value="true">Активен</option>
                    <option value="false">Неактивен</option>
                  </CFormSelect>
                </CCol>
              )}
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setModal(false)}>Отмена</CButton>
            <CButton type="submit" color="primary" disabled={saving}>
              {saving ? <CSpinner size="sm" /> : 'Сохранить'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>
    </>
  )
}