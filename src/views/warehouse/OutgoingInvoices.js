import { useEffect, useState, useCallback, useRef } from 'react'
import {
  CCard, CCardBody, CCardHeader,
  CTable, CTableBody, CTableDataCell,
  CTableHead, CTableHeaderCell, CTableRow,
  CBadge, CButton, CSpinner, CAlert,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CForm, CFormInput, CFormLabel, CFormSelect, CFormTextarea,
  CRow, CCol, CInputGroup, CInputGroupText,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilSearch, cilPrint, cilCheck, cilX, cilTrash, cilWarning } from '@coreui/icons'
import api from '../../api/client'
import { useAuth } from '../../AuthContext'

const STATUS_COLOR = {
  draft:            'warning',
  pending_purchase: 'info',
  confirmed:        'success',
  cancelled:        'danger',
}
const STATUS_LABEL = {
  draft:            'Черновик',
  pending_purchase: 'Ожидание закупки',
  confirmed:        'Подтверждена',
  cancelled:        'Отменена',
}

export default function OutgoingInvoices() {
  const { hasRole } = useAuth()
  const canCreate = hasRole('admin', 'supervisor', 'manager', 'seller')
  const printRef  = useRef()

  const [invoices,     setInvoices]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [modal,        setModal]        = useState(false)
  const [viewModal,    setViewModal]    = useState(false)
  const [current,      setCurrent]      = useState(null)
  const [saving,       setSaving]       = useState(false)
  const [confirming,   setConfirming]   = useState(false)

  // Модал дефицита
  const [deficitModal,  setDeficitModal]  = useState(false)
  const [deficitItems,  setDeficitItems]  = useState([])
  const [deficitMsg,    setDeficitMsg]    = useState('')

  // Форма новой накладной
  const [invoiceType,   setInvoiceType]   = useState('order')
  const [orderID,       setOrderID]       = useState('')
  const [clientName,    setClientName]    = useState('')
  const [notes,         setNotes]         = useState('')
  const [items,         setItems]         = useState([])
  const [itemSearch,    setItemSearch]    = useState('')
  const [warehouseItems, setWarehouseItems] = useState([])
  const [orders,        setOrders]        = useState([])
  const [searchResults, setSearchResults] = useState([])

  const load = useCallback(() => {
    setLoading(true)
    api.get('/warehouse/outgoing-invoices', { params: { status: filterStatus } })
      .then(r => setInvoices(r.data.data || []))
      .catch(() => setError('Ошибка загрузки'))
      .finally(() => setLoading(false))
  }, [filterStatus])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!modal) return
    api.get('/warehouse/items').then(r => {
      setWarehouseItems((r.data.data || []).map(item => ({
        ...item,
        quantity:       item.balance   || 0,
        purchase_price: item.avg_price || 0,
      })))
    }).catch(() => {})
    api.get('/orders').then(r => {
      setOrders((r.data.data || []).filter(o => o.status !== 'cancelled'))
    }).catch(() => {})
  }, [modal])

  useEffect(() => {
    if (!itemSearch) { setSearchResults([]); return }
    const q = itemSearch.toLowerCase()
    setSearchResults(
      warehouseItems
        .filter(i => i.name?.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q))
        .slice(0, 10)
    )
  }, [itemSearch, warehouseItems])

  const addItem = (warehouseItem) => {
    setItems(prev => {
      const exists = prev.find(i => i.item_id === warehouseItem.id)
      if (exists) return prev
      return [...prev, {
        item_id:    warehouseItem.id,
        item_name:  warehouseItem.name,
        unit:       warehouseItem.unit || 'шт',
        quantity:   1,
        cost_price: warehouseItem.purchase_price || 0,
        sale_price: warehouseItem.sale_price || 0,
        stock:      warehouseItem.quantity || 0,
      }]
    })
    setItemSearch('')
    setSearchResults([])
  }

  const removeItem = (itemID) => setItems(prev => prev.filter(i => i.item_id !== itemID))

  const updateItem = (itemID, field, value) => {
    setItems(prev => prev.map(i => i.item_id === itemID ? { ...i, [field]: parseFloat(value) || 0 } : i))
  }

  const totalCost  = items.reduce((s, i) => s + i.quantity * i.cost_price, 0)
  const totalPrice = items.reduce((s, i) => s + i.quantity * i.sale_price, 0)

  const resetForm = () => {
    setInvoiceType('order'); setOrderID(''); setClientName('')
    setNotes(''); setItems([]); setItemSearch(''); setSearchResults([])
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (items.length === 0) { setError('Добавьте хотя бы один товар'); return }
    setSaving(true)
    try {
      await api.post('/warehouse/outgoing-invoices', {
        invoice_type: invoiceType,
        order_id:     invoiceType === 'order' ? orderID : '',
        client_name:  invoiceType === 'external' ? clientName : '',
        notes,
        items: items.map(i => ({
          item_id:    i.item_id,
          quantity:   i.quantity,
          sale_price: i.sale_price,
        })),
      })
      setModal(false); resetForm(); load()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка сохранения')
    } finally { setSaving(false) }
  }

  const openView = async (inv) => {
    const res = await api.get(`/warehouse/outgoing-invoices/${inv.id}`)
    setCurrent(res.data)
    setViewModal(true)
  }

  const handleConfirm = async (id) => {
    setConfirming(true)
    try {
      const res = await api.post(`/warehouse/outgoing-invoices/${id}/confirm`)
      const result = res.data

      if (result.status === 'pending_purchase') {
        // Не хватает товаров — показываем модал дефицита
        setDeficitItems(result.deficit_items || [])
        setDeficitMsg(result.message || '')
        setDeficitModal(true)
        // Обновляем список (статус изменился на pending_purchase)
        load()
        setViewModal(false)
      } else {
        // Успешно подтверждено
        load()
        setViewModal(false)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка подтверждения')
    } finally {
      setConfirming(false)
    }
  }

  const handleCancel = async (id) => {
    if (!window.confirm('Отменить накладную? Товары вернутся на склад если накладная была подтверждена.')) return
    try {
      await api.post(`/warehouse/outgoing-invoices/${id}/cancel`)
      load()
      setViewModal(false)
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка')
    }
  }

  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML
    if (!printContent) return
    const win = window.open('', '_blank')
    win.document.write(`
      <html><head><title>Расходная накладная</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 13px; padding: 20px; }
        h2 { text-align: center; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; }
        th { background: #f0f0f0; }
        .sign { margin-top: 40px; display: flex; justify-content: space-between; }
        .sign div { border-top: 1px solid #333; min-width: 200px; padding-top: 4px; }
      </style></head>
      <body>${printContent}</body></html>
    `)
    win.document.close()
    win.print()
  }

  const visible = invoices.filter(inv => {
    const q = search.toLowerCase()
    return (
      inv.invoice_number?.toLowerCase().includes(q) ||
      inv.client_name?.toLowerCase().includes(q) ||
      String(inv.order_number).includes(q)
    )
  })

  return (
    <>
      {error && <CAlert color="danger" dismissible onClose={() => setError('')}>{error}</CAlert>}

      <CCard>
        <CCardHeader>
          <div className="d-flex gap-2 align-items-center">
            <CInputGroup size="sm" style={{ width: 220 }}>
              <CInputGroupText><CIcon icon={cilSearch} /></CInputGroupText>
              <CFormInput placeholder="Поиск..." value={search}
                onChange={e => setSearch(e.target.value)} />
            </CInputGroup>
            <CFormSelect size="sm" style={{ width: 190 }} value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}>
              <option value="">Все статусы</option>
              <option value="draft">Черновик</option>
              <option value="pending_purchase">Ожидание закупки</option>
              <option value="confirmed">Подтверждена</option>
              <option value="cancelled">Отменена</option>
            </CFormSelect>
            <div className="ms-auto">
              {canCreate && (
                <CButton color="primary" size="sm" onClick={() => { resetForm(); setModal(true) }}>
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
                  <CTableHeaderCell>Номер</CTableHeaderCell>
                  <CTableHeaderCell>Тип</CTableHeaderCell>
                  <CTableHeaderCell>Заказ / Клиент</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Себестоимость</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Сумма продажи</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Прибыль</CTableHeaderCell>
                  <CTableHeaderCell>Статус</CTableHeaderCell>
                  <CTableHeaderCell>Дата</CTableHeaderCell>
                  <CTableHeaderCell></CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {visible.length === 0 && (
                  <CTableRow>
                    <CTableDataCell colSpan={9} className="text-center text-body-secondary py-4">
                      Накладных нет
                    </CTableDataCell>
                  </CTableRow>
                )}
                {visible.map(inv => {
                  const profit = inv.total_price - inv.total_cost
                  const canConfirm = (inv.status === 'draft' || inv.status === 'pending_purchase') && canCreate
                  return (
                    <CTableRow key={inv.id} style={{ cursor: 'pointer' }} onClick={() => openView(inv)}>
                      <CTableDataCell className="fw-semibold">{inv.invoice_number}</CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={inv.invoice_type === 'order' ? 'primary' : 'info'}>
                          {inv.invoice_type === 'order' ? 'Заказ' : 'Внешняя'}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell className="small">
                        {inv.order_number ? `#${inv.order_number}` : inv.client_name || '—'}
                      </CTableDataCell>
                      <CTableDataCell className="text-end small">
                        {Number(inv.total_cost).toLocaleString()} сом.
                      </CTableDataCell>
                      <CTableDataCell className="text-end fw-semibold">
                        {Number(inv.total_price).toLocaleString()} сом.
                      </CTableDataCell>
                      <CTableDataCell className="text-end">
                        <span className={profit >= 0 ? 'text-success' : 'text-danger'}>
                          {Number(profit).toLocaleString()} сом.
                        </span>
                      </CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={STATUS_COLOR[inv.status] || 'secondary'}>
                          {STATUS_LABEL[inv.status] || inv.status}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell className="small text-body-secondary">
                        {new Date(inv.created_at).toLocaleDateString('ru-RU')}
                      </CTableDataCell>
                      <CTableDataCell onClick={e => e.stopPropagation()}>
                        {canConfirm && (
                          <CButton size="sm" color="success" variant="ghost"
                            onClick={() => handleConfirm(inv.id)}
                            disabled={confirming}
                            title="Подтвердить">
                            <CIcon icon={cilCheck} />
                          </CButton>
                        )}
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
      <CModal size="xl" visible={modal} onClose={() => { setModal(false); resetForm() }}>
        <CModalHeader>
          <CModalTitle>Новая расходная накладная</CModalTitle>
        </CModalHeader>
        <CForm onSubmit={handleCreate}>
          <CModalBody>
            <CRow className="g-3">
              <CCol xs={12}>
                <div className="d-flex gap-2">
                  <CButton type="button" size="sm"
                    color={invoiceType === 'order' ? 'primary' : 'secondary'}
                    variant={invoiceType === 'order' ? undefined : 'outline'}
                    onClick={() => setInvoiceType('order')}>
                    📦 Для заказа
                  </CButton>
                  <CButton type="button" size="sm"
                    color={invoiceType === 'external' ? 'info' : 'secondary'}
                    variant={invoiceType === 'external' ? undefined : 'outline'}
                    onClick={() => setInvoiceType('external')}>
                    🏪 Продажа вне цеха
                  </CButton>
                </div>
              </CCol>

              {invoiceType === 'order' ? (
                <CCol xs={12} md={6}>
                  <CFormLabel>Заказ *</CFormLabel>
                  <CFormSelect required value={orderID} onChange={e => setOrderID(e.target.value)}>
                    <option value="">— Выберите заказ —</option>
                    {orders.map(o => (
                      <option key={o.id} value={o.id}>
                        #{o.order_number} — {o.title} {o.client_name ? `(${o.client_name})` : ''}
                      </option>
                    ))}
                  </CFormSelect>
                </CCol>
              ) : (
                <CCol xs={12} md={6}>
                  <CFormLabel>Покупатель</CFormLabel>
                  <CFormInput value={clientName} onChange={e => setClientName(e.target.value)}
                    placeholder="Имя покупателя или организация" />
                </CCol>
              )}

              <CCol xs={12} md={6}>
                <CFormLabel>Примечание</CFormLabel>
                <CFormTextarea rows={1} value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Дополнительная информация..." />
              </CCol>

              <CCol xs={12}>
                <CFormLabel>Добавить товар</CFormLabel>
                <div style={{ position: 'relative' }}>
                  <CInputGroup size="sm">
                    <CInputGroupText><CIcon icon={cilSearch} /></CInputGroupText>
                    <CFormInput placeholder="Поиск по названию или категории..."
                      value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
                  </CInputGroup>
                  {searchResults.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
                      background: 'var(--cui-card-bg)',
                      border: '1px solid var(--cui-border-color)',
                      borderRadius: 6, maxHeight: 250, overflowY: 'auto',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}>
                      {searchResults.map(item => (
                        <div key={item.id}
                          onClick={() => addItem(item)}
                          style={{ padding: '8px 12px', cursor: 'pointer',
                            borderBottom: '0.5px solid var(--cui-border-color)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--cui-tertiary-bg)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div className="fw-semibold small">{item.name}</div>
                          <div className="text-body-secondary" style={{ fontSize: 11 }}>
                            {item.category} • {item.unit} • Остаток: {item.quantity}
                            {item.sale_price > 0 && ` • Цена: ${item.sale_price} сом.`}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CCol>

              {items.length > 0 && (
                <CCol xs={12}>
                  <CTable small bordered responsive style={{ fontSize: 12 }}>
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell>Товар</CTableHeaderCell>
                        <CTableHeaderCell style={{ width: 80 }}>Ед.</CTableHeaderCell>
                        <CTableHeaderCell style={{ width: 100 }}>Кол-во</CTableHeaderCell>
                        <CTableHeaderCell style={{ width: 110 }}>Себест.</CTableHeaderCell>
                        <CTableHeaderCell style={{ width: 110 }}>Цена прод.</CTableHeaderCell>
                        <CTableHeaderCell style={{ width: 110 }} className="text-end">Итого</CTableHeaderCell>
                        <CTableHeaderCell style={{ width: 40 }}></CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {items.map(item => (
                        <CTableRow key={item.item_id}>
                          <CTableDataCell>
                            <div className="fw-semibold">{item.item_name}</div>
                            <div className="text-body-secondary" style={{ fontSize: 10 }}>
                              Остаток: {item.stock}
                            </div>
                          </CTableDataCell>
                          <CTableDataCell>{item.unit}</CTableDataCell>
                          <CTableDataCell>
                            <CFormInput type="number" size="sm" min="0.001" step="any"
                              value={item.quantity}
                              onChange={e => updateItem(item.item_id, 'quantity', e.target.value)} />
                          </CTableDataCell>
                          <CTableDataCell>
                            <CFormInput type="number" size="sm" min="0" step="any"
                              value={item.cost_price}
                              onChange={e => updateItem(item.item_id, 'cost_price', e.target.value)} />
                          </CTableDataCell>
                          <CTableDataCell>
                            <CFormInput type="number" size="sm" min="0" step="any"
                              value={item.sale_price}
                              onChange={e => updateItem(item.item_id, 'sale_price', e.target.value)} />
                          </CTableDataCell>
                          <CTableDataCell className="text-end fw-semibold">
                            {(item.quantity * item.sale_price).toLocaleString()}
                          </CTableDataCell>
                          <CTableDataCell>
                            <CButton size="sm" color="danger" variant="ghost"
                              onClick={() => removeItem(item.item_id)}>
                              <CIcon icon={cilTrash} />
                            </CButton>
                          </CTableDataCell>
                        </CTableRow>
                      ))}
                      <CTableRow style={{ background: 'var(--cui-tertiary-bg)' }}>
                        <CTableDataCell colSpan={3} className="fw-bold">Итого</CTableDataCell>
                        <CTableDataCell className="fw-semibold text-body-secondary">
                          {totalCost.toLocaleString()} сом.
                        </CTableDataCell>
                        <CTableDataCell></CTableDataCell>
                        <CTableDataCell className="text-end fw-bold text-success">
                          {totalPrice.toLocaleString()} сом.
                        </CTableDataCell>
                        <CTableDataCell></CTableDataCell>
                      </CTableRow>
                    </CTableBody>
                  </CTable>
                </CCol>
              )}
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => { setModal(false); resetForm() }}>
              Отмена
            </CButton>
            <CButton type="submit" color="primary" disabled={saving || items.length === 0}>
              {saving ? <CSpinner size="sm" /> : 'Создать накладную'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>

      {/* ── Модал просмотра / печати ── */}
      {current && (
        <CModal size="lg" visible={viewModal} onClose={() => setViewModal(false)}>
          <CModalHeader>
            <CModalTitle>Накладная {current.invoice_number}</CModalTitle>
          </CModalHeader>
          <CModalBody>
            {current.status === 'pending_purchase' && (
              <CAlert color="warning" className="mb-3">
                <CIcon icon={cilWarning} className="me-2" />
                <strong>Ожидание закупки.</strong> Для подтверждения накладной снабженец должен
                сделать приходную накладную на недостающие товары.
              </CAlert>
            )}
            <div ref={printRef}>
              <h2 style={{ textAlign: 'center', fontSize: 18 }}>
                Расходная накладная № {current.invoice_number}
              </h2>
              <p style={{ textAlign: 'center', color: '#666' }}>
                {new Date(current.created_at).toLocaleDateString('ru-RU')}
              </p>
              {current.order_number ? (
                <p><strong>Заказ:</strong> #{current.order_number}</p>
              ) : current.client_name ? (
                <p><strong>Покупатель:</strong> {current.client_name}</p>
              ) : null}
              {current.notes && <p><strong>Примечание:</strong> {current.notes}</p>}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
                <thead>
                  <tr>
                    {['№', 'Наименование', 'Ед.', 'Кол-во', 'Себест.', 'Цена', 'Сумма'].map(h => (
                      <th key={h} style={{ border: '1px solid #333', padding: '5px 8px',
                        background: '#f0f0f0', fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(current.items || []).map((item, i) => (
                    <tr key={item.id}>
                      <td style={{ border: '1px solid #333', padding: '4px 8px', fontSize: 12 }}>{i + 1}</td>
                      <td style={{ border: '1px solid #333', padding: '4px 8px', fontSize: 12 }}>{item.item_name}</td>
                      <td style={{ border: '1px solid #333', padding: '4px 8px', fontSize: 12 }}>{item.unit}</td>
                      <td style={{ border: '1px solid #333', padding: '4px 8px', fontSize: 12 }}>{item.quantity}</td>
                      <td style={{ border: '1px solid #333', padding: '4px 8px', fontSize: 12 }}>
                        {Number(item.cost_price).toLocaleString()}
                      </td>
                      <td style={{ border: '1px solid #333', padding: '4px 8px', fontSize: 12 }}>
                        {Number(item.sale_price).toLocaleString()}
                      </td>
                      <td style={{ border: '1px solid #333', padding: '4px 8px', fontSize: 12, fontWeight: 700 }}>
                        {Number(item.total_price).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={6} style={{ border: '1px solid #333', padding: '5px 8px',
                      fontSize: 12, fontWeight: 700, textAlign: 'right' }}>Итого:</td>
                    <td style={{ border: '1px solid #333', padding: '5px 8px', fontSize: 13, fontWeight: 700 }}>
                      {Number(current.total_price).toLocaleString()} сом.
                    </td>
                  </tr>
                </tbody>
              </table>
              <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ minWidth: 200 }}>
                  <div style={{ borderTop: '1px solid #333', paddingTop: 4, fontSize: 12 }}>
                    Продавец: {current.creator_name}
                  </div>
                </div>
                <div style={{ minWidth: 200 }}>
                  <div style={{ borderTop: '1px solid #333', paddingTop: 4, fontSize: 12 }}>
                    Подпись покупателя
                  </div>
                </div>
              </div>
            </div>
          </CModalBody>
          <CModalFooter>
            {(current.status === 'draft' || current.status === 'pending_purchase') && canCreate && (
              <>
                <CButton color="success" disabled={confirming}
                  onClick={() => handleConfirm(current.id)}>
                  {confirming ? <CSpinner size="sm" className="me-1" /> : <CIcon icon={cilCheck} className="me-1" />}
                  Подтвердить
                </CButton>
                <CButton color="danger" variant="outline" onClick={() => handleCancel(current.id)}>
                  <CIcon icon={cilX} className="me-1" />Отменить
                </CButton>
              </>
            )}
            {current.status === 'confirmed' && canCreate && (
              <CButton color="danger" variant="outline" onClick={() => handleCancel(current.id)}>
                <CIcon icon={cilX} className="me-1" />Отменить
              </CButton>
            )}
            <CButton color="secondary" variant="outline" onClick={handlePrint}>
              <CIcon icon={cilPrint} className="me-1" />Печать
            </CButton>
            <CButton color="secondary" variant="outline" onClick={() => setViewModal(false)}>
              Закрыть
            </CButton>
          </CModalFooter>
        </CModal>
      )}

      {/* ── Модал дефицита ── */}
      <CModal visible={deficitModal} onClose={() => setDeficitModal(false)}>
        <CModalHeader>
          <CModalTitle>⚠️ Недостаточно товаров на складе</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CAlert color="warning" className="mb-3">
            {deficitMsg || 'Накладная переведена в статус «Ожидание закупки».'}
          </CAlert>
          <p className="mb-2 fw-semibold" style={{ fontSize: 13 }}>
            Снабженцу необходимо создать приходную накладную на следующие товары:
          </p>
          <CTable small bordered style={{ fontSize: 13 }}>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Товар</CTableHeaderCell>
                <CTableHeaderCell className="text-center">Ед.</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Нужно</CTableHeaderCell>
                <CTableHeaderCell className="text-end">На складе</CTableHeaderCell>
                <CTableHeaderCell className="text-end text-danger">Нехватка</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {deficitItems.map(d => (
                <CTableRow key={d.item_id}>
                  <CTableDataCell className="fw-semibold">{d.item_name}</CTableDataCell>
                  <CTableDataCell className="text-center">{d.unit}</CTableDataCell>
                  <CTableDataCell className="text-end">{d.required}</CTableDataCell>
                  <CTableDataCell className="text-end">{d.available}</CTableDataCell>
                  <CTableDataCell className="text-end fw-bold text-danger">
                    {d.shortage}
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
          <p className="mt-3 text-body-secondary" style={{ fontSize: 12 }}>
            После поступления товаров повторно нажмите «Подтвердить» на накладной.
          </p>
        </CModalBody>
        <CModalFooter>
          <CButton color="primary" onClick={() => setDeficitModal(false)}>Понятно</CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}