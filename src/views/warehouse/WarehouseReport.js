import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CButton, CSpinner, CAlert,
  CFormInput, CFormSelect, CFormLabel,
  CRow, CCol, CCard, CCardBody,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilArrowLeft, cilFilter, cilPrint } from '@coreui/icons'
import api from '../../api/client'

const TYPE_COLOR = { in: '#388e3c', out: '#f44336' }
const TYPE_BG    = { in: '#e8f5e9', out: '#ffebee' }

function fmt(n) {
  if (!n && n !== 0) return '—'
  return Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function fmtDate(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric' }) }
  catch { return d }
}

function currentMonthRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate()
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${lastDay}` }
}

export default function WarehouseReport() {
  const navigate = useNavigate()
  const range = currentMonthRange()

  const [dateFrom,      setDateFrom]      = useState(range.from)
  const [dateTo,        setDateTo]        = useState(range.to)
  const [selectedItem,  setSelectedItem]  = useState('')
  const [category,      setCategory]      = useState('')
  const [typeFilter,    setTypeFilter]    = useState('')
  const [itemSearch,    setItemSearch]    = useState('')

  const [items,         setItems]         = useState([])
  const [categories,    setCategories]    = useState([])
  const [report,        setReport]        = useState(null)
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState('')
  const [loaded,        setLoaded]        = useState(false)
  const [metaLoaded,    setMetaLoaded]    = useState(false)

  const loadMeta = useCallback(async () => {
    if (metaLoaded) return
    try {
      const res = await api.get('/warehouse/items', { params: { active: 'true' } })
      setItems(res.data.data || [])
      setCategories(res.data.categories || [])
      setMetaLoaded(true)
    } catch {}
  }, [metaLoaded])

  // Загружаем метаданные при первом рендере
  useState(() => { loadMeta() })

  const load = async () => {
    setLoading(true); setError('')
    try {
      const res = await api.get('/warehouse/report', {
        params: {
          ...(dateFrom     ? { date_from: dateFrom }     : {}),
          ...(dateTo       ? { date_to:   dateTo   }     : {}),
          ...(selectedItem ? { item_id:   selectedItem } : {}),
          ...(category     ? { category }               : {}),
        }
      })
      setReport(res.data)
      setLoaded(true)
    } catch { setError('Ошибка загрузки отчёта') }
    finally  { setLoading(false) }
  }

  const setQuickPeriod = (from, to) => { setDateFrom(from); setDateTo(to) }

  const filteredRows = (report?.rows || []).filter(r => {
    if (typeFilter && r.type !== typeFilter) return false
    if (itemSearch) {
      const q = itemSearch.toLowerCase()
      return (r.item_name || '').toLowerCase().includes(q)
    }
    return true
  })

  const summary = report?.summary || {}
  const inTotal  = filteredRows.filter(r => r.type === 'in').reduce((s, r) => s + (r.total || 0), 0)
  const outTotal = filteredRows.filter(r => r.type === 'out').reduce((s, r) => s + (r.total || 0), 0)

  return (
    <div style={{ padding:'0 0 32px' }}>
      {/* Шапка */}
      <div className="d-flex align-items-center gap-3 mb-4">
        <CButton color="secondary" variant="ghost" size="sm" onClick={() => navigate('/warehouse')}>
          <CIcon icon={cilArrowLeft} />
        </CButton>
        <h5 className="mb-0 fw-bold">Отчёт по складу</h5>
        {loaded && (
          <CButton size="sm" color="secondary" variant="outline" onClick={() => window.print()} className="ms-auto no-print">
            <CIcon icon={cilPrint} className="me-1" />Печать
          </CButton>
        )}
      </div>

      {error && <CAlert color="danger" dismissible onClose={() => setError('')}>{error}</CAlert>}

      {/* Фильтры */}
      <CCard className="mb-4 no-print">
        <CCardBody>
          <CRow className="g-3 align-items-end">
            <CCol xs={6} md={2}>
              <CFormLabel className="small fw-semibold mb-1">Дата с</CFormLabel>
              <CFormInput type="date" size="sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </CCol>
            <CCol xs={6} md={2}>
              <CFormLabel className="small fw-semibold mb-1">Дата по</CFormLabel>
              <CFormInput type="date" size="sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </CCol>
            <CCol xs={12} md={2}>
              <CFormLabel className="small fw-semibold mb-1">Категория</CFormLabel>
              <CFormSelect size="sm" value={category} onChange={e => { setCategory(e.target.value); setSelectedItem('') }}>
                <option value="">Все категории</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </CFormSelect>
            </CCol>
            <CCol xs={12} md={4}>
              <CFormLabel className="small fw-semibold mb-1">Товар</CFormLabel>
              <CFormSelect size="sm" value={selectedItem} onChange={e => setSelectedItem(e.target.value)}>
                <option value="">Все товары</option>
                {items
                  .filter(it => !category || it.category === category)
                  .map(it => (
                    <option key={it.id} value={it.id}>
                      {it.name}{it.article ? ` (${it.article})` : ''}
                    </option>
                  ))}
              </CFormSelect>
            </CCol>
            <CCol xs={12} md={2}>
              <CButton color="primary" size="sm" className="w-100" onClick={load} disabled={loading}>
                {loading
                  ? <><CSpinner size="sm" className="me-1" />Загрузка...</>
                  : <><CIcon icon={cilFilter} className="me-1" />Показать</>}
              </CButton>
            </CCol>
          </CRow>

          {/* Быстрые периоды */}
          <div className="d-flex gap-2 flex-wrap mt-3 align-items-center">
            <span className="small text-body-secondary">Период:</span>
            {[
              {
                label: 'Сегодня',
                fn: () => { const d = new Date().toISOString().slice(0,10); setQuickPeriod(d, d) }
              },
              {
                label: 'Эта неделя',
                fn: () => {
                  const now = new Date()
                  const mon = new Date(now); mon.setDate(now.getDate() - (now.getDay()||7) + 1)
                  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
                  setQuickPeriod(mon.toISOString().slice(0,10), sun.toISOString().slice(0,10))
                }
              },
              {
                label: 'Этот месяц',
                fn: () => { const r = currentMonthRange(); setQuickPeriod(r.from, r.to) }
              },
              {
                label: 'Прошлый месяц',
                fn: () => {
                  const now = new Date()
                  const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
                  const m = now.getMonth() === 0 ? 12 : now.getMonth()
                  const last = new Date(y, m, 0).getDate()
                  const ms = String(m).padStart(2, '0')
                  setQuickPeriod(`${y}-${ms}-01`, `${y}-${ms}-${last}`)
                }
              },
              {
                label: 'Этот год',
                fn: () => { const y = new Date().getFullYear(); setQuickPeriod(`${y}-01-01`, `${y}-12-31`) }
              },
            ].map(p => (
              <button key={p.label} onClick={p.fn}
                style={{ padding:'2px 10px', border:'1px solid var(--cui-border-color)', borderRadius:12, background:'transparent', fontSize:11, cursor:'pointer', color:'var(--cui-body-color)', transition:'all 0.1s' }}>
                {p.label}
              </button>
            ))}
          </div>
        </CCardBody>
      </CCard>

      {/* Результаты */}
      {loaded && (
        <>
          {/* Итоговые карточки */}
          <CRow className="g-3 mb-4">
            <CCol xs={6} md={3}>
              <div className="p-3 rounded" style={{ background:'#e8f5e9', border:'1px solid #a5d6a7' }}>
                <div className="small text-body-secondary mb-1">Приходов (строк)</div>
                <div className="fw-bold fs-5" style={{ color:'#388e3c' }}>{summary.rows_in || 0}</div>
                <div className="small fw-semibold" style={{ color:'#388e3c' }}>+{fmt(summary.total_in)} сом.</div>
              </div>
            </CCol>
            <CCol xs={6} md={3}>
              <div className="p-3 rounded" style={{ background:'#ffebee', border:'1px solid #ef9a9a' }}>
                <div className="small text-body-secondary mb-1">Расходов (строк)</div>
                <div className="fw-bold fs-5" style={{ color:'#f44336' }}>{summary.rows_out || 0}</div>
                <div className="small fw-semibold" style={{ color:'#f44336' }}>−{fmt(summary.total_out)} сом.</div>
              </div>
            </CCol>
            <CCol xs={6} md={3}>
              <div className="p-3 rounded" style={{ background:'var(--cui-secondary-bg)', border:'1px solid var(--cui-border-color)' }}>
                <div className="small text-body-secondary mb-1">Период</div>
                <div className="fw-semibold" style={{ fontSize:12 }}>{fmtDate(dateFrom)} — {fmtDate(dateTo)}</div>
              </div>
            </CCol>
            <CCol xs={6} md={3}>
              <div className="p-3 rounded" style={{ background: (inTotal - outTotal) >= 0 ? '#e8f5e9' : '#ffebee', border:`1px solid ${(inTotal-outTotal)>=0?'#a5d6a7':'#ef9a9a'}` }}>
                <div className="small text-body-secondary mb-1">Баланс периода</div>
                <div className="fw-bold fs-5" style={{ color:(inTotal-outTotal)>=0?'#388e3c':'#f44336' }}>
                  {(inTotal-outTotal)>=0?'+':''}{fmt(inTotal-outTotal)} сом.
                </div>
              </div>
            </CCol>
          </CRow>

          {/* Фильтр строк */}
          <div className="d-flex gap-2 align-items-center flex-wrap mb-3 no-print">
            <div className="d-flex gap-1">
              {[
                { value:'',    label:'Все',      color:'#607d8b' },
                { value:'in',  label:'↓ Приходы', color:'#388e3c' },
                { value:'out', label:'↑ Расходы', color:'#f44336' },
              ].map(t => {
                const isActive = typeFilter === t.value
                return (
                  <button key={t.value} onClick={() => setTypeFilter(t.value)}
                    style={{ padding:'4px 12px', border:`2px solid ${t.color}`, borderRadius:20, background:isActive?t.color:'transparent', color:isActive?'#fff':t.color, fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.15s' }}>
                    {t.label}
                  </button>
                )
              })}
            </div>
            <div style={{ maxWidth:220 }}>
              <CFormInput size="sm" placeholder="Поиск по товару..." value={itemSearch}
                onChange={e => setItemSearch(e.target.value)} />
            </div>
            <div className="small text-body-secondary ms-auto">
              Показано: <strong>{filteredRows.length}</strong> строк
            </div>
          </div>

          {/* Таблица */}
          {filteredRows.length === 0 ? (
            <div className="text-center text-body-secondary py-5">
              <div style={{ fontSize:32, marginBottom:8 }}>📭</div>
              Нет данных за выбранный период
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ borderBottom:'2px solid var(--cui-border-color)' }}>
                    {[
                      { label:'Дата',       w:90  },
                      { label:'Тип',        w:90  },
                      { label:'Товар',      w:null },
                      { label:'Категория',  w:100 },
                      { label:'Кол-во',     w:80  },
                      { label:'Ед.',        w:50  },
                      { label:'Цена',       w:90  },
                      { label:'Сумма',      w:110 },
                      { label:'Накладная',  w:130 },
                      { label:'Поставщик',  w:130 },
                      { label:'Заказ',      w:100 },
                      { label:'Примечание', w:120 },
                    ].map(h => (
                      <th key={h.label} style={{ padding:'8px 10px', fontWeight:700, fontSize:11, textAlign:'left', whiteSpace:'nowrap', color:'var(--cui-secondary-color)', background:'var(--cui-secondary-bg)', width:h.w||'auto' }}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, idx) => {
                    const isIn = row.type === 'in'
                    return (
                      <tr key={idx} style={{ background: idx%2===0 ? 'var(--cui-card-bg)' : 'var(--cui-secondary-bg)', borderBottom:'1px solid var(--cui-border-color)' }}>
                        {/* Дата */}
                        <td style={{ padding:'7px 10px', whiteSpace:'nowrap', fontWeight:600, color:'var(--cui-secondary-color)', fontSize:11 }}>
                          {fmtDate(row.date)}
                        </td>
                        {/* Тип */}
                        <td style={{ padding:'7px 10px' }}>
                          <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:700, background:TYPE_BG[row.type], color:TYPE_COLOR[row.type] }}>
                            {isIn ? '↓ Приход' : '↑ Расход'}
                          </span>
                        </td>
                        {/* Товар */}
                        <td style={{ padding:'7px 10px', fontWeight:600 }}>
                          <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:200 }}>
                            {row.item_name}
                          </div>
                        </td>
                        {/* Категория */}
                        <td style={{ padding:'7px 10px', color:'var(--cui-secondary-color)', fontSize:11 }}>
                          {row.category || '—'}
                        </td>
                        {/* Кол-во */}
                        <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:700, color:TYPE_COLOR[row.type] }}>
                          {isIn ? '+' : '−'}{fmt(row.quantity)}
                        </td>
                        {/* Ед. */}
                        <td style={{ padding:'7px 10px', color:'var(--cui-secondary-color)', fontSize:11 }}>
                          {row.unit || '—'}
                        </td>
                        {/* Цена */}
                        <td style={{ padding:'7px 10px', textAlign:'right', color:'var(--cui-secondary-color)' }}>
                          {row.price > 0 ? `${fmt(row.price)} сом.` : '—'}
                        </td>
                        {/* Сумма */}
                        <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:700, color:TYPE_COLOR[row.type] }}>
                          {isIn ? '+' : '−'}{fmt(row.total)} сом.
                        </td>
                        {/* Накладная */}
                        <td style={{ padding:'7px 10px' }}>
                          {isIn && row.receipt_number
                            ? <span style={{ fontWeight:600, fontSize:11 }}>📋 {row.receipt_number}</span>
                            : <span style={{ color:'#ccc' }}>—</span>}
                        </td>
                        {/* Поставщик */}
                        <td style={{ padding:'7px 10px' }}>
                          {isIn && row.supplier_name
                            ? <span style={{ fontSize:11, color:'var(--cui-secondary-color)' }}>{row.supplier_name}</span>
                            : <span style={{ color:'#ccc' }}>—</span>}
                        </td>
                        {/* Заказ */}
                        <td style={{ padding:'7px 10px' }}>
                          {!isIn && row.order_number ? (
                            <div>
                              <div style={{ fontWeight:600, fontSize:11, color:'#1976d2' }}>📦 {row.order_number}</div>
                              {row.order_title && (
                                <div style={{ color:'var(--cui-secondary-color)', fontSize:10, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:120 }}>{row.order_title}</div>
                              )}
                            </div>
                          ) : <span style={{ color:'#ccc' }}>—</span>}
                        </td>
                        {/* Примечание */}
                        <td style={{ padding:'7px 10px', color:'var(--cui-secondary-color)', fontSize:11 }}>
                          <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:120 }}>
                            {row.notes || '—'}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {/* Итог */}
                <tfoot>
                  <tr style={{ borderTop:'2px solid var(--cui-border-color)', fontWeight:700, background:'var(--cui-secondary-bg)' }}>
                    <td colSpan={4} style={{ padding:'8px 10px', fontSize:12 }}>
                      Итого за период ({filteredRows.length} строк)
                    </td>
                    <td style={{ padding:'8px 10px', textAlign:'right' }}>
                      <div style={{ color:'#388e3c', fontSize:11 }}>+{fmt(filteredRows.filter(r=>r.type==='in').reduce((s,r)=>s+(r.quantity||0),0))}</div>
                      <div style={{ color:'#f44336', fontSize:11 }}>−{fmt(filteredRows.filter(r=>r.type==='out').reduce((s,r)=>s+(r.quantity||0),0))}</div>
                    </td>
                    <td colSpan={2} />
                    <td style={{ padding:'8px 10px', textAlign:'right' }}>
                      <div style={{ color:'#388e3c' }}>+{fmt(inTotal)} сом.</div>
                      <div style={{ color:'#f44336' }}>−{fmt(outTotal)} сом.</div>
                    </td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      {!loaded && !loading && (
        <div className="text-center text-body-secondary py-5">
          <div style={{ fontSize:48, marginBottom:12, opacity:0.4 }}>📊</div>
          <div className="fw-semibold mb-1">Выберите период и нажмите «Показать»</div>
          <div className="small">По умолчанию выбран текущий месяц</div>
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 9pt; }
        }
      `}</style>
    </div>
  )
}