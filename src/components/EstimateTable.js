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

// ── Печать сметы ─────────────────────────────────────────

function printEstimate(order, services, totalSvc) {
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
    <tr class="total-row"><td colspan="6" style="text-align:right">Итого расход:</td><td class="right">${Math.round(totalSvc).toLocaleString()}</td></tr>
  </tbody></table>
  <div class="grand-total"><table>
    <tr><td style="font-size:11pt"><b>Итого расход:</b></td><td style="font-size:11pt"><b>−${Math.round(totalSvc).toLocaleString()} сом.</b></td></tr>
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

function ServiceSelect({ value, catalog, onSelect }) {
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

export default function EstimateTable({ orderId, order, canEdit = true, canEditPrice = false, onSaved }) {
  const [svcRows, setSvcRows] = useState(() => Array.from({ length: DEFAULT_ROWS }, emptyServiceRow))
  const [catalog, setCatalog] = useState([])
  const [colors,  setColors]  = useState([])
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState(false)

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

      const svc = estRes.data.services || []

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
    } catch {
      setError('Ошибка загрузки сметы')
    }
  }, [orderId])

  useEffect(() => { loadEstimate() }, [loadEstimate])

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

  // skipDesignQty=true — не перезаписывать quantity если пользователь
  // сам его редактирует (иначе автопересчёт из sawing сбивает ввод)
  const recalcDesign = (rows, skipDesignQty = false) => {
    const designIdx = rows.findIndex(r => r._group === 'design')
    if (designIdx === -1) return rows
    const designRow = rows[designIdx]

    // Убрана старая логика hasDrilling которая обнуляла Чертёж при наличии Присадки.
    // Теперь Чертёж Базис всегда редактируемый независимо от других строк.

    let totalM2 = 0
    rows.forEach(r => {
      if (r._group === 'sawing' && r.name && SHEET_AREA[r.name]) {
        totalM2 += (parseFloat(r.quantity) || 0) * SHEET_AREA[r.name]
      }
    })

    if (totalM2 > 0 && !skipDesignQty) {
      // Автопересчёт quantity из листов распила
      const next = [...rows]
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

    // Если quantity задан вручную (skipDesignQty) или нет sawing-листов —
    // просто пересчитываем total_price из текущих quantity и unit_price
    const q = parseFloat(designRow.quantity)   || 0
    const p = parseFloat(designRow.unit_price) || 0
    if (q > 0 && p > 0) {
      const next = [...rows]
      next[designIdx] = {
        ...designRow,
        total_price: parseFloat((q * p).toFixed(2)),
        _dirty: true,
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
      if (row._group === 'design' && field === 'unit_price') return next
      // Если пользователь вручную меняет quantity у строки Чертёж —
      // не перезаписывать его автопересчётом из sawing-листов
      const skipDesignQty = row._group === 'design' && field === 'quantity'
      return recalcDesign(next, skipDesignQty)
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
      // При выборе design из каталога не перезаписываем quantity —
      // recalcDesign сработает когда изменится quantity в sawing-строках
      if (isDesign) return next
      return recalcDesign(next)
    })
  }

  const deleteSvcRow = (idx) => {
    setSvcRows(prev => { const next = [...prev]; next.splice(idx, 1, emptyServiceRow()); return next })
  }

  // ── Сохранение ───────────────────────────────────────

  const saveAll = async () => {
    setSaving(true)
    setError('')
    try {
      const services = svcRows
        .filter(r => r.name.trim())
        .map((r, i) => ({
          catalog_id: r.catalog_id,
          name:       r.name.trim(),
          color:      r.color      || '',
          article:    r.article    || '',
          quantity:   parseFloat(r.quantity)  || 0,
          unit:       r.unit       || 'шт',
          unit_spec:  r.unit_spec  || '',
          unit_price: parseFloat(r.unit_price) || 0,
          sort_order: i,
        }))

      // 1. Сохраняем основную смету (без материалов)
      await api.post(`/orders/${orderId}/estimate`, { services, materials: [] })

      // 2. Синхронизируем detail-estimate для cutting
      // Передаём строки напрямую — бэкенд считает totalPrice как quantity*unit_price
      // когда width_mm=0 и height_mm=0 (см. CASE в SaveSection)
      const cuttingRows = services.filter(s => s.name.trim() && s.unit_price > 0)
      if (cuttingRows.length > 0) {
        await api.post(`/orders/${orderId}/detail-estimate`, {
          service_type: 'cutting',
          settings: {},
          rows: cuttingRows.map(s => ({
            detail_name: s.name,
            width_mm:    0,
            height_mm:   0,
            quantity:    Math.round(parseFloat(s.quantity) || 1),
            unit_price:  parseFloat(s.unit_price) || 0,
          })),
        })
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      await loadEstimate()
      onSaved?.()
    } catch (e) {
      console.error('Status:', e.response?.status)
      console.error('Data:',   e.response?.data)
      setError('Ошибка сохранения сметы')
    } finally {
      setSaving(false)
    }
  }

  const totalSvc = svcRows.reduce((s, r) => s + (parseFloat(r.total_price) || 0), 0)

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
          {totalSvc > 0 && (
            <strong className="text-danger">Расход: {Math.round(totalSvc).toLocaleString()} сом.</strong>
          )}
        </div>
        <div className="d-flex gap-2">
          <CButton size="sm" color="secondary" variant="outline"
            onClick={() => printEstimate(order, svcRows, totalSvc)}>
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
                      <ServiceSelect value={row} catalog={catalog} onSelect={item => selectCatalogItem(idx, item)} />
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
                  <td style={{ ...cellStyle, background: 'transparent' }}>
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
                  <td style={{ border:'1px solid var(--cui-border-color)', padding:'4px 8px', textAlign:'right', fontWeight: hasData && row.total_price ? 600 : 400, color: hasData && row.total_price ? 'var(--cui-danger)' : 'var(--cui-secondary-color)', background: hasData && row.total_price ? 'var(--cui-danger-bg-subtle)' : 'transparent' }}>
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
              <td colSpan={7} style={{ border:'1px solid var(--cui-border-color)', padding:'5px 8px', textAlign:'right' }}>Итого расход:</td>
              <td style={{ border:'1px solid var(--cui-border-color)', padding:'5px 8px', textAlign:'right', color:'var(--cui-danger)' }}>
                {totalSvc > 0 ? `−${Math.round(totalSvc).toLocaleString()} сом.` : ''}
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

      {/* ── Итог ── */}
      {totalSvc > 0 && (
        <div className="p-3 rounded mt-2"
          style={{ border:'1px solid var(--cui-danger-border-subtle)', background:'var(--cui-danger-bg-subtle)' }}>
          <div className="d-flex gap-4 flex-wrap">
            <div>
              <div className="small text-body-secondary">Итого расход (услуги)</div>
              <div className="fw-bold fs-6 text-danger">−{Math.round(totalSvc).toLocaleString()} сом.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}