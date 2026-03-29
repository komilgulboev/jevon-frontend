import { useEffect, useState, useCallback } from 'react'
import {
  CCard, CCardBody, CCardHeader,
  CTable, CTableBody, CTableDataCell,
  CTableHead, CTableHeaderCell, CTableRow,
  CBadge, CButton, CSpinner, CAlert,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CForm, CFormInput, CFormLabel, CFormSelect,
  CRow, CCol, CInputGroup, CInputGroupText,
  CNav, CNavItem, CNavLink, CTabContent, CTabPane,
  CProgress,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilPlus, cilSearch, cilPencil, cilTrash,
  cilChevronBottom, cilChevronTop, cilMoney,
} from '@coreui/icons'
import {
  getReceipts, getReceipt, createReceipt, updateReceipt, deleteReceipt,
  addReceiptItem, deleteReceiptItem,
  createPayment, deletePayment,
  getSuppliers, getItems,
} from '../../api/warehouse'
import { useAuth } from '../../AuthContext'

// ─── Константы ────────────────────────────────────────────────

const PAYMENT_COLOR = { unpaid: 'danger', partial: 'warning', paid: 'success' }
const PAYMENT_LABEL = { unpaid: 'Не оплачено', partial: 'Частично', paid: 'Оплачено' }

const EMPTY_FORM = {
  number: '', supplier_id: '', receipt_date: new Date().toISOString().slice(0, 10),
  notes: '', items: [],
}
const EMPTY_ITEM    = { item_id: '', quantity: '', price: '', notes: '' }
const EMPTY_PAYMENT = { amount: '', paid_at: new Date().toISOString().slice(0, 10), notes: '' }

