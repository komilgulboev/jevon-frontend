import { useState, useEffect, useRef, useCallback } from 'react'
import { CButton, CSpinner, CAlert } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilSave, cilPrint } from '@coreui/icons'
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
  _dirty:      false,
  _saved:      false,
})

// ── Печать накладной (A5, все линии, 28 строк) ─────────────

function printInvoice(order, rows, total) {
  const filled = rows.filter(r => r.name.trim())

  // Строки с данными
  const filledTrs = filled.map((r, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td class="name">${r.name}</td>
      <td class="center">${r.quantity !== '' ? r.quantity : ''} ${r.unit}</td>
      <td class="right">${r.unit_price !== '' ? Number(r.unit_price).toLocaleString() : ''}</td>
      <td class="right bold">${r.total_price !== '' ? Number(r.total_price).toLocaleString() : ''}</td>
    </tr>`).join('')

  // Пустые строки до 28
  const emptyCount = Math.max(0, 28 - filled.length)
  const emptyTrs = Array.from({ length: emptyCount }, (_, i) => `
    <tr>
      <td class="num">${filled.length + i + 1}</td>
      <td class="name">&nbsp;</td>
      <td></td><td></td><td></td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Накладная №${order?.order_number || ''}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10pt;
      color: #000;
      background: #fff;
    }

    .page {
      width: 148mm;
      margin: 0 auto;
      padding: 8mm;
    }

    h2 {
      text-align: center;
      font-size: 11pt;
      font-weight: bold;
      margin-bottom: 5mm;
    }

    .meta { margin-bottom: 4mm; font-size: 9.5pt; }
    .meta p { margin: 1mm 0; }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 3mm;
      /* Принудительно рисуем все границы */
      border: 2px solid #000;
    }

    th, td {
      border: 1px solid #000;
      padding: 1.5mm 2mm;
      font-size: 9pt;
      line-height: 1.2;
      /* Гарантируем что print не скрывает border */
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    th {
      background-color: #d8d8d8 !important;
      font-weight: bold;
      text-align: center;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    td.num   { text-align: center; width: 8mm; }
    td.name  { text-align: left; }
    td.center{ text-align: center; }
    td.right { text-align: right; }
    td.bold  { font-weight: bold; }

    tr { height: 6mm; }
    tr:nth-child(even) {
      background-color: #f9f9f9 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .total-row td {
      font-weight: bold;
      background-color: #e8e8e8 !important;
      border-top: 2px solid #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .sign {
      margin-top: 8mm;
      display: flex;
      justify-content: space-between;
      font-size: 9pt;
    }

    /* Экран — показываем как лист */
    @media screen {
      body { background: #888; padding: 10px 0 30px; }
      .page {
        background: #fff;
        box-shadow: 0 3px 20px rgba(0,0,0,0.4);
        min-height: 210mm;
        padding: 10mm;
      }
      .print-btn {
        display: block;
        width: 148mm;
        margin: 10px auto;
        padding: 10px;
        background: #1a73e8;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        cursor: pointer;
        text-align: center;
      }
    }

    /* Печать — формат A5 */
    @media print {
      @page { size: A5 portrait; margin: 0; }
      body { background: #fff; padding: 0; }
      .page { padding: 8mm; box-shadow: none; min-height: auto; }
      .print-btn { display: none; }

      /* Критично для Chrome/Firefox — без этого border исчезают */
      table { border-collapse: collapse !important; }
      th, td { border: 1px solid #000 !important; }
      table { border: 2px solid #000 !important; }
      .total-row td { border-top: 2px solid #000 !important; }
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨️ Распечатать накладную</button>

  <div class="page">
    <h2>
      Накладная №${order?.order_number || '___'} &nbsp;&nbsp;
      Дата: ${new Date().toLocaleDateString('ru-RU')}
    </h2>

    <div class="meta">
      <p><b>Заказ:</b> ${order?.title || ''}</p>
      <p><b>Клиент:</b> ${order?.client_name || '—'}${order?.client_phone ? ' / ' + order.client_phone : ''}</p>
      ${order?.address ? `<p><b>Адрес:</b> ${order.address}</p>` : ''}
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:8mm">№</th>
          <th>Наименование</th>
          <th style="width:20mm">Кол-во</th>
          <th style="width:22mm">Цена</th>
          <th style="width:24mm">Сумма</th>
        </tr>
      </thead>
      <tbody>
        ${filledTrs}
        ${emptyTrs}
        <tr class="total-row">
          <td colspan="4" style="text-align:right">Итого:</td>
          <td class="right">${total > 0 ? Number(total).toLocaleString() + ' сом.' : ''}</td>
        </tr>
      </tbody>
    </table>

    <div class="sign">
      <span>Снабженец: ______________________</span>
      <span>Принял: ______________________</span>
    </div>
  </div>
</body>
</html>`

  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
  w.focus()
}

// ── Ячейка с автодополнением ──────────────────────────────

function AutocompleteCell({ value, suggestions, onChange, onSelect, placeholder }) {
  const [open,     setOpen]     = useState(false)
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
      <input
        className="form-control form-control-sm"
        value={value}
        placeholder={placeholder}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => value && setOpen(true)}
        style={{
          border: 'none', borderRadius: 0, boxShadow: 'none',
          background: 'transparent', fontSize: 13,
        }}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 1050,
          background: 'var(--cui-body-bg)',
          border: '1px solid var(--cui-border-color)',
          borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          minWidth: 240, maxHeight: 220, overflowY: 'auto',
        }}>
          {filtered.map((s, i) => (
            <div key={i}
              onMouseDown={() => { onSelect(s); setOpen(false) }}
              style={{
                padding: '6px 12px', cursor: 'pointer', fontSize: 13,
                borderBottom: '0.5px solid var(--cui-border-color)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--cui-primary-bg-subtle)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Мобильная карточка материала ──────────────────────────

function MobileRow({ row, idx, suggestions, canEdit, onUpdate, onSelect, onDelete }) {
  const hasData = row.name.trim() !== ''
  if (!hasData && !canEdit) return null

  return (
    <div style={{
      border: '1px solid var(--cui-border-color)',
      borderRadius: 8,
      marginBottom: 8,
      padding: 10,
      background: row._dirty && !row._saved
        ? 'var(--cui-warning-bg-subtle)'
        : 'var(--cui-card-bg)',
    }}>
      <div className="d-flex justify-content-between align-items-start mb-2">
        <span className="small text-body-secondary">#{idx + 1}</span>
        {canEdit && hasData && (
          <button onClick={() => onDelete(idx)}
            style={{ border:'none', background:'none', color:'var(--cui-danger)', fontSize:18, cursor:'pointer', lineHeight:1, padding:'0 4px' }}>
            ×
          </button>
        )}
      </div>

      {/* Наименование */}
      <div className="mb-2">
        <div className="small text-body-secondary mb-1">Наименование</div>
        {canEdit ? (
          <AutocompleteCell
            value={row.name}
            suggestions={suggestions}
            placeholder="Введите название..."
            onChange={v => onUpdate(idx, 'name', v)}
            onSelect={v => onSelect(idx, v)}
          />
        ) : (
          <div className="fw-semibold">{row.name}</div>
        )}
      </div>

      <div className="d-flex gap-2 mb-2">
        {/* Количество */}
        <div style={{ flex: 1 }}>
          <div className="small text-body-secondary mb-1">Кол-во</div>
          {canEdit ? (
            <input type="number" min="0" step="0.001"
              value={row.quantity} placeholder=""
              onChange={e => onUpdate(idx, 'quantity', e.target.value)}
              className="form-control form-control-sm"
              style={{ textAlign: 'center' }} />
          ) : (
            <div className="text-center">{row.quantity} {row.unit}</div>
          )}
        </div>

        {/* Ед. изм. */}
        {canEdit && (
          <div style={{ width: 72 }}>
            <div className="small text-body-secondary mb-1">Ед.</div>
            <select value={row.unit} onChange={e => onUpdate(idx, 'unit', e.target.value)}
              className="form-select form-select-sm">
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        )}

        {/* Цена */}
        <div style={{ flex: 1 }}>
          <div className="small text-body-secondary mb-1">Цена</div>
          {canEdit ? (
            <input type="number" min="0" step="1"
              value={row.unit_price} placeholder=""
              onChange={e => onUpdate(idx, 'unit_price', e.target.value)}
              className="form-control form-control-sm"
              style={{ textAlign: 'right' }} />
          ) : (
            <div className="text-end">
              {row.unit_price !== '' ? Number(row.unit_price).toLocaleString() : ''}
            </div>
          )}
        </div>
      </div>

      {/* Сумма */}
      {row.total_price !== '' && row.total_price !== 0 && (
        <div className="d-flex justify-content-between align-items-center"
          style={{ background:'var(--cui-success-bg-subtle)', borderRadius:4, padding:'4px 8px' }}>
          <span className="small text-body-secondary">Итого:</span>
          <span className="fw-bold text-success">{Number(row.total_price).toLocaleString()} сом.</span>
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
        quantity:    m.quantity   && m.quantity   !== 0 ? m.quantity   : '',
        unit:        m.unit || 'шт',
        unit_price:  m.unit_price && m.unit_price !== 0 ? m.unit_price : '',
        total_price: m.total_price && m.total_price !== 0 ? m.total_price : '',
        supplier:    m.supplier   || '',
        stage_name:  m.stage_name || stageName || '',
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

  const addRows = (count = 10) => {
    setRows(prev => [...prev, ...Array.from({ length: count }, emptyRow)])
  }

  const addMobileRow = () => {
    setRows(prev => [...prev, emptyRow()])
  }

  const deleteRow = async (idx) => {
    const row = rows[idx]
    if (row.id) {
      try {
        await api.delete(`/orders/${orderId}/materials/${row.id}`)
      } catch { setError('Ошибка удаления'); return }
    }
    setRows(prev => {
      const next = [...prev]
      next.splice(idx, 1, emptyRow())
      return next
    })
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
        if (row.id) {
          await api.delete(`/orders/${orderId}/materials/${row.id}`)
          await api.post(`/orders/${orderId}/materials`, payload)
        } else {
          await api.post(`/orders/${orderId}/materials`, payload)
        }
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

  const total       = rows.reduce((sum, r) => sum + (parseFloat(r.total_price) || 0), 0)
  const filledCount = rows.filter(r => r.name.trim()).length

  const cellStyle = { border: '1px solid var(--cui-border-color)', padding: 0 }
  const inputStyle = {
    width: '100%', border: 'none', background: 'transparent',
    fontSize: 13, padding: '4px 6px',
    color: 'var(--cui-body-color)', outline: 'none',
  }

  return (
    <div>
      {error   && <CAlert color="danger"  dismissible onClose={() => setError('')}>{error}</CAlert>}
      {success && <CAlert color="success" dismissible onClose={() => setSuccess(false)}>Сохранено!</CAlert>}

      {/* Toolbar */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="small text-body-secondary">
          {filledCount > 0 && <>
            Позиций: <strong>{filledCount}</strong> &nbsp;|&nbsp;
            Итого: <strong className="text-success">{total.toLocaleString()} сом.</strong>
          </>}
        </div>
        <div className="d-flex gap-2">
          <CButton size="sm" color="secondary" variant="outline"
            onClick={() => printInvoice(order, rows, total)}>
            <CIcon icon={cilPrint} className="me-1" />Печать
          </CButton>
          {canEdit && (
            <CButton size="sm" color="primary" onClick={saveAll} disabled={saving}>
              {saving
                ? <><CSpinner size="sm" className="me-1" />Сохранение...</>
                : <><CIcon icon={cilSave} className="me-1" />Сохранить</>
              }
            </CButton>
          )}
        </div>
      </div>

      {/* ── Мобильный вид ── */}
      {isMobile ? (
        <div>
          {rows.map((row, idx) => (
            <MobileRow
              key={row._id}
              row={row}
              idx={idx}
              suggestions={suggestions}
              canEdit={canEdit}
              onUpdate={updateRow}
              onSelect={selectSuggestion}
              onDelete={deleteRow}
            />
          ))}
          {canEdit && (
            <CButton color="primary" variant="outline" className="w-100 mt-2" onClick={addMobileRow}>
              <CIcon icon={cilPlus} className="me-1" />Добавить строку
            </CButton>
          )}
          {/* Итог мобильный */}
          {total > 0 && (
            <div className="d-flex justify-content-between align-items-center mt-3 p-3 rounded"
              style={{ background:'var(--cui-success-bg-subtle)', border:'1px solid var(--cui-success-border-subtle)' }}>
              <span className="fw-bold">Итого:</span>
              <span className="fw-bold text-success fs-6">{total.toLocaleString()} сом.</span>
            </div>
          )}
        </div>
      ) : (
        /* ── Десктопный вид (таблица) ── */
        <div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 36 }} />
                <col style={{ width: '32%' }} />
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
                      <th key={i} style={{
                        border: '1px solid var(--cui-border-color)',
                        padding: '5px 8px',
                        textAlign: i === 0 || i >= 3 ? 'center' : 'left',
                        fontWeight: 600, fontSize: 12,
                        color: 'var(--cui-body-color)',
                      }}>
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
                        {hasData ? idx + 1 : ''}
                      </td>
                      <td style={cellStyle}>
                        {canEdit ? (
                          <AutocompleteCell
                            value={row.name}
                            suggestions={suggestions}
                            placeholder="Введите название..."
                            onChange={v => updateRow(idx, 'name', v)}
                            onSelect={v => selectSuggestion(idx, v)}
                          />
                        ) : (
                          <div style={{ padding: '4px 8px' }}>{row.name}</div>
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
                          <input type="number" min="0" step="0.001"
                            value={row.quantity} placeholder=""
                            onChange={e => updateRow(idx, 'quantity', e.target.value)}
                            style={{ ...inputStyle, textAlign:'center' }} />
                        ) : (
                          <div style={{ padding:'4px 8px', textAlign:'center' }}>{row.quantity}</div>
                        )}
                      </td>
                      <td style={cellStyle}>
                        {canEdit ? (
                          <input type="number" min="0" step="1"
                            value={row.unit_price} placeholder=""
                            onChange={e => updateRow(idx, 'unit_price', e.target.value)}
                            style={{ ...inputStyle, textAlign:'right' }} />
                        ) : (
                          <div style={{ padding:'4px 8px', textAlign:'right' }}>
                            {row.unit_price !== '' ? Number(row.unit_price).toLocaleString() : ''}
                          </div>
                        )}
                      </td>
                      <td style={{
                        border: '1px solid var(--cui-border-color)',
                        padding: '4px 8px', textAlign: 'right',
                        fontWeight: hasData && row.total_price ? 600 : 400,
                        color: hasData && row.total_price ? 'var(--cui-success)' : 'var(--cui-secondary-color)',
                        background: hasData && row.total_price ? 'var(--cui-success-bg-subtle)' : 'transparent',
                      }}>
                        {row.total_price !== '' && row.total_price !== 0
                          ? Number(row.total_price).toLocaleString() : ''}
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
                              style={{ border:'none', background:'none', cursor:'pointer', color:'var(--cui-danger)', fontSize:16, padding:'0 4px', lineHeight:1 }}
                              title="Удалить">×</button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
                {/* Итог */}
                <tr style={{ background:'var(--cui-secondary-bg)', fontWeight:700 }}>
                  <td colSpan={5} style={{ border:'1px solid var(--cui-border-color)', padding:'6px 8px', textAlign:'right' }}>
                    Итого:
                  </td>
                  <td style={{ border:'1px solid var(--cui-border-color)', padding:'6px 8px', textAlign:'right', color:'var(--cui-success)', fontSize:14 }}>
                    {total > 0 ? `${total.toLocaleString()} сом.` : ''}
                  </td>
                  <td colSpan={canEdit ? 2 : 1} style={{ border:'1px solid var(--cui-border-color)' }} />
                </tr>
              </tbody>
            </table>
          </div>

          {/* Добавить строки */}
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
        </div>
      )}
    </div>
  )
}