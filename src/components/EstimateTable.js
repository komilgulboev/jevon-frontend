import { useState, useEffect, useRef, useCallback } from 'react'
import {
  CButton, CSpinner, CAlert, CBadge,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CFormInput, CInputGroup, CInputGroupText,
  CTable, CTableHead, CTableBody, CTableRow,
  CTableHeaderCell, CTableDataCell,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilSave, cilPrint, cilSearch, cilClipboard } from '@coreui/icons'
import api from '../api/client'

const SERVICE_UNITS  = ['шт', 'м', 'м²', 'лист', 'пара']
const MATERIAL_UNITS = ['шт', 'м', 'м²', 'кг', 'л', 'упак']
const DEFAULT_ROWS   = 20

const GROUP_LABELS = {
  design:   'Чертёж',
  sawing:   'Распил',
  edging:   'Кромкование',
  drilling: 'Присадка',
  milling:  'Фрезеровка',
  gluing:   'Склейка',
  packing:  'Упаковка',
  other:    'Другое',
}
const GROUP_COLORS = {
  design:   '#e8f4fd', sawing:  '#fff3e0',
  edging:   '#f3e5f5', drilling:'#e8f5e9',
  milling:  '#fce4ec', gluing:  '#e0f7fa',
  packing:  '#f9fbe7', other:   '#fafafa',
}

const emptyServiceRow = () => ({
  _id:        Math.random().toString(36).slice(2),
  id:         null,
  catalog_id: null,
  name:       '',
  color:      '',
  article:    '',
  quantity:   '',
  unit:       'шт',
  unit_spec:  '',
  unit_price: '',
  total_price:'',
  _dirty:     false,
  _saved:     false,
  _group:     '',
})

const emptyMaterialRow = () => ({
  _id:        Math.random().toString(36).slice(2),
  id:         null,
  name:       '',
  quantity:   '',
  unit:       'шт',
  unit_price: '',
  total_price:'',
  item_id:    '',
  _dirty:     false,
  _saved:     false,
})

// ── Печать сметы ─────────────────────────────────────────