export default function Receipts() {
  const { hasRole } = useAuth()
  const canEdit = hasRole('admin', 'supervisor')

  const [receipts,  setReceipts]  = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [items,     setItems]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [search,    setSearch]    = useState('')

  // Раскрытая накладная
  const [expanded, setExpanded] = useState(null)
  const [detail,   setDetail]   = useState(null)
  const [activeTab, setActiveTab] = useState('items') // 'items' | 'payments'

  // Модал создания накладной
  const [modal,  setModal]  = useState(false)
  const [form,   setForm]   = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Модал редактирования шапки
  const [editModal, setEditModal] = useState(false)
  const [editRec,   setEditRec]   = useState(null)
  const [editForm,  setEditForm]  = useState({})

  // Модал добавления строки
  const [addItemModal,  setAddItemModal]  = useState(false)
  const [addItemRecId,  setAddItemRecId]  = useState(null)
  const [addItemForm,   setAddItemForm]   = useState(EMPTY_ITEM)
  const [addItemSaving, setAddItemSaving] = useState(false)

  // Модал добавления платежа
  const [payModal,   setPayModal]   = useState(false)
  const [payRecId,   setPayRecId]   = useState(null)
  const [payForm,    setPayForm]    = useState(EMPTY_PAYMENT)
  const [paySaving,  setPaySaving]  = useState(false)

  // ── Загрузка ──────────────────────────────────────────

  const load = useCallback(() => {
    setLoading(true)
    const params = {}
    if (search) params.search = search
    Promise.all([
      getReceipts(params),
      getSuppliers({}),
      getItems({ active: 'true' }),
    ])
      .then(([recRes, supRes, itemsRes]) => {
        setReceipts(recRes.data.data || [])
        setSuppliers(supRes.data.data || [])
        setItems(itemsRes.data.data || [])
      })
      .catch(() => setError('Ошибка загрузки накладных'))
      .finally(() => setLoading(false))
  }, [search])

  useEffect(() => { load() }, [load])

  // ── Раскрытие накладной ───────────────────────────────

  const toggleExpand = async (id) => {
    if (expanded === id) {
      setExpanded(null)
      setDetail(null)
      return
    }
    setExpanded(id)
    setActiveTab('items')
    await reloadDetail(id)
  }

  const reloadDetail = async (id) => {
    try {
      const res = await getReceipt(id)
      setDetail(res.data)
    } catch {
      setError('Ошибка загрузки накладной')
    }
  }

  // ── Создание накладной ────────────────────────────────

  const addFormItem = () =>
    setForm(prev => ({ ...prev, items: [...prev.items, { ...EMPTY_ITEM }] }))

  const updateFormItem = (idx, field, value) =>
    setForm(prev => {
      const items = [...prev.items]
      items[idx] = { ...items[idx], [field]: value }
      return { ...prev, items }
    })

  const removeFormItem = (idx) =>
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))

  const handleCreate = async (e) => {
    e.preventDefault()
    if (form.items.length === 0) { setError('Добавьте хотя бы одну строку'); return }
    setSaving(true)
    try {
      await createReceipt({
        ...form,
        supplier_id: form.supplier_id || null,
        items: form.items.map(it => ({
          item_id:  it.item_id,
          quantity: parseFloat(it.quantity),
          price:    parseFloat(it.price) || 0,
          notes:    it.notes,
        })),
      })
      setModal(false)
      setForm(EMPTY_FORM)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка создания')
    } finally {
      setSaving(false)
    }
  }

  // ── Редактирование шапки ──────────────────────────────

  const openEdit = (rec) => {
    setEditRec(rec)
    setEditForm({
      number:       rec.number,
      supplier_id:  rec.supplier_id || '',
      receipt_date: rec.receipt_date,
      notes:        rec.notes,
    })
    setEditModal(true)
  }

  const handleEditSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateReceipt(editRec.id, { ...editForm, supplier_id: editForm.supplier_id || null })
      setEditModal(false)
      load()
      if (expanded === editRec.id) await reloadDetail(editRec.id)
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  // ── Удаление накладной ────────────────────────────────

  const handleDelete = async (rec) => {
    if (!window.confirm(`Удалить накладную ${rec.number || '(без номера)'}?`)) return
    try {
      await deleteReceipt(rec.id)
      if (expanded === rec.id) { setExpanded(null); setDetail(null) }
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка удаления')
    }
  }

  // ── Строки накладной ──────────────────────────────────

  const openAddItem = (recId) => {
    setAddItemRecId(recId)
    setAddItemForm(EMPTY_ITEM)
    setAddItemModal(true)
  }

  const handleAddItem = async (e) => {
    e.preventDefault()
    setAddItemSaving(true)
    try {
      await addReceiptItem(addItemRecId, {
        item_id:  addItemForm.item_id,
        quantity: parseFloat(addItemForm.quantity),
        price:    parseFloat(addItemForm.price) || 0,
        notes:    addItemForm.notes,
      })
      setAddItemModal(false)
      await reloadDetail(addItemRecId)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка добавления строки')
    } finally {
      setAddItemSaving(false)
    }
  }

  const handleDeleteItem = async (receiptId, itemId, itemName) => {
    if (!window.confirm(`Удалить строку "${itemName}"?`)) return
    try {
      await deleteReceiptItem(receiptId, itemId)
      await reloadDetail(receiptId)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка удаления строки')
    }
  }

  // ── Платежи ───────────────────────────────────────────

  const openPayModal = (recId) => {
    setPayRecId(recId)
    setPayForm(EMPTY_PAYMENT)
    setPayModal(true)
  }

  const handlePayCreate = async (e) => {
    e.preventDefault()
    setPaySaving(true)
    try {
      await createPayment(payRecId, {
        amount: parseFloat(payForm.amount),
        paid_at: payForm.paid_at || undefined,
        notes:   payForm.notes,
      })
      setPayModal(false)
      await reloadDetail(payRecId)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка добавления платежа')
    } finally {
      setPaySaving(false)
    }
  }

  const handlePayDelete = async (receiptId, paymentId) => {
    if (!window.confirm('Удалить платёж?')) return
    try {
      await deletePayment(receiptId, paymentId)
      await reloadDetail(receiptId)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка удаления платежа')
    }
  }

  // ── Render ────────────────────────────────────────────

  const debt = (rec) => Math.max(0, (rec.total_amount || 0) - (rec.paid_amount || 0))
  const paidPercent = (rec) => rec.total_amount > 0
    ? Math.min(100, Math.round((rec.paid_amount / rec.total_amount) * 100))
    : 0

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
            <strong>Приходные накладные</strong>
            <CInputGroup size="sm" style={{ width: 240 }}>
              <CInputGroupText><CIcon icon={cilSearch} /></CInputGroupText>
              <CFormInput
                placeholder="Поиск по номеру, поставщику..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </CInputGroup>
            <div className="ms-auto">
              {canEdit && (
                <CButton color="primary" size="sm"
                  onClick={() => { setForm(EMPTY_FORM); setModal(true) }}>
                  <CIcon icon={cilPlus} className="me-1" />Новая накладная
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
                  <CTableHeaderCell style={{ width: 32 }}></CTableHeaderCell>
                  <CTableHeaderCell>№ накладной</CTableHeaderCell>
                  <CTableHeaderCell>Поставщик</CTableHeaderCell>
                  <CTableHeaderCell>Дата</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Сумма</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Оплачено</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Долг</CTableHeaderCell>
                  <CTableHeaderCell>Статус</CTableHeaderCell>
                  {canEdit && <CTableHeaderCell></CTableHeaderCell>}
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {receipts.length === 0 && (
                  <CTableRow>
                    <CTableDataCell colSpan={9} className="text-center text-body-secondary py-4">
                      Накладные не найдены
                    </CTableDataCell>
                  </CTableRow>
                )}
                {receipts.map(rec => (
                  <>
                    {/* ── Строка накладной ── */}
                    <CTableRow key={rec.id} style={{ cursor: 'pointer' }}
                      onClick={() => toggleExpand(rec.id)}>
                      <CTableDataCell>
                        <CIcon icon={expanded === rec.id ? cilChevronTop : cilChevronBottom}
                          className="text-body-secondary" />
                      </CTableDataCell>
                      <CTableDataCell>
                        <CBadge color="light" className="text-dark fw-semibold">
                          {rec.number || '—'}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell>{rec.supplier_name || '—'}</CTableDataCell>
                      <CTableDataCell className="text-body-secondary">
                        {rec.receipt_date}
                      </CTableDataCell>
                      <CTableDataCell className="text-end fw-semibold">
                        {rec.total_amount > 0
                          ? `${rec.total_amount.toLocaleString()} сом`
                          : '—'}
                      </CTableDataCell>
                      <CTableDataCell className="text-end text-success">
                        {rec.paid_amount > 0
                          ? `${rec.paid_amount.toLocaleString()} сом`
                          : '—'}
                      </CTableDataCell>
                      <CTableDataCell className="text-end text-danger">
                        {debt(rec) > 0
                          ? `${debt(rec).toLocaleString()} сом`
                          : '—'}
                      </CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={PAYMENT_COLOR[rec.payment_status] || 'secondary'}>
                          {PAYMENT_LABEL[rec.payment_status] || rec.payment_status}
                        </CBadge>
                      </CTableDataCell>
                      {canEdit && (
                        <CTableDataCell onClick={e => e.stopPropagation()}>
                          <div className="d-flex gap-1">
                            <CButton size="sm" color="success" variant="ghost"
                              title="Добавить оплату"
                              onClick={() => openPayModal(rec.id)}>
                              <CIcon icon={cilMoney} />
                            </CButton>
                            <CButton size="sm" color="primary" variant="ghost"
                              onClick={() => openEdit(rec)}>
                              <CIcon icon={cilPencil} />
                            </CButton>
                            <CButton size="sm" color="danger" variant="ghost"
                              onClick={() => handleDelete(rec)}>
                              <CIcon icon={cilTrash} />
                            </CButton>
                          </div>
                        </CTableDataCell>
                      )}
                    </CTableRow>

                    {/* ── Детали накладной ── */}
                    {expanded === rec.id && (
                      <CTableRow key={`${rec.id}-detail`}>
                        <CTableDataCell colSpan={canEdit ? 9 : 8} className="p-0">
                          <div className="p-3" style={{ background: 'var(--cui-tertiary-bg)' }}>
                            {detail?.id === rec.id ? (
                              <>
                                {/* Прогресс оплаты */}
                                {detail.total_amount > 0 && (
                                  <div className="mb-3">
                                    <div className="d-flex justify-content-between small mb-1">
                                      <span>
                                        Оплачено: <strong className="text-success">
                                          {(detail.paid_amount || 0).toLocaleString()} сом
                                        </strong>
                                      </span>
                                      <span>
                                        Долг: <strong className="text-danger">
                                          {debt(detail).toLocaleString()} сом
                                        </strong>
                                      </span>
                                      <span>
                                        Итого: <strong>
                                          {detail.total_amount.toLocaleString()} сом
                                        </strong>
                                      </span>
                                    </div>
                                    <CProgress
                                      value={paidPercent(detail)}
                                      color={PAYMENT_COLOR[detail.payment_status]}
                                      style={{ height: 6 }}
                                    />
                                  </div>
                                )}

                                {/* Вкладки */}
                                <CNav variant="tabs" className="mb-2">
                                  <CNavItem>
                                    <CNavLink active={activeTab === 'items'}
                                      onClick={() => setActiveTab('items')}
                                      style={{ cursor: 'pointer' }}>
                                      Товары ({detail.items?.length || 0})
                                    </CNavLink>
                                  </CNavItem>
                                  <CNavItem>
                                    <CNavLink active={activeTab === 'payments'}
                                      onClick={() => setActiveTab('payments')}
                                      style={{ cursor: 'pointer' }}>
                                      Оплаты ({detail.payments?.length || 0})
                                      {detail.payment_status !== 'paid' && (
                                        <CBadge color="danger" className="ms-1" style={{ fontSize: 10 }}>
                                          {PAYMENT_LABEL[detail.payment_status]}
                                        </CBadge>
                                      )}
                                    </CNavLink>
                                  </CNavItem>
                                </CNav>

                                {/* ── Вкладка: Товары ── */}
                                {activeTab === 'items' && (
                                  <>
                                    <CTable size="sm" bordered responsive
                                      style={{ fontSize: 12, background: 'white', marginBottom: 0 }}>
                                      <CTableHead>
                                        <CTableRow>
                                          <CTableHeaderCell>Материал</CTableHeaderCell>
                                          <CTableHeaderCell>Ед.</CTableHeaderCell>
                                          <CTableHeaderCell className="text-end">Кол-во</CTableHeaderCell>
                                          <CTableHeaderCell className="text-end">Цена</CTableHeaderCell>
                                          <CTableHeaderCell className="text-end">Сумма</CTableHeaderCell>
                                          {canEdit && <CTableHeaderCell></CTableHeaderCell>}
                                        </CTableRow>
                                      </CTableHead>
                                      <CTableBody>
                                        {detail.items?.length === 0 && (
                                          <CTableRow>
                                            <CTableDataCell colSpan={6}
                                              className="text-center text-body-secondary">
                                              Строки не добавлены
                                            </CTableDataCell>
                                          </CTableRow>
                                        )}
                                        {detail.items?.map(it => (
                                          <CTableRow key={it.id}>
                                            <CTableDataCell>{it.item_name}</CTableDataCell>
                                            <CTableDataCell>{it.unit}</CTableDataCell>
                                            <CTableDataCell className="text-end">
                                              {it.quantity.toLocaleString()}
                                            </CTableDataCell>
                                            <CTableDataCell className="text-end">
                                              {it.price.toLocaleString()} сом
                                            </CTableDataCell>
                                            <CTableDataCell className="text-end fw-semibold">
                                              {it.total.toLocaleString()} сом
                                            </CTableDataCell>
                                            {canEdit && (
                                              <CTableDataCell>
                                                <CButton size="sm" color="danger" variant="ghost"
                                                  onClick={() => handleDeleteItem(rec.id, it.id, it.item_name)}>
                                                  <CIcon icon={cilTrash} />
                                                </CButton>
                                              </CTableDataCell>
                                            )}
                                          </CTableRow>
                                        ))}
                                        <CTableRow>
                                          <CTableDataCell colSpan={canEdit ? 4 : 3}
                                            className="text-end fw-bold">
                                            Итого:
                                          </CTableDataCell>
                                          <CTableDataCell className="text-end fw-bold text-primary">
                                            {detail.total_amount?.toLocaleString()} сом
                                          </CTableDataCell>
                                          {canEdit && <CTableDataCell></CTableDataCell>}
                                        </CTableRow>
                                      </CTableBody>
                                    </CTable>
                                    {canEdit && (
                                      <div className="mt-2">
                                        <CButton size="sm" color="primary" variant="outline"
                                          onClick={() => openAddItem(rec.id)}>
                                          <CIcon icon={cilPlus} className="me-1" />Добавить строку
                                        </CButton>
                                      </div>
                                    )}
                                  </>
                                )}

                                {/* ── Вкладка: Оплаты ── */}
                                {activeTab === 'payments' && (
                                  <>
                                    <CTable size="sm" bordered responsive
                                      style={{ fontSize: 12, background: 'white', marginBottom: 0 }}>
                                      <CTableHead>
                                        <CTableRow>
                                          <CTableHeaderCell>Дата оплаты</CTableHeaderCell>
                                          <CTableHeaderCell className="text-end">Сумма</CTableHeaderCell>
                                          <CTableHeaderCell>Примечание</CTableHeaderCell>
                                          {canEdit && <CTableHeaderCell></CTableHeaderCell>}
                                        </CTableRow>
                                      </CTableHead>
                                      <CTableBody>
                                        {detail.payments?.length === 0 && (
                                          <CTableRow>
                                            <CTableDataCell colSpan={4}
                                              className="text-center text-body-secondary">
                                              Оплат не зафиксировано
                                            </CTableDataCell>
                                          </CTableRow>
                                        )}
                                        {detail.payments?.map(p => (
                                          <CTableRow key={p.id}>
                                            <CTableDataCell>{p.paid_at}</CTableDataCell>
                                            <CTableDataCell className="text-end fw-semibold text-success">
                                              {p.amount.toLocaleString()} сом
                                            </CTableDataCell>
                                            <CTableDataCell className="text-body-secondary">
                                              {p.notes || '—'}
                                            </CTableDataCell>
                                            {canEdit && (
                                              <CTableDataCell>
                                                <CButton size="sm" color="danger" variant="ghost"
                                                  onClick={() => handlePayDelete(rec.id, p.id)}>
                                                  <CIcon icon={cilTrash} />
                                                </CButton>
                                              </CTableDataCell>
                                            )}
                                          </CTableRow>
                                        ))}
                                        {/* Итог оплат */}
                                        {detail.payments?.length > 0 && (
                                          <CTableRow>
                                            <CTableDataCell className="text-end fw-bold">
                                              Итого оплачено:
                                            </CTableDataCell>
                                            <CTableDataCell className="text-end fw-bold text-success">
                                              {(detail.paid_amount || 0).toLocaleString()} сом
                                            </CTableDataCell>
                                            <CTableDataCell colSpan={canEdit ? 2 : 1}></CTableDataCell>
                                          </CTableRow>
                                        )}
                                      </CTableBody>
                                    </CTable>
                                    {canEdit && detail.payment_status !== 'paid' && (
                                      <div className="mt-2">
                                        <CButton size="sm" color="success" variant="outline"
                                          onClick={() => openPayModal(rec.id)}>
                                          <CIcon icon={cilMoney} className="me-1" />Добавить оплату
                                        </CButton>
                                      </div>
                                    )}
                                  </>
                                )}
                              </>
                            ) : (
                              <div className="text-center py-2"><CSpinner size="sm" /></div>
                            )}
                          </div>
                        </CTableDataCell>
                      </CTableRow>
                    )}
                  </>
                ))}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>

      {/* ── Модал создания накладной ── */}
      <CModal size="xl" visible={modal} onClose={() => setModal(false)}>
        <CModalHeader><CModalTitle>Новая приходная накладная</CModalTitle></CModalHeader>
        <CForm onSubmit={handleCreate}>
          <CModalBody>
            <CRow className="g-3 mb-3">
              <CCol xs={12} md={3}>
                <CFormLabel>№ накладной</CFormLabel>
                <CFormInput value={form.number}
                  onChange={e => setForm({ ...form, number: e.target.value })}
                  placeholder="НК-001" />
              </CCol>
              <CCol xs={12} md={4}>
                <CFormLabel>Поставщик</CFormLabel>
                <CFormSelect value={form.supplier_id}
                  onChange={e => setForm({ ...form, supplier_id: e.target.value })}>
                  <option value="">— без поставщика —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </CFormSelect>
              </CCol>
              <CCol xs={12} md={3}>
                <CFormLabel>Дата *</CFormLabel>
                <CFormInput type="date" required value={form.receipt_date}
                  onChange={e => setForm({ ...form, receipt_date: e.target.value })} />
              </CCol>
              <CCol xs={12} md={2}>
                <CFormLabel>Примечание</CFormLabel>
                <CFormInput value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })} />
              </CCol>
            </CRow>

            <div className="d-flex justify-content-between align-items-center mb-2">
              <strong style={{ fontSize: 13 }}>Строки накладной</strong>
              <CButton size="sm" color="primary" variant="outline" type="button"
                onClick={addFormItem}>
                <CIcon icon={cilPlus} className="me-1" />Добавить строку
              </CButton>
            </div>

            {form.items.length === 0 && (
              <div className="text-center text-body-secondary py-3 border rounded">
                Нажмите «Добавить строку» чтобы добавить материалы
              </div>
            )}

            {form.items.map((it, idx) => (
              <CRow key={idx} className="g-2 mb-2 align-items-end">
                <CCol xs={12} md={5}>
                  <CFormLabel className="small">Материал *</CFormLabel>
                  <CFormSelect required value={it.item_id}
                    onChange={e => updateFormItem(idx, 'item_id', e.target.value)}>
                    <option value="">— выбрать —</option>
                    {items.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name}{m.article ? ` (${m.article})` : ''}
                      </option>
                    ))}
                  </CFormSelect>
                </CCol>
                <CCol xs={4} md={2}>
                  <CFormLabel className="small">Кол-во *</CFormLabel>
                  <CFormInput required type="number" min="0.001" step="any"
                    value={it.quantity}
                    onChange={e => updateFormItem(idx, 'quantity', e.target.value)}
                    placeholder="0" />
                </CCol>
                <CCol xs={4} md={2}>
                  <CFormLabel className="small">Цена (сом)</CFormLabel>
                  <CFormInput type="number" min="0" step="any"
                    value={it.price}
                    onChange={e => updateFormItem(idx, 'price', e.target.value)}
                    placeholder="0" />
                </CCol>
                <CCol xs={3} md={2}>
                  <CFormLabel className="small">Сумма</CFormLabel>
                  <div className="fw-semibold text-primary" style={{ lineHeight: '38px' }}>
                    {((parseFloat(it.quantity) || 0) * (parseFloat(it.price) || 0)).toLocaleString()} сом
                  </div>
                </CCol>
                <CCol xs={1} className="d-flex align-items-end">
                  <CButton color="danger" variant="ghost" size="sm" type="button"
                    onClick={() => removeFormItem(idx)}>
                    <CIcon icon={cilTrash} />
                  </CButton>
                </CCol>
              </CRow>
            ))}

            {form.items.length > 0 && (
              <div className="text-end mt-2 fw-bold text-primary">
                Итого: {form.items.reduce((sum, it) =>
                  sum + (parseFloat(it.quantity) || 0) * (parseFloat(it.price) || 0), 0
                ).toLocaleString()} сом
              </div>
            )}
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setModal(false)}>Отмена</CButton>
            <CButton type="submit" color="primary" disabled={saving}>
              {saving ? <CSpinner size="sm" /> : 'Создать накладную'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>

      {/* ── Модал редактирования шапки ── */}
      <CModal visible={editModal} onClose={() => setEditModal(false)}>
        <CModalHeader><CModalTitle>Редактировать накладную</CModalTitle></CModalHeader>
        <CForm onSubmit={handleEditSave}>
          <CModalBody>
            <CRow className="g-3">
              <CCol xs={6}>
                <CFormLabel>№ накладной</CFormLabel>
                <CFormInput value={editForm.number || ''}
                  onChange={e => setEditForm({ ...editForm, number: e.target.value })} />
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Дата *</CFormLabel>
                <CFormInput type="date" required value={editForm.receipt_date || ''}
                  onChange={e => setEditForm({ ...editForm, receipt_date: e.target.value })} />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Поставщик</CFormLabel>
                <CFormSelect value={editForm.supplier_id || ''}
                  onChange={e => setEditForm({ ...editForm, supplier_id: e.target.value })}>
                  <option value="">— без поставщика —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </CFormSelect>
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
            <CButton type="submit" color="primary" disabled={saving}>
              {saving ? <CSpinner size="sm" /> : 'Сохранить'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>

      {/* ── Модал добавления строки ── */}
      <CModal visible={addItemModal} onClose={() => setAddItemModal(false)}>
        <CModalHeader><CModalTitle>Добавить строку</CModalTitle></CModalHeader>
        <CForm onSubmit={handleAddItem}>
          <CModalBody>
            <CRow className="g-3">
              <CCol xs={12}>
                <CFormLabel>Материал *</CFormLabel>
                <CFormSelect required value={addItemForm.item_id}
                  onChange={e => setAddItemForm({ ...addItemForm, item_id: e.target.value })}>
                  <option value="">— выбрать —</option>
                  {items.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name}{m.article ? ` (${m.article})` : ''}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Количество *</CFormLabel>
                <CFormInput required type="number" min="0.001" step="any"
                  value={addItemForm.quantity}
                  onChange={e => setAddItemForm({ ...addItemForm, quantity: e.target.value })}
                  placeholder="0" />
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Цена (сом)</CFormLabel>
                <CFormInput type="number" min="0" step="any"
                  value={addItemForm.price}
                  onChange={e => setAddItemForm({ ...addItemForm, price: e.target.value })}
                  placeholder="0" />
              </CCol>
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setAddItemModal(false)}>Отмена</CButton>
            <CButton type="submit" color="primary" disabled={addItemSaving}>
              {addItemSaving ? <CSpinner size="sm" /> : 'Добавить'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>

      {/* ── Модал добавления платежа ── */}
      <CModal visible={payModal} onClose={() => setPayModal(false)}>
        <CModalHeader><CModalTitle>Добавить оплату</CModalTitle></CModalHeader>
        <CForm onSubmit={handlePayCreate}>
          <CModalBody>
            <CRow className="g-3">
              <CCol xs={12}>
                <CFormLabel>Сумма (сом) *</CFormLabel>
                <CFormInput required type="number" min="0.01" step="any"
                  value={payForm.amount}
                  onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                  placeholder="0" />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Дата оплаты</CFormLabel>
                <CFormInput type="date" value={payForm.paid_at}
                  onChange={e => setPayForm({ ...payForm, paid_at: e.target.value })} />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Примечание</CFormLabel>
                <CFormInput value={payForm.notes}
                  onChange={e => setPayForm({ ...payForm, notes: e.target.value })}
                  placeholder="Наличные, перевод..." />
              </CCol>
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setPayModal(false)}>Отмена</CButton>
            <CButton type="submit" color="success" disabled={paySaving}>
              {paySaving ? <CSpinner size="sm" /> : 'Зафиксировать оплату'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>
    </>
  )
}