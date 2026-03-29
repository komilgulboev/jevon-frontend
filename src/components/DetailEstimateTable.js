import { useState, useEffect, useCallback } from 'react'
import {
  CButton, CSpinner, CAlert, CBadge,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CFormInput, CFormLabel, CRow, CCol,
  CNav, CNavItem, CNavLink,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilSave, cilPrint, cilTrash } from '@coreui/icons'
import api from '../api/client'
import EstimateTable from './EstimateTable'

// ── Константы ─────────────────────────────────────────────

const SERVICE_TYPES = [
  { key:'cnc',      label:'ЧПУ',           color:'info',    subtitle:'От идеи к идеальной детали.' },
  { key:'painting', label:'Покраска',       color:'danger',  subtitle:'От эскиза до идеального цвета.' },
  { key:'soft',     label:'Мягкая мебель',  color:'success', subtitle:'От идеи к идеальной детали.' },
  { key:'cutting',  label:'Распил',         color:'warning', subtitle:'От чертежа до готовой детали.' },
]

const DEFAULT_ROWS = 20

const emptyRow = () => ({
  _id:        Math.random().toString(36).slice(2),
  detail_name:'',
  width_mm:   '',
  height_mm:  '',
  quantity:   1,
  area_m2:    '',
  unit_price: '',
  total_price:'',
  _dirty:     false,
})

// ── Печать накладной ──────────────────────────────────────

