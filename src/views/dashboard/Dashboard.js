import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { CSpinner, CAlert, CFormInput, CInputGroup, CInputGroupText } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSearch } from '@coreui/icons'
import api from '../../api/client'
import { useAuth } from '../../AuthContext'
import { formatOrderNumber } from '../../utils/orderNumber'

const CUTTING_STAGES = ['intake', 'material', 'sawing', 'edging', 'drilling', 'packing', 'shipment']

const STAGE_COL_LABELS = {
  intake:   'Конструкция',
  material: 'Материал',
  sawing:   'Распил',
  edging:   'Кромка',
  drilling: 'Присадка',
  packing:  'Упаковка',
  shipment: 'Отгрузка',
}

const STATUS_OPTIONS = [
  { value: 'pending',     label: 'Ожидание' },
  { value: 'in_progress', label: 'В процессе' },
  { value: 'done',        label: 'Готово' },
  { value: 'skipped',     label: 'Пропущено' },
]

const STATUS_COLORS = {
  done:        { bg: '#4CAF50', text: '#fff' },
  in_progress: { bg: '#2196F3', text: '#fff' },
  pending:     { bg: '#fff',    text: '#333' },
  skipped:     { bg: '#9E9E9E', text: '#fff' },
}

const PAYMENT_COLORS = {
  unpaid:  { bg: '#F44336', text: '#fff' },
  partial: { bg: '#FF9800', text: '#fff' },
  paid:    { bg: '#4CAF50', text: '#fff' },
}

const PAYMENT_LABELS = {
  unpaid:  'Не оплачен',
  partial: 'Частично',
  paid:    'Оплачен',
}

const ORDER_TYPES = [
  { value: '',               label: 'Все',           color: '#607d8b' },
  { value: 'workshop',       label: 'Цех',           color: '#9c27b0' },
  { value: 'cutting',        label: 'Распил',        color: '#ff9800' },
  { value: 'painting',       label: 'Покраска',      color: '#f44336' },
  { value: 'cnc',            label: 'ЧПУ',           color: '#2196f3' },
  { value: 'soft_furniture', label: 'Мягкая мебель', color: '#009688' },
]

