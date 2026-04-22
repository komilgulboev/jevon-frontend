import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { CSpinner, CAlert, CFormInput, CInputGroup, CInputGroupText } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSearch, cilArrowTop, cilArrowBottom } from '@coreui/icons'
import api from '../../api/client'
import { useAuth } from '../../AuthContext'
import { formatOrderNumber } from '../../utils/orderNumber'

// Этапы по группам услуг
const STAGES_BY_SERVICE = {
  main: {
    label: 'Основные этапы',
    color: '#9c27b0',
    stages: ['intake', 'measure', 'design', 'purchase', 'production', 'assembly', 'delivery', 'handover'],
  },
  cutting: {
    label: 'Распил',
    color: '#ff9800',
    stages: ['intake', 'material', 'sawing', 'edging', 'drilling', 'packing', 'shipment'],
  },
  painting: {
    label: 'Покраска',
    color: '#f44336',
    stages: ['intake', 'calculate', 'sanding', 'priming', 'painting', 'delivery'],
  },
  cnc: {
    label: 'ЧПУ',
    color: '#2196f3',
    stages: ['intake', 'calculate', 'cnc_work', 'delivery'],
  },
  soft: {
    label: 'Мягкая мебель',
    color: '#009688',
    stages: ['intake', 'calculate', 'assign', 'work', 'delivery'],
  },
}

const STAGE_COL_LABELS = {
  intake:     'Приём',
  measure:    'Замер',
  design:     'Дизайн',
  purchase:   'Закупка',
  production: 'Производство',
  assembly:   'Сборка',
  delivery:   'Доставка',
  handover:   'Сдача',
  material:   'Материал',
  sawing:     'Распил',
  edging:     'Кромка',
  drilling:   'Присадка',
  packing:    'Упаковка',
  shipment:   'Отгрузка',
  calculate:  'Расчёт',
  sanding:    'Шлифовка',
  priming:    'Грунтовка',
  painting:   'Покраска',
  cnc_work:   'Фрезеровка',
  assign:     'Назначение',
  work:       'Работа',
}

const STATUS_OPTIONS = [
  { value: 'pending',     label: 'Ожидание'   },
  { value: 'in_progress', label: 'В процессе' },
  { value: 'done',        label: 'Готово'     },
  { value: 'skipped',     label: 'Пропущено'  },
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
  { value: '',         label: 'Все',        color: '#607d8b' },
  { value: 'workshop', label: 'Заказ цеха', color: '#9c27b0' },
  { value: 'external', label: 'Вне цеха',   color: '#388e3c' },
]

const TYPE_COLOR = {
  workshop: '#9c27b0',
  external: '#388e3c',
}

const PAYMENT_STATUS_ORDER = { unpaid: 0, partial: 1, paid: 2 }

