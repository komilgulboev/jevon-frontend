import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { CSpinner, CAlert, CBadge, CFormSelect } from '@coreui/react'
import api from '../../api/client'
import { useAuth } from '../../AuthContext'

// Колонки этапов по типу заказа
const CUTTING_STAGES = ['intake', 'material', 'sawing', 'edging', 'drilling', 'packing', 'shipment']

const STAGE_COL_LABELS = {
  intake:    'Конструкция',
  material:  'Материал',
  sawing:    'Распил',
  edging:    'Кромка',
  drilling:  'Присадка',
  packing:   'Упаковка',
  shipment:  'Отгрузка',
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

const ORDER_TYPE_LABELS = {
  cutting:        'Распил',
  workshop:       'Цех',
  painting:       'Покраска',
  cnc:            'ЧПУ',
  soft_fabric:    'Мягкая ткань',
  soft_furniture: 'Мягкая мебель',
}

export default function Dashboard() {
  const navigate    = useNavigate()
  const { hasRole } = useAuth()
  const canEdit     = hasRole('admin', 'supervisor', 'manager')

  const [orders,  setOrders]  = useState([])
  const [stages,  setStages]  = useState({}) // { order_id: [stages] }
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [updating, setUpdating] = useState({}) // { stage_id: true }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const ordersRes = await api.get('/orders', { params: { limit: 200 } })
      const allOrders = (ordersRes.data.data || []).filter(o => o.status !== 'cancelled')
      setOrders(allOrders)

      // Загружаем этапы для каждого заказа параллельно
      const stagesMap = {}
      await Promise.all(
        allOrders.map(async (order) => {
          try {
            const r = await api.get(`/orders/${order.id}/stages`)
            stagesMap[order.id] = r.data.data || []
          } catch {
            stagesMap[order.id] = []
          }
        })
      )
      setStages(stagesMap)
    } catch {
      setError('Ошибка загрузки данных')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const getStageStatus = (orderId, stageName) => {
    const orderStages = stages[orderId] || []
    const stage = orderStages.find(s => s.stage === stageName)
    return stage || null
  }

  const handleStatusChange = async (orderId, stageId, newStatus) => {
    if (!stageId) return
    setUpdating(prev => ({ ...prev, [stageId]: true }))
    try {
      await api.patch(`/orders/${orderId}/stages/${stageId}`, { status: newStatus })
      // Обновляем локально
      setStages(prev => ({
        ...prev,
        [orderId]: (prev[orderId] || []).map(s =>
          s.id === stageId ? { ...s, status: newStatus } : s
        ),
      }))
    } catch {
      setError('Ошибка обновления статуса')
    } finally {
      setUpdating(prev => ({ ...prev, [stageId]: false }))
    }
  }

  const isDeadlineRed = (deadline) => {
    if (!deadline) return false
    return new Date(deadline) < new Date()
  }

  const isDeadlineYellow = (deadline) => {
    if (!deadline) return false
    const diff = new Date(deadline) - new Date()
    return diff >= 0 && diff < 3 * 24 * 60 * 60 * 1000
  }

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: 300 }}>
      <CSpinner color="primary" />
    </div>
  )

  return (
    <div style={{ padding: '0 0 24px' }}>
      {error && <CAlert color="danger" dismissible onClose={() => setError('')}>{error}</CAlert>}

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0 fw-bold">Производственный дашборд</h5>
        <div className="small text-body-secondary">
          Заказов: <strong>{orders.length}</strong>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 12,
          tableLayout: 'fixed',
          minWidth: 1100,
        }}>
          <colgroup>
            <col style={{ width: 70 }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: 70 }} />
            {CUTTING_STAGES.map(s => (
              <col key={s} style={{ width: `${Math.floor(55 / CUTTING_STAGES.length)}%` }} />
            ))}
            <col style={{ width: 90 }} />
            <col style={{ width: 85 }} />
          </colgroup>

          <thead>
            <tr style={{ background: '#f5a623', color: '#fff' }}>
              <th style={thStyle}>№ заказа</th>
              <th style={thStyle}>Клиент (заказ)</th>
              <th style={thStyle}>Тип</th>
              {CUTTING_STAGES.map(s => (
                <th key={s} style={thStyle}>{STAGE_COL_LABELS[s]}</th>
              ))}
              <th style={thStyle}>Срок</th>
              <th style={thStyle}>Статус оплаты</th>
            </tr>
          </thead>

          <tbody>
            {orders.map((order, idx) => {
              const deadlineRed    = isDeadlineRed(order.deadline)
              const deadlineYellow = !deadlineRed && isDeadlineYellow(order.deadline)
              const rowBg = idx % 2 === 0 ? '#fff' : '#fafafa'

              return (
                <tr key={order.id} style={{ background: rowBg, borderBottom: '1px solid #e0e0e0' }}>
                  {/* № заказа */}
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span
                      onClick={() => navigate(`/orders/${order.id}`)}
                      style={{ cursor: 'pointer', color: '#1976d2', fontWeight: 600, textDecoration: 'underline' }}
                    >
                      {order.order_number ? `03/${String(order.order_number).padStart(3, '0')}` : '—'}
                    </span>
                  </td>

                  {/* Клиент */}
                  <td style={{ ...tdStyle, maxWidth: 0 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {order.client_name || '—'}
                    </div>
                    {order.client_phone && (
                      <div style={{ fontSize: 11, color: '#666' }}>{order.client_phone}</div>
                    )}
                    {order.title && (
                      <div style={{ fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {order.title}
                      </div>
                    )}
                  </td>

                  {/* Тип */}
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{ fontSize: 10, color: '#666' }}>
                      {ORDER_TYPE_LABELS[order.order_type] || order.order_type}
                    </span>
                  </td>

                  {/* Этапы */}
                  {CUTTING_STAGES.map(stageName => {
                    const stageObj = getStageStatus(order.id, stageName)
                    const status   = stageObj?.status || 'pending'
                    const colors   = STATUS_COLORS[status] || STATUS_COLORS.pending
                    const isUpdating = stageObj && updating[stageObj.id]

                    // Если этапа нет у этого заказа — серая ячейка
                    if (!stageObj) {
                      return (
                        <td key={stageName} style={{ ...tdStyle, textAlign: 'center' }}>
                          <span style={{ color: '#ccc', fontSize: 11 }}>—</span>
                        </td>
                      )
                    }

                    return (
                      <td key={stageName} style={{ ...tdStyle, padding: '2px 4px' }}>
                        {canEdit ? (
                          <div style={{ position: 'relative' }}>
                            <select
                              value={status}
                              disabled={isUpdating}
                              onChange={e => handleStatusChange(order.id, stageObj.id, e.target.value)}
                              style={{
                                width: '100%',
                                border: 'none',
                                borderRadius: 4,
                                padding: '3px 4px',
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer',
                                background: colors.bg,
                                color: colors.text,
                                appearance: 'none',
                                WebkitAppearance: 'none',
                                textAlign: 'center',
                                outline: 'none',
                              }}
                            >
                              {STATUS_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            {isUpdating && (
                              <div style={{ position: 'absolute', top: 0, right: 2, bottom: 0, display: 'flex', alignItems: 'center' }}>
                                <CSpinner size="sm" style={{ width: 10, height: 10 }} />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{
                            background: colors.bg, color: colors.text,
                            borderRadius: 4, padding: '3px 6px',
                            textAlign: 'center', fontSize: 11, fontWeight: 600,
                            border: status === 'pending' ? '1px solid #ddd' : 'none',
                          }}>
                            {STATUS_OPTIONS.find(o => o.value === status)?.label || status}
                          </div>
                        )}
                      </td>
                    )
                  })}

                  {/* Срок */}
                  <td style={{
                    ...tdStyle, textAlign: 'center', fontWeight: 600,
                    color: deadlineRed ? '#F44336' : deadlineYellow ? '#FF9800' : '#333',
                    background: deadlineRed ? '#FFEBEE' : deadlineYellow ? '#FFF3E0' : 'transparent',
                  }}>
                    {order.deadline
                      ? new Date(order.deadline).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
                      : '—'}
                  </td>

                  {/* Статус оплаты */}
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {(() => {
                      const pc = PAYMENT_COLORS[order.payment_status] || { bg: '#9E9E9E', text: '#fff' }
                      return (
                        <div style={{
                          background: pc.bg, color: pc.text,
                          borderRadius: 4, padding: '3px 6px',
                          fontSize: 11, fontWeight: 600, textAlign: 'center',
                        }}>
                          {PAYMENT_LABELS[order.payment_status] || order.payment_status}
                        </div>
                      )
                    })()}
                  </td>
                </tr>
              )
            })}

            {orders.length === 0 && (
              <tr>
                <td colSpan={CUTTING_STAGES.length + 5} style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                  Нет заказов
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Легенда */}
      <div className="d-flex gap-3 mt-3 flex-wrap">
        {STATUS_OPTIONS.map(opt => {
          const c = STATUS_COLORS[opt.value]
          return (
            <div key={opt.value} className="d-flex align-items-center gap-1">
              <div style={{ width: 14, height: 14, borderRadius: 3, background: c.bg, border: opt.value === 'pending' ? '1px solid #ddd' : 'none' }} />
              <span style={{ fontSize: 11, color: '#666' }}>{opt.label}</span>
            </div>
          )
        })}
        <div className="d-flex align-items-center gap-1">
          <div style={{ width: 14, height: 14, borderRadius: 3, background: '#FFEBEE' }} />
          <span style={{ fontSize: 11, color: '#666' }}>Просрочен</span>
        </div>
        <div className="d-flex align-items-center gap-1">
          <div style={{ width: 14, height: 14, borderRadius: 3, background: '#FFF3E0' }} />
          <span style={{ fontSize: 11, color: '#666' }}>Срок &lt; 3 дней</span>
        </div>
      </div>
    </div>
  )
}

const thStyle = {
  padding: '10px 6px',
  fontWeight: 800,
  fontSize: 12,
  textAlign: 'center',
  border: '1px solid #c8850a',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  color: '#000',
  letterSpacing: 0.3,
  textTransform: 'uppercase',
  boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.15)',
}

const tdStyle = {
  padding: '5px 6px',
  border: '1px solid #e0e0e0',
  verticalAlign: 'middle',
  fontSize: 12,
}