function printDetailEstimate(order, serviceType, settings, rows, totalM2, totalPrice, payments) {
  const svcDef = SERVICE_TYPES.find(s => s.key === serviceType)
  const filled = rows.filter(r => r.detail_name.trim())
  const paidAmount  = payments?.reduce((s, p) => s + (p.amount || 0), 0) || 0
  const remaining   = totalPrice - paidAmount

  const trs = filled.map((r, i) => `
    <tr>
      <td class="num">${i+1}</td>
      <td class="name">${r.detail_name}</td>
      <td class="center">${r.area_m2 > 0 ? Number(r.area_m2).toFixed(2) : ''}</td>
      <td class="right">${r.unit_price > 0 ? Number(r.unit_price).toLocaleString() : ''}</td>
      <td class="right bold">${r.total_price > 0 ? Number(r.total_price).toFixed(2) : ''}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${svcDef?.label || ''} №${order?.order_number}</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:Arial,sans-serif; font-size:10pt; color:#000; background:#fff; }
.page { width:148mm; margin:0 auto; padding:8mm; }
.header { text-align:center; margin-bottom:3mm; }
.header h1 { font-size:13pt; font-weight:bold; letter-spacing:1px; }
.header p  { font-size:8.5pt; font-style:italic; }
.info-table { width:100%; border-collapse:collapse; margin-bottom:3mm; font-size:9pt; }
.info-table td { border:1px solid #000; padding:1.5mm 2.5mm; }
.info-table .label { font-weight:bold; white-space:nowrap; }
h2 { font-size:9.5pt; font-weight:bold; text-align:center;
     border:1px solid #000; border-bottom:none;
     padding:1.5mm; background:#e8e8e8 !important;
     -webkit-print-color-adjust:exact; print-color-adjust:exact; }
table.main { width:100%; border-collapse:collapse; margin-bottom:3mm; }
table.main th,table.main td { border:1px solid #000 !important; padding:1.5mm 2mm; font-size:9pt; }
table.main th { background:#d8d8d8 !important; text-align:center; font-weight:bold;
  -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.num   { text-align:center; width:7mm; }
.name  { text-align:left; }
.center{ text-align:center; }
.right { text-align:right; }
.bold  { font-weight:bold; }
tr:nth-child(even) { background:#fafafa !important;
  -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.total-row td { font-weight:bold; background:#e0e0e0 !important;
  border-top:2px solid #000 !important;
  -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.payment-box { border:1px solid #000; margin-top:3mm; font-size:9pt; }
.payment-box table { width:100%; border-collapse:collapse; }
.payment-box td { padding:1.5mm 3mm; }
.payment-box .title { background:#e8e8e8 !important; text-align:center; font-weight:bold;
  -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.payment-num { border:2px solid #000; float:right; padding:3mm 5mm; font-size:9pt; margin-top:-20mm; }
.payment-num b { font-size:11pt; }
.print-btn { display:block; width:148mm; margin:10px auto;
  padding:10px; background:#1a73e8; color:white;
  border:none; border-radius:6px; font-size:14px; cursor:pointer; }
@media screen {
  body { background:#888; padding:10px 0 30px; }
  .page { background:#fff; box-shadow:0 3px 20px rgba(0,0,0,0.4); min-height:210mm; }
}
@media print {
  @page { size:A5 portrait; margin:0; }
  body { background:#fff; }
  .page { padding:7mm; box-shadow:none; }
  .print-btn { display:none; }
}
</style></head><body>
<button class="print-btn" onclick="window.print()">🖨️ Распечатать</button>
<div class="page">
  <div class="header">
    <h1>JEVON</h1>
    <p>${settings?.section_subtitle || svcDef?.subtitle || ''}</p>
  </div>

  <table class="info-table">
    <tr>
      <td class="label" style="width:22mm">${order?.order_number || '—'}</td>
      <td>${order?.client_name || '—'}${order?.client_phone ? ' ' + order.client_phone : ''}</td>
      <td class="label" style="width:14mm">Дата:</td>
      <td style="width:22mm">${new Date().toLocaleDateString('ru-RU')}</td>
    </tr>
    <tr>
      <td class="label">Мебель:</td>
      <td>${order?.title || ''}${settings?.notes ? ' ' + settings.notes : ''}</td>
      <td class="label">Срок:</td>
      <td>${settings?.deadline || ''}</td>
    </tr>
    ${settings?.delivery_date ? `
    <tr>
      <td></td><td></td>
      <td class="label">Дата сдачи:</td>
      <td>${settings.delivery_date}</td>
    </tr>` : ''}
  </table>

  <h2>Наименование и размеры деталей</h2>
  <table class="main">
    <thead><tr>
      <th class="num">№</th>
      <th>Наименование и размеры деталей</th>
      <th style="width:14mm">м²</th>
      <th style="width:22mm">Цена за ед.</th>
      <th style="width:24mm">Общая сумма</th>
    </tr></thead>
    <tbody>
      ${trs}
      <tr class="total-row">
        <td colspan="2" class="right">Итого:</td>
        <td class="center">${totalM2.toFixed(2)}</td>
        <td></td>
        <td class="right">${totalPrice.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div class="payment-box">
    <table>
      <tr><td colspan="2" class="title">Итого к оплате:</td></tr>
      <tr>
        <td>Стоимость Услуги:</td>
        <td><b>${totalPrice.toFixed(2)} смн</b></td>
      </tr>
      <tr><td style="border-top:1px solid #ccc">Оплатили:</td>
          <td style="border-top:1px solid #ccc"><b>${paidAmount.toFixed(2)} смн</b></td></tr>
      <tr><td>Остаток:</td>
          <td><b>${remaining.toFixed(2)} смн</b></td></tr>
    </table>
  </div>

  <div style="margin-top:3mm;float:right;border:2px solid #000;padding:2mm 4mm;font-size:9pt;text-align:center">
    <div style="font-size:8pt">Номер для оплаты:</div>
    <b style="font-size:10pt">940008000</b>
  </div>
</div></body></html>`

  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
  w.focus()
}

// ── Строка таблицы ────────────────────────────────────────

function calcRow(row) {
  const w = parseFloat(row.width_mm)  || 0
  const h = parseFloat(row.height_mm) || 0
  const q = parseInt(row.quantity)    || 1
  const p = parseFloat(row.unit_price)|| 0
  const area  = w > 0 && h > 0 ? Math.round(w / 1000 * h / 1000 * q * 10000) / 10000 : 0
  const total = area > 0 && p > 0 ? Math.round(area * p * 100) / 100 : 0
  return { area_m2: area || '', total_price: total || '' }
}

// ── Секция одного типа услуги ─────────────────────────────

function ServiceSection({ serviceType, orderId, order, payments, canEdit }) {
  const svcDef  = SERVICE_TYPES.find(s => s.key === serviceType)
  const [rows,     setRows]     = useState(() => Array.from({ length: DEFAULT_ROWS }, emptyRow))
  const [settings, setSettings] = useState({
    section_title: '', section_subtitle: svcDef?.subtitle || '',
    deadline: '', delivery_date: '', notes: '',
  })
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState(false)
  const [loaded,   setLoaded]   = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/orders/${orderId}/detail-estimate`)
      const sections = r.data.data || []
      const sec = sections.find(s => s.service_type === serviceType)
      if (sec) {
        if (sec.settings) {
          setSettings({
            section_title:    sec.settings.section_title    || '',
            section_subtitle: sec.settings.section_subtitle || svcDef?.subtitle || '',
            deadline:         sec.settings.deadline         || '',
            delivery_date:    sec.settings.delivery_date    || '',
            notes:            sec.settings.notes            || '',
          })
        }
        if (sec.rows?.length > 0) {
          const filled = sec.rows.map(r => ({
            _id:        r.id,
            detail_name:r.detail_name,
            width_mm:   r.width_mm   || '',
            height_mm:  r.height_mm  || '',
            quantity:   r.quantity   || 1,
            area_m2:    r.area_m2    || '',
            unit_price: r.unit_price || '',
            total_price:r.total_price|| '',
            _dirty:     false,
          }))
          const empty = Math.max(0, DEFAULT_ROWS - filled.length)
          setRows([...filled, ...Array.from({ length: empty }, emptyRow)])
        }
      }
    } catch {}
    setLoaded(true)
  }, [orderId, serviceType])

  useEffect(() => { load() }, [load])

  const updateRow = (idx, field, value) => {
    setRows(prev => {
      const next = [...prev]
      const row  = { ...next[idx], [field]: value, _dirty: true }
      const calc = calcRow(row)
      row.area_m2    = calc.area_m2
      row.total_price = calc.total_price
      next[idx] = row
      return next
    })
  }

  const deleteRow = (idx) => {
    setRows(prev => {
      const next = [...prev]
      next.splice(idx, 1, emptyRow())
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const rowsToSave = rows
        .filter(r => r.detail_name.trim())
        .map(r => ({
          detail_name: r.detail_name.trim(),
          width_mm:    parseFloat(r.width_mm)   || 0,
          height_mm:   parseFloat(r.height_mm)  || 0,
          quantity:    parseInt(r.quantity)      || 1,
          unit_price:  parseFloat(r.unit_price)  || 0,
        }))
      await api.post(`/orders/${orderId}/detail-estimate`, {
        service_type: serviceType,
        settings,
        rows: rowsToSave,
      })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      await load()
    } catch { setError('Ошибка сохранения') }
    finally  { setSaving(false) }
  }

  const totalM2    = rows.reduce((s, r) => s + (parseFloat(r.area_m2)    || 0), 0)
  const totalPrice = rows.reduce((s, r) => s + (parseFloat(r.total_price) || 0), 0)
  const filledCount = rows.filter(r => r.detail_name.trim()).length

  if (!loaded) return <div className="text-center py-3"><CSpinner size="sm" /></div>

  const cellStyle = { border:'1px solid var(--cui-border-color)', padding:0 }
  const inputStyle = {
    width:'100%', border:'none', background:'transparent',
    fontSize:12, padding:'3px 5px', color:'var(--cui-body-color)', outline:'none',
  }
  const thStyle = {
    border:'1px solid var(--cui-border-color)', padding:'4px 5px',
    fontWeight:600, fontSize:11, textAlign:'center',
    color:'var(--cui-body-color)', background:'var(--cui-secondary-bg)',
  }

  return (
    <div>
      {error   && <CAlert color="danger"  dismissible onClose={() => setError('')}>{error}</CAlert>}
      {success && <CAlert color="success" dismissible onClose={() => setSuccess(false)}>Сохранено!</CAlert>}

      {/* Настройки — не нужны для ЧПУ/Покраска/Мягкая мебель */}

      {/* Toolbar */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="small text-body-secondary">
          {filledCount > 0 && <>
            Деталей: <strong>{filledCount}</strong> &nbsp;|&nbsp;
            м²: <strong>{totalM2.toFixed(2)}</strong> &nbsp;|&nbsp;
            Итого: <strong className="text-success">{totalPrice.toFixed(2)} сом.</strong>
          </>}
        </div>
        <div className="d-flex gap-2">
          <CButton size="sm" color="secondary" variant="outline"
            onClick={() => printDetailEstimate(order, serviceType, settings, rows, totalM2, totalPrice, payments)}>
            <CIcon icon={cilPrint} className="me-1" />Печать
          </CButton>
          {canEdit && (
            <CButton size="sm" color="primary" onClick={save} disabled={saving}>
              {saving
                ? <><CSpinner size="sm" className="me-1" />Сохранение...</>
                : <><CIcon icon={cilSave} className="me-1" />Сохранить</>
              }
            </CButton>
          )}
        </div>
      </div>

      {/* Таблица деталей */}
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, tableLayout:'fixed' }}>
          <colgroup>
            <col style={{ width:28 }} />
            <col />
            <col style={{ width:65 }} />
            <col style={{ width:65 }} />
            <col style={{ width:45 }} />
            <col style={{ width:60 }} />
            <col style={{ width:80 }} />
            <col style={{ width:80 }} />
            {canEdit && <col style={{ width:26 }} />}
          </colgroup>
          <thead>
            <tr>
              {['№','Наименование и размеры деталей','Ширина мм','Высота мм','Кол-во','м²','Цена/м²','Сумма', canEdit?'':null]
                .filter(h => h !== null)
                .map((h,i) => <th key={i} style={thStyle}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const hasData = row.detail_name.trim() !== ''
              const isDirty = hasData && row._dirty
              return (
                <tr key={row._id} style={{ background: isDirty ? 'var(--cui-warning-bg-subtle)' : 'transparent' }}>
                  {/* № */}
                  <td style={{ border:'1px solid var(--cui-border-color)', textAlign:'center', fontSize:10, color:'var(--cui-secondary-color)', padding:'2px' }}>
                    {hasData ? idx+1 : ''}
                  </td>
                  {/* Наименование */}
                  <td style={cellStyle}>
                    {canEdit ? (
                      <input
                        value={row.detail_name}
                        placeholder="Фаска 2д 1800×1200=2шт..."
                        onChange={e => updateRow(idx, 'detail_name', e.target.value)}
                        style={{ ...inputStyle, width:'100%' }}
                      />
                    ) : <div style={{ padding:'3px 6px' }}>{row.detail_name}</div>}
                  </td>
                  {/* Ширина */}
                  <td style={cellStyle}>
                    {canEdit ? (
                      <input type="number" min="0" step="0.1" value={row.width_mm} placeholder=""
                        onChange={e => updateRow(idx, 'width_mm', e.target.value)}
                        style={{ ...inputStyle, textAlign:'center' }} />
                    ) : <div style={{ padding:'3px', textAlign:'center' }}>{row.width_mm}</div>}
                  </td>
                  {/* Высота */}
                  <td style={cellStyle}>
                    {canEdit ? (
                      <input type="number" min="0" step="0.1" value={row.height_mm} placeholder=""
                        onChange={e => updateRow(idx, 'height_mm', e.target.value)}
                        style={{ ...inputStyle, textAlign:'center' }} />
                    ) : <div style={{ padding:'3px', textAlign:'center' }}>{row.height_mm}</div>}
                  </td>
                  {/* Кол-во */}
                  <td style={cellStyle}>
                    {canEdit ? (
                      <input type="number" min="1" step="1" value={row.quantity}
                        onChange={e => updateRow(idx, 'quantity', e.target.value)}
                        style={{ ...inputStyle, textAlign:'center' }} />
                    ) : <div style={{ padding:'3px', textAlign:'center' }}>{row.quantity}</div>}
                  </td>
                  {/* м² авто */}
                  <td style={{
                    border:'1px solid var(--cui-border-color)', padding:'3px 5px',
                    textAlign:'center', fontSize:11,
                    background: hasData && row.area_m2 ? 'var(--cui-info-bg-subtle)' : 'transparent',
                    color: hasData && row.area_m2 ? 'var(--cui-info)' : 'var(--cui-secondary-color)',
                  }}>
                    {row.area_m2 > 0 ? Number(row.area_m2).toFixed(2) : ''}
                  </td>
                  {/* Цена */}
                  <td style={cellStyle}>
                    {canEdit ? (
                      <input type="number" min="0" step="any" value={row.unit_price} placeholder=""
                        onChange={e => updateRow(idx, 'unit_price', e.target.value)}
                        style={{ ...inputStyle, textAlign:'right' }} />
                    ) : <div style={{ padding:'3px 5px', textAlign:'right' }}>{row.unit_price > 0 ? Number(row.unit_price).toLocaleString() : ''}</div>}
                  </td>
                  {/* Сумма */}
                  <td style={{
                    border:'1px solid var(--cui-border-color)', padding:'3px 5px', textAlign:'right',
                    fontWeight: hasData && row.total_price ? 600 : 400,
                    color: hasData && row.total_price ? 'var(--cui-success)' : 'var(--cui-secondary-color)',
                    background: hasData && row.total_price ? 'var(--cui-success-bg-subtle)' : 'transparent',
                  }}>
                    {row.total_price > 0 ? Number(row.total_price).toFixed(2) : ''}
                  </td>
                  {/* Удалить */}
                  {canEdit && (
                    <td style={{ border:'1px solid var(--cui-border-color)', padding:'2px', textAlign:'center' }}>
                      {hasData && (
                        <button onClick={() => deleteRow(idx)}
                          style={{ border:'none', background:'none', cursor:'pointer', color:'var(--cui-danger)', fontSize:14, padding:'0 2px' }}>×</button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
            {/* Итог */}
            <tr style={{ background:'var(--cui-secondary-bg)', fontWeight:700 }}>
              <td colSpan={5} style={{ border:'1px solid var(--cui-border-color)', padding:'5px 8px', textAlign:'right' }}>Итого:</td>
              <td style={{ border:'1px solid var(--cui-border-color)', padding:'5px', textAlign:'center', color:'var(--cui-info)' }}>
                {totalM2 > 0 ? totalM2.toFixed(2) : ''}
              </td>
              <td style={{ border:'1px solid var(--cui-border-color)' }} />
              <td style={{ border:'1px solid var(--cui-border-color)', padding:'5px 8px', textAlign:'right', color:'var(--cui-success)', fontSize:13 }}>
                {totalPrice > 0 ? totalPrice.toFixed(2) : ''}
              </td>
              {canEdit && <td style={{ border:'1px solid var(--cui-border-color)' }} />}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Добавить строки */}
      {canEdit && (
        <div className="d-flex gap-2 mt-2">
          <CButton size="sm" color="secondary" variant="outline"
            onClick={() => setRows(prev => [...prev, ...Array.from({length:10}, emptyRow)])}>
            <CIcon icon={cilPlus} className="me-1" />+ 10 строк
          </CButton>
          <CButton size="sm" color="secondary" variant="outline"
            onClick={() => setRows(prev => [...prev, ...Array.from({length:5}, emptyRow)])}>
            + 5 строк
          </CButton>
        </div>
      )}
    </div>
  )
}

// ── Главный компонент ─────────────────────────────────────

export default function DetailEstimateTable({ orderId, order, payments, canEdit = true, canEditPrice = false }) {
  // Дефолтный тип зависит от типа заказа
  const defaultType = order?.order_type === 'cutting'  ? 'cutting' :
                      order?.order_type === 'painting' ? 'painting' :
                      order?.order_type === 'cnc'      ? 'cnc' :
                      order?.order_type === 'soft_fabric' || order?.order_type === 'soft_furniture' ? 'soft' :
                      'cnc'

  // Для Заказа цеха (workshop) показываем все 4 раздела сразу
  const isWorkshop = order?.order_type === 'workshop'
  const defaultSections = isWorkshop
    ? ['cutting', 'cnc', 'painting', 'soft']
    : [defaultType]

  const [activeType,     setActiveType]     = useState(defaultType)
  const [addModal,       setAddModal]       = useState(false)
  const [activeSections, setActiveSections] = useState(defaultSections)

  useEffect(() => {
    api.get(`/orders/${orderId}/detail-estimate`)
      .then(r => {
        const sections = r.data.data || []
        if (sections.length > 0) {
          const types = sections.map(s => s.service_type)
          setActiveSections(types)
          setActiveType(types[0])
        }
      })
      .catch(() => {})
  }, [orderId])

  const addSection = (type) => {
    if (!activeSections.includes(type)) {
      setActiveSections(prev => [...prev, type])
    }
    setActiveType(type)
    setAddModal(false)
  }

  const removeSection = (type) => {
    if (!window.confirm(`Удалить раздел "${SERVICE_TYPES.find(s=>s.key===type)?.label}"?`)) return
    api.delete(`/orders/${orderId}/detail-estimate/${type}`)
    setActiveSections(prev => prev.filter(t => t !== type))
    if (activeType === type) {
      setActiveType(activeSections.filter(t => t !== type)[0] || 'cnc')
    }
  }

  return (
    <div>
      {/* Табы типов услуг */}
      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
        <CNav variant="pills">
          {activeSections.map(type => {
            const def = SERVICE_TYPES.find(s => s.key === type)
            return (
              <CNavItem key={type}>
                <CNavLink
                  active={activeType === type}
                  onClick={() => setActiveType(type)}
                  style={{ cursor:'pointer', padding:'4px 12px', fontSize:13 }}>
                  <CBadge color={def?.color} className="me-1" style={{ fontSize:10 }}>
                    {def?.label}
                  </CBadge>
                  {canEdit && activeSections.length > 1 && (
                    <span
                      onClick={e => { e.stopPropagation(); removeSection(type) }}
                      style={{ marginLeft:4, color:'var(--cui-danger)', cursor:'pointer', fontSize:14 }}>
                      ×
                    </span>
                  )}
                </CNavLink>
              </CNavItem>
            )
          })}
        </CNav>

        {/* Добавить раздел */}
        {canEdit && (
          <CButton size="sm" color="secondary" variant="outline"
            onClick={() => setAddModal(true)}>
            <CIcon icon={cilPlus} className="me-1" />Раздел
          </CButton>
        )}
      </div>

      {/* Активная секция */}
      {activeSections.includes(activeType) && (
        activeType === 'cutting' ? (
          // Распил — EstimateTable с каталогом услуг (лист/м/шт)
          <EstimateTable
            key="cutting"
            orderId={orderId}
            order={order}
            canEdit={canEdit}
            canEditPrice={canEditPrice}
          />
        ) : (
          // ЧПУ / Покраска / Мягкая мебель — таблица деталей с размерами и м²
          <ServiceSection
            key={activeType}
            serviceType={activeType}
            orderId={orderId}
            order={order}
            payments={payments}
            canEdit={canEdit}
          />
        )
      )}

      {/* Модал добавления раздела */}
      <CModal visible={addModal} onClose={() => setAddModal(false)}>
        <CModalHeader><CModalTitle>Добавить раздел сметы</CModalTitle></CModalHeader>
        <CModalBody>
          <div className="d-flex flex-column gap-2">
            {SERVICE_TYPES.filter(s => !activeSections.includes(s.key)).map(s => (
              <CButton key={s.key} color={s.color} variant="outline"
                onClick={() => addSection(s.key)}>
                {s.label}
                <span className="ms-2 small text-body-secondary">{s.subtitle}</span>
              </CButton>
            ))}
            {SERVICE_TYPES.every(s => activeSections.includes(s.key)) && (
              <div className="text-center text-body-secondary py-2 small">
                Все разделы уже добавлены
              </div>
            )}
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={() => setAddModal(false)}>
            Закрыть
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}