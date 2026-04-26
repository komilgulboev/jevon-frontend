import { useState, useEffect, useRef, useCallback } from 'react'
import {
  CButton, CSpinner, CAlert,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CFormInput, CInputGroup, CInputGroupText,
  CTable, CTableHead, CTableBody, CTableRow,
  CTableHeaderCell, CTableDataCell, CBadge,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilSave, cilPrint, cilSearch, cilClipboard } from '@coreui/icons'
import api from '../api/client'

const UNITS = ['шт', 'м', 'м²', 'м³', 'кг', 'л', 'упак', 'лист']
const DEFAULT_ROWS = 28

const emptyRow = () => ({
  _id:           Math.random().toString(36).slice(2),
  id:            null,
  name:          '',
  quantity:      '',
  unit:          'шт',
  unit_price:    '',
  total_price:   '',
  supplier:      '',
  stage_name:    '',
  item_id:       '',
  invoice_id:    '',
  invoice_number:'',
  _dirty:        false,
  _saved:        false,
})

function printInvoice(order, rows, total) {
  const filled = rows.filter(r => r.name.trim())
  const filledTrs = filled.map((r, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td class="name">${r.name}</td>
      <td class="center">${r.quantity !== '' ? r.quantity : ''} ${r.unit}</td>
      <td class="right">${r.unit_price !== '' ? Number(r.unit_price).toLocaleString() : ''}</td>
      <td class="right bold">${r.total_price !== '' ? Number(r.total_price).toLocaleString() : ''}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Накладная №${order?.order_number || ''}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #000; background: #fff; }
.page { width: 148mm; margin: 0 auto; padding: 8mm; }
h2 { text-align: center; font-size: 11pt; font-weight: bold; margin-bottom: 5mm; }
.meta { margin-bottom: 4mm; font-size: 9.5pt; }
.meta p { margin: 1mm 0; }
table { width: 100%; border-collapse: collapse; margin-top: 3mm; border: 2px solid #000; }
th, td { border: 1px solid #000; padding: 1.5mm 2mm; font-size: 9pt; line-height: 1.2; }
th { background-color: #d8d8d8 !important; font-weight: bold; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
td.num { text-align: center; width: 8mm; } td.name { text-align: left; }
td.center { text-align: center; } td.right { text-align: right; } td.bold { font-weight: bold; }
tr { height: 6mm; }
tr:nth-child(even) { background-color: #f9f9f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.total-row td { font-weight: bold; background-color: #e8e8e8 !important; border-top: 2px solid #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.sign { margin-top: 8mm; display: flex; justify-content: space-between; font-size: 9pt; }
@media screen { body { background: #888; padding: 10px 0 30px; } .page { background: #fff; box-shadow: 0 3px 20px rgba(0,0,0,0.4); min-height: 210mm; padding: 10mm; } .print-btn { display: block; width: 148mm; margin: 10px auto; padding: 10px; background: #1a73e8; color: white; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; text-align: center; } }
@media print { @page { size: A5 portrait; margin: 0; } body { background: #fff; padding: 0; } .page { padding: 8mm; box-shadow: none; min-height: auto; } .print-btn { display: none; } table { border-collapse: collapse !important; } th, td { border: 1px solid #000 !important; } table { border: 2px solid #000 !important; } .total-row td { border-top: 2px solid #000 !important; } }
</style></head>
<body>
<button class="print-btn" onclick="window.print()">🖨️ Распечатать накладную</button>
<div class="page">
<h2>Накладная №${order?.order_number || '___'} &nbsp;&nbsp; Дата: ${new Date().toLocaleDateString('ru-RU')}</h2>
<div class="meta">
<p><b>Заказ:</b> ${order?.title || ''}</p>
<p><b>Клиент:</b> ${order?.client_name || '—'}${order?.client_phone ? ' / ' + order.client_phone : ''}</p>
${order?.address ? `<p><b>Адрес:</b> ${order.address}</p>` : ''}
</div>
<table><thead><tr>
<th style="width:8mm">№</th><th>Наименование</th><th style="width:20mm">Кол-во</th><th style="width:22mm">Цена</th><th style="width:24mm">Сумма</th>
</tr></thead><tbody>
${filledTrs}
<tr class="total-row"><td colspan="4" style="text-align:right">Итого:</td><td class="right">${total > 0 ? Number(total).toLocaleString() + ' сом.' : ''}</td></tr>
</tbody></table>
<div class="sign"><span>Снабженец: ______________________</span><span>Принял: ______________________</span></div>
</div></body></html>`

  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
  w.focus()
}

function NomenclatureCell({ value, itemId, warehouseItems, onSelect, onManualChange, placeholder }) {
  const [search, setSearch] = useState('')
  const [open, setOpen]     = useState(false)
  const ref = useRef(null)

  const linkedItem = itemId ? warehouseItems.find(i => i.id === itemId) : null

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSearch('') }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = warehouseItems.filter(i => {
    if (!search) return true
    const q = search.toLowerCase()
    return i.name?.toLowerCase().includes(q) || i.article?.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q)
  }).slice(0, 30)

  if (linkedItem) {
    return (
      <div style={{ display:'flex', alignItems:'center', padding:'3px 6px', gap:4, minHeight:28 }}>
        <div style={{ flex:1, fontSize:13, overflow:'hidden' }}>
          <span className="fw-semibold">{linkedItem.name}</span>
          {linkedItem.article && <span style={{ fontSize:10, color:'var(--cui-secondary-color)', marginLeft:4 }}>{linkedItem.article}</span>}
          <span style={{ fontSize:9, color:'var(--cui-info)', marginLeft:4 }}>●</span>
        </div>
        <button onClick={() => onSelect(null)} title="Отвязать"
          style={{ border:'none', background:'none', cursor:'pointer', color:'var(--cui-secondary-color)', fontSize:14, padding:'0 2px', lineHeight:1, flexShrink:0 }}>×</button>
      </div>
    )
  }

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <input value={search || value} placeholder={placeholder || 'Выберите из номенклатуры...'}
        onChange={e => { setSearch(e.target.value); onManualChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        style={{ width:'100%', border:'none', background:'transparent', fontSize:13, padding:'4px 6px', color:'var(--cui-body-color)', outline:'none' }} />
      {open && (
        <div style={{ position:'absolute', top:'100%', left:0, zIndex:1060, background:'var(--cui-body-bg)', border:'1px solid var(--cui-border-color)', borderRadius:4, boxShadow:'0 6px 20px rgba(0,0,0,0.15)', minWidth:280, maxHeight:260, overflowY:'auto' }}>
          {filtered.length === 0
            ? <div style={{ padding:'8px 12px', fontSize:12, color:'var(--cui-secondary-color)' }}>Ничего не найдено — введите вручную</div>
            : filtered.map(item => (
              <div key={item.id} onMouseDown={() => { onSelect(item); setOpen(false); setSearch('') }}
                style={{ padding:'6px 12px', cursor:'pointer', fontSize:13, borderBottom:'0.5px solid var(--cui-border-color)', display:'flex', justifyContent:'space-between', alignItems:'center' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--cui-primary-bg-subtle)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div>
                  <span className="fw-semibold">{item.name}</span>
                  {item.article && <span style={{ fontSize:11, color:'var(--cui-secondary-color)', marginLeft:6 }}>{item.article}</span>}
                  {item.category && <span style={{ fontSize:10, marginLeft:6, color:'var(--cui-secondary-color)' }}>[{item.category}]</span>}
                </div>
                <div style={{ fontSize:11, color:'var(--cui-secondary-color)', flexShrink:0, marginLeft:8 }}>
                  {item.unit}{item.sale_price > 0 && ` · ${item.sale_price.toLocaleString()} сом`}
                  <span style={{ marginLeft:4, color: item.balance > 0 ? 'var(--cui-success)' : 'var(--cui-danger)' }}>({item.balance || 0})</span>
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}

export default function MaterialsTable({ orderId, order, stageName, canEdit = true, onSaved }) {
  const [rows,           setRows]           = useState(() => Array.from({ length: DEFAULT_ROWS }, emptyRow))
  const [warehouseItems, setWarehouseItems] = useState([])
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState('')
  const [success,        setSuccess]        = useState(false)

  const [warehouseModal,   setWarehouseModal]   = useState(false)
  const [warehouseSearch,  setWarehouseSearch]  = useState('')
  const [warehouseLoading, setWarehouseLoading] = useState(false)

  const [invoiceModal,   setInvoiceModal]   = useState(false)
  const [invoiceItems,   setInvoiceItems]   = useState([])
  const [invoiceSaving,  setInvoiceSaving]  = useState(false)
  const [invoiceSuccess, setInvoiceSuccess] = useState(false)
  const [invoiceError,   setInvoiceError]   = useState('')

  useEffect(() => {
    api.get('/warehouse/items').then(r => setWarehouseItems(r.data.data || [])).catch(() => {})
  }, [])

  const loadMaterials = useCallback(async () => {
    try {
      const matRes = await api.get(`/orders/${orderId}/materials`)
      const existing = matRes.data.data || []
      const filled = existing.map(m => ({
        _id:           m.id,
        id:            m.id,
        name:          m.name,
        quantity:      m.quantity   && m.quantity   !== 0 ? m.quantity   : '',
        unit:          m.unit || 'шт',
        unit_price:    m.unit_price && m.unit_price !== 0 ? m.unit_price : '',
        total_price:   m.total_price && m.total_price !== 0 ? m.total_price : '',
        supplier:      m.supplier   || '',
        stage_name:    m.stage_name || stageName || '',
        item_id:       m.item_id    || '',
        invoice_id:    m.invoice_id    || '',
        invoice_number:m.invoice_number || '',
        _dirty: false, _saved: true,
      }))
      const empty = Math.max(0, DEFAULT_ROWS - filled.length)
      setRows([...filled, ...Array.from({ length: empty }, emptyRow)])
    } catch { setError('Ошибка загрузки материалов') }
  }, [orderId, stageName])

  useEffect(() => { loadMaterials() }, [loadMaterials])

  const selectNomenclatureItem = (idx, item) => {
    setRows(prev => {
      const next = [...prev]
      if (item === null) {
        next[idx] = { ...next[idx], item_id: '', _dirty: true }
      } else {
        const price = item.sale_price > 0 ? item.sale_price : (next[idx].unit_price || '')
        const q = parseFloat(next[idx].quantity) || 0
        const p = parseFloat(price) || 0
        next[idx] = { ...next[idx], name: item.name, unit: item.unit || 'шт', unit_price: price, item_id: item.id, total_price: (q > 0 && p > 0) ? q * p : '', _dirty: true }
      }
      return next
    })
  }

  const handleManualNameChange = (idx, value) => {
    setRows(prev => { const next = [...prev]; next[idx] = { ...next[idx], name: value, item_id: '', _dirty: true }; return next })
  }

  const openWarehouseModal = async () => {
    setWarehouseModal(true); setWarehouseSearch('')
    if (warehouseItems.length === 0) {
      setWarehouseLoading(true)
      try { const r = await api.get('/warehouse/items'); setWarehouseItems(r.data.data || []) }
      catch {} finally { setWarehouseLoading(false) }
    }
  }

  const addFromWarehouse = (item) => {
    setRows(prev => {
      const emptyIdx = prev.findIndex(r => !r.name.trim())
      const price = item.sale_price > 0 ? item.sale_price : ''
      const newRow = { ...emptyRow(), name: item.name, unit: item.unit || 'шт', unit_price: price, quantity: 1, total_price: price || '', item_id: item.id, _dirty: true }
      if (emptyIdx !== -1) { const next = [...prev]; next[emptyIdx] = newRow; return next }
      return [...prev, newRow]
    })
    setWarehouseModal(false)
  }

  const filteredWarehouse = warehouseItems.filter(i => {
    const q = warehouseSearch.toLowerCase()
    return !q || i.name?.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q) || i.article?.toLowerCase().includes(q)
  })

  // В модал заявки попадают только строки БЕЗ подтверждённой накладной
  const openInvoiceModal = () => {
    setInvoiceError(''); setInvoiceSuccess(false)
    const filledRows = rows.filter(r => r.name.trim() && !r.invoice_id)
    if (filledRows.length === 0) {
      setInvoiceError('Все материалы уже получены по накладной')
      setInvoiceModal(true)
      return
    }
    setInvoiceItems(filledRows.map(row => ({
      item_id:    row.item_id || '',
      item_name:  row.name,
      unit:       row.unit || 'шт',
      quantity:   parseFloat(row.quantity) || 0,
      sale_price: parseFloat(row.unit_price) || 0,
      no_item:    !row.item_id,
    })))
    setInvoiceModal(true)
  }

  const updateInvoiceItem = (idx, field, value) =>
    setInvoiceItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: parseFloat(value) || 0 } : item))

  const removeInvoiceItem = (idx) => setInvoiceItems(prev => prev.filter((_, i) => i !== idx))

  const handleCreateInvoice = async () => {
    const valid = invoiceItems.filter(i => i.quantity > 0)
    if (valid.length === 0) { setInvoiceError('Нет позиций для заявки'); return }
    setInvoiceSaving(true); setInvoiceError('')
    try {
      await api.post('/warehouse/outgoing-invoices', {
        invoice_type: 'order', order_id: orderId,
        notes: `Заявка из Материалов заказа #${order?.order_number || ''}`,
        items: valid.map(i => ({ item_id: i.item_id || '', item_name: i.item_name || '', unit: i.unit || 'шт', quantity: i.quantity, sale_price: i.sale_price || 0 })),
      })
      setInvoiceSuccess(true)
    } catch (e) {
      setInvoiceError(e.response?.data?.error || 'Ошибка создания заявки')
    } finally { setInvoiceSaving(false) }
  }

  const updateRow = (idx, field, value) => {
    setRows(prev => {
      const next = [...prev]
      const row  = { ...next[idx], [field]: value, _dirty: true }
      if (field === 'quantity' || field === 'unit_price') {
        const q = parseFloat(field === 'quantity'   ? value : row.quantity)   || 0
        const p = parseFloat(field === 'unit_price' ? value : row.unit_price) || 0
        row.total_price = (q > 0 && p > 0) ? q * p : ''
      }
      next[idx] = row; return next
    })
  }

  const addRows = (count = 10) => setRows(prev => [...prev, ...Array.from({ length: count }, emptyRow)])

  const deleteRow = async (idx) => {
    const row = rows[idx]
    if (row.id) {
      try { await api.delete(`/orders/${orderId}/materials/${row.id}`) }
      catch { setError('Ошибка удаления'); return }
    }
    setRows(prev => { const next = [...prev]; next.splice(idx, 1, emptyRow()); return next })
  }

  const saveAll = async () => {
    const toSave = rows.filter(r => r._dirty && r.name.trim())
    if (toSave.length === 0) { setSuccess(true); return }
    setSaving(true); setError('')
    try {
      for (const row of toSave) {
        const payload = {
          name:       row.name.trim(),
          quantity:   parseFloat(row.quantity)   || 0,
          unit:       row.unit || 'шт',
          unit_price: parseFloat(row.unit_price) || 0,
          supplier:   row.supplier   || '',
          stage_name: row.stage_name || stageName || '',
          item_id:    row.item_id    || '',
        }
        if (row.id) { await api.delete(`/orders/${orderId}/materials/${row.id}`) }
        await api.post(`/orders/${orderId}/materials`, payload)
      }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      await loadMaterials()
      onSaved?.()
    } catch { setError('Ошибка сохранения материалов') }
    finally { setSaving(false) }
  }

  const total       = rows.reduce((sum, r) => sum + (parseFloat(r.total_price) || 0), 0)
  const filledCount = rows.filter(r => r.name.trim()).length
  // Сколько строк ещё не получено (для счётчика на кнопке заявки)
  const pendingCount = rows.filter(r => r.name.trim() && !r.invoice_id).length

  const cellStyle  = { border: '1px solid var(--cui-border-color)', padding: 0 }
  const inputStyle = { width:'100%', border:'none', background:'transparent', fontSize:13, padding:'4px 6px', color:'var(--cui-body-color)', outline:'none' }

  return (
    <div>
      {error   && <CAlert color="danger"  dismissible onClose={() => setError('')}>{error}</CAlert>}
      {success && <CAlert color="success" dismissible onClose={() => setSuccess(false)}>Сохранено!</CAlert>}

      {/* Toolbar */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div className="small text-body-secondary">
          {filledCount > 0 && <>Позиций: <strong>{filledCount}</strong> &nbsp;|&nbsp; Итого: <strong className="text-success">{total.toLocaleString()} сом.</strong></>}
        </div>
        <div className="d-flex gap-2 flex-wrap">
          {canEdit && (
            <CButton size="sm" color="info" variant="outline" onClick={openWarehouseModal}>
              <CIcon icon={cilSearch} className="me-1" />Из склада
            </CButton>
          )}
          {filledCount > 0 && (
            <CButton size="sm" color="warning" variant="outline" onClick={openInvoiceModal}>
              <CIcon icon={cilClipboard} className="me-1" />
              Создать заявку
              {pendingCount > 0 && <span className="ms-1">({pendingCount})</span>}
            </CButton>
          )}
          <CButton size="sm" color="secondary" variant="outline" onClick={() => printInvoice(order, rows, total)}>
            <CIcon icon={cilPrint} className="me-1" />Печать
          </CButton>
          {canEdit && (
            <CButton size="sm" color="primary" onClick={saveAll} disabled={saving}>
              {saving ? <><CSpinner size="sm" className="me-1" />Сохранение...</> : <><CIcon icon={cilSave} className="me-1" />Сохранить</>}
            </CButton>
          )}
        </div>
      </div>

      {/* Таблица */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, tableLayout:'fixed' }}>
          <colgroup>
            <col style={{ width: 36 }} />
            <col style={{ width: '28%' }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 75 }} />
            <col style={{ width: 85 }} />
            <col style={{ width: 95 }} />
            <col style={{ width: 110 }} />  {/* Получено */}
            <col />
            {canEdit && <col style={{ width: 32 }} />}
          </colgroup>
          <thead>
            <tr style={{ background: 'var(--cui-secondary-bg)' }}>
              {['№', 'Наименование', 'Ед.', 'Кол-во', 'Цена', 'Сумма', 'Получено', 'Поставщик', canEdit ? '' : null]
                .filter(h => h !== null)
                .map((h, i) => (
                  <th key={i} style={{ border:'1px solid var(--cui-border-color)', padding:'5px 8px', textAlign: i === 0 || (i >= 3 && i !== 6) ? 'center' : 'left', fontWeight:600, fontSize:12, color:'var(--cui-body-color)' }}>{h}</th>
                ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const hasData   = row.name.trim() !== ''
              const isDirty   = hasData && row._dirty && !row._saved
              const isIssued  = hasData && !!row.invoice_id
              return (
                <tr key={row._id} style={{ background: isIssued ? 'var(--cui-success-bg-subtle)' : isDirty ? 'var(--cui-warning-bg-subtle)' : 'transparent' }}>
                  <td style={{ border:'1px solid var(--cui-border-color)', textAlign:'center', padding:'2px', color:'var(--cui-secondary-color)', fontSize:11 }}>
                    {hasData ? idx + 1 : ''}
                  </td>
                  <td style={cellStyle}>
                    {canEdit && !isIssued ? (
                      <NomenclatureCell value={row.name} itemId={row.item_id} warehouseItems={warehouseItems}
                        onSelect={item => selectNomenclatureItem(idx, item)}
                        onManualChange={val => handleManualNameChange(idx, val)}
                        placeholder="Выберите из номенклатуры..." />
                    ) : (
                      <div style={{ padding:'4px 8px' }}>
                        {row.name}
                        {row.item_id && <span style={{ fontSize:9, color:'var(--cui-info)', marginLeft:4 }}>●</span>}
                      </div>
                    )}
                  </td>
                  <td style={cellStyle}>
                    {canEdit && !isIssued
                      ? <select value={row.unit} onChange={e => updateRow(idx, 'unit', e.target.value)} style={{ ...inputStyle, cursor:'pointer', textAlign:'center' }}>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select>
                      : <div style={{ padding:'4px 8px', textAlign:'center' }}>{row.unit}</div>}
                  </td>
                  <td style={cellStyle}>
                    {canEdit && !isIssued
                      ? <input type="number" min="0" step="0.001" value={row.quantity} placeholder="" onChange={e => updateRow(idx, 'quantity', e.target.value)} style={{ ...inputStyle, textAlign:'center' }} />
                      : <div style={{ padding:'4px 8px', textAlign:'center' }}>{row.quantity}</div>}
                  </td>
                  <td style={cellStyle}>
                    {canEdit && !isIssued
                      ? <input type="number" min="0" step="0.01" value={row.unit_price} placeholder="" onChange={e => updateRow(idx, 'unit_price', e.target.value)} style={{ ...inputStyle, textAlign:'right' }} />
                      : <div style={{ padding:'4px 8px', textAlign:'right' }}>{row.unit_price !== '' ? Number(row.unit_price).toLocaleString() : ''}</div>}
                  </td>
                  <td style={{ border:'1px solid var(--cui-border-color)', padding:'4px 8px', textAlign:'right', fontWeight: hasData && row.total_price ? 600 : 400, color: hasData && row.total_price ? 'var(--cui-success)' : 'var(--cui-secondary-color)', background: hasData && row.total_price ? 'var(--cui-success-bg-subtle)' : 'transparent' }}>
                    {row.total_price !== '' && row.total_price !== 0 ? Number(row.total_price).toLocaleString() : ''}
                  </td>
                  {/* Колонка "Получено" */}
                  <td style={{ border:'1px solid var(--cui-border-color)', padding:'4px 8px', textAlign:'center' }}>
                    {isIssued ? (
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                        <span style={{ fontSize:14 }}>✅</span>
                        <span style={{ fontSize:10, color:'var(--cui-success)', fontWeight:600 }}>{row.invoice_number}</span>
                      </div>
                    ) : hasData ? (
                      <span style={{ fontSize:11, color:'var(--cui-secondary-color)' }}>—</span>
                    ) : null}
                  </td>
                  <td style={cellStyle}>
                    {canEdit && !isIssued
                      ? <input value={row.supplier} placeholder="" onChange={e => updateRow(idx, 'supplier', e.target.value)} style={{ ...inputStyle, fontSize:12 }} />
                      : <div style={{ padding:'4px 8px', fontSize:12 }}>{row.supplier}</div>}
                  </td>
                  {canEdit && (
                    <td style={{ border:'1px solid var(--cui-border-color)', padding:'2px', textAlign:'center' }}>
                      {hasData && !isIssued && (
                        <button onClick={() => deleteRow(idx)} style={{ border:'none', background:'none', cursor:'pointer', color:'var(--cui-danger)', fontSize:16, padding:'0 4px', lineHeight:1 }}>×</button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
            <tr style={{ background:'var(--cui-secondary-bg)', fontWeight:700 }}>
              <td colSpan={5} style={{ border:'1px solid var(--cui-border-color)', padding:'6px 8px', textAlign:'right' }}>Итого:</td>
              <td style={{ border:'1px solid var(--cui-border-color)', padding:'6px 8px', textAlign:'right', color:'var(--cui-success)', fontSize:14 }}>{total > 0 ? `${total.toLocaleString()} сом.` : ''}</td>
              <td colSpan={canEdit ? 3 : 2} style={{ border:'1px solid var(--cui-border-color)' }} />
            </tr>
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="d-flex gap-2 mt-2">
          <CButton size="sm" color="secondary" variant="outline" onClick={() => addRows(10)}><CIcon icon={cilPlus} className="me-1" />+ 10 строк</CButton>
          <CButton size="sm" color="secondary" variant="outline" onClick={() => addRows(5)}>+ 5 строк</CButton>
        </div>
      )}

      {/* ── Модал "Из склада" ── */}
      <CModal size="lg" visible={warehouseModal} onClose={() => setWarehouseModal(false)}>
        <CModalHeader><CModalTitle><CIcon icon={cilSearch} className="me-2" />Выбрать из склада</CModalTitle></CModalHeader>
        <CModalBody>
          <CInputGroup className="mb-3">
            <CInputGroupText><CIcon icon={cilSearch} /></CInputGroupText>
            <CFormInput placeholder="Поиск по названию, артикулу, категории..." value={warehouseSearch} onChange={e => setWarehouseSearch(e.target.value)} autoFocus />
          </CInputGroup>
          {warehouseLoading ? <div className="text-center py-4"><CSpinner /></div> : (
            <CTable small hover responsive style={{ fontSize: 13 }}>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Наименование</CTableHeaderCell>
                  <CTableHeaderCell>Категория</CTableHeaderCell>
                  <CTableHeaderCell className="text-center">Ед.</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Остаток</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Цена прод.</CTableHeaderCell>
                  <CTableHeaderCell></CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {filteredWarehouse.length === 0 && (
                  <CTableRow><CTableDataCell colSpan={6} className="text-center text-body-secondary py-3">Ничего не найдено</CTableDataCell></CTableRow>
                )}
                {filteredWarehouse.map(item => (
                  <CTableRow key={item.id} style={{ cursor:'pointer' }} onClick={() => addFromWarehouse(item)}>
                    <CTableDataCell>
                      <div className="fw-semibold">{item.name}</div>
                      {item.article && <div className="text-body-secondary" style={{ fontSize:11 }}>{item.article}</div>}
                    </CTableDataCell>
                    <CTableDataCell>{item.category && <CBadge color="light" className="text-dark">{item.category}</CBadge>}</CTableDataCell>
                    <CTableDataCell className="text-center">{item.unit}</CTableDataCell>
                    <CTableDataCell className="text-end">
                      <span className={item.balance <= 0 ? 'text-danger' : item.balance <= item.min_stock ? 'text-warning' : 'text-success'}>{item.balance?.toLocaleString() || 0}</span>
                    </CTableDataCell>
                    <CTableDataCell className="text-end">{item.sale_price > 0 ? `${item.sale_price.toLocaleString()} сом` : '—'}</CTableDataCell>
                    <CTableDataCell><CButton size="sm" color="primary" variant="outline">+ Добавить</CButton></CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}
        </CModalBody>
        <CModalFooter><CButton color="secondary" variant="outline" onClick={() => setWarehouseModal(false)}>Закрыть</CButton></CModalFooter>
      </CModal>

      {/* ── Модал заявки — только не полученные ── */}
      <CModal size="lg" visible={invoiceModal} onClose={() => setInvoiceModal(false)}>
        <CModalHeader><CModalTitle><CIcon icon={cilClipboard} className="me-2" />Создать заявку со склада</CModalTitle></CModalHeader>
        <CModalBody>
          {invoiceError && <CAlert color="danger" className="mb-3">{invoiceError}</CAlert>}
          {invoiceSuccess ? (
            <CAlert color="success">
              ✅ Заявка создана! Она появилась на странице{' '}
              <a href="/warehouse/outgoing-invoices" target="_blank" rel="noopener noreferrer">Расходных накладных</a>{' '}
              со статусом «Черновик».
            </CAlert>
          ) : invoiceItems.length === 0 && !invoiceError ? (
            <CAlert color="warning">Нет позиций для заявки.</CAlert>
          ) : invoiceItems.length > 0 ? (
            <>
              <p className="small text-body-secondary mb-3">
                Показаны только материалы <strong>без подтверждённой накладной</strong>.
                Позиции без привязки к номенклатуре (⚠️) попадут в заявку как информационные.
              </p>
              <CTable small bordered style={{ fontSize:13 }}>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Наименование</CTableHeaderCell>
                    <CTableHeaderCell className="text-center" style={{ width:55 }}>Ед.</CTableHeaderCell>
                    <CTableHeaderCell style={{ width:95 }}>Кол-во</CTableHeaderCell>
                    <CTableHeaderCell style={{ width:110 }}>Цена</CTableHeaderCell>
                    <CTableHeaderCell style={{ width:32 }}></CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {invoiceItems.map((item, idx) => (
                    <CTableRow key={idx} style={{ background: item.no_item ? 'var(--cui-warning-bg-subtle)' : 'transparent' }}>
                      <CTableDataCell>
                        <div className="fw-semibold">{item.item_name}</div>
                        {item.no_item
                          ? <div className="text-warning" style={{ fontSize:11 }}>⚠️ нет в номенклатуре</div>
                          : <div style={{ fontSize:10, color:'var(--cui-info)' }}>● привязан к складу</div>}
                      </CTableDataCell>
                      <CTableDataCell className="text-center">{item.unit}</CTableDataCell>
                      <CTableDataCell>
                        <input type="number" min="0" step="any" value={item.quantity} onChange={e => updateInvoiceItem(idx, 'quantity', e.target.value)}
                          style={{ width:'100%', border:'1px solid var(--cui-border-color)', borderRadius:4, padding:'3px 6px', textAlign:'right', background:'transparent', color:'var(--cui-body-color)' }} />
                      </CTableDataCell>
                      <CTableDataCell>
                        <input type="number" min="0" step="any" value={item.sale_price || ''} placeholder="0" onChange={e => updateInvoiceItem(idx, 'sale_price', e.target.value)}
                          style={{ width:'100%', border:'1px solid var(--cui-border-color)', borderRadius:4, padding:'3px 6px', textAlign:'right', background:'transparent', color:'var(--cui-body-color)' }} />
                      </CTableDataCell>
                      <CTableDataCell className="text-center">
                        <button onClick={() => removeInvoiceItem(idx)} style={{ border:'none', background:'none', cursor:'pointer', color:'var(--cui-danger)', fontSize:16 }}>×</button>
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            </>
          ) : null}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={() => setInvoiceModal(false)}>{invoiceSuccess ? 'Закрыть' : 'Отмена'}</CButton>
          {!invoiceSuccess && invoiceItems.length > 0 && (
            <CButton color="primary" disabled={invoiceSaving} onClick={handleCreateInvoice}>
              {invoiceSaving ? <><CSpinner size="sm" className="me-1" />Создание...</> : <><CIcon icon={cilClipboard} className="me-1" />Создать заявку ({invoiceItems.filter(i => i.quantity > 0).length} поз.)</>}
            </CButton>
          )}
        </CModalFooter>
      </CModal>
    </div>
  )
}