export default function Dashboard() {
  const navigate    = useNavigate()
  const { hasRole } = useAuth()
  const canEdit     = hasRole('admin', 'supervisor', 'manager')

  const [orders,     setOrders]     = useState([])
  const [stages,     setStages]     = useState({})
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [updating,   setUpdating]   = useState({})
  const [search,     setSearch]     = useState('')
  const [filterType, setFilterType] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const ordersRes = await api.get('/orders', { params: { limit: 200 } })
      const allOrders = (ordersRes.data.data || []).filter(o => o.status !== 'cancelled')
      setOrders(allOrders)
      const stagesMap = {}
      await Promise.all(allOrders.map(async (order) => {
        try {
          const r = await api.get(`/orders/${order.id}/stages`)
          stagesMap[order.id] = r.data.data || []
        } catch { stagesMap[order.id] = [] }
      }))
      setStages(stagesMap)
    } catch {
      setError('Ошибка загрузки данных')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filteredOrders = orders.filter(order => {
    if (filterType && order.order_type !== filterType) return false
    if (search) {
      const q = search.toLowerCase()
      const orderNum = order.order_number ? formatOrderNumber(order.order_type, order.order_number) : ''
      return (
        orderNum.toLowerCase().includes(q) ||
        (order.client_name  || '').toLowerCase().includes(q) ||
        (order.client_phone || '').toLowerCase().includes(q) ||
        (order.title        || '').toLowerCase().includes(q) ||
        (ORDER_TYPES.find(t => t.value === order.order_type)?.label || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const getStageStatus = (orderId, stageName) => {
    return (stages[orderId] || []).find(s => s.stage === stageName) || null
  }

  const handleStatusChange = async (orderId, stageId, newStatus) => {
    if (!stageId) return
    setUpdating(prev => ({ ...prev, [stageId]: true }))
    try {
      await api.patch(`/orders/${orderId}/stages/${stageId}`, { status: newStatus })
      setStages(prev => ({
        ...prev,
        [orderId]: (prev[orderId] || []).map(s => s.id === stageId ? { ...s, status: newStatus } : s),
      }))
    } catch { setError('Ошибка обновления статуса') }
    finally { setUpdating(prev => ({ ...prev, [stageId]: false })) }
  }

  const isDeadlineRed    = d => d && new Date(d) < new Date()
  const isDeadlineYellow = d => {
    if (!d) return false
    const diff = new Date(d) - new Date()
    return diff >= 0 && diff < 3 * 24 * 60 * 60 * 1000
  }

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight:300 }}>
      <CSpinner color="primary" />
    </div>
  )

  return (
    <div style={{ padding:'0 0 24px' }}>
      {error && <CAlert color="danger" dismissible onClose={() => setError('')}>{error}</CAlert>}

      <div className="mb-3">
        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
          <h5 className="mb-0 fw-bold">Производственный дашборд</h5>
          <div className="small text-body-secondary">
            Показано: <strong>{filteredOrders.length}</strong> из <strong>{orders.length}</strong>
          </div>
        </div>

        <div className="mb-2" style={{ maxWidth:360 }}>
          <CInputGroup size="sm">
            <CInputGroupText style={{ background:'#f8f9fa' }}>
              <CIcon icon={cilSearch} style={{ width:14 }} />
            </CInputGroupText>
            <CFormInput placeholder="Поиск по номеру, клиенту, названию..."
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && (
              <button onClick={() => setSearch('')}
                style={{ border:'1px solid #ced4da', borderLeft:'none', background:'#f8f9fa', padding:'0 10px', cursor:'pointer', borderRadius:'0 4px 4px 0', color:'#888', fontSize:16 }}>
                ×
              </button>
            )}
          </CInputGroup>
        </div>

        <div className="d-flex gap-1 flex-wrap">
          {ORDER_TYPES.map(type => {
            const isActive = filterType === type.value
            const count = type.value ? orders.filter(o => o.order_type === type.value).length : orders.length
            return (
              <button key={type.value} onClick={() => setFilterType(type.value)}
                style={{ padding:'4px 12px', border:`2px solid ${type.color}`, borderRadius:20, background: isActive ? type.color : 'transparent', color: isActive ? '#fff' : type.color, fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.15s', whiteSpace:'nowrap' }}>
                {type.label}
                <span style={{ marginLeft:5, background: isActive ? 'rgba(255,255,255,0.3)' : type.color+'22', borderRadius:10, padding:'1px 6px', fontSize:11 }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, tableLayout:'fixed', minWidth:1100 }}>
          <colgroup>
            <col style={{ width:80 }} />
            <col style={{ width:'18%' }} />
            <col style={{ width:70 }} />
            {CUTTING_STAGES.map(s => <col key={s} style={{ width:`${Math.floor(55/CUTTING_STAGES.length)}%` }} />)}
            <col style={{ width:90 }} />
            <col style={{ width:85 }} />
          </colgroup>
          <thead>
            <tr style={{ background:'#f5a623', color:'#000', borderBottom:'3px solid #c8850a' }}>
              <th style={thStyle}>№ заказа</th>
              <th style={thStyle}>Клиент (заказ)</th>
              <th style={thStyle}>Тип</th>
              {CUTTING_STAGES.map(s => <th key={s} style={thStyle}>{STAGE_COL_LABELS[s]}</th>)}
              <th style={thStyle}>Срок</th>
              <th style={thStyle}>Статус оплаты</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order, idx) => {
              const deadlineRed    = isDeadlineRed(order.deadline)
              const deadlineYellow = !deadlineRed && isDeadlineYellow(order.deadline)
              const rowBg = idx % 2 === 0 ? '#fff' : '#fafafa'
              return (
                <tr key={order.id} style={{ background:rowBg, borderBottom:'1px solid #e0e0e0' }}>
                  <td style={{ ...tdStyle, textAlign:'center' }}>
                    <span onClick={() => navigate(`/orders/${order.id}`)}
                      style={{ cursor:'pointer', color:'#1976d2', fontWeight:600, textDecoration:'underline' }}>
                      {order.order_number ? formatOrderNumber(order.order_type, order.order_number) : '—'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, maxWidth:0 }}>
                    <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:600 }}>
                      {order.client_name || '—'}
                    </div>
                    {order.client_phone && <div style={{ fontSize:11, color:'#666' }}>{order.client_phone}</div>}
                    {order.title && <div style={{ fontSize:11, color:'#888', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{order.title}</div>}
                  </td>
                  <td style={{ ...tdStyle, textAlign:'center' }}>
                    {(() => {
                      const t = ORDER_TYPES.find(t => t.value === order.order_type)
                      return <span style={{ fontSize:10, fontWeight:600, color:t?.color||'#666', background:(t?.color||'#666')+'18', borderRadius:10, padding:'2px 6px' }}>{t?.label||order.order_type}</span>
                    })()}
                  </td>
                  {CUTTING_STAGES.map(stageName => {
                    const stageObj   = getStageStatus(order.id, stageName)
                    const status     = stageObj?.status || 'pending'
                    const colors     = STATUS_COLORS[status] || STATUS_COLORS.pending
                    const isUpdating = stageObj && updating[stageObj.id]
                    if (!stageObj) return <td key={stageName} style={{ ...tdStyle, textAlign:'center' }}><span style={{ color:'#ccc', fontSize:11 }}>—</span></td>
                    return (
                      <td key={stageName} style={{ ...tdStyle, padding:'2px 4px' }}>
                        {canEdit ? (
                          <div style={{ position:'relative' }}>
                            <select value={status} disabled={isUpdating}
                              onChange={e => handleStatusChange(order.id, stageObj.id, e.target.value)}
                              style={{ width:'100%', border:'none', borderRadius:4, padding:'3px 4px', fontSize:11, fontWeight:600, cursor:'pointer', background:colors.bg, color:colors.text, appearance:'none', WebkitAppearance:'none', textAlign:'center', outline:'none' }}>
                              {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                            {isUpdating && <div style={{ position:'absolute', top:0, right:2, bottom:0, display:'flex', alignItems:'center' }}><CSpinner size="sm" style={{ width:10, height:10 }} /></div>}
                          </div>
                        ) : (
                          <div style={{ background:colors.bg, color:colors.text, borderRadius:4, padding:'3px 6px', textAlign:'center', fontSize:11, fontWeight:600, border:status==='pending'?'1px solid #ddd':'none' }}>
                            {STATUS_OPTIONS.find(o => o.value === status)?.label || status}
                          </div>
                        )}
                      </td>
                    )
                  })}
                  <td style={{ ...tdStyle, textAlign:'center', fontWeight:600, color:deadlineRed?'#F44336':deadlineYellow?'#FF9800':'#333', background:deadlineRed?'#FFEBEE':deadlineYellow?'#FFF3E0':'transparent' }}>
                    {order.deadline ? new Date(order.deadline).toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'2-digit' }) : '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign:'center' }}>
                    {(() => {
                      const pc = PAYMENT_COLORS[order.payment_status] || { bg:'#9E9E9E', text:'#fff' }
                      return <div style={{ background:pc.bg, color:pc.text, borderRadius:4, padding:'3px 6px', fontSize:11, fontWeight:600, textAlign:'center' }}>{PAYMENT_LABELS[order.payment_status]||order.payment_status}</div>
                    })()}
                  </td>
                </tr>
              )
            })}
            {filteredOrders.length === 0 && (
              <tr><td colSpan={CUTTING_STAGES.length+5} style={{ textAlign:'center', padding:40, color:'#999' }}>
                {search || filterType ? 'Ничего не найдено' : 'Нет заказов'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="d-flex gap-3 mt-3 flex-wrap">
        {STATUS_OPTIONS.map(opt => {
          const c = STATUS_COLORS[opt.value]
          return (
            <div key={opt.value} className="d-flex align-items-center gap-1">
              <div style={{ width:14, height:14, borderRadius:3, background:c.bg, border:opt.value==='pending'?'1px solid #ddd':'none' }} />
              <span style={{ fontSize:11, color:'#666' }}>{opt.label}</span>
            </div>
          )
        })}
        <div className="d-flex align-items-center gap-1">
          <div style={{ width:14, height:14, borderRadius:3, background:'#FFEBEE' }} />
          <span style={{ fontSize:11, color:'#666' }}>Просрочен</span>
        </div>
        <div className="d-flex align-items-center gap-1">
          <div style={{ width:14, height:14, borderRadius:3, background:'#FFF3E0' }} />
          <span style={{ fontSize:11, color:'#666' }}>Срок &lt; 3 дней</span>
        </div>
      </div>
    </div>
  )
}

const thStyle = { padding:'10px 6px', fontWeight:800, fontSize:12, textAlign:'center', border:'1px solid #c8850a', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color:'#000', letterSpacing:0.3, textTransform:'uppercase', boxShadow:'inset 0 -2px 0 rgba(0,0,0,0.15)' }
const tdStyle = { padding:'5px 6px', border:'1px solid #e0e0e0', verticalAlign:'middle', fontSize:12 }