export default function Dashboard() {
  const navigate = useNavigate()
  const canEdit  = true

  const [orders,       setOrders]       = useState([])
  const [stages,       setStages]       = useState({})
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [updating,     setUpdating]     = useState({})
  const [search,       setSearch]       = useState('')
  const [filterType,   setFilterType]   = useState('')
  const [serviceView,  setServiceView]  = useState('main') // текущая группа этапов
  const [sortField,    setSortField]    = useState('order_number')
  const [sortDir,      setSortDir]      = useState('desc')

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

  // Сортировка
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sortedOrders = [...orders].sort((a, b) => {
    let va, vb
    switch (sortField) {
      case 'order_number':
        va = a.order_number || 0; vb = b.order_number || 0
        break
      case 'client_name':
        va = (a.client_name || '').toLowerCase(); vb = (b.client_name || '').toLowerCase()
        break
      case 'order_type':
        va = a.order_type || ''; vb = b.order_type || ''
        break
      case 'deadline':
        va = a.deadline || '9999'; vb = b.deadline || '9999'
        break
      case 'payment_status':
        va = PAYMENT_STATUS_ORDER[a.payment_status] ?? 99
        vb = PAYMENT_STATUS_ORDER[b.payment_status] ?? 99
        break
      default:
        va = a[sortField] || ''; vb = b[sortField] || ''
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ? 1  : -1
    return 0
  })

  const filteredOrders = sortedOrders.filter(order => {
    if (filterType && order.order_type !== filterType) return false
    if (search) {
      const q = search.toLowerCase()
      const orderNum = order.order_number ? formatOrderNumber(order.order_type, order.order_number) : ''
      return (
        orderNum.toLowerCase().includes(q) ||
        (order.client_name  || '').toLowerCase().includes(q) ||
        (order.client_phone || '').toLowerCase().includes(q) ||
        (order.title        || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const activeStages = STAGES_BY_SERVICE[serviceView]?.stages || STAGES_BY_SERVICE.main.stages

  const getStageStatus = (orderId, stageName) =>
    (stages[orderId] || []).find(s => s.stage === stageName) || null

  const handleStatusChange = async (orderId, stageId, newStatus) => {
    if (!stageId) return
    setUpdating(prev => ({ ...prev, [stageId]: true }))
    try {
      await api.patch(`/orders/${orderId}/stages/${stageId}`, { status: newStatus })
      setStages(prev => ({
        ...prev,
        [orderId]: (prev[orderId] || []).map(s =>
          s.id === stageId ? { ...s, status: newStatus } : s
        ),
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

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span style={{ opacity: 0.3, fontSize: 9 }}> ↕</span>
    return <span style={{ fontSize: 9 }}>{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>
  }

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: 300 }}>
      <CSpinner color="primary" />
    </div>
  )

  const svcDef = STAGES_BY_SERVICE[serviceView]

  return (
    <div style={{ padding: '0 0 24px' }}>
      {error && <CAlert color="danger" dismissible onClose={() => setError('')}>{error}</CAlert>}

      {/* Заголовок */}
      <div className="mb-3">
        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
          <h5 className="mb-0 fw-bold">Производственный дашборд</h5>
          <div className="small text-body-secondary">
            Показано: <strong>{filteredOrders.length}</strong> из <strong>{orders.length}</strong>
          </div>
        </div>

        {/* Поиск */}
        <div className="mb-2" style={{ maxWidth: 360 }}>
          <CInputGroup size="sm">
            <CInputGroupText style={{ background: '#f8f9fa' }}>
              <CIcon icon={cilSearch} style={{ width: 14 }} />
            </CInputGroupText>
            <CFormInput
              placeholder="Поиск по номеру, клиенту, названию..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')}
                style={{ border: '1px solid #ced4da', borderLeft: 'none', background: '#f8f9fa', padding: '0 10px', cursor: 'pointer', borderRadius: '0 4px 4px 0', color: '#888', fontSize: 16 }}>
                ×
              </button>
            )}
          </CInputGroup>
        </div>

        {/* Фильтр по типу заказа */}
        <div className="d-flex gap-1 flex-wrap mb-2">
          {ORDER_TYPES.map(type => {
            const isActive = filterType === type.value
            const count = type.value
              ? orders.filter(o => o.order_type === type.value).length
              : orders.length
            return (
              <button key={type.value} onClick={() => setFilterType(type.value)}
                style={{ padding: '4px 12px', border: `2px solid ${type.color}`, borderRadius: 20, background: isActive ? type.color : 'transparent', color: isActive ? '#fff' : type.color, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                {type.label}
                <span style={{ marginLeft: 5, background: isActive ? 'rgba(255,255,255,0.3)' : type.color + '22', borderRadius: 10, padding: '1px 6px', fontSize: 11 }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Выбор группы этапов */}
        <div className="d-flex gap-1 flex-wrap align-items-center">
          <span style={{ fontSize: 11, color: '#888', marginRight: 4 }}>Этапы:</span>
          {Object.entries(STAGES_BY_SERVICE).map(([key, svc]) => {
            const isActive = serviceView === key
            return (
              <button key={key} onClick={() => setServiceView(key)}
                style={{ padding: '3px 10px', border: `2px solid ${svc.color}`, borderRadius: 20, background: isActive ? svc.color : 'transparent', color: isActive ? '#fff' : svc.color, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                {svc.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Таблица */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed', minWidth: 900 }}>
          <colgroup>
            <col style={{ width: 80 }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: 70 }} />
            {activeStages.map(s => (
              <col key={s} style={{ width: `${Math.floor(48 / activeStages.length)}%` }} />
            ))}
            <col style={{ width: 80 }} />
            <col style={{ width: 80 }} />
          </colgroup>
          <thead>
            <tr style={{ background: '#f5a623', color: '#000', borderBottom: `3px solid ${svcDef?.color || '#c8850a'}` }}>

              {/* Сортируемые заголовки */}
              <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => handleSort('order_number')}>
                № заказа<SortIcon field="order_number" />
              </th>
              <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => handleSort('client_name')}>
                Клиент / Заказ<SortIcon field="client_name" />
              </th>
              <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => handleSort('order_type')}>
                Тип<SortIcon field="order_type" />
              </th>

              {/* Заголовки этапов с цветом группы */}
              {activeStages.map(s => (
                <th key={s} style={{ ...thStyle, background: svcDef?.color || '#f5a623', borderColor: svcDef?.color || '#c8850a' }}>
                  {STAGE_COL_LABELS[s] || s}
                </th>
              ))}

              <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => handleSort('deadline')}>
                Срок<SortIcon field="deadline" />
              </th>
              <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => handleSort('payment_status')}>
                Оплата<SortIcon field="payment_status" />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order, idx) => {
              const deadlineRed    = isDeadlineRed(order.deadline)
              const deadlineYellow = !deadlineRed && isDeadlineYellow(order.deadline)
              const rowBg    = idx % 2 === 0 ? '#fff' : '#fafafa'
              const typeColor = TYPE_COLOR[order.order_type] || '#607d8b'
              const typeLabel = ORDER_TYPES.find(t => t.value === order.order_type)?.label || order.order_type

              return (
                <tr key={order.id} style={{ background: rowBg, borderBottom: '1px solid #e0e0e0' }}>

                  {/* № заказа */}
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span onClick={() => navigate(`/orders/${order.id}`)}
                      style={{ cursor: 'pointer', color: '#1976d2', fontWeight: 600, textDecoration: 'underline' }}>
                      {order.order_number ? formatOrderNumber(order.order_type, order.order_number) : '—'}
                    </span>
                  </td>

                  {/* Клиент / Заказ */}
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

                  {/* Тип заказа */}
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: typeColor, background: typeColor + '18', borderRadius: 10, padding: '2px 6px', display: 'inline-block', lineHeight: 1.4 }}>
                      {typeLabel}
                    </span>
                  </td>

                  {/* Этапы */}
                  {activeStages.map(stageName => {
                    const stageObj = getStageStatus(order.id, stageName)
                    const status   = stageObj?.status || 'pending'
                    const colors   = STATUS_COLORS[status] || STATUS_COLORS.pending
                    const isUpd    = stageObj && updating[stageObj.id]

                    if (!stageObj) return (
                      <td key={stageName} style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{ color: '#ccc', fontSize: 11 }}>—</span>
                      </td>
                    )
                    return (
                      <td key={stageName} style={{ ...tdStyle, padding: '2px 4px' }}>
                        {canEdit ? (
                          <div style={{ position: 'relative' }}>
                            <select
                              value={status}
                              disabled={isUpd}
                              onChange={e => handleStatusChange(order.id, stageObj.id, e.target.value)}
                              style={{ width: '100%', border: 'none', borderRadius: 4, padding: '3px 4px', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: colors.bg, color: colors.text, appearance: 'none', WebkitAppearance: 'none', textAlign: 'center', outline: 'none' }}>
                              {STATUS_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            {isUpd && (
                              <div style={{ position: 'absolute', top: 0, right: 2, bottom: 0, display: 'flex', alignItems: 'center' }}>
                                <CSpinner size="sm" style={{ width: 10, height: 10 }} />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ background: colors.bg, color: colors.text, borderRadius: 4, padding: '3px 6px', textAlign: 'center', fontSize: 11, fontWeight: 600, border: status === 'pending' ? '1px solid #ddd' : 'none' }}>
                            {STATUS_OPTIONS.find(o => o.value === status)?.label || status}
                          </div>
                        )}
                      </td>
                    )
                  })}

                  {/* Срок */}
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, color: deadlineRed ? '#F44336' : deadlineYellow ? '#FF9800' : '#333', background: deadlineRed ? '#FFEBEE' : deadlineYellow ? '#FFF3E0' : 'transparent' }}>
                    {order.deadline
                      ? new Date(order.deadline).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
                      : '—'}
                  </td>

                  {/* Оплата */}
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {(() => {
                      const pc = PAYMENT_COLORS[order.payment_status] || { bg: '#9E9E9E', text: '#fff' }
                      return (
                        <div style={{ background: pc.bg, color: pc.text, borderRadius: 4, padding: '3px 6px', fontSize: 11, fontWeight: 600, textAlign: 'center' }}>
                          {PAYMENT_LABELS[order.payment_status] || order.payment_status}
                        </div>
                      )
                    })()}
                  </td>
                </tr>
              )
            })}
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={activeStages.length + 5} style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                  {search || filterType ? 'Ничего не найдено' : 'Нет заказов'}
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
  padding: '10px 6px', fontWeight: 800, fontSize: 12, textAlign: 'center',
  border: '1px solid #c8850a', whiteSpace: 'nowrap', overflow: 'hidden',
  textOverflow: 'ellipsis', color: '#000', letterSpacing: 0.3,
  textTransform: 'uppercase', boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.15)',
  background: '#f5a623',
}
const tdStyle = {
  padding: '5px 6px', border: '1px solid #e0e0e0',
  verticalAlign: 'middle', fontSize: 12,
}