import { useState, useEffect, useCallback } from 'react'
import {
  CButton, CSpinner, CAlert, CBadge,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CFormInput, CFormLabel, CRow, CCol,
  CTable, CTableHead, CTableBody, CTableRow,
  CTableHeaderCell, CTableDataCell,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilSave, cilTrash, cilClipboard, cilPrint } from '@coreui/icons'
import api from '../api/client'
import EstimateTable from './EstimateTable'



// ── Константы ─────────────────────────────────────────────

const SERVICE_TYPES = [
  { key: 'cutting',  label: 'Распил',       color: '#ff9800', subtitle: 'От чертежа до готовой детали.' },
  { key: 'cnc',      label: 'ЧПУ',          color: '#2196f3', subtitle: 'От идеи к идеальной детали.' },
  { key: 'painting', label: 'Покраска',      color: '#f44336', subtitle: 'От эскиза до идеального цвета.' },
  { key: 'soft',     label: 'Мягкая мебель', color: '#4caf50', subtitle: 'От идеи к идеальной детали.' },
]

const DEFAULT_ROWS = 20

function normalizeCategory(cat) {
  if (!cat) return null
  const c = cat.trim()
  if (c.toUpperCase().startsWith('КРА')) return 'Краска'
  if (c.toUpperCase().startsWith('ГРУ')) return 'Грунт'
  if (c.toUpperCase().startsWith('ЛАК')) return 'Лак'
  return null
}

const CATEGORY_LABELS = {
  'Краска': { label: 'Краска', color: '#f44336', bg: '#ffebee' },
  'Грунт':  { label: 'Грунт',  color: '#ff9800', bg: '#fff3e0' },
  'Лак':    { label: 'Лак',    color: '#9c27b0', bg: '#f3e5f5' },
}

async function buildInvoiceItemsFromRows(rows) {
  const warehouseRes = await api.get('/warehouse/items')
  const wItems = warehouseRes.data.data || []
  const totalArea = rows.reduce((s, r) => s + (parseFloat(r.area_m2) || 0), 0)

  const paintGrouped = {}
  for (const row of rows) {
    if (!row.product_id) continue
    const area = parseFloat(row.area_m2) || 0
    if (area <= 0) continue
    const wItem = wItems.find(i => i.id === row.product_id)
    const category = row.product_category || wItem?.category || ''
    const norm = normalizeCategory(category)
    if (norm !== 'Краска') continue
    if (!paintGrouped[row.product_id]) {
      paintGrouped[row.product_id] = {
        item_id: row.product_id, item_name: row.product_name || wItem?.name || '—',
        category: 'Краска', unit: wItem?.unit || 'кг', total_area: 0,
        sale_price: wItem?.sale_price || 0, no_item: !wItem,
      }
    }
    paintGrouped[row.product_id].total_area += area
  }

  const result = []
  for (const g of Object.values(paintGrouped)) {
    const qty = parseFloat((g.total_area * 0.35).toFixed(3))
    if (qty > 0) result.push({
      item_id: g.item_id, item_name: g.item_name, unit: g.unit,
      quantity: qty, sale_price: g.sale_price, category: 'Краска',
      area_info: `${g.total_area.toFixed(2)} м² × 0.35 кг/м²`, no_item: g.no_item,
    })
  }

  if (totalArea > 0) {
    const gruntItem = wItems.find(i => normalizeCategory(i.category) === 'Грунт')
    result.push({
      item_id: gruntItem?.id || '', item_name: gruntItem?.name || 'Грунт',
      unit: gruntItem?.unit || 'кг', quantity: parseFloat((totalArea * 0.45).toFixed(3)),
      sale_price: gruntItem?.sale_price || 0, category: 'Грунт',
      area_info: `${totalArea.toFixed(2)} м² × 0.45 кг/м²`, no_item: !gruntItem,
    })
    const lakItem = wItems.find(i => normalizeCategory(i.category) === 'Лак')
    result.push({
      item_id: lakItem?.id || '', item_name: lakItem?.name || 'Лак',
      unit: lakItem?.unit || 'кг', quantity: parseFloat((totalArea * 0.25).toFixed(3)),
      sale_price: lakItem?.sale_price || 0, category: 'Лак',
      area_info: `${totalArea.toFixed(2)} м² × 0.25 кг/м²`, no_item: !lakItem,
    })
  }
  return result
}

function emptyRow() {
  return {
    _id: Math.random().toString(36).slice(2),
    detail_name: '', width_mm: '', height_mm: '', quantity: 1,
    area_m2: '', unit_price: '', total_price: '',
    product_id: '', product_name: '', product_category: '', _dirty: false,
  }
}

function calcRow(row) {
  const h = parseFloat(row.height_mm)
  const w = parseFloat(row.width_mm)
  const q = parseInt(row.quantity) || 1
  const p = parseFloat(row.unit_price)
  const area  = h > 0 && w > 0 ? Math.round(h / 1000 * w / 1000 * q * 10000) / 10000 : 0
  const total = area > 0 && p > 0 ? Math.round(area * p * 100) / 100 : 0
  return { area_m2: area || '', total_price: total || '' }
}

