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
  _id:         Math.random().toString(36).slice(2),
  id:          null,
  name:        '',
  quantity:    '',
  unit:        'шт',
  unit_price:  '',
  total_price: '',
  supplier:    '',
  stage_name:  '',
  item_id:     '',
  _dirty:      false,
  _saved:      false,
})

// ── Печать накладной ──────────────────────────────────────

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
th, td { border: 1px solid #000; padding: 1.5mm 2mm; font-size: 9pt; line-height: 1.2; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
th { background-color: #d8d8d8 !important; font-weight: bold; text-align: center; }
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

// ── Ячейка с автодополнением ──────────────────────────────

function AutocompleteCell({ value, suggestions, onChange, onSelect, placeholder }) {
  const [open, setOpen]         = useState(false)
  const [filtered, setFiltered] = useState([])
  const ref = useRef(null)

  useEffect(() => {
    if (!value) { setFiltered([]); return }
    const q = value.toLowerCase()
    setFiltered(suggestions.filter(s => s.toLowerCase().includes(q)).slice(0, 8))
  }, [value, suggestions])

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input className="form-control form-control-sm" value={value} placeholder={placeholder}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => value && setOpen(true)}
        style={{ border:'none', borderRadius:0, boxShadow:'none', background:'transparent', fontSize:13 }} />
      {open && filtered.length > 0 && (
        <div style={{ position:'absolute', top:'100%', left:0, zIndex:1050, background:'var(--cui-body-bg)', border:'1px solid var(--cui-border-color)', borderRadius:4, boxShadow:'0 4px 12px rgba(0,0,0,0.15)', minWidth:240, maxHeight:220, overflowY:'auto' }}>
          {filtered.map((s, i) => (
            <div key={i} onMouseDown={() => { onSelect(s); setOpen(false) }}
              style={{ padding:'6px 12px', cursor:'pointer', fontSize:13, borderBottom:'0.5px solid var(--cui-border-color)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--cui-primary-bg-subtle)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Главный компонент ─────────────────────────────────────

export default function MaterialsTable({ orderId, order, stageName, canEdit = true }) {
  const [rows,        setRows]        = useState(() => Array.from({ length: DEFAULT_ROWS }, emptyRow))
  const [suggestions, setSuggestions] = useState([])
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState(false)
  const [isMobile,    setIsMobile]    = useState(window.innerWidth < 768)

  const [warehouseModal,   setWarehouseModal]   = useState(false)
  const [warehouseItems,   setWarehouseItems]   = useState([])
  const [warehouseSearch,  setWarehouseSearch]  = useState('')
  const [warehouseLoading, setWarehouseLoading] = useState(false)

  const [invoiceModal,   setInvoiceModal]   = useState(false)
  const [invoiceItems,   setInvoiceItems]   = useState([])
  const [invoiceSaving,  setInvoiceSaving]  = useState(false)
  const [invoiceSuccess, setInvoiceSuccess] = useState(false)
  const [invoiceError,   setInvoiceError]   = useState('')

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const loadMaterials = useCallback(async () => {
    try {
      const [matRes, catRes] = await Promise.all([
        api.get(`/orders/${orderId}/materials`),
        api.get('/materials/catalog'),
      ])
      const existing = matRes.data.data || []
      setSuggestions((catRes.data.data || []).map(c => c.name))
      const filled = existing.map(m => ({
        _id:         m.id,
        id:          m.id,
        name:        m.name,
        quantity:    m.quantity    && m.quantity    !== 0 ? m.quantity    : '',
        unit:        m.unit || 'шт',
        unit_price:  m.unit_price  && m.unit_price  !== 0 ? m.unit_price  : '',
        total_price: m.total_price && m.total_price !== 0 ? m.total_price : '',
        supplier:    m.supplier    || '',
        stage_name:  m.stage_name  || stageName || '',
        item_id:     m.item_id     || '',
        _dirty:      false,
        _saved:      true,
      }))
      const empty = Math.max(0, DEFAULT_ROWS - filled.length)
      setRows([...filled, ...Array.from({ length: empty }, emptyRow)])
    } catch {
      setError('Ошибка загрузки материалов')
    }
  }, [orderId, stageName])

  useEffect(() => { loadMaterials() }, [loadMaterials])

  const openWarehouseModal = async () => {
    setWarehouseModal(true)
    setWarehouseSearch('')
    setWarehouseLoading(true)
    try {
      const r = await api.get('/warehouse/items')
      setWarehouseItems(r.data.data || [])
    } catch {} finally {
      setWarehouseLoading(false)
    }
  }

  const addFromWarehouse = (item) => {
    setRows(prev => {
      const emptyIdx = prev.findIndex(r => !r.name.trim())
      const price = item.sale_price > 0 ? item.sale_price : ''
      const qty   = 1
      const newRow = {
        ...emptyRow(),
        name:        item.name,
        unit:        item.unit || 'шт',
        unit_price:  price,
        quantity:    qty,
        total_price: price ? qty * price : '',
        item_id:     item.id,
        _dirty:      true,
      }
      if (emptyIdx !== -1) {
        const next = [...prev]
        next[emptyIdx] = newRow
        return next
      }
      return [...prev, newRow]
    })
    setWarehouseModal(false)
  }

  const filteredWarehouse = warehouseItems.filter(i => {
    const q = warehouseSearch.toLowerCase()
    return !q || i.name?.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q) || i.article?.toLowerCase().includes(q)
  })

  const openInvoiceModal = () => {
    const filledRows = rows.filter(r => r.name.trim() && r.item_id)
    const grouped = {}
    for (const row of filledRows) {
      if (!grouped[row.item_id]) {
        grouped[row.item_id] = {
          item_id:    row.item_id,
          item_name:  row.name,
          unit:       row.unit,
          quantity:   0,
          sale_price: parseFloat(row.unit_price) || 0,
        }
      }
      grouped[row.item_id].quantity += parseFloat(row.quantity) || 0
    }
    setInvoiceItems(Object.values(grouped))
    setInvoiceError('')
    setInvoiceSuccess(false)
    setInvoiceModal(true)
  }

  const updateInvoiceItem = (idx, field, value) => {
    setInvoiceItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, [field]: parseFloat(value) || 0 } : item
    ))
  }

  const handleCreateInvoice = async () => {
    const valid = invoiceItems.filter(i => i.item_id && i.quantity > 0)
    if (valid.length === 0) { setInvoiceError('Нет позиций для заявки'); return }
    setInvoiceSaving(true)
    setInvoiceError('')
    try {
      await api.post('/warehouse/outgoing-invoices', {
        invoice_type: 'order',
        order_id:     orderId,
        notes:        `Заявка из Материалов заказа #${order?.order_number || ''}`,
        items: valid.map(i => ({
          item_id:    i.item_id,
          quantity:   i.quantity,
          sale_price: i.sale_price || 0,
        })),
      })
      setInvoiceSuccess(true)
    } catch (e) {
      setInvoiceError(e.response?.data?.error || 'Ошибка создания заявки')
    } finally {
      setInvoiceSaving(false)
    }
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
      next[idx] = row
      return next
    })
  }

  const selectSuggestion = (idx, name) => {
    setRows(prev => {
      const next = [...prev]
      const row  = { ...next[idx], name, _dirty: true }
      const q = parseFloat(row.quantity)   || 0
      const p = parseFloat(row.unit_price) || 0
      row.total_price = (q > 0 && p > 0) ? q * p : ''
      next[idx] = row
      return next
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
    setSaving(true)
    setError('')
    try {
      for (const row of toSave) {
        const payload = {
          name:       row.name.trim(),
          quantity:   parseFloat(row.quantity)   || 0,
          unit:       row.unit || 'шт',
          unit_price: parseFloat(row.unit_price) || 0,
          supplier:   row.supplier   || '',
          stage_name: row.stage_name || stageName || '',
        }
        if (row.id) { await api.delete(`/orders/${orderId}/materials/${row.id}`) }
        await api.post(`/orders/${orderId}/materials`, payload)
      }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      await loadMaterials()
    } catch {
      setError('Ошибка сохранения материалов')
    } finally {
      setSaving(false)
    }
  }

  const total             = rows.reduce((sum, r) => sum + (parseFloat(r.total_price) || 0), 0)
  const filledCount       = rows.filter(r => r.name.trim()).length
  const hasWarehouseItems = rows.some(r => r.name.trim() && r.item_id)

  const cellStyle  = { border: '1px solid var(--cui-border-color)', padding: 0 }
  const inputStyle = { width:'100%', border:'none', background:'transparent', fontSize:13, padding:'4px 6px', color:'var(--cui-body-color)', outline:'none' }

  return (
    <div>
      {error   && <CAlert color="danger"  dismissible onClose={() => setError('')}>{error}</CAlert>}
      {success && <CAlert color="success" dismissible onClose={() => setSuccess(false)}>Сохранено!</CAlert>}

      {/* Toolbar */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div className="small text-body-secondary">
          {filledCount > 0 && <>
            Позиций: <strong>{filledCount}</strong> &nbsp;|&nbsp;
            Итого: <strong className="text-success">{total.toLocaleString()} сом.</strong>
          </>}
        </div>
        <div className="d-flex gap-2 flex-wrap">
          {canEdit && (
            <CButton size="sm" color="info" variant="outline" onClick={openWarehouseModal}>
              <CIcon icon={cilSearch} className="me-1" />Из склада
            </CButton>
          )}
          {hasWarehouseItems && (
            <CButton size="sm" color="warning" variant="outline" onClick={openInvoiceModal}>
              <CIcon icon={cilClipboard} className="me-1" />Создать заявку
            </CButton>
          )}
          <CButton size="sm" color="secondary" variant="outline"
            onClick={() => printInvoice(order, rows, total)}>
            <CIcon icon={cilPrint} className="me-1" />Печать
          </CButton>
          {canEdit && (
            <CButton size="sm" color="primary" onClick={saveAll} disabled={saving}>
              {saving
                ? <><CSpinner size="sm" className="me-1" />Сохранение...</>
                : <><CIcon icon={cilSave} className="me-1" />Сохранить</>}
            </CButton>
          )}
        </div>
      </div>

      {/* Таблица */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, tableLayout:'fixed' }}>
          <colgroup>
            <col style={{ width: 36 }} />
            <col style={{ width: '30%' }} />
            <col style={{ width: 68 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 100 }} />
            <col />
            {canEdit && <col style={{ width: 32 }} />}
          </colgroup>
          <thead>
            <tr style={{ background: 'var(--cui-secondary-bg)' }}>
              {['№', 'Наименование', 'Ед.', 'Кол-во', 'Цена', 'Сумма', 'Поставщик', canEdit ? '' : null]
                .filter(h => h !== null)
                .map((h, i) => (
                  <th key={i} style={{ border:'1px solid var(--cui-border-color)', padding:'5px 8px', textAlign: i === 0 || i >= 3 ? 'center' : 'left', fontWeight:600, fontSize:12, color:'var(--cui-body-color)' }}>
                    {h}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const hasData = row.name.trim() !== ''
              const isDirty = hasData && row._dirty && !row._saved
              return (
                <tr key={row._id} style={{ background: isDirty ? 'var(--cui-warning-bg-subtle)' : 'transparent' }}>
                  <td style={{ border:'1px solid var(--cui-border-color)', textAlign:'center', padding:'2px', color:'var(--cui-secondary-color)', fontSize:11 }}>
                    {hasData ? (
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:2 }}>
                        {idx + 1}
                        {row.item_id && <span style={{ fontSize:9, color:'var(--cui-info)', lineHeight:1 }}>●</span>}
                      </div>
                    ) : ''}
                  </td>
                  <td style={cellStyle}>
                    {canEdit ? (
                      <AutocompleteCell value={row.name} suggestions={suggestions}
                        placeholder="Введите название..."
                        onChange={v => updateRow(idx, 'name', v)}
                        onSelect={v => selectSuggestion(idx, v)} />
                    ) : (
                      <div style={{ padding:'4px 8px' }}>{row.name}</div>
                    )}
                  </td>
                  <td style={cellStyle}>
                    {canEdit ? (
                      <select value={row.unit} onChange={e => updateRow(idx, 'unit', e.target.value)}
                        style={{ ...inputStyle, cursor:'pointer', textAlign:'center' }}>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    ) : (
                      <div style={{ padding:'4px 8px', textAlign:'center' }}>{row.unit}</div>
                    )}
                  </td>
                  <td style={cellStyle}>
                    {canEdit ? (
                      <input type="number" min="0" step="0.001" value={row.quantity} placeholder=""
                        onChange={e => updateRow(idx, 'quantity', e.target.value)}
                        style={{ ...inputStyle, textAlign:'center' }} />
                    ) : (
                      <div style={{ padding:'4px 8px', textAlign:'center' }}>{row.quantity}</div>
                    )}
                  </td>
                  <td style={cellStyle}>
                    {canEdit ? (
                      <input type="number" min="0" step="1" value={row.unit_price} placeholder=""
                        onChange={e => updateRow(idx, 'unit_price', e.target.value)}
                        style={{ ...inputStyle, textAlign:'right' }} />
                    ) : (
                      <div style={{ padding:'4px 8px', textAlign:'right' }}>
                        {row.unit_price !== '' ? Number(row.unit_price).toLocaleString() : ''}
                      </div>
                    )}
                  </td>
                  <td style={{ border:'1px solid var(--cui-border-color)', padding:'4px 8px', textAlign:'right', fontWeight: hasData && row.total_price ? 600 : 400, color: hasData && row.total_price ? 'var(--cui-success)' : 'var(--cui-secondary-color)', background: hasData && row.total_price ? 'var(--cui-success-bg-subtle)' : 'transparent' }}>
                    {row.total_price !== '' && row.total_price !== 0 ? Number(row.total_price).toLocaleString() : ''}
                  </td>
                  <td style={cellStyle}>
                    {canEdit ? (
                      <input value={row.supplier} placeholder=""
                        onChange={e => updateRow(idx, 'supplier', e.target.value)}
                        style={{ ...inputStyle, fontSize:12 }} />
                    ) : (
                      <div style={{ padding:'4px 8px', fontSize:12 }}>{row.supplier}</div>
                    )}
                  </td>
                  {canEdit && (
                    <td style={{ border:'1px solid var(--cui-border-color)', padding:'2px', textAlign:'center' }}>
                      {hasData && (
                        <button onClick={() => deleteRow(idx)}
                          style={{ border:'none', background:'none', cursor:'pointer', color:'var(--cui-danger)', fontSize:16, padding:'0 4px', lineHeight:1 }}>×</button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
            <tr style={{ background:'var(--cui-secondary-bg)', fontWeight:700 }}>
              <td colSpan={5} style={{ border:'1px solid var(--cui-border-color)', padding:'6px 8px', textAlign:'right' }}>Итого:</td>
              <td style={{ border:'1px solid var(--cui-border-color)', padding:'6px 8px', textAlign:'right', color:'var(--cui-success)', fontSize:14 }}>
                {total > 0 ? `${total.toLocaleString()} сом.` : ''}
              </td>
              <td colSpan={canEdit ? 2 : 1} style={{ border:'1px solid var(--cui-border-color)' }} />
            </tr>
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="d-flex gap-2 mt-2">
          <CButton size="sm" color="secondary" variant="outline" onClick={() => addRows(10)}>
            <CIcon icon={cilPlus} className="me-1" />+ 10 строк
          </CButton>
          <CButton size="sm" color="secondary" variant="outline" onClick={() => addRows(5)}>
            + 5 строк
          </CButton>
        </div>
      )}

      {/* ── Модал выбора из склада ── */}
      <CModal size="lg" visible={warehouseModal} onClose={() => setWarehouseModal(false)}>
        <CModalHeader>
          <CModalTitle><CIcon icon={cilSearch} className="me-2" />Выбрать из склада</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CInputGroup className="mb-3">
            <CInputGroupText><CIcon icon={cilSearch} /></CInputGroupText>
            <CFormInput placeholder="Поиск по названию, артикулу, категории..."
              value={warehouseSearch} onChange={e => setWarehouseSearch(e.target.value)} autoFocus />
          </CInputGroup>
          {warehouseLoading ? (
            <div className="text-center py-4"><CSpinner /></div>
          ) : (
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
                  <CTableRow>
                    <CTableDataCell colSpan={6} className="text-center text-body-secondary py-3">
                      Ничего не найдено
                    </CTableDataCell>
                  </CTableRow>
                )}
                {filteredWarehouse.map(item => (
                  <CTableRow key={item.id} style={{ cursor:'pointer' }}
                    onClick={() => addFromWarehouse(item)}>
                    <CTableDataCell>
                      <div className="fw-semibold">{item.name}</div>
                      {item.article && <div className="text-body-secondary" style={{ fontSize:11 }}>{item.article}</div>}
                    </CTableDataCell>
                    <CTableDataCell>
                      {item.category && <CBadge color="light" className="text-dark">{item.category}</CBadge>}
                    </CTableDataCell>
                    <CTableDataCell className="text-center">{item.unit}</CTableDataCell>
                    <CTableDataCell className="text-end">
                      <span className={item.balance <= 0 ? 'text-danger' : item.balance <= item.min_stock ? 'text-warning' : 'text-success'}>
                        {item.balance?.toLocaleString() || 0}
                      </span>
                    </CTableDataCell>
                    <CTableDataCell className="text-end">
                      {item.sale_price > 0 ? `${item.sale_price.toLocaleString()} сом` : '—'}
                    </CTableDataCell>
                    <CTableDataCell>
                      <CButton size="sm" color="primary" variant="outline">+ Добавить</CButton>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={() => setWarehouseModal(false)}>Закрыть</CButton>
        </CModalFooter>
      </CModal>

      {/* ── Модал заявки ── */}
      <CModal size="lg" visible={invoiceModal} onClose={() => setInvoiceModal(false)}>
        <CModalHeader>
          <CModalTitle><CIcon icon={cilClipboard} className="me-2" />Создать заявку со склада</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {invoiceError   && <CAlert color="danger"  className="mb-3">{invoiceError}</CAlert>}
          {invoiceSuccess ? (
            <CAlert color="success">
              ✅ Заявка создана! Она появилась на странице{' '}
              <a href="/warehouse/outgoing-invoices" target="_blank" rel="noopener noreferrer">
                Расходных накладных
              </a>{' '}
              со статусом «Черновик».
            </CAlert>
          ) : invoiceItems.length === 0 ? (
            <CAlert color="warning">
              Нет позиций привязанных к складу. Добавьте материалы через кнопку «Из склада».
            </CAlert>
          ) : (
            <>
              <p className="small text-body-secondary mb-3">
                Позиции привязанные к номенклатуре склада. Проверьте количество и укажите цену продажи.
              </p>
              <CTable small bordered style={{ fontSize: 13 }}>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Материал</CTableHeaderCell>
                    <CTableHeaderCell className="text-center" style={{ width: 70 }}>Ед.</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 100 }}>Кол-во</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 120 }}>Цена прод.</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {invoiceItems.map((item, idx) => (
                    <CTableRow key={item.item_id}>
                      <CTableDataCell className="fw-semibold">{item.item_name}</CTableDataCell>
                      <CTableDataCell className="text-center">{item.unit}</CTableDataCell>
                      <CTableDataCell>
                        <input type="number" min="0.001" step="any" value={item.quantity}
                          onChange={e => updateInvoiceItem(idx, 'quantity', e.target.value)}
                          style={{ width:'100%', border:'1px solid var(--cui-border-color)', borderRadius:4, padding:'3px 6px', textAlign:'right', background:'transparent', color:'var(--cui-body-color)' }} />
                      </CTableDataCell>
                      <CTableDataCell>
                        <input type="number" min="0" step="any" value={item.sale_price || ''}
                          placeholder="0"
                          onChange={e => updateInvoiceItem(idx, 'sale_price', e.target.value)}
                          style={{ width:'100%', border:'1px solid var(--cui-border-color)', borderRadius:4, padding:'3px 6px', textAlign:'right', background:'transparent', color:'var(--cui-body-color)' }} />
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            </>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={() => setInvoiceModal(false)}>
            {invoiceSuccess ? 'Закрыть' : 'Отмена'}
          </CButton>
          {!invoiceSuccess && invoiceItems.length > 0 && (
            <CButton color="primary" disabled={invoiceSaving} onClick={handleCreateInvoice}>
              {invoiceSaving
                ? <><CSpinner size="sm" className="me-1" />Создание...</>
                : <><CIcon icon={cilClipboard} className="me-1" />Создать заявку</>}
            </CButton>
          )}
        </CModalFooter>
      </CModal>
    </div>
  )
}