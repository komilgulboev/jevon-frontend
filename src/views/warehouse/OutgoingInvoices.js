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
import { cilPlus, cilSearch, cilPrint, cilCheck, cilX, cilTrash, cilWarning, cilSave, cilPencil } from '@coreui/icons'
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

// ── Строка позиции в детальном просмотре ─────────────────
function InvoiceItemRow({ item, warehouseItems, canEdit, onUpdate, onDelete, onWarehouseItemCreated }) {
  const [editing,       setEditing]       = useState(false)
  const [itemSearch,    setItemSearch]     = useState('')
  const [searchRes,     setSearchRes]      = useState([])
  const [form,          setForm]           = useState({
    item_id:    item.item_id    || '',
    item_name:  item.item_name  || '',
    unit:       item.unit       || 'шт',
    quantity:   item.quantity   || 1,
    sale_price: item.sale_price || 0,
  })
  const [saving,        setSaving]         = useState(false)

  // Создание нового товара в номенклатуре
  const [showCreate,    setShowCreate]     = useState(false)
  const [createForm,    setCreateForm]     = useState({ name:'', unit:'шт', category:'', sale_price:'' })
  const [creating,      setCreating]       = useState(false)
  const [createError,   setCreateError]    = useState('')

  const ref = useRef(null)

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setSearchRes([]) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (!itemSearch) { setSearchRes([]); return }
    const q = itemSearch.toLowerCase()
    setSearchRes(warehouseItems.filter(i =>
      i.name?.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q)
    ).slice(0, 8))
  }, [itemSearch, warehouseItems])

  const selectItem = (wItem) => {
    setForm(prev => ({
      ...prev,
      item_id:    wItem.id,
      item_name:  wItem.name,
      unit:       wItem.unit || 'шт',
      sale_price: wItem.sale_price || prev.sale_price,
    }))
    setItemSearch(''); setSearchRes([])
  }

  const clearItem = () => setForm(prev => ({ ...prev, item_id: '' }))

  const handleSave = async () => {
    setSaving(true)
    try { await onUpdate(item.id, form); setEditing(false) }
    finally { setSaving(false) }
  }

  // Создать товар в номенклатуре
  const handleCreateNomenclature = async () => {
    if (!createForm.name.trim()) { setCreateError('Введите название'); return }
    setCreating(true); setCreateError('')
    try {
      const res = await api.post('/warehouse/items', {
        name:       createForm.name.trim(),
        unit:       createForm.unit || 'шт',
        category:   createForm.category || '',
        sale_price: parseFloat(createForm.sale_price) || 0,
        is_active:  true,
      })
      const newId = res.data?.id
      if (newId) {
        // Привязываем новый товар к строке накладной
        setForm(prev => ({
          ...prev,
          item_id:   newId,
          item_name: createForm.name.trim(),
          unit:      createForm.unit || 'шт',
          sale_price: parseFloat(createForm.sale_price) || prev.sale_price,
        }))
        // Уведомляем родителя чтобы обновить список номенклатуры
        onWarehouseItemCreated?.()
      }
      setShowCreate(false)
      setCreateForm({ name:'', unit:'шт', category:'', sale_price:'' })
    } catch (e) {
      setCreateError(e.response?.data?.error || 'Ошибка создания товара')
    } finally { setCreating(false) }
  }

  const isLinked = !!form.item_id

  if (!editing) {
    return (
      <CTableRow>
        <CTableDataCell>
          <div className="fw-semibold">{item.item_name}</div>
          {item.item_id
            ? <span style={{ fontSize:10, color:'var(--cui-success)' }}>● привязан к складу</span>
            : <span style={{ fontSize:10, color:'var(--cui-warning)' }}>⚠️ не привязан</span>
          }
        </CTableDataCell>
        <CTableDataCell className="text-center">{item.unit}</CTableDataCell>
        <CTableDataCell className="text-center" style={{ color: item.quantity ? 'var(--cui-primary)' : 'inherit', fontWeight: item.quantity ? 600 : 400 }}>{item.quantity}</CTableDataCell>
        <CTableDataCell className="text-end text-body-secondary">{Number(item.cost_price).toLocaleString()}</CTableDataCell>
        <CTableDataCell className="text-end">{Number(item.sale_price).toLocaleString()}</CTableDataCell>
        <CTableDataCell className="text-end fw-bold">{Number(item.total_price).toLocaleString()}</CTableDataCell>
        {canEdit && (
          <CTableDataCell className="text-center">
            <div className="d-flex gap-1 justify-content-center">
              <CButton size="sm" color="primary" variant="ghost" onClick={() => { setEditing(true); setShowCreate(false) }} title="Редактировать">
                <CIcon icon={cilPencil} />
              </CButton>
              <CButton size="sm" color="danger" variant="ghost" onClick={() => onDelete(item.id)} title="Удалить">
                <CIcon icon={cilTrash} />
              </CButton>
            </div>
          </CTableDataCell>
        )}
      </CTableRow>
    )
  }

  // Режим редактирования
  return (
    <CTableRow style={{ background:'var(--cui-warning-bg-subtle)' }}>
      <CTableDataCell colSpan={canEdit ? 7 : 6} className="p-2">
        <div className="d-flex flex-column gap-2">

          {/* Привязка к номенклатуре */}
          <div ref={ref} style={{ position:'relative' }}>
            <div className="small fw-semibold mb-1">Привязка к номенклатуре склада</div>
            {isLinked ? (
              <div className="d-flex align-items-center gap-2 p-2 rounded"
                style={{ background:'var(--cui-success-bg-subtle)', border:'1px solid var(--cui-success-border-subtle)' }}>
                <span className="fw-semibold flex-grow-1">{form.item_name}</span>
                <span style={{ fontSize:10, color:'var(--cui-success)' }}>● привязан к складу</span>
                <CButton size="sm" color="secondary" variant="ghost" onClick={clearItem}>× Отвязать</CButton>
              </div>
            ) : (
              <div>
                <div className="d-flex gap-2 mb-1">
                  <CFormInput size="sm" flex="1"
                    value={itemSearch || form.item_name}
                    placeholder="Поиск в номенклатуре..."
                    onChange={e => {
                      setItemSearch(e.target.value)
                      setForm(prev => ({ ...prev, item_name: e.target.value }))
                    }}
                  />
                  {/* Кнопка создания нового товара */}
                  {!showCreate && (
                    <CButton size="sm" color="success" variant="outline"
                      onClick={() => {
                        setShowCreate(true)
                        setCreateForm(prev => ({ ...prev, name: form.item_name, unit: form.unit }))
                        setCreateError('')
                      }}
                      title="Создать новый товар в номенклатуре">
                      <CIcon icon={cilPlus} className="me-1" />В номенклатуру
                    </CButton>
                  )}
                </div>

                {/* Выпадающий список поиска */}
                {searchRes.length > 0 && (
                  <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:1060, background:'var(--cui-body-bg)', border:'1px solid var(--cui-border-color)', borderRadius:4, maxHeight:200, overflowY:'auto', boxShadow:'0 4px 12px rgba(0,0,0,0.15)' }}>
                    {searchRes.map(wItem => (
                      <div key={wItem.id} onMouseDown={() => selectItem(wItem)}
                        style={{ padding:'6px 12px', cursor:'pointer', fontSize:13, borderBottom:'0.5px solid var(--cui-border-color)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--cui-primary-bg-subtle)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span className="fw-semibold">{wItem.name}</span>
                        <span className="text-body-secondary ms-2" style={{ fontSize:11 }}>
                          {wItem.category && `[${wItem.category}]`} {wItem.unit}
                          {' · Остаток: '}<span style={{ color: wItem.balance > 0 ? 'var(--cui-success)' : 'var(--cui-danger)' }}>{wItem.balance || 0}</span>
                          {wItem.sale_price > 0 && ` · ${wItem.sale_price} сом`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Форма создания нового товара */}
                {showCreate && (
                  <div className="mt-2 p-2 rounded" style={{ background:'var(--cui-success-bg-subtle)', border:'1px solid var(--cui-success-border-subtle)' }}>
                    <div className="small fw-semibold text-success mb-2">✨ Создать новый товар в номенклатуре</div>
                    {createError && <CAlert color="danger" className="py-1 mb-2 small">{createError}</CAlert>}
                    <CRow className="g-2">
                      <CCol xs={12} md={4}>
                        <div className="small text-body-secondary mb-1">Название *</div>
                        <CFormInput size="sm" value={createForm.name}
                          onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))}
                          placeholder="Точное название товара" autoFocus />
                      </CCol>
                      <CCol xs={6} md={2}>
                        <div className="small text-body-secondary mb-1">Ед. изм.</div>
                        <CFormSelect size="sm" value={createForm.unit}
                          onChange={e => setCreateForm(p => ({ ...p, unit: e.target.value }))}>
                          {['шт','кг','л','м','м²','м³','упак','лист'].map(u => <option key={u} value={u}>{u}</option>)}
                        </CFormSelect>
                      </CCol>
                      <CCol xs={6} md={3}>
                        <div className="small text-body-secondary mb-1">Категория</div>
                        <CFormInput size="sm" value={createForm.category}
                          onChange={e => setCreateForm(p => ({ ...p, category: e.target.value }))}
                          placeholder="Например: Краска" />
                      </CCol>
                      <CCol xs={6} md={2}>
                        <div className="small text-body-secondary mb-1">Цена продажи</div>
                        <CFormInput size="sm" type="number" min="0" step="any"
                          value={createForm.sale_price}
                          onChange={e => setCreateForm(p => ({ ...p, sale_price: e.target.value }))}
                          placeholder="0" />
                      </CCol>
                      <CCol xs={6} md={1} className="d-flex align-items-end gap-1">
                        <CButton size="sm" color="success" onClick={handleCreateNomenclature} disabled={creating}>
                          {creating ? <CSpinner size="sm" /> : <CIcon icon={cilCheck} />}
                        </CButton>
                        <CButton size="sm" color="secondary" variant="outline"
                          onClick={() => { setShowCreate(false); setCreateError('') }}>×</CButton>
                      </CCol>
                    </CRow>
                    <div className="small text-body-secondary mt-1">
                      💡 После создания товар появится в номенклатуре. Снабженщик сможет добавить его на склад через приходную накладную.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Кол-во, ед., цена */}
          <CRow className="g-2">
            <CCol xs={3}>
              <div className="small text-body-secondary mb-1">Ед. измерения</div>
              <CFormInput size="sm" value={form.unit}
                onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} />
            </CCol>
            <CCol xs={3}>
              <div className="small text-body-secondary mb-1">Количество</div>
              <CFormInput size="sm" type="number" min="0.001" step="any" value={form.quantity}
                onChange={e => setForm(p => ({ ...p, quantity: parseFloat(e.target.value) || 0 }))} />
            </CCol>
            <CCol xs={3}>
              <div className="small text-body-secondary mb-1">Цена продажи</div>
              <CFormInput size="sm" type="number" min="0" step="any" value={form.sale_price}
                onChange={e => setForm(p => ({ ...p, sale_price: parseFloat(e.target.value) || 0 }))} />
            </CCol>
            <CCol xs={3} className="d-flex align-items-end gap-2">
              <CButton size="sm" color="success" onClick={handleSave} disabled={saving}>
                {saving ? <CSpinner size="sm" /> : <><CIcon icon={cilSave} className="me-1" />Сохранить</>}
              </CButton>
              <CButton size="sm" color="secondary" variant="outline"
                onClick={() => { setEditing(false); setShowCreate(false) }}>Отмена</CButton>
            </CCol>
          </CRow>
        </div>
      </CTableDataCell>
    </CTableRow>
  )
}

// ── Главный компонент ─────────────────────────────────────
export default function OutgoingInvoices() {
  const { hasRole } = useAuth()
  const canCreate = hasRole('admin', 'supervisor', 'manager', 'seller')
  const canEdit   = hasRole('admin', 'supervisor', 'warehouse')
  const printRef  = useRef()

  const [invoices,       setInvoices]       = useState([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState('')
  const [search,         setSearch]         = useState('')
  const [filterStatus,   setFilterStatus]   = useState('')
  const [modal,          setModal]          = useState(false)
  const [viewModal,      setViewModal]      = useState(false)
  const [current,        setCurrent]        = useState(null)
  const [saving,         setSaving]         = useState(false)
  const [confirming,     setConfirming]     = useState(false)
  const [warehouseItems, setWarehouseItems] = useState([])

  // Добавление новой позиции
  const [addItemForm,    setAddItemForm]    = useState({ item_id:'', item_name:'', unit:'шт', quantity:1, sale_price:0 })
  const [addItemSearch,  setAddItemSearch]  = useState('')
  const [addItemRes,     setAddItemRes]     = useState([])
  const [addItemSaving,  setAddItemSaving]  = useState(false)
  const [showAddItem,    setShowAddItem]    = useState(false)

  // Создание номенклатуры из формы добавления
  const [showAddCreate,  setShowAddCreate]  = useState(false)
  const [addCreateForm,  setAddCreateForm]  = useState({ name:'', unit:'шт', category:'', sale_price:'' })
  const [addCreating,    setAddCreating]    = useState(false)
  const [addCreateError, setAddCreateError] = useState('')

  const [deficitModal,   setDeficitModal]   = useState(false)
  const [deficitItems,   setDeficitItems]   = useState([])
  const [deficitMsg,     setDeficitMsg]     = useState('')

  // Форма новой накладной
  const [invoiceType,    setInvoiceType]    = useState('order')
  const [orderID,        setOrderID]        = useState('')
  const [clientName,     setClientName]     = useState('')
  const [notes,          setNotes]          = useState('')
  const [items,          setItems]          = useState([])
  const [itemSearch,     setItemSearch]     = useState('')
  const [orders,         setOrders]         = useState([])
  const [searchResults,  setSearchResults]  = useState([])

  const loadWarehouseItems = useCallback(() => {
    api.get('/warehouse/items').then(r => setWarehouseItems(r.data.data || [])).catch(() => {})
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    api.get('/warehouse/outgoing-invoices', { params: { status: filterStatus } })
      .then(r => setInvoices(r.data.data || []))
      .catch(() => setError('Ошибка загрузки'))
      .finally(() => setLoading(false))
  }, [filterStatus])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadWarehouseItems() }, [loadWarehouseItems])

  useEffect(() => {
    if (!modal) return
    api.get('/orders').then(r => {
      setOrders((r.data.data || []).filter(o => o.status !== 'cancelled'))
    }).catch(() => {})
  }, [modal])

  useEffect(() => {
    if (!itemSearch) { setSearchResults([]); return }
    const q = itemSearch.toLowerCase()
    setSearchResults(warehouseItems.filter(i =>
      i.name?.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q)
    ).slice(0, 10))
  }, [itemSearch, warehouseItems])

  useEffect(() => {
    if (!addItemSearch) { setAddItemRes([]); return }
    const q = addItemSearch.toLowerCase()
    setAddItemRes(warehouseItems.filter(i =>
      i.name?.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q)
    ).slice(0, 8))
  }, [addItemSearch, warehouseItems])

  const addItem = (warehouseItem) => {
    setItems(prev => {
      if (prev.find(i => i.item_id === warehouseItem.id)) return prev
      return [...prev, {
        item_id:    warehouseItem.id,
        item_name:  warehouseItem.name,
        unit:       warehouseItem.unit || 'шт',
        quantity:   1,
        cost_price: warehouseItem.avg_price || 0,
        sale_price: warehouseItem.sale_price || 0,
        stock:      warehouseItem.balance || 0,
      }]
    })
    setItemSearch(''); setSearchResults([])
  }

  const removeItem    = (itemID) => setItems(prev => prev.filter(i => i.item_id !== itemID))
  const updateItem    = (itemID, field, value) =>
    setItems(prev => prev.map(i => i.item_id === itemID ? { ...i, [field]: parseFloat(value) || 0 } : i))

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
          item_id: i.item_id, item_name: i.item_name,
          unit: i.unit, quantity: i.quantity, sale_price: i.sale_price,
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
    setShowAddItem(false); setShowAddCreate(false)
    setViewModal(true)
  }

  const reloadCurrent = async (id) => {
    const res = await api.get(`/warehouse/outgoing-invoices/${id}`)
    setCurrent(res.data)
  }

  const handleConfirm = async (id) => {
    setConfirming(true)
    try {
      const res = await api.post(`/warehouse/outgoing-invoices/${id}/confirm`)
      const result = res.data
      if (result.status === 'pending_purchase') {
        setDeficitItems(result.deficit_items || [])
        setDeficitMsg(result.message || '')
        setDeficitModal(true)
        load(); setViewModal(false)
      } else {
        load(); setViewModal(false)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка подтверждения')
    } finally { setConfirming(false) }
  }

  const handleCancel = async (id) => {
    if (!window.confirm('Отменить накладную? Товары вернутся на склад если накладная была подтверждена.')) return
    try {
      await api.post(`/warehouse/outgoing-invoices/${id}/cancel`)
      load(); setViewModal(false)
    } catch (err) { setError(err.response?.data?.error || 'Ошибка') }
  }

  const handleItemUpdate = async (itemId, form) => {
    await api.put(`/warehouse/outgoing-invoices/${current.id}/items/${itemId}`, form)
    await reloadCurrent(current.id)
  }

  const handleItemDelete = async (itemId) => {
    if (!window.confirm('Удалить позицию?')) return
    await api.delete(`/warehouse/outgoing-invoices/${current.id}/items/${itemId}`)
    await reloadCurrent(current.id)
  }

  const handleItemAdd = async () => {
    if (!addItemForm.item_name && !addItemForm.item_id) return
    setAddItemSaving(true)
    try {
      await api.post(`/warehouse/outgoing-invoices/${current.id}/items`, addItemForm)
      await reloadCurrent(current.id)
      setShowAddItem(false); setShowAddCreate(false)
      setAddItemForm({ item_id:'', item_name:'', unit:'шт', quantity:1, sale_price:0 })
      setAddItemSearch('')
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка добавления')
    } finally { setAddItemSaving(false) }
  }

  const selectAddItem = (wItem) => {
    setAddItemForm(prev => ({
      ...prev, item_id: wItem.id, item_name: wItem.name,
      unit: wItem.unit || 'шт', sale_price: wItem.sale_price || prev.sale_price,
    }))
    setAddItemSearch(''); setAddItemRes([])
  }

  // Создание товара из формы добавления позиции
  const handleAddCreateNomenclature = async () => {
    if (!addCreateForm.name.trim()) { setAddCreateError('Введите название'); return }
    setAddCreating(true); setAddCreateError('')
    try {
      const res = await api.post('/warehouse/items', {
        name:       addCreateForm.name.trim(),
        unit:       addCreateForm.unit || 'шт',
        category:   addCreateForm.category || '',
        sale_price: parseFloat(addCreateForm.sale_price) || 0,
        is_active:  true,
      })
      const newId = res.data?.id
      if (newId) {
        setAddItemForm(prev => ({
          ...prev, item_id: newId, item_name: addCreateForm.name.trim(),
          unit: addCreateForm.unit || 'шт',
          sale_price: parseFloat(addCreateForm.sale_price) || prev.sale_price,
        }))
        loadWarehouseItems()
      }
      setShowAddCreate(false)
      setAddCreateForm({ name:'', unit:'шт', category:'', sale_price:'' })
    } catch (e) {
      setAddCreateError(e.response?.data?.error || 'Ошибка создания товара')
    } finally { setAddCreating(false) }
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
        @media print { button { display: none; } }
      </style></head>
      <body>${printContent}</body></html>
    `)
    win.document.close(); win.print()
  }

  const visible = invoices.filter(inv => {
    const q = search.toLowerCase()
    return (
      inv.invoice_number?.toLowerCase().includes(q) ||
      inv.client_name?.toLowerCase().includes(q) ||
      String(inv.order_number).includes(q)
    )
  })

  const isDraftOrPending = current?.status === 'draft' || current?.status === 'pending_purchase'
  const canEditItems = isDraftOrPending && canEdit

  return (
    <>
      {error && <CAlert color="danger" dismissible onClose={() => setError('')}>{error}</CAlert>}

      <CCard>
        <CCardHeader>
          <div className="d-flex gap-2 align-items-center">
            <CInputGroup size="sm" style={{ width: 220 }}>
              <CInputGroupText><CIcon icon={cilSearch} /></CInputGroupText>
              <CFormInput placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)} />
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
                  <CTableHeaderCell className="text-end">Себест.</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Сумма</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Прибыль</CTableHeaderCell>
                  <CTableHeaderCell>Статус</CTableHeaderCell>
                  <CTableHeaderCell>Дата</CTableHeaderCell>
                  <CTableHeaderCell></CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {visible.length === 0 && (
                  <CTableRow>
                    <CTableDataCell colSpan={9} className="text-center text-body-secondary py-4">Накладных нет</CTableDataCell>
                  </CTableRow>
                )}
                {visible.map(inv => {
                  const profit = inv.total_price - inv.total_cost
                  const canConfirm = (inv.status === 'draft' || inv.status === 'pending_purchase') && canCreate
                  return (
                    <CTableRow key={inv.id} style={{ cursor:'pointer' }} onClick={() => openView(inv)}>
                      <CTableDataCell className="fw-semibold">{inv.invoice_number}</CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={inv.invoice_type === 'order' ? 'primary' : 'info'}>
                          {inv.invoice_type === 'order' ? 'Заказ' : 'Внешняя'}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell className="small">
                        {inv.order_number ? `#${inv.order_number}` : inv.client_name || '—'}
                      </CTableDataCell>
                      <CTableDataCell className="text-end small">{Number(inv.total_cost).toLocaleString()} сом.</CTableDataCell>
                      <CTableDataCell className="text-end fw-semibold">{Number(inv.total_price).toLocaleString()} сом.</CTableDataCell>
                      <CTableDataCell className="text-end">
                        <span className={profit >= 0 ? 'text-success' : 'text-danger'}>{Number(profit).toLocaleString()} сом.</span>
                      </CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={STATUS_COLOR[inv.status] || 'secondary'}>{STATUS_LABEL[inv.status] || inv.status}</CBadge>
                      </CTableDataCell>
                      <CTableDataCell className="small text-body-secondary">
                        {new Date(inv.created_at).toLocaleDateString('ru-RU')}
                      </CTableDataCell>
                      <CTableDataCell onClick={e => e.stopPropagation()}>
                        {canConfirm && (
                          <CButton size="sm" color="success" variant="ghost"
                            onClick={() => handleConfirm(inv.id)} disabled={confirming} title="Подтвердить">
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
        <CModalHeader><CModalTitle>Новая расходная накладная</CModalTitle></CModalHeader>
        <CForm onSubmit={handleCreate}>
          <CModalBody>
            <CRow className="g-3">
              <CCol xs={12}>
                <div className="d-flex gap-2">
                  <CButton type="button" size="sm"
                    color={invoiceType === 'order' ? 'primary' : 'secondary'}
                    variant={invoiceType === 'order' ? undefined : 'outline'}
                    onClick={() => setInvoiceType('order')}>📦 Для заказа</CButton>
                  <CButton type="button" size="sm"
                    color={invoiceType === 'external' ? 'info' : 'secondary'}
                    variant={invoiceType === 'external' ? undefined : 'outline'}
                    onClick={() => setInvoiceType('external')}>🏪 Продажа вне цеха</CButton>
                </div>
              </CCol>
              {invoiceType === 'order' ? (
                <CCol xs={12} md={6}>
                  <CFormLabel>Заказ *</CFormLabel>
                  <CFormSelect required value={orderID} onChange={e => setOrderID(e.target.value)}>
                    <option value="">— Выберите заказ —</option>
                    {orders.map(o => (
                      <option key={o.id} value={o.id}>#{o.order_number} — {o.title} {o.client_name ? `(${o.client_name})` : ''}</option>
                    ))}
                  </CFormSelect>
                </CCol>
              ) : (
                <CCol xs={12} md={6}>
                  <CFormLabel>Покупатель</CFormLabel>
                  <CFormInput value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Имя покупателя или организация" />
                </CCol>
              )}
              <CCol xs={12} md={6}>
                <CFormLabel>Примечание</CFormLabel>
                <CFormTextarea rows={1} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Дополнительная информация..." />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Добавить товар</CFormLabel>
                <div style={{ position:'relative' }}>
                  <CInputGroup size="sm">
                    <CInputGroupText><CIcon icon={cilSearch} /></CInputGroupText>
                    <CFormInput placeholder="Поиск по названию или категории..."
                      value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
                  </CInputGroup>
                  {searchResults.length > 0 && (
                    <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:1000, background:'var(--cui-card-bg)', border:'1px solid var(--cui-border-color)', borderRadius:6, maxHeight:250, overflowY:'auto', boxShadow:'0 4px 12px rgba(0,0,0,0.15)' }}>
                      {searchResults.map(item => (
                        <div key={item.id} onClick={() => addItem(item)}
                          style={{ padding:'8px 12px', cursor:'pointer', borderBottom:'0.5px solid var(--cui-border-color)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--cui-tertiary-bg)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div className="fw-semibold small">{item.name}</div>
                          <div className="text-body-secondary" style={{ fontSize:11 }}>
                            {item.category} • {item.unit} • Остаток: {item.balance || 0}
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
                  <CTable small bordered responsive style={{ fontSize:12 }}>
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell>Товар</CTableHeaderCell>
                        <CTableHeaderCell style={{ width:80 }}>Ед.</CTableHeaderCell>
                        <CTableHeaderCell style={{ width:100 }}>Кол-во</CTableHeaderCell>
                        <CTableHeaderCell style={{ width:110 }}>Себест.</CTableHeaderCell>
                        <CTableHeaderCell style={{ width:110 }}>Цена прод.</CTableHeaderCell>
                        <CTableHeaderCell style={{ width:110 }} className="text-end">Итого</CTableHeaderCell>
                        <CTableHeaderCell style={{ width:40 }}></CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {items.map(item => (
                        <CTableRow key={item.item_id}>
                          <CTableDataCell>
                            <div className="fw-semibold">{item.item_name}</div>
                            <div className="text-body-secondary" style={{ fontSize:10 }}>Остаток: {item.stock}</div>
                          </CTableDataCell>
                          <CTableDataCell>{item.unit}</CTableDataCell>
                          <CTableDataCell>
                            <CFormInput type="number" size="sm" min="0.001" step="any" value={item.quantity}
                              onChange={e => updateItem(item.item_id, 'quantity', e.target.value)} />
                          </CTableDataCell>
                          <CTableDataCell>
                            <CFormInput type="number" size="sm" min="0" step="any" value={item.cost_price}
                              onChange={e => updateItem(item.item_id, 'cost_price', e.target.value)} />
                          </CTableDataCell>
                          <CTableDataCell>
                            <CFormInput type="number" size="sm" min="0" step="any" value={item.sale_price}
                              onChange={e => updateItem(item.item_id, 'sale_price', e.target.value)} />
                          </CTableDataCell>
                          <CTableDataCell className="text-end fw-semibold">
                            {(item.quantity * item.sale_price).toLocaleString()}
                          </CTableDataCell>
                          <CTableDataCell>
                            <CButton size="sm" color="danger" variant="ghost" onClick={() => removeItem(item.item_id)}>
                              <CIcon icon={cilTrash} />
                            </CButton>
                          </CTableDataCell>
                        </CTableRow>
                      ))}
                      <CTableRow style={{ background:'var(--cui-tertiary-bg)' }}>
                        <CTableDataCell colSpan={3} className="fw-bold">Итого</CTableDataCell>
                        <CTableDataCell className="fw-semibold text-body-secondary">{totalCost.toLocaleString()} сом.</CTableDataCell>
                        <CTableDataCell></CTableDataCell>
                        <CTableDataCell className="text-end fw-bold text-success">{totalPrice.toLocaleString()} сом.</CTableDataCell>
                        <CTableDataCell></CTableDataCell>
                      </CTableRow>
                    </CTableBody>
                  </CTable>
                </CCol>
              )}
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => { setModal(false); resetForm() }}>Отмена</CButton>
            <CButton type="submit" color="primary" disabled={saving || items.length === 0}>
              {saving ? <CSpinner size="sm" /> : 'Создать накладную'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>

      {/* ── Модал просмотра (интерактивный) ── */}
      {current && (
        <CModal size="xl" visible={viewModal} onClose={() => setViewModal(false)}>
          <CModalHeader>
            <CModalTitle>
              Накладная {current.invoice_number}
              <CBadge color={STATUS_COLOR[current.status] || 'secondary'} className="ms-2" style={{ fontSize:12 }}>
                {STATUS_LABEL[current.status] || current.status}
              </CBadge>
            </CModalTitle>
          </CModalHeader>
          <CModalBody>
            {current.status === 'pending_purchase' && (
              <CAlert color="warning" className="mb-3">
                <CIcon icon={cilWarning} className="me-2" />
                <strong>Ожидание закупки.</strong> Привяжите позиции к номенклатуре и повторите подтверждение.
              </CAlert>
            )}

            {/* Шапка */}
            <div className="d-flex gap-4 mb-3 flex-wrap small">
              {current.order_number && <span><strong>Заказ:</strong> #{current.order_number}</span>}
              {current.client_name  && <span><strong>Покупатель:</strong> {current.client_name}</span>}
              {current.notes        && <span><strong>Примечание:</strong> {current.notes}</span>}
              <span><strong>Создал:</strong> {current.creator_name}</span>
              <span><strong>Дата:</strong> {new Date(current.created_at).toLocaleDateString('ru-RU')}</span>
              {current.confirmed_at && <span><strong>Подтверждена:</strong> {new Date(current.confirmed_at).toLocaleDateString('ru-RU')}</span>}
            </div>

            {/* Таблица позиций */}
            <div ref={printRef}>
              <h2 style={{ textAlign:'center', fontSize:16, marginBottom:8 }}>
                Расходная накладная № {current.invoice_number}
              </h2>
              <CTable small bordered responsive style={{ fontSize:13 }}>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Наименование</CTableHeaderCell>
                    <CTableHeaderCell className="text-center" style={{ width:60 }}>Ед.</CTableHeaderCell>
                    <CTableHeaderCell className="text-center" style={{ width:80 }}>Кол-во</CTableHeaderCell>
                    <CTableHeaderCell className="text-end" style={{ width:100 }}>Себест.</CTableHeaderCell>
                    <CTableHeaderCell className="text-end" style={{ width:100 }}>Цена</CTableHeaderCell>
                    <CTableHeaderCell className="text-end" style={{ width:110 }}>Сумма</CTableHeaderCell>
                    {canEditItems && <CTableHeaderCell style={{ width:80 }}></CTableHeaderCell>}
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {(current.items || []).length === 0 && (
                    <CTableRow>
                      <CTableDataCell colSpan={canEditItems ? 7 : 6} className="text-center text-body-secondary py-3">
                        Позиции не добавлены
                      </CTableDataCell>
                    </CTableRow>
                  )}
                  {(current.items || []).map(item => (
                    <InvoiceItemRow
                      key={item.id}
                      item={item}
                      warehouseItems={warehouseItems}
                      canEdit={canEditItems}
                      onUpdate={handleItemUpdate}
                      onDelete={handleItemDelete}
                      onWarehouseItemCreated={loadWarehouseItems}
                    />
                  ))}
                  <CTableRow style={{ background:'var(--cui-secondary-bg)', fontWeight:700 }}>
                    <CTableDataCell colSpan={3} className="text-end">Итого:</CTableDataCell>
                    <CTableDataCell className="text-end text-body-secondary">{Number(current.total_cost).toLocaleString()} сом.</CTableDataCell>
                    <CTableDataCell></CTableDataCell>
                    <CTableDataCell className="text-end text-success">{Number(current.total_price).toLocaleString()} сом.</CTableDataCell>
                    {canEditItems && <CTableDataCell />}
                  </CTableRow>
                </CTableBody>
              </CTable>
            </div>

            {/* Добавление новой позиции */}
            {canEditItems && (
              <div className="mt-3">
                {!showAddItem ? (
                  <CButton size="sm" color="primary" variant="outline" onClick={() => setShowAddItem(true)}>
                    <CIcon icon={cilPlus} className="me-1" />Добавить позицию
                  </CButton>
                ) : (
                  <div className="p-3 rounded" style={{ background:'var(--cui-secondary-bg)', border:'1px solid var(--cui-border-color)' }}>
                    <div className="fw-semibold small mb-2">Новая позиция</div>
                    <CRow className="g-2">
                      <CCol xs={12} md={5}>
                        <div className="small text-body-secondary mb-1">Наименование / поиск в номенклатуре</div>
                        <div style={{ position:'relative' }}>
                          {addItemForm.item_id ? (
                            <div className="d-flex align-items-center gap-2 p-2 rounded"
                              style={{ background:'var(--cui-success-bg-subtle)', border:'1px solid var(--cui-success-border-subtle)' }}>
                              <span className="fw-semibold flex-grow-1">{addItemForm.item_name}</span>
                              <span style={{ fontSize:10, color:'var(--cui-success)' }}>● склад</span>
                              <CButton size="sm" color="secondary" variant="ghost"
                                onClick={() => setAddItemForm(p => ({ ...p, item_id:'' }))}>× Отвязать</CButton>
                            </div>
                          ) : (
                            <div>
                              <div className="d-flex gap-2 mb-1">
                                <CFormInput size="sm"
                                  value={addItemSearch || addItemForm.item_name}
                                  placeholder="Введите название или найдите в номенклатуре..."
                                  onChange={e => { setAddItemSearch(e.target.value); setAddItemForm(p => ({ ...p, item_name: e.target.value })) }}
                                />
                                {!showAddCreate && (
                                  <CButton size="sm" color="success" variant="outline"
                                    onClick={() => {
                                      setShowAddCreate(true)
                                      setAddCreateForm(p => ({ ...p, name: addItemForm.item_name, unit: addItemForm.unit }))
                                      setAddCreateError('')
                                    }}>
                                    <CIcon icon={cilPlus} className="me-1" />В номенклатуру
                                  </CButton>
                                )}
                              </div>
                              {addItemRes.length > 0 && (
                                <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:1060, background:'var(--cui-body-bg)', border:'1px solid var(--cui-border-color)', borderRadius:4, maxHeight:200, overflowY:'auto', boxShadow:'0 4px 12px rgba(0,0,0,0.15)' }}>
                                  {addItemRes.map(wItem => (
                                    <div key={wItem.id} onMouseDown={() => selectAddItem(wItem)}
                                      style={{ padding:'6px 12px', cursor:'pointer', fontSize:13, borderBottom:'0.5px solid var(--cui-border-color)' }}
                                      onMouseEnter={e => e.currentTarget.style.background = 'var(--cui-primary-bg-subtle)'}
                                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                      <span className="fw-semibold">{wItem.name}</span>
                                      <span className="text-body-secondary ms-2" style={{ fontSize:11 }}>
                                        {wItem.unit} · Остаток: {wItem.balance || 0}
                                        {wItem.sale_price > 0 && ` · ${wItem.sale_price} сом`}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Форма создания товара в номенклатуре (из формы добавления позиции) */}
                        {showAddCreate && (
                          <div className="mt-2 p-2 rounded" style={{ background:'var(--cui-success-bg-subtle)', border:'1px solid var(--cui-success-border-subtle)' }}>
                            <div className="small fw-semibold text-success mb-2">✨ Создать новый товар</div>
                            {addCreateError && <CAlert color="danger" className="py-1 mb-2 small">{addCreateError}</CAlert>}
                            <CRow className="g-2">
                              <CCol xs={12}>
                                <CFormInput size="sm" value={addCreateForm.name}
                                  onChange={e => setAddCreateForm(p => ({ ...p, name: e.target.value }))}
                                  placeholder="Название товара *" autoFocus />
                              </CCol>
                              <CCol xs={4}>
                                <CFormSelect size="sm" value={addCreateForm.unit}
                                  onChange={e => setAddCreateForm(p => ({ ...p, unit: e.target.value }))}>
                                  {['шт','кг','л','м','м²','м³','упак','лист'].map(u => <option key={u} value={u}>{u}</option>)}
                                </CFormSelect>
                              </CCol>
                              <CCol xs={4}>
                                <CFormInput size="sm" value={addCreateForm.category}
                                  onChange={e => setAddCreateForm(p => ({ ...p, category: e.target.value }))}
                                  placeholder="Категория" />
                              </CCol>
                              <CCol xs={4}>
                                <CFormInput size="sm" type="number" min="0" step="any"
                                  value={addCreateForm.sale_price}
                                  onChange={e => setAddCreateForm(p => ({ ...p, sale_price: e.target.value }))}
                                  placeholder="Цена" />
                              </CCol>
                              <CCol xs={12} className="d-flex gap-1">
                                <CButton size="sm" color="success" onClick={handleAddCreateNomenclature} disabled={addCreating}>
                                  {addCreating ? <CSpinner size="sm" /> : '✓ Создать'}
                                </CButton>
                                <CButton size="sm" color="secondary" variant="outline"
                                  onClick={() => { setShowAddCreate(false); setAddCreateError('') }}>Отмена</CButton>
                              </CCol>
                            </CRow>
                          </div>
                        )}
                      </CCol>
                      <CCol xs={4} md={2}>
                        <div className="small text-body-secondary mb-1">Ед.</div>
                        <CFormInput size="sm" value={addItemForm.unit}
                          onChange={e => setAddItemForm(p => ({ ...p, unit: e.target.value }))} />
                      </CCol>
                      <CCol xs={4} md={2}>
                        <div className="small text-body-secondary mb-1">Кол-во</div>
                        <CFormInput size="sm" type="number" min="0.001" step="any" value={addItemForm.quantity}
                          onChange={e => setAddItemForm(p => ({ ...p, quantity: parseFloat(e.target.value) || 0 }))} />
                      </CCol>
                      <CCol xs={4} md={2}>
                        <div className="small text-body-secondary mb-1">Цена</div>
                        <CFormInput size="sm" type="number" min="0" step="any" value={addItemForm.sale_price}
                          onChange={e => setAddItemForm(p => ({ ...p, sale_price: parseFloat(e.target.value) || 0 }))} />
                      </CCol>
                      <CCol xs={12} md={1} className="d-flex align-items-end gap-1">
                        <CButton size="sm" color="success" onClick={handleItemAdd} disabled={addItemSaving}>
                          {addItemSaving ? <CSpinner size="sm" /> : <CIcon icon={cilSave} />}
                        </CButton>
                        <CButton size="sm" color="secondary" variant="outline"
                          onClick={() => {
                            setShowAddItem(false); setShowAddCreate(false)
                            setAddItemSearch('')
                            setAddItemForm({ item_id:'', item_name:'', unit:'шт', quantity:1, sale_price:0 })
                          }}>×</CButton>
                      </CCol>
                    </CRow>
                  </div>
                )}
              </div>
            )}
          </CModalBody>
          <CModalFooter>
            {isDraftOrPending && canCreate && (
              <>
                <CButton color="success" disabled={confirming} onClick={() => handleConfirm(current.id)}>
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
            <CButton color="secondary" variant="outline" onClick={() => setViewModal(false)}>Закрыть</CButton>
          </CModalFooter>
        </CModal>
      )}

      {/* ── Модал дефицита ── */}
      <CModal visible={deficitModal} onClose={() => setDeficitModal(false)}>
        <CModalHeader><CModalTitle>⚠️ Недостаточно товаров на складе</CModalTitle></CModalHeader>
        <CModalBody>
          <CAlert color="warning" className="mb-3">{deficitMsg || 'Накладная переведена в статус «Ожидание закупки».'}</CAlert>
          <p className="mb-2 fw-semibold" style={{ fontSize:13 }}>
            Снабженцу необходимо создать приходную накладную на следующие товары:
          </p>
          <CTable small bordered style={{ fontSize:13 }}>
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
                  <CTableDataCell className="text-end fw-bold text-danger">{d.shortage}</CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
          <p className="mt-3 text-body-secondary" style={{ fontSize:12 }}>
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