// ── Блок расхода краски ───────────────────────────────────

function PaintConsumptionBlock({ rows }) {
  const totalArea = rows.reduce((s, r) => s + (parseFloat(r.area_m2) || 0), 0)
  const paintGrouped = {}
  for (const row of rows) {
    if (!row.product_id) continue
    const area = parseFloat(row.area_m2) || 0
    if (area <= 0) continue
    const norm = normalizeCategory(row.product_category || '')
    if (norm !== 'Краска') continue
    if (!paintGrouped[row.product_id]) {
      paintGrouped[row.product_id] = { product_id: row.product_id, product_name: row.product_name || '—', total_area: 0 }
    }
    paintGrouped[row.product_id].total_area += area
  }
  const paintItems = Object.values(paintGrouped)
  if (totalArea <= 0) return null

  const fixedItems = [
    { key: 'grunt', label: 'Грунт', rate: 0.45, ...CATEGORY_LABELS['Грунт'], area: totalArea },
    { key: 'lak',   label: 'Лак',   rate: 0.25, ...CATEGORY_LABELS['Лак'],   area: totalArea },
  ]

  const Chip = ({ label, catMeta, area, rate, productName }) => (
    <div style={{ display:'inline-flex', alignItems:'center', gap:0, background:catMeta.bg, border:`1px solid ${catMeta.color}44`, borderRadius:20, padding:'4px 12px', fontSize:13 }}>
      {productName && <span style={{ fontWeight:600, color:'var(--cui-body-color)', marginRight:4 }}>{productName}</span>}
      <span style={{ background:catMeta.color, color:'#fff', borderRadius:10, padding:'1px 7px', fontSize:11, fontWeight:600, marginRight:2 }}>{label}</span>
      <span style={{ color:'var(--cui-secondary-color)', fontSize:12 }}>
        {parseFloat(area.toFixed(2))} м²×{rate}кг={parseFloat((area * rate).toFixed(2))}кг
      </span>
    </div>
  )

  return (
    <div style={{ background:'var(--cui-secondary-bg)', border:'1px solid var(--cui-border-color)', borderRadius:6, padding:'10px 14px', marginBottom:10, display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
      <span style={{ fontWeight:600, fontSize:13, color:'var(--cui-body-color)', marginRight:2 }}>🎨 Расход:</span>
      {paintItems.length > 0 && (
        <>
          {paintItems.map(item => (
            <Chip key={item.product_id} label="Краска" catMeta={CATEGORY_LABELS['Краска']} area={item.total_area} rate={0.35} productName={item.product_name} />
          ))}
          <span style={{ color:'var(--cui-secondary-color)', fontSize:16, margin:'0 2px', opacity:0.4 }}>|</span>
        </>
      )}
      {fixedItems.map(item => (
        <Chip key={item.key} label={item.label} catMeta={item} area={item.area} rate={item.rate} />
      ))}
    </div>
  )
}

// ── Секция услуги ─────────────────────────────────────────
function printServiceEstimate(order, serviceType, rows, totalArea, totalPrice) {
  const svcLabel = SERVICE_TYPES.find(s => s.key === serviceType)?.label || serviceType
  const filledRows = rows.filter(r => r.detail_name.trim())

  const tableRows = filledRows.map((r, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td class="name">${r.detail_name}</td>
      <td class="center">${r.height_mm || ''}</td>
      <td class="center">${r.width_mm || ''}</td>
      <td class="center">${r.quantity || ''}</td>
      <td class="center">${r.area_m2 ? parseFloat(r.area_m2).toFixed(4) : ''}</td>
      <td class="right">${r.unit_price ? Number(r.unit_price).toLocaleString() : ''}</td>
      <td class="right bold">${r.total_price ? Math.round(Number(r.total_price)).toLocaleString() : ''}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Смета ${svcLabel} №${order?.order_number || ''}</title>
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
  <div class="header"><h1>JEVON</h1><p>${svcLabel} — смета</p></div>
  <div class="info-grid">
    <div class="cell"><span class="label">Номер заказа:</span> ${order?.order_number || '—'}</div>
    <div class="cell"><span class="label">Дата:</span> ${new Date().toLocaleDateString('ru-RU')}</div>
    <div class="cell"><span class="label">Клиент:</span> ${order?.client_name || '—'} ${order?.client_phone || ''}</div>
    <div class="cell"><span class="label">Заказ:</span> ${order?.title || ''}</div>
  </div>
  <h2>Смета — ${svcLabel}</h2>
  <table><thead><tr>
    <th>№</th><th>Наименование</th><th>Высота мм</th><th>Ширина мм</th>
    <th>Кол-во</th><th>м²</th><th>Цена/м²</th><th>Сумма (сом.)</th>
  </tr></thead><tbody>
    ${tableRows}
    <tr class="total-row">
      <td colspan="5" style="text-align:right">Итого:</td>
      <td style="text-align:center">${totalArea > 0 ? totalArea.toFixed(4) : ''}</td>
      <td></td>
      <td style="text-align:right">${totalPrice > 0 ? Math.round(totalPrice).toLocaleString() : ''}</td>
    </tr>
  </tbody></table>
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

function ServiceSection({ serviceType, orderId, order, canEdit, onSaved }) {

  
  const isPainting = serviceType === 'painting'

  const [rows,     setRows]     = useState(() => Array.from({ length: DEFAULT_ROWS }, emptyRow))
  const [settings, setSettings] = useState({ section_subtitle:'', deadline:'', delivery_date:'', notes:'' })
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState(false)

  const [invoiceModal,   setInvoiceModal]   = useState(false)
  const [invoiceItems,   setInvoiceItems]   = useState([])
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [invoiceSaving,  setInvoiceSaving]  = useState(false)
  const [invoiceError,   setInvoiceError]   = useState('')
  const [invoiceSuccess, setInvoiceSuccess] = useState(false)

  const [products,        setProducts]        = useState([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productSearch,   setProductSearch]   = useState({})
  const [productDropdown, setProductDropdown] = useState(null)

  useEffect(() => {
    if (!isPainting) return
    setProductsLoading(true)
    api.get('/warehouse/items')
      .then(r => {
        const d = r.data
        setProducts(Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [])
      })
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false))
  }, [isPainting])

const load = useCallback(async () => {
  try {
    const r = await api.get(`/orders/${orderId}/detail-estimate`)
    const sections = r.data.data || []
    const sec = sections.find(s => s.service_type === serviceType)
    if (sec) {
      if (sec.settings) setSettings({
        section_subtitle: sec.settings.section_subtitle || '',
        deadline:         sec.settings.deadline         || '',
        delivery_date:    sec.settings.delivery_date    || '',
        notes:            sec.settings.notes            || '',
      })
      if (sec.rows?.length > 0) {
        const filled = sec.rows.map(r => {
          // Восстанавливаем product_category из списка products
          let cat = r.product_category || ''
          if (!cat && r.product_id && products.length > 0) {
            const found = products.find(p => p.id === r.product_id)
            if (found) cat = found.category || ''
          }
          return {
            _id:              r.id || Math.random().toString(36).slice(2),
            detail_name:      r.detail_name   || '',
            width_mm:         r.width_mm      || '',
            height_mm:        r.height_mm     || '',
            quantity:         r.quantity      || 1,
            area_m2:          r.area_m2       || '',
            unit_price:       r.unit_price    || '',
            total_price:      r.total_price   || '',
            product_id:       r.product_id    || '',
            product_name:     r.product_name  || '',
            product_category: cat,
            _dirty: false,
          }
        })
        const empty = Math.max(0, DEFAULT_ROWS - filled.length)
        setRows([...filled, ...Array.from({ length: empty }, emptyRow)])
      }
    }
  } catch {}
}, [orderId, serviceType, products])  // ← добавлен products

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (products.length === 0) return
    setRows(prev => prev.map(row => {
      if (!row.product_id || row.product_category) return row
      const prod = products.find(p => p.id === row.product_id)
      return prod ? { ...row, product_category: prod.category || '' } : row
    }))
  }, [products])

  const updateRow = (idx, field, value) => {
    setRows(prev => {
      const next = [...prev]
      const row  = { ...next[idx], [field]: value, _dirty: true }
      const calc = calcRow(row)
      row.area_m2 = calc.area_m2; row.total_price = calc.total_price
      next[idx] = row; return next
    })
  }

  const deleteRow = (idx) => setRows(prev => {
    const next = [...prev]; next.splice(idx, 1, emptyRow()); return next
  })

  const selectProduct = (rowIdx, prod) => {
    setRows(prev => {
      const next = [...prev]
      next[rowIdx] = { ...next[rowIdx], product_id: prod.id, product_name: prod.name, product_category: prod.category || '', _dirty: true }
      return next
    })
    setProductDropdown(null)
    setProductSearch(prev => ({ ...prev, [rowIdx]: '' }))
  }

  const clearProduct = (rowIdx) => {
    setRows(prev => {
      const next = [...prev]
      next[rowIdx] = { ...next[rowIdx], product_id: '', product_name: '', product_category: '', _dirty: true }
      return next
    })
  }

const save = async () => {
  setSaving(true); setError('')
  try {
    const rowsToSave = rows.filter(r => r.detail_name.trim()).map(r => ({
      detail_name:  r.detail_name.trim(),
      width_mm:     parseFloat(r.width_mm)  || 0,
      height_mm:    parseFloat(r.height_mm) || 0,
      quantity:     parseInt(r.quantity)    || 1,
      unit_price:   parseFloat(r.unit_price) || 0,
      product_id:   r.product_id   || '',
      product_name: r.product_name || '',
    }))
    await api.post(`/orders/${orderId}/detail-estimate`, {
      service_type: serviceType, settings, rows: rowsToSave,
    })
    setSuccess(true)
    setTimeout(() => setSuccess(false), 2000)
    // load() убран — не нужен, rows уже в правильном состоянии
    onSaved?.()
  } catch (e) {
    setError(e.response?.data?.error || 'Ошибка сохранения')
  } finally { setSaving(false) }
}

  const openInvoiceModal = async () => {
    setInvoiceError(''); setInvoiceSuccess(false); setInvoiceItems([])
    setInvoiceModal(true); setInvoiceLoading(true)
    try { setInvoiceItems(await buildInvoiceItemsFromRows(rows)) }
    catch { setInvoiceError('Ошибка загрузки данных') }
    finally { setInvoiceLoading(false) }
  }

  const updateInvoiceItem = (idx, field, value) =>
    setInvoiceItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, [field]: parseFloat(value) || 0 } : item
    ))

  const removeInvoiceItem = (idx) =>
    setInvoiceItems(prev => prev.filter((_, i) => i !== idx))

  const handleCreateInvoice = async () => {
    const validItems = invoiceItems.filter(i => i.item_id && i.quantity > 0)
    if (validItems.length === 0) { setInvoiceError('Нет позиций для создания заявки'); return }
    setInvoiceSaving(true); setInvoiceError('')
    try {
      await api.post('/warehouse/outgoing-invoices', {
        invoice_type: 'order', order_id: orderId,
        notes: `Заявка из Сметы заказа #${order?.order_number || ''}`,
        items: validItems.map(i => ({ item_id: i.item_id, quantity: i.quantity, sale_price: i.sale_price || 0 })),
      })
      setInvoiceSuccess(true)
    } catch (e) {
      setInvoiceError(e.response?.data?.error || 'Ошибка создания заявки')
    } finally { setInvoiceSaving(false) }
  }

  const hasPaintData = isPainting && rows.some(r => r.detail_name.trim() && parseFloat(r.area_m2) > 0)
  const totalArea    = rows.reduce((s, r) => s + (parseFloat(r.area_m2)    || 0), 0)
  const totalPrice   = rows.reduce((s, r) => s + (parseFloat(r.total_price) || 0), 0)

  const cellStyle  = { border: '1px solid var(--cui-border-color)', padding: 0 }
  const inputStyle = { border:'none', outline:'none', background:'transparent', width:'100%', padding:'4px 6px', fontSize:13, color:'var(--cui-body-color)' }

  const getFilteredProducts = (rowIdx) => {
    const search = (productSearch[rowIdx] || '').toLowerCase()
    if (!search) return products.slice(0, 30)
    return products.filter(p =>
      p.name.toLowerCase().includes(search) ||
      (p.article || '').toLowerCase().includes(search)
    ).slice(0, 20)
  }

  return (
    <div>
      {error   && <CAlert color="danger"  className="py-2 mb-2">{error}</CAlert>}
      {success && <CAlert color="success" className="py-2 mb-2">✅ Сохранено</CAlert>}

      {isPainting && <PaintConsumptionBlock rows={rows} />}

      {/* Toolbar */}
     {/* Toolbar */}
{canEdit && (
  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, gap:8 }}>
    <CButton color="secondary" variant="outline" size="sm"
      onClick={() => setRows(prev => [...prev, ...Array.from({ length: 10 }, emptyRow)])}>
      <CIcon icon={cilPlus} size="sm" className="me-1" />+ 10 строк
    </CButton>
    <div style={{ display:'flex', gap:8 }}>
      {/* ── Кнопка печати ── */}
      <CButton color="secondary" variant="outline" size="sm"
        onClick={() => printServiceEstimate(order, serviceType, rows, totalArea, totalPrice)}>
        <CIcon icon={cilPrint} size="sm" className="me-1" />Печать
      </CButton>
      {hasPaintData && (
        <CButton color="warning" variant="outline" size="sm" onClick={openInvoiceModal}>
          <CIcon icon={cilClipboard} size="sm" className="me-1" />Создать заявку
        </CButton>
      )}
      <CButton color="primary" size="sm" disabled={saving} onClick={save}>
        {saving
          ? <CSpinner size="sm" className="me-1" />
          : <CIcon icon={cilSave} size="sm" className="me-1" />}
        Сохранить
      </CButton>
    </div>
  </div>
)}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background: 'var(--cui-secondary-bg)' }}>
              <th style={{ ...cellStyle, padding:'6px 4px', textAlign:'center', width:32, color:'var(--cui-secondary-color)', fontSize:11 }}>#</th>
              <th style={{ ...cellStyle, padding:'6px 8px', minWidth:180 }}>Наименование детали</th>
              {isPainting && <th style={{ ...cellStyle, padding:'6px 8px', minWidth:180 }}>Продукт</th>}
              <th style={{ ...cellStyle, padding:'6px 8px', width:90, textAlign:'center' }}>Высота мм</th>
              <th style={{ ...cellStyle, padding:'6px 8px', width:90, textAlign:'center' }}>Ширина мм</th>
              <th style={{ ...cellStyle, padding:'6px 8px', width:70, textAlign:'center' }}>Кол-во</th>
              <th style={{ ...cellStyle, padding:'6px 8px', width:90, textAlign:'center' }}>м²</th>
              <th style={{ ...cellStyle, padding:'6px 8px', width:100, textAlign:'right' }}>Цена/м²</th>
              <th style={{ ...cellStyle, padding:'6px 8px', width:110, textAlign:'right' }}>Сумма</th>
              {canEdit && <th style={{ ...cellStyle, width:30 }}></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const hasData       = row.detail_name.trim() !== ''
              const filteredProds = isPainting ? getFilteredProducts(idx) : []
              const selectedProd  = isPainting && row.product_id ? products.find(p => p.id === row.product_id) : null
              const catNorm       = normalizeCategory(selectedProd?.category || '')
              const catMeta       = catNorm ? CATEGORY_LABELS[catNorm] : null

              return (
                <tr key={row._id}>
                  <td style={{ ...cellStyle, textAlign:'center', color:'var(--cui-secondary-color)', fontSize:11, padding:'4px 2px' }}>
                    {hasData ? idx + 1 : ''}
                  </td>
                  <td style={cellStyle}>
                    {canEdit ? (
                      <input type="text" value={row.detail_name}
                        placeholder={idx === 0 ? 'Например: Фасад 600×900' : ''}
                        onChange={e => updateRow(idx, 'detail_name', e.target.value)}
                        style={inputStyle} />
                    ) : <div style={{ padding:'4px 8px' }}>{row.detail_name}</div>}
                  </td>

                  {isPainting && (
                    <td style={{ ...cellStyle, position:'relative' }}>
                      {canEdit ? (
                        <div style={{ position:'relative' }}>
                          {row.product_id ? (
                            <div style={{ display:'flex', alignItems:'center', padding:'3px 6px', gap:4 }}>
                              <div style={{ flex:1, fontSize:12 }}>
                                <span style={{ fontWeight:600 }}>{row.product_name}</span>
                                {catMeta && <span style={{ marginLeft:5, fontSize:10, background:catMeta.color, color:'#fff', borderRadius:8, padding:'1px 6px' }}>{catMeta.label}</span>}
                              </div>
                              <button onClick={() => clearProduct(idx)}
                                style={{ border:'none', background:'none', cursor:'pointer', color:'var(--cui-danger)', fontSize:14, lineHeight:1, padding:'0 2px' }}>×</button>
                            </div>
                          ) : (
                            <div>
                              <input type="text" value={productSearch[idx] || ''}
                                placeholder={productsLoading ? 'Загрузка...' : 'Выбрать продукт...'}
                                onChange={e => {
                                  setProductSearch(prev => ({ ...prev, [idx]: e.target.value }))
                                  setProductDropdown(idx)
                                }}
                                onFocus={() => setProductDropdown(idx)}
                                onBlur={() => setTimeout(() => setProductDropdown(null), 200)}
                                style={inputStyle} />
                              {productDropdown === idx && (
                                <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'var(--cui-body-bg)', border:'1px solid var(--cui-border-color)', borderRadius:4, zIndex:1000, maxHeight:220, overflowY:'auto', boxShadow:'0 4px 12px rgba(0,0,0,0.15)' }}>
                                  {filteredProds.length === 0 ? (
                                    <div style={{ padding:'8px 12px', color:'var(--cui-secondary-color)', fontSize:12 }}>Ничего не найдено</div>
                                  ) : filteredProds.map(prod => {
                                    const pCatMeta = CATEGORY_LABELS[normalizeCategory(prod.category)]
                                    return (
                                      <div key={prod.id} onMouseDown={() => selectProduct(idx, prod)}
                                        style={{ padding:'6px 12px', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', gap:6, borderBottom:'1px solid var(--cui-border-color)' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--cui-secondary-bg)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <span style={{ flex:1 }}>{prod.name}</span>
                                        {prod.article && <span style={{ color:'var(--cui-secondary-color)', fontSize:11 }}>{prod.article}</span>}
                                        {pCatMeta && <span style={{ fontSize:10, background:pCatMeta.color, color:'#fff', borderRadius:8, padding:'1px 6px' }}>{pCatMeta.label}</span>}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ padding:'4px 8px', fontSize:12 }}>
                          {row.product_name}
                          {catMeta && <span style={{ marginLeft:5, fontSize:10, background:catMeta.color, color:'#fff', borderRadius:8, padding:'1px 6px' }}>{catMeta.label}</span>}
                        </div>
                      )}
                    </td>
                  )}

                  <td style={cellStyle}>
                    {canEdit
                      ? <input type="number" min="0" value={row.height_mm} onChange={e => updateRow(idx, 'height_mm', e.target.value)} style={{ ...inputStyle, textAlign:'center' }} />
                      : <div style={{ padding:'4px', textAlign:'center' }}>{row.height_mm}</div>}
                  </td>
                  <td style={cellStyle}>
                    {canEdit
                      ? <input type="number" min="0" value={row.width_mm} onChange={e => updateRow(idx, 'width_mm', e.target.value)} style={{ ...inputStyle, textAlign:'center' }} />
                      : <div style={{ padding:'4px', textAlign:'center' }}>{row.width_mm}</div>}
                  </td>
                  <td style={cellStyle}>
                    {canEdit
                      ? <input type="number" min="1" value={row.quantity} onChange={e => updateRow(idx, 'quantity', e.target.value)} style={{ ...inputStyle, textAlign:'center' }} />
                      : <div style={{ padding:'4px', textAlign:'center' }}>{row.quantity}</div>}
                  </td>
                  <td style={{ ...cellStyle, textAlign:'center', padding:'4px 6px', background: row.area_m2 ? 'var(--cui-info-bg-subtle)' : 'transparent', color: row.area_m2 ? 'var(--cui-info)' : 'var(--cui-secondary-color)', fontWeight: row.area_m2 ? 600 : 400 }}>
                    {row.area_m2 !== '' ? row.area_m2 : ''}
                  </td>
                  <td style={cellStyle}>
                    {canEdit
                      ? <input type="number" min="0" step="any" value={row.unit_price} onChange={e => updateRow(idx, 'unit_price', e.target.value)} style={{ ...inputStyle, textAlign:'right' }} />
                      : <div style={{ padding:'4px 8px', textAlign:'right' }}>{row.unit_price}</div>}
                  </td>
                  <td style={{ ...cellStyle, padding:'4px 8px', textAlign:'right', fontWeight: row.total_price ? 600 : 400, color: row.total_price ? 'var(--cui-success)' : 'var(--cui-secondary-color)', background: row.total_price ? 'var(--cui-success-bg-subtle)' : 'transparent' }}>
                    {row.total_price !== '' && row.total_price !== 0 ? Math.round(Number(row.total_price)).toLocaleString() : ''}
                  </td>
                  {canEdit && (
                    <td style={{ ...cellStyle, textAlign:'center', padding:'2px' }}>
                      {hasData && (
                        <button onClick={() => deleteRow(idx)}
                          style={{ border:'none', background:'none', cursor:'pointer', color:'var(--cui-danger)', fontSize:16, padding:'0 2px', lineHeight:1 }}>×</button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
            <tr style={{ background:'var(--cui-secondary-bg)', fontWeight:700 }}>
              <td colSpan={isPainting ? 7 : 6} style={{ ...cellStyle, padding:'6px 8px', textAlign:'right' }}>Итого:</td>
              <td style={{ ...cellStyle, padding:'6px 8px', textAlign:'center', color:'var(--cui-info)' }}>
                {totalArea > 0 ? totalArea.toFixed(4) : ''}
              </td>
              <td style={{ ...cellStyle, padding:'6px 8px', textAlign:'right' }}></td>
              <td style={{ ...cellStyle, padding:'6px 8px', textAlign:'right', color:'var(--cui-success)' }}>
                {totalPrice > 0 ? Math.round(totalPrice).toLocaleString() + ' сом' : ''}
              </td>
              {canEdit && <td style={cellStyle}></td>}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Модал заявки */}
      <CModal size="lg" visible={invoiceModal} onClose={() => setInvoiceModal(false)}>
        <CModalHeader>
          <CModalTitle><CIcon icon={cilClipboard} className="me-2" />Создать заявку со Склада</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {invoiceError && <CAlert color="danger" className="mb-3">{invoiceError}</CAlert>}
          {invoiceSuccess ? (
            <CAlert color="success">
              ✅ Заявка создана! Она появилась на странице{' '}
              <a href="/warehouse/outgoing-invoices" target="_blank" rel="noopener noreferrer">Расходных накладных</a>{' '}
              со статусом «Черновик».
            </CAlert>
          ) : invoiceLoading ? (
            <div className="text-center py-4"><CSpinner size="sm" className="me-2" />Загрузка данных из Сметы...</div>
          ) : invoiceItems.length > 0 ? (
            <>
              <p className="small text-body-secondary mb-3">
                Перечень рассчитан из Сметы (Покраска). Проверьте количество и укажите цену продажи.
              </p>
              <CTable small bordered style={{ fontSize:13 }}>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Продукт</CTableHeaderCell>
                    <CTableHeaderCell className="text-center" style={{ width:60 }}>Ед.</CTableHeaderCell>
                    <CTableHeaderCell style={{ width:95 }}>Кол-во</CTableHeaderCell>
                    <CTableHeaderCell style={{ width:110 }}>Цена прод.</CTableHeaderCell>
                    <CTableHeaderCell className="text-body-secondary" style={{ fontSize:11, width:150 }}>Расчёт</CTableHeaderCell>
                    <CTableHeaderCell style={{ width:36 }}></CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {invoiceItems.map((item, idx) => {
                    const catMeta = CATEGORY_LABELS[item.category]
                    return (
                      <CTableRow key={idx} style={{ background: item.no_item ? 'var(--cui-warning-bg-subtle)' : 'transparent' }}>
                        <CTableDataCell>
                          <div className="fw-semibold" style={{ fontSize:13 }}>{item.item_name}</div>
                          <div>
                            {catMeta && <span style={{ fontSize:10, background:catMeta.color, color:'#fff', borderRadius:8, padding:'1px 6px', fontWeight:600 }}>{item.category}</span>}
                            {item.no_item && <span className="text-warning ms-1" style={{ fontSize:11 }}>⚠️ нет в номенклатуре</span>}
                          </div>
                        </CTableDataCell>
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
                        <CTableDataCell className="text-body-secondary" style={{ fontSize:11 }}>{item.area_info}</CTableDataCell>
                        <CTableDataCell className="text-center">
                          <button onClick={() => removeInvoiceItem(idx)}
                            style={{ border:'none', background:'none', cursor:'pointer', color:'var(--cui-danger)', fontSize:16 }}>×</button>
                        </CTableDataCell>
                      </CTableRow>
                    )
                  })}
                </CTableBody>
              </CTable>
              {invoiceItems.some(i => i.no_item) && (
                <CAlert color="warning" className="mt-2 py-2 small">
                  ⚠️ Некоторые продукты не найдены в номенклатуре. Добавьте через <strong>Склад → Номенклатура</strong>.
                </CAlert>
              )}
            </>
          ) : !invoiceError ? (
            <CAlert color="warning">В Смете нет заполненных строк с размерами. Сначала заполните таблицу и сохраните.</CAlert>
          ) : null}
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

// ── Блок прихода для дочернего заказа ────────────────────

function IncomeBanner({ orderId, order }) {
  const [sections,   setSections]   = useState([])
  const [linkAmount, setLinkAmount] = useState(0)
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const r = await api.get(`/orders/${orderId}/detail-estimate`)
        setSections(r.data.data || [])
      } catch {}
      try {
        if (order?.parent_order_id) {
          const linksRes = await api.get(`/orders/${order.parent_order_id}/service-links`)
          const links = linksRes.data.data || []
          const myLink = links.find(l => l.child_order_id === orderId)
          if (myLink) setLinkAmount(myLink.amount || 0)
        }
      } catch {}
      setLoading(false)
    }
    load()
  }, [orderId, order])

  if (loading) return null
  const ownEstimateTotal = sections.reduce((s, sec) => s + (sec.total_price || 0), 0)

  return (
    <div className="mb-3 p-3 rounded"
      style={{ background:'var(--cui-success-bg-subtle)', border:'1px solid var(--cui-success-border-subtle)' }}>
      <div className="fw-semibold text-success mb-2">💰 Доход от заказа цеха</div>
      <div className="d-flex gap-4 flex-wrap">
        <div>
          <div className="small text-body-secondary">Заказано из цеха</div>
          <div className="fw-bold text-success fs-6">+{linkAmount.toLocaleString()} сом.</div>
        </div>
        {ownEstimateTotal > 0 && (
          <div>
            <div className="small text-body-secondary">По своей смете</div>
            <div className="fw-bold text-success fs-6">+{Math.round(ownEstimateTotal).toLocaleString()} сом.</div>
          </div>
        )}
        {ownEstimateTotal > 0 && linkAmount > 0 && (
          <div>
            <div className="small text-body-secondary">Разница</div>
            <div className={`fw-bold fs-6 ${ownEstimateTotal - linkAmount >= 0 ? 'text-success' : 'text-danger'}`}>
              {ownEstimateTotal - linkAmount >= 0 ? '+' : ''}
              {Math.round(ownEstimateTotal - linkAmount).toLocaleString()} сом.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Главный компонент ─────────────────────────────────────

export default function DetailEstimateTable({ orderId, order, payments, canEdit = true, onSaved }) {
  const defaultType = order?.order_type === 'cutting'  ? 'cutting'
    : order?.order_type === 'painting' ? 'painting'
    : order?.order_type === 'cnc'      ? 'cnc'
    : (order?.order_type === 'soft_fabric' || order?.order_type === 'soft_furniture') ? 'soft'
    : 'cnc'

  const isChildOrder = !!order?.parent_order_id

  const [activeType,     setActiveType]     = useState('')
  const [activeSections, setActiveSections] = useState([])
  const [addModal,       setAddModal]       = useState(false)
  const [newSectionType, setNewSectionType] = useState('')
  const [sectionsLoaded, setSectionsLoaded] = useState(false)

  useEffect(() => {
    api.get(`/orders/${orderId}/detail-estimate`)
      .then(r => {
        const detailSections = r.data.data || []
        if (detailSections.length > 0) {
          const types = detailSections.map(s => s.service_type)
          setActiveSections(types)
          setActiveType(types[0])
        } else {
          // Для всех типов заказов — показываем секцию по умолчанию
          setActiveSections([defaultType])
          setActiveType(defaultType)
        }
        setSectionsLoaded(true)
      })
      .catch(() => {
        setActiveSections([defaultType])
        setActiveType(defaultType)
        setSectionsLoaded(true)
      })
  }, [orderId])

  const addSection = async () => {
    if (!newSectionType || activeSections.includes(newSectionType)) return
    await api.post(`/orders/${orderId}/detail-estimate`, {
      service_type: newSectionType, settings: {}, rows: [],
    }).catch(() => {})
    setActiveSections(prev => [...prev, newSectionType])
    setActiveType(newSectionType)
    setAddModal(false)
    setNewSectionType('')
  }

  const removeSection = async (type) => {
    if (!window.confirm('Удалить раздел и все его данные?')) return
    await api.delete(`/orders/${orderId}/detail-estimate/${type}`).catch(() => {})
    const next = activeSections.filter(t => t !== type)
    setActiveSections(next)
    setActiveType(next[0] || '')
  }

  const availableToAdd = SERVICE_TYPES.filter(s => !activeSections.includes(s.key))

  const tabBtnStyle = (key) => ({
    padding: '6px 14px', border: 'none',
    borderBottom: activeType === key ? '2px solid' : '2px solid transparent',
    borderBottomColor: activeType === key
      ? SERVICE_TYPES.find(s => s.key === key)?.color || 'var(--cui-primary)'
      : 'transparent',
    background: 'transparent', cursor: 'pointer',
    fontWeight: activeType === key ? 600 : 400, fontSize: 13,
    color: activeType === key
      ? SERVICE_TYPES.find(s => s.key === key)?.color || 'var(--cui-primary)'
      : 'var(--cui-secondary-color)',
    transition: 'all 0.15s',
  })

  return (
    <div>
      {isChildOrder && <IncomeBanner orderId={orderId} order={order} />}

      {/* Табы */}
      <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:2, borderBottom:'1px solid var(--cui-border-color)', marginBottom:14 }}>
        {activeSections.map(key => {
          const svc = SERVICE_TYPES.find(s => s.key === key)
          return (
            <div key={key} style={{ display:'flex', alignItems:'center' }}>
              <button style={tabBtnStyle(key)} onClick={() => setActiveType(key)}>
                {svc?.label || key}
              </button>
              {canEdit && activeSections.length > 1 && (
                <button onClick={() => removeSection(key)} title="Удалить раздел"
                  style={{ border:'none', background:'none', cursor:'pointer', color:'var(--cui-secondary-color)', fontSize:14, padding:'0 2px', lineHeight:1 }}>×</button>
              )}
            </div>
          )
        })}
        {canEdit && availableToAdd.length > 0 && (
          <button onClick={() => setAddModal(true)}
            style={{ padding:'6px 12px', border:'1px dashed var(--cui-border-color)', borderRadius:4, background:'transparent', cursor:'pointer', color:'var(--cui-secondary-color)', fontSize:12, marginLeft:4 }}>
            <CIcon icon={cilPlus} size="sm" className="me-1" />Раздел
          </button>
        )}
      </div>

      {sectionsLoaded && activeSections.length === 0 && (
        <div className="text-center py-5 text-body-secondary">
          <div style={{ fontSize:40, marginBottom:8 }}>📋</div>
          <div className="fw-semibold mb-1">Разделы сметы не добавлены</div>
          <div className="small mb-3">Нажмите «+ Раздел» чтобы добавить услугу</div>
        </div>
      )}

{activeSections.includes(activeType) && (
  activeType === 'cutting' && (order?.order_type === 'workshop' || order?.order_type === 'external')
    ? <EstimateTable key="estimate-cutting" orderId={orderId} order={order} canEdit={canEdit} onSaved={onSaved} />
    : <ServiceSection key={`service-${activeType}`} serviceType={activeType} orderId={orderId} order={order} canEdit={canEdit} onSaved={onSaved} />
)}

      {/* Модал добавления раздела */}
      <CModal visible={addModal} onClose={() => setAddModal(false)}>
        <CModalHeader><CModalTitle>Добавить раздел</CModalTitle></CModalHeader>
        <CModalBody>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {availableToAdd.map(svc => (
              <button key={svc.key} onClick={() => setNewSectionType(svc.key)}
                style={{
                  padding:'10px 16px',
                  border:`2px solid ${newSectionType === svc.key ? svc.color : 'var(--cui-border-color)'}`,
                  borderRadius:6,
                  background: newSectionType === svc.key ? svc.color + '18' : 'transparent',
                  cursor:'pointer', textAlign:'left', fontWeight:500, color:'var(--cui-body-color)',
                }}>
                {svc.label}
                <span style={{ marginLeft:8, fontSize:12, color:'var(--cui-secondary-color)' }}>{svc.subtitle}</span>
              </button>
            ))}
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setAddModal(false)}>Отмена</CButton>
          <CButton color="primary" disabled={!newSectionType} onClick={addSection}>Добавить</CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}