function printEstimate(order, services, materials, totalSvc, totalMat) {
  const svcRows = services.filter(r => r.name.trim()).map((r, i) => `
    <tr>
      <td class="num">${i+1}</td>
      <td class="name">${r.name}</td>
      <td class="center">${r.color || ''}${r.article ? ' / '+r.article : ''}</td>
      <td class="center">${r.quantity !== '' ? r.quantity : ''}</td>
      <td class="center">${r.unit}${r.unit_spec ? ' '+r.unit_spec : ''}</td>
      <td class="right">${r.unit_price !== '' ? Number(r.unit_price).toLocaleString() : ''}</td>
      <td class="right bold">${r.total_price !== '' ? Number(r.total_price).toLocaleString() : ''}</td>
    </tr>`).join('')

  const matRows = materials.filter(r => r.name.trim()).map((r, i) => `
    <tr>
      <td class="num">${i+1}</td>
      <td class="name">${r.name}</td>
      <td class="center">${r.quantity !== '' ? r.quantity : ''} ${r.unit}</td>
      <td class="right">${r.unit_price !== '' ? Number(r.unit_price).toLocaleString() : ''}</td>
      <td class="right bold">${r.total_price !== '' ? Number(r.total_price).toLocaleString() : ''}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Смета №${order?.order_number||''}</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:Arial,sans-serif; font-size:10pt; color:#000; background:#fff; }
.page { width:210mm; margin:0 auto; padding:8mm; }
.header { text-align:center; border:2px solid #000; padding:4mm; margin-bottom:4mm; }
.header h1 { font-size:14pt; font-weight:bold; }
.header p  { font-size:9pt; }
.info-grid { display:grid; grid-template-columns:1fr 1fr; gap:2mm; margin-bottom:4mm; font-size:9pt; }
.info-grid .cell { border:1px solid #000; padding:1.5mm 3mm; }
.info-grid .label { font-weight:bold; }
h2 { font-size:10pt; font-weight:bold; text-align:center; border:1px solid #000;
     border-bottom:none; padding:2mm; background:#f0f0f0;
     -webkit-print-color-adjust:exact; print-color-adjust:exact; }
table { width:100%; border-collapse:collapse; margin-bottom:4mm; }
th,td { border:1px solid #000 !important; padding:1.5mm 2mm; font-size:9pt; }
th { background:#e0e0e0 !important; text-align:center; font-weight:bold;
     -webkit-print-color-adjust:exact; print-color-adjust:exact; }
td.num    { text-align:center; width:8mm; }
td.name   { text-align:left; }
td.center { text-align:center; }
td.right  { text-align:right; }
td.bold   { font-weight:bold; }
tr:nth-child(even) { background:#fafafa !important;
  -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.total-row td { font-weight:bold; background:#e8e8e8 !important;
  border-top:2px solid #000 !important;
  -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.grand-total { border:2px solid #000; padding:3mm; margin-top:4mm; font-size:10pt; }
.grand-total table { border:none; margin:0; }
.grand-total td { border:none !important; padding:1mm 3mm; }
.sign { margin-top:8mm; display:flex; justify-content:space-between; font-size:9pt; }
.print-btn { display:block; width:210mm; margin:10px auto;
  padding:10px; background:#1a73e8; color:white;
  border:none; border-radius:6px; font-size:14px; cursor:pointer; }
@media screen {
  body { background:#888; padding:10px 0 30px; }
  .page { background:#fff; box-shadow:0 3px 20px rgba(0,0,0,0.4); min-height:297mm; }
}
@media print {
  @page { size:A4 portrait; margin:0; }
  body { background:#fff; padding:0; }
  .page { padding:8mm; box-shadow:none; min-height:auto; }
  .print-btn { display:none; }
}
</style></head><body>
<button class="print-btn" onclick="window.print()">🖨️ Распечатать смету</button>
<div class="page">
  <div class="header"><h1>JEVON</h1><p>От чертежа до готовой детали</p></div>
  <div class="info-grid">
    <div class="cell"><span class="label">Номер заказа:</span> ${order?.order_number||'—'}</div>
    <div class="cell"><span class="label">Дата:</span> ${new Date().toLocaleDateString('ru-RU')}</div>
    <div class="cell"><span class="label">Клиент/телефон:</span> ${order?.client_name||'—'} ${order?.client_phone||''}</div>
    <div class="cell"><span class="label">Наименование заказа:</span> ${order?.title||''}</div>
  </div>
  <h2>Список предоставляемых услуг</h2>
  <table><thead><tr>
    <th>№</th><th>Наименование услуг</th><th>Цвет, код, артикул</th>
    <th>Кол-во</th><th>Ед.</th><th>Цена за ед. (сом.)</th><th>Общая сумма (сом.)</th>
  </tr></thead><tbody>
    ${svcRows}
    <tr class="total-row"><td colspan="6" style="text-align:right">Итого услуги:</td><td class="right">${Math.round(totalSvc).toLocaleString()}</td></tr>
  </tbody></table>
  ${matRows ? `
  <h2>Список расходующих материалов</h2>
  <table><thead><tr>
    <th>№</th><th>Наименование материалов</th><th>Кол-во</th><th>Цена за ед. (сом.)</th><th>Общая сумма (сом.)</th>
  </tr></thead><tbody>
    ${matRows}
    <tr class="total-row"><td colspan="4" style="text-align:right">Итого материалы:</td><td class="right">${Math.round(totalMat).toLocaleString()}</td></tr>
  </tbody></table>` : ''}
  <div class="grand-total"><table>
    <tr><td><b>Итого к оплате:</b></td><td></td></tr>
    <tr><td>Услуги:</td><td><b>${Math.round(totalSvc).toLocaleString()} сом.</b></td></tr>
    ${matRows ? `<tr><td>Материалы:</td><td><b>${Math.round(totalMat).toLocaleString()} сом.</b></td></tr>` : ''}
    <tr><td style="font-size:11pt"><b>Общий итог:</b></td><td style="font-size:11pt"><b>${Math.round(totalSvc+totalMat).toLocaleString()} сом.</b></td></tr>
  </table></div>
  <div class="sign">
    <span>Исполнитель: _______________________</span>
    <span>Клиент: _______________________</span>
  </div>
</div></body></html>`

  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
  w.focus()
}

// ── Выпадающий список услуг из каталога ──────────────────

function ServiceSelect({ value, catalog, onSelect, canEditPrice }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const grouped = catalog.reduce((acc, item) => {
    if (!acc[item.group_name]) acc[item.group_name] = []
    acc[item.group_name].push(item)
    return acc
  }, {})

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ padding:'4px 8px', cursor:'pointer', fontSize:13, minHeight:28, display:'flex', alignItems:'center', justifyContent:'space-between', gap:4 }}>
        <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {value?.name || <span style={{ color:'var(--cui-secondary-color)' }}>Выберите услугу...</span>}
        </span>
        <span style={{ fontSize:10, color:'var(--cui-secondary-color)', flexShrink:0 }}>▼</span>
      </div>
      {open && (
        <div style={{ position:'absolute', top:'100%', left:0, zIndex:1060, background:'var(--cui-body-bg)', border:'1px solid var(--cui-border-color)', borderRadius:4, boxShadow:'0 6px 20px rgba(0,0,0,0.15)', minWidth:360, maxHeight:320, overflowY:'auto' }}>
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <div style={{ padding:'4px 10px', fontSize:10, fontWeight:700, background:'var(--cui-secondary-bg)', color:'var(--cui-secondary-color)', textTransform:'uppercase', letterSpacing:0.5, position:'sticky', top:0 }}>
                {GROUP_LABELS[group] || group}
              </div>
              {items.map(item => (
                <div key={item.id}
                  onMouseDown={() => { onSelect(item); setOpen(false) }}
                  style={{ padding:'6px 12px', cursor:'pointer', fontSize:13, borderBottom:'0.5px solid var(--cui-border-color)', display:'flex', justifyContent:'space-between', alignItems:'center', background: value?.catalog_id === item.id ? 'var(--cui-primary-bg-subtle)' : 'transparent' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--cui-primary-bg-subtle)'}
                  onMouseLeave={e => e.currentTarget.style.background = value?.catalog_id === item.id ? 'var(--cui-primary-bg-subtle)' : 'transparent'}>
                  <span>
                    {item.name}
                    {item.unit_spec && <span style={{ fontSize:11, color:'var(--cui-secondary-color)', marginLeft:4 }}>({item.unit_spec})</span>}
                  </span>
                  <span style={{ fontSize:12, fontWeight:600, color:'var(--cui-success)', flexShrink:0, marginLeft:8 }}>
                    {item.price > 0 ? `${item.price} сом.` : 'бесплатно'} / {item.unit}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ColorSelect({ value, colors, onChange }) {
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value)}
      style={{ width:'100%', border:'none', background:'transparent', fontSize:12, padding:'4px 2px', color:'var(--cui-body-color)', cursor:'pointer' }}>
      <option value="">—</option>
      {colors.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
    </select>
  )
}

// ── Главный компонент ─────────────────────────────────────

export default function EstimateTable({ orderId, order, canEdit = true, canEditPrice = false }) {
  const [svcRows,  setSvcRows]  = useState(() => Array.from({ length: DEFAULT_ROWS }, emptyServiceRow))
  const [matRows,  setMatRows]  = useState(() => Array.from({ length: 5 }, emptyMaterialRow))
  const [catalog,  setCatalog]  = useState([])
  const [colors,   setColors]   = useState([])
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  // Склад
  const [warehouseModal,   setWarehouseModal]   = useState(false)
  const [warehouseItems,   setWarehouseItems]   = useState([])
  const [warehouseSearch,  setWarehouseSearch]  = useState('')
  const [warehouseLoading, setWarehouseLoading] = useState(false)

  // Заявка
  const [invoiceModal,   setInvoiceModal]   = useState(false)
  const [invoiceItems,   setInvoiceItems]   = useState([])
  const [invoiceSaving,  setInvoiceSaving]  = useState(false)
  const [invoiceSuccess, setInvoiceSuccess] = useState(false)
  const [invoiceError,   setInvoiceError]   = useState('')

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  const loadEstimate = useCallback(async () => {
    try {
      const [estRes, catRes, colRes] = await Promise.all([
        api.get(`/orders/${orderId}/estimate`),
        api.get('/estimate/catalog/flat'),
        api.get('/estimate/colors'),
      ])
      const catData = catRes.data.data || []
      setCatalog(catData)
      setColors(colRes.data.data || [])

      const catById = {}
      catData.forEach(c => { catById[c.id] = c })

      const svc = estRes.data.services  || []
      const mat = estRes.data.materials || []

      const filledSvc = svc.map(s => {
        const catItem = catById[s.catalog_id] || {}
        return {
          _id: s.id, id: s.id, catalog_id: s.catalog_id,
          name: s.name, color: s.color || '', article: s.article || '',
          quantity:    s.quantity    && s.quantity    !== 0 ? s.quantity    : '',
          unit:        s.unit        || 'шт',
          unit_spec:   s.unit_spec   || '',
          unit_price:  s.unit_price  && s.unit_price  !== 0 ? s.unit_price  : '',
          total_price: s.total_price && s.total_price !== 0 ? s.total_price : '',
          _dirty: false, _saved: true,
          _group: catItem.group_name || '',
        }
      })
      const emptySvc = Math.max(0, DEFAULT_ROWS - filledSvc.length)
      setSvcRows([...filledSvc, ...Array.from({ length: emptySvc }, emptyServiceRow)])

      const filledMat = mat.map(m => ({
        _id: m.id, id: m.id,
        name:        m.name,
        quantity:    m.quantity    && m.quantity    !== 0 ? m.quantity    : '',
        unit:        m.unit        || 'шт',
        unit_price:  m.unit_price  && m.unit_price  !== 0 ? m.unit_price  : '',
        total_price: m.total_price && m.total_price !== 0 ? m.total_price : '',
        item_id:     m.item_id     || '',
        _dirty: false, _saved: true,
      }))
      const emptyMat = Math.max(0, 5 - filledMat.length)
      setMatRows([...filledMat, ...Array.from({ length: emptyMat }, emptyMaterialRow)])
    } catch {
      setError('Ошибка загрузки сметы')
    }
  }, [orderId])

  useEffect(() => { loadEstimate() }, [loadEstimate])

  // ── Склад ─────────────────────────────────────────────

  const openWarehouseModal = async () => {
    setWarehouseModal(true)
    setWarehouseSearch('')
    setWarehouseLoading(true)
    try {
      const r = await api.get('/warehouse/items')
      setWarehouseItems(r.data.data || [])
    } catch {} finally { setWarehouseLoading(false) }
  }

  const addFromWarehouse = (item) => {
    setMatRows(prev => {
      const emptyIdx = prev.findIndex(r => !r.name.trim())
      const price = item.sale_price > 0 ? item.sale_price : ''
      const qty   = 1
      const newRow = {
        ...emptyMaterialRow(),
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

  // ── Заявка ────────────────────────────────────────────

  const openInvoiceModal = () => {
    const grouped = {}
    for (const row of matRows.filter(r => r.name.trim() && r.item_id)) {
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
        notes:        `Заявка из Сметы заказа #${order?.order_number || ''}`,
        items: valid.map(i => ({
          item_id:    i.item_id,
          quantity:   i.quantity,
          sale_price: i.sale_price || 0,
        })),
      })
      setInvoiceSuccess(true)
    } catch (e) {
      setInvoiceError(e.response?.data?.error || 'Ошибка создания заявки')
    } finally { setInvoiceSaving(false) }
  }

  const hasWarehouseMatItems = matRows.some(r => r.name.trim() && r.item_id)

  // ── Логика расчёта ────────────────────────────────────

  const SHEET_AREA = {
    'Распил ДСП 5,03м²': 5.03,
    'Распил МДФ 3,41м²': 3.41,
    'Распил ДСП 5,79м²': 5.79,
    'Распил МДФ 5,79м²': 5.79,
  }

  const getMultiplier = (unit_spec, group) => {
    if (!unit_spec || group !== 'drilling') return 1
    const match = unit_spec.match(/^1[×x\*]\s*(\d+)$/)
    return match ? parseInt(match[1]) : 1
  }

  const calcTotal = (quantity, unit_price, unit_spec, group) => {
    const q = parseFloat(quantity)   || 0
    const p = parseFloat(unit_price) || 0
    const m = getMultiplier(unit_spec, group)
    return (q > 0 && p > 0) ? q * m * p : ''
  }

  const recalcDesign = (rows) => {
    const designIdx = rows.findIndex(r => r._group === 'design')
    if (designIdx === -1) return rows
    const designRow = rows[designIdx]
    const hasDrilling = rows.some(r => r.name && r._group === 'drilling')
    if (hasDrilling) {
      const next = [...rows]
      next[designIdx] = { ...designRow, quantity: '', unit_price: 0, total_price: 0, _dirty: true }
      return next
    }
    let totalM2 = 0
    rows.forEach(r => {
      if (r._group === 'sawing' && r.name && SHEET_AREA[r.name]) {
        totalM2 += (parseFloat(r.quantity) || 0) * SHEET_AREA[r.name]
      }
    })
    if (totalM2 > 0) {
      const next = [...rows]
      // Используем текущую цену если задана, иначе дефолт 15
      const price = parseFloat(designRow.unit_price) || 15
      next[designIdx] = {
        ...designRow,
        quantity:    parseFloat(totalM2.toFixed(2)),
        unit:        'м²',
        unit_price:  price,
        total_price: parseFloat((totalM2 * price).toFixed(2)),
        _dirty:      true,
      }
      return next
    }
    return rows
  }

  const updateSvc = (idx, field, value) => {
    setSvcRows(prev => {
      const next = [...prev]
      const row  = { ...next[idx], [field]: value, _dirty: true }
      if (field === 'quantity' || field === 'unit_price') {
        row.total_price = calcTotal(
          field === 'quantity'   ? value : row.quantity,
          field === 'unit_price' ? value : row.unit_price,
          row.unit_spec, row._group
        )
      }
      next[idx] = row
      // Для design-строки не запускаем recalcDesign при изменении unit_price
      // чтобы не перезаписать только что введённую цену
      if (row._group === 'design' && field === 'unit_price') return next
      return recalcDesign(next)
    })
  }

  const selectCatalogItem = (idx, item) => {
    setSvcRows(prev => {
      const next = [...prev]
      const isDesign = item.group_name === 'design'
      const price = isDesign ? (item.price || 15) : (item.price || '')
      const row = {
        ...next[idx],
        catalog_id: item.id, name: item.name, unit: item.unit,
        unit_spec: item.unit_spec || '', unit_price: price,
        _dirty: true, _group: item.group_name,
      }
      if (!isDesign) row.total_price = calcTotal(row.quantity, price, item.unit_spec, item.group_name)
      next[idx] = row
      return recalcDesign(next)
    })
  }

  const updateMat = (idx, field, value) => {
    setMatRows(prev => {
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

  const deleteSvcRow = (idx) => {
    setSvcRows(prev => { const next = [...prev]; next.splice(idx, 1, emptyServiceRow()); return next })
  }

  const deleteMatRow = (idx) => {
    setMatRows(prev => { const next = [...prev]; next.splice(idx, 1, emptyMaterialRow()); return next })
  }

  // ── Сохранение ───────────────────────────────────────

  const saveAll = async () => {
    setSaving(true)
    setError('')
    try {
      const services = svcRows.filter(r => r.name.trim()).map((r, i) => ({
        catalog_id: r.catalog_id, name: r.name.trim(),
        color: r.color || '', article: r.article || '',
        quantity: parseFloat(r.quantity) || 0, unit: r.unit || 'шт',
        unit_spec: r.unit_spec || '', unit_price: parseFloat(r.unit_price) || 0, sort_order: i,
      }))
      const materials = matRows.filter(r => r.name.trim()).map((r, i) => ({
        name: r.name.trim(), quantity: parseFloat(r.quantity) || 0,
        unit: r.unit || 'шт', unit_price: parseFloat(r.unit_price) || 0, sort_order: i,
      }))
      await api.post(`/orders/${orderId}/estimate`, { services, materials })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      await loadEstimate()
    } catch {
      setError('Ошибка сохранения сметы')
    } finally {
      setSaving(false)
    }
  }

  const totalSvc = svcRows.reduce((s, r) => s + (parseFloat(r.total_price) || 0), 0)
  const totalMat = matRows.reduce((s, r) => s + (parseFloat(r.total_price) || 0), 0)
  const total    = totalSvc + totalMat

  const cellStyle  = { border: '1px solid var(--cui-border-color)', padding: 0 }
  const inputStyle = { width:'100%', border:'none', background:'transparent', fontSize:13, padding:'4px 6px', color:'var(--cui-body-color)', outline:'none' }
  const thStyle    = { border:'1px solid var(--cui-border-color)', padding:'5px 6px', fontWeight:600, fontSize:11, color:'var(--cui-body-color)', background:'var(--cui-secondary-bg)', textAlign:'center' }

  return (
    <div>
      {error   && <CAlert color="danger"  dismissible onClose={() => setError('')}>{error}</CAlert>}
      {success && <CAlert color="success" dismissible onClose={() => setSuccess(false)}>Смета сохранена!</CAlert>}

      {/* Toolbar */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="small text-body-secondary">
          {total > 0 && <>
            Услуги: <strong>{Math.round(totalSvc).toLocaleString()}</strong> сом. &nbsp;|&nbsp;
            Материалы: <strong>{Math.round(totalMat).toLocaleString()}</strong> сом. &nbsp;|&nbsp;
            <strong className="text-success">Итого: {Math.round(total).toLocaleString()} сом.</strong>
          </>}
        </div>
        <div className="d-flex gap-2">
          <CButton size="sm" color="secondary" variant="outline"
            onClick={() => printEstimate(order, svcRows, matRows, totalSvc, totalMat)}>
            <CIcon icon={cilPrint} className="me-1" />Печать
          </CButton>
          {canEdit && (
            <CButton size="sm" color="primary" onClick={saveAll} disabled={saving}>
              {saving
                ? <><CSpinner size="sm" className="me-1" />Сохранение...</>
                : <><CIcon icon={cilSave} className="me-1" />Сохранить смету</>}
            </CButton>
          )}
        </div>
      </div>

      {/* ── Таблица услуг ── */}
      <div className="small fw-semibold mb-1 text-body-secondary">Список услуг</div>
      <div style={{ overflowX:'auto', marginBottom:16 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, tableLayout:'fixed' }}>
          <colgroup>
            <col style={{ width:30 }} />
            <col style={{ width:'28%' }} />
            <col style={{ width:'12%' }} />
            <col style={{ width:50 }} />
            <col style={{ width:60 }} />
            <col style={{ width:'10%' }} />
            <col style={{ width:90 }} />
            <col style={{ width:90 }} />
            {canEdit && <col style={{ width:28 }} />}
          </colgroup>
          <thead>
            <tr>
              {['№','Наименование услуги','Цвет','Арт.','Кол-во','Ед.','Цена','Сумма', canEdit?'':null]
                .filter(h => h !== null)
                .map((h,i) => <th key={i} style={thStyle}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {svcRows.map((row, idx) => {
              const hasData = row.name.trim() !== ''
              const isDirty = hasData && row._dirty && !row._saved
              const groupBg = hasData && row._group ? GROUP_COLORS[row._group] : 'transparent'
              return (
                <tr key={row._id} style={{ background: isDirty ? 'var(--cui-warning-bg-subtle)' : groupBg }}>
                  <td style={{ border:'1px solid var(--cui-border-color)', textAlign:'center', fontSize:11, color:'var(--cui-secondary-color)', padding:'2px' }}>
                    {hasData ? idx+1 : ''}
                  </td>
                  <td style={cellStyle}>
                    {canEdit ? (
                      <ServiceSelect value={row} catalog={catalog} onSelect={item => selectCatalogItem(idx, item)} canEditPrice={canEditPrice} />
                    ) : <div style={{ padding:'4px 8px', fontSize:13 }}>{row.name}</div>}
                  </td>
                  <td style={cellStyle}>
                    {canEdit ? (
                      <ColorSelect value={row.color} colors={colors} onChange={v => updateSvc(idx, 'color', v)} />
                    ) : <div style={{ padding:'4px 4px', fontSize:12 }}>{row.color}</div>}
                  </td>
                  <td style={cellStyle}>
                    {canEdit ? (
                      <input value={row.article} placeholder="" onChange={e => updateSvc(idx, 'article', e.target.value)} style={{ ...inputStyle, fontSize:11 }} />
                    ) : <div style={{ padding:'4px 4px', fontSize:11 }}>{row.article}</div>}
                  </td>
                  <td style={cellStyle}>
                    {canEdit ? (
                      <div style={{ position:'relative' }}>
                        <input type="number" min="0" step="any" value={row.quantity} placeholder=""
                          onChange={e => updateSvc(idx, 'quantity', e.target.value)}
                          style={{ ...inputStyle, textAlign:'center', paddingBottom: row._group === 'drilling' && getMultiplier(row.unit_spec, row._group) > 1 ? '14px' : '4px' }} />
                        {row._group === 'drilling' && getMultiplier(row.unit_spec, row._group) > 1 && row.quantity > 0 && (
                          <div style={{ position:'absolute', bottom:1, left:0, right:0, textAlign:'center', fontSize:9, color:'var(--cui-info)', lineHeight:1 }}>
                            ×{getMultiplier(row.unit_spec, row._group)}={parseFloat(row.quantity)*getMultiplier(row.unit_spec, row._group)}
                          </div>
                        )}
                      </div>
                    ) : <div style={{ padding:'4px', textAlign:'center' }}>{row.quantity}</div>}
                  </td>
                  <td style={cellStyle}>
                    {canEdit && row._group !== 'design' ? (
                      <select value={row.unit} onChange={e => updateSvc(idx, 'unit', e.target.value)}
                        style={{ ...inputStyle, cursor:'pointer', textAlign:'center', padding:'4px 2px' }}>
                        {SERVICE_UNITS.map(u => <option key={u} value={u}>{u}{row.unit_spec?' '+row.unit_spec:''}</option>)}
                      </select>
                    ) : <div style={{ padding:'4px', textAlign:'center', fontWeight: row._group === 'design' ? 600 : 400 }}>
                      {row._group === 'design' ? 'м²' : (row.unit + (row.unit_spec?' '+row.unit_spec:''))}
                    </div>}
                  </td>
                  {/* ── Цена: для design — редактируемый input, для остальных — div ── */}
                  <td style={{ ...cellStyle, background: row.item_id ? 'var(--cui-secondary-bg)' : 'transparent' }}>
                    {canEdit && row._group === 'design' ? (
                      <input
                        type="number" min="0" step="any"
                        value={row.unit_price}
                        placeholder=""
                        onChange={e => updateSvc(idx, 'unit_price', e.target.value)}
                        style={{ ...inputStyle, textAlign:'right' }}
                      />
                    ) : (
                      <div style={{ padding:'4px 8px', textAlign:'right', fontSize:13, color: row.unit_price !== '' ? 'var(--cui-body-color)' : 'var(--cui-secondary-color)' }}>
                        {row.unit_price !== '' ? Number(row.unit_price).toLocaleString() : ''}
                      </div>
                    )}
                  </td>
                  <td style={{ border:'1px solid var(--cui-border-color)', padding:'4px 8px', textAlign:'right', fontWeight: hasData && row.total_price ? 600 : 400, color: hasData && row.total_price ? 'var(--cui-success)' : 'var(--cui-secondary-color)', background: hasData && row.total_price ? 'var(--cui-success-bg-subtle)' : 'transparent' }}>
                    {row.total_price !== '' && row.total_price !== 0 ? Math.round(Number(row.total_price)).toLocaleString() : ''}
                  </td>
                  {canEdit && (
                    <td style={{ border:'1px solid var(--cui-border-color)', padding:'2px', textAlign:'center' }}>
                      {hasData && (
                        <button onClick={() => deleteSvcRow(idx)}
                          style={{ border:'none', background:'none', cursor:'pointer', color:'var(--cui-danger)', fontSize:16, padding:'0 2px', lineHeight:1 }}>×</button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
            <tr style={{ background:'var(--cui-secondary-bg)', fontWeight:700 }}>
              <td colSpan={7} style={{ border:'1px solid var(--cui-border-color)', padding:'5px 8px', textAlign:'right' }}>Итого услуги:</td>
              <td style={{ border:'1px solid var(--cui-border-color)', padding:'5px 8px', textAlign:'right', color:'var(--cui-success)' }}>
                {totalSvc > 0 ? `${Math.round(totalSvc).toLocaleString()} сом.` : ''}
              </td>
              {canEdit && <td style={{ border:'1px solid var(--cui-border-color)' }} />}
            </tr>
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="d-flex gap-2 mb-4">
          <CButton size="sm" color="secondary" variant="outline"
            onClick={() => setSvcRows(prev => [...prev, ...Array.from({length:10}, emptyServiceRow)])}>
            <CIcon icon={cilPlus} className="me-1" />+ 10 строк
          </CButton>
          <CButton size="sm" color="secondary" variant="outline"
            onClick={() => setSvcRows(prev => [...prev, ...Array.from({length:5}, emptyServiceRow)])}>
            + 5 строк
          </CButton>
        </div>
      )}

      {/* ── Таблица материалов ── */}
      <div className="d-flex justify-content-between align-items-center mb-1">
        <div className="small fw-semibold text-body-secondary">Список расходных материалов</div>
        <div className="d-flex gap-2">
          {canEdit && (
            <CButton size="sm" color="info" variant="outline" onClick={openWarehouseModal}>
              <CIcon icon={cilSearch} className="me-1" />Из склада
            </CButton>
          )}
          {hasWarehouseMatItems && (
            <CButton size="sm" color="warning" variant="outline" onClick={openInvoiceModal}>
              <CIcon icon={cilClipboard} className="me-1" />Создать заявку
            </CButton>
          )}
        </div>
      </div>

      <div style={{ overflowX:'auto', marginBottom:16 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, tableLayout:'fixed' }}>
          <colgroup>
            <col style={{ width:30 }} />
            <col />
            <col style={{ width:70 }} />
            <col style={{ width:60 }} />
            <col style={{ width:90 }} />
            <col style={{ width:90 }} />
            {canEdit && <col style={{ width:28 }} />}
          </colgroup>
          <thead>
            <tr>
              {['№','Наименование материала','Кол-во','Ед.','Цена','Сумма', canEdit?'':null]
                .filter(h => h !== null)
                .map((h,i) => <th key={i} style={thStyle}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {matRows.map((row, idx) => {
              const hasData = row.name.trim() !== ''
              const isDirty = hasData && row._dirty && !row._saved
              return (
                <tr key={row._id} style={{ background: isDirty ? 'var(--cui-warning-bg-subtle)' : 'transparent' }}>
                  <td style={{ border:'1px solid var(--cui-border-color)', textAlign:'center', fontSize:11, color:'var(--cui-secondary-color)', padding:'2px' }}>
                    {hasData ? (
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:2 }}>
                        {idx+1}
                        {row.item_id && <span style={{ fontSize:9, color:'var(--cui-info)', lineHeight:1 }}>●</span>}
                      </div>
                    ) : ''}
                  </td>
                  <td style={cellStyle}>
                    {canEdit ? (
                      <input value={row.name} placeholder="Название материала..."
                        onChange={e => updateMat(idx, 'name', e.target.value)}
                        style={inputStyle} />
                    ) : <div style={{ padding:'4px 8px' }}>{row.name}</div>}
                  </td>
                  <td style={cellStyle}>
                    {canEdit ? (
                      <input type="number" min="0" step="any" value={row.quantity} placeholder=""
                        onChange={e => updateMat(idx, 'quantity', e.target.value)}
                        style={{ ...inputStyle, textAlign:'center' }} />
                    ) : <div style={{ padding:'4px', textAlign:'center' }}>{row.quantity}</div>}
                  </td>
                  <td style={cellStyle}>
                    {canEdit ? (
                      <select value={row.unit} onChange={e => updateMat(idx, 'unit', e.target.value)}
                        style={{ ...inputStyle, cursor:'pointer', textAlign:'center', padding:'4px 2px' }}>
                        {MATERIAL_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    ) : <div style={{ padding:'4px', textAlign:'center' }}>{row.unit}</div>}
                  </td>
                  <td style={cellStyle}>
                    {canEdit ? (
                      <input type="number" min="0" step="any" value={row.unit_price} placeholder=""
                        onChange={e => updateMat(idx, 'unit_price', e.target.value)}
                        style={{ ...inputStyle, textAlign:'right' }} />
                    ) : <div style={{ padding:'4px 8px', textAlign:'right' }}>{row.unit_price !== '' ? Number(row.unit_price).toLocaleString() : ''}</div>}
                  </td>
                  <td style={{ border:'1px solid var(--cui-border-color)', padding:'4px 8px', textAlign:'right', fontWeight: hasData && row.total_price ? 600 : 400, color: hasData && row.total_price ? 'var(--cui-success)' : 'var(--cui-secondary-color)', background: hasData && row.total_price ? 'var(--cui-success-bg-subtle)' : 'transparent' }}>
                    {row.total_price !== '' && row.total_price !== 0 ? Math.round(Number(row.total_price)).toLocaleString() : ''}
                  </td>
                  {canEdit && (
                    <td style={{ border:'1px solid var(--cui-border-color)', padding:'2px', textAlign:'center' }}>
                      {hasData && (
                        <button onClick={() => deleteMatRow(idx)}
                          style={{ border:'none', background:'none', cursor:'pointer', color:'var(--cui-danger)', fontSize:16, padding:'0 2px', lineHeight:1 }}>×</button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
            <tr style={{ background:'var(--cui-secondary-bg)', fontWeight:700 }}>
              <td colSpan={5} style={{ border:'1px solid var(--cui-border-color)', padding:'5px 8px', textAlign:'right' }}>Итого материалы:</td>
              <td style={{ border:'1px solid var(--cui-border-color)', padding:'5px 8px', textAlign:'right', color:'var(--cui-success)' }}>
                {totalMat > 0 ? `${Math.round(totalMat).toLocaleString()} сом.` : ''}
              </td>
              {canEdit && <td style={{ border:'1px solid var(--cui-border-color)' }} />}
            </tr>
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="d-flex gap-2 mb-3">
          <CButton size="sm" color="secondary" variant="outline"
            onClick={() => setMatRows(prev => [...prev, ...Array.from({length:5}, emptyMaterialRow)])}>
            <CIcon icon={cilPlus} className="me-1" />+ 5 строк
          </CButton>
        </div>
      )}

      {total > 0 && (
        <div className="p-3 rounded mt-2"
          style={{ border:'1px solid var(--cui-success-border-subtle)', background:'var(--cui-success-bg-subtle)' }}>
          <div className="d-flex gap-4 flex-wrap">
            <div>
              <div className="small text-body-secondary">Услуги</div>
              <div className="fw-semibold">{Math.round(totalSvc).toLocaleString()} сом.</div>
            </div>
            {totalMat > 0 && (
              <div>
                <div className="small text-body-secondary">Материалы</div>
                <div className="fw-semibold">{Math.round(totalMat).toLocaleString()} сом.</div>
              </div>
            )}
            <div>
              <div className="small text-body-secondary">Общий итог</div>
              <div className="fw-bold fs-6 text-success">{Math.round(total).toLocaleString()} сом.</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Модал выбора из склада ── */}
      <CModal size="lg" visible={warehouseModal} onClose={() => setWarehouseModal(false)}>
        <CModalHeader><CModalTitle><CIcon icon={cilSearch} className="me-2" />Выбрать из склада</CModalTitle></CModalHeader>
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
                    <CTableDataCell colSpan={6} className="text-center text-body-secondary py-3">Ничего не найдено</CTableDataCell>
                  </CTableRow>
                )}
                {filteredWarehouse.map(item => (
                  <CTableRow key={item.id} style={{ cursor:'pointer' }} onClick={() => addFromWarehouse(item)}>
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
        <CModalHeader><CModalTitle><CIcon icon={cilClipboard} className="me-2" />Создать заявку со склада</CModalTitle></CModalHeader>
        <CModalBody>
          {invoiceError && <CAlert color="danger" className="mb-3">{invoiceError}</CAlert>}
          {invoiceSuccess ? (
            <CAlert color="success">
              ✅ Заявка создана! Она появилась на странице{' '}
              <a href="/warehouse/outgoing-invoices" target="_blank" rel="noopener noreferrer">Расходных накладных</a>{' '}
              со статусом «Черновик».
            </CAlert>
          ) : invoiceItems.length === 0 ? (
            <CAlert color="warning">Нет позиций привязанных к складу. Добавьте материалы через кнопку «Из склада».</CAlert>
          ) : (
            <>
              <p className="small text-body-secondary mb-3">Позиции привязанные к номенклатуре склада. Проверьте количество и укажите цену продажи.</p>
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
                        <input type="number" min="0" step="any" value={item.sale_price || ''} placeholder="0"
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