import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { CSpinner, CAlert, CFormInput, CInputGroup, CInputGroupText } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSearch } from '@coreui/icons'
import api from '../../api/client'
import { formatOrderNumber } from '../../utils/orderNumber'

// ── Константы ────────────────────────────────────────────

const STAGES_BY_SERVICE = {
  main: {
    label: 'Основные этапы', color: '#9c27b0',
    stages: ['intake','measure','design','purchase','production','assembly','delivery','handover'],
  },
  cutting: {
    label: 'Распил', color: '#ff9800',
    stages: ['intake','material','sawing','edging','drilling','packing','shipment'],
  },
  painting: {
    label: 'Покраска', color: '#f44336',
    stages: ['intake','calculate','sanding','priming','painting','delivery'],
  },
  cnc: {
    label: 'ЧПУ', color: '#2196f3',
    stages: ['intake','calculate','cnc_work','delivery'],
  },
  soft: {
    label: 'Мягкая мебель', color: '#009688',
    stages: ['intake','calculate','assign','work','delivery'],
  },
}

const STAGE_LABELS = {
  intake:'Приём заказа', measure:'Замер', design:'Чертёж/Смета',
  purchase:'Закупка', production:'Производство', assembly:'Сборка',
  delivery:'Доставка', handover:'Сдача клиенту',
  material:'Приём материала', sawing:'Распил', edging:'Кромкование',
  drilling:'Присадка', packing:'Упаковка', shipment:'Отгрузка',
  calculate:'Расчёт', sanding:'Шлифовка', priming:'Грунтовка',
  painting:'Покраска', cnc_work:'Фрезеровка',
  assign:'Назначение', work:'Работа',
}

// Этапы для канбана заказов
const WORKSHOP_STAGES = [
  { key:'intake',     label:'Приём заказа',  color:'#607d8b' },
  { key:'measure',    label:'Замер',         color:'#795548' },
  { key:'design',     label:'Чертёж/Смета',  color:'#9c27b0' },
  { key:'purchase',   label:'Закупка',       color:'#ff9800' },
  { key:'production', label:'Производство',  color:'#2196f3' },
  { key:'assembly',   label:'Сборка',        color:'#009688' },
  { key:'delivery',   label:'Доставка',      color:'#f44336' },
  { key:'handover',   label:'Сдача клиенту', color:'#4caf50' },
]

const EXTERNAL_STAGES = [
  { key:'intake',     label:'Приём заказа',  color:'#607d8b' },
  { key:'design',     label:'Чертёж/Смета',  color:'#9c27b0' },
  { key:'production', label:'Производство',  color:'#2196f3' },
  { key:'sawing',     label:'Распил',        color:'#ff9800' },
  { key:'edging',     label:'Кромкование',   color:'#ff5722' },
  { key:'drilling',   label:'Присадка',      color:'#795548' },
  { key:'painting',   label:'Покраска',      color:'#f44336' },
  { key:'packing',    label:'Упаковка',      color:'#009688' },
  { key:'handover',   label:'Сдача клиенту', color:'#4caf50' },
]

const STATUS_OPTIONS = [
  { value:'pending',     label:'Ожидание'   },
  { value:'in_progress', label:'В процессе' },
  { value:'done',        label:'Готово'     },
  { value:'skipped',     label:'Пропущено'  },
]

const STATUS_COLORS = {
  done:        { bg:'#4CAF50', text:'#fff' },
  in_progress: { bg:'#2196F3', text:'#fff' },
  pending:     { bg:'#fff',    text:'#333' },
  skipped:     { bg:'#9E9E9E', text:'#fff' },
}

const PAYMENT_COLORS = {
  unpaid:  { bg:'#F44336', text:'#fff' },
  partial: { bg:'#FF9800', text:'#fff' },
  paid:    { bg:'#4CAF50', text:'#fff' },
}
const PAYMENT_LABELS = { unpaid:'Не оплачен', partial:'Частично', paid:'Оплачен' }

const ORDER_TYPES_FILTER = [
  { value:'',         label:'Все',        color:'#607d8b' },
  { value:'workshop', label:'Заказ цеха', color:'#9c27b0' },
  { value:'external', label:'Вне цеха',   color:'#388e3c' },
]

const TYPE_COLOR = { workshop:'#9c27b0', external:'#388e3c' }
const PAYMENT_STATUS_ORDER = { unpaid:0, partial:1, paid:2 }

const PROJECT_COLUMNS = [
  { key:'new',         label:'Новые',     color:'#607d8b', bg:'#f5f5f5' },
  { key:'in_progress', label:'В работе',  color:'#1976d2', bg:'#e3f2fd' },
  { key:'on_hold',     label:'На паузе',  color:'#f57c00', bg:'#fff3e0' },
  { key:'done',        label:'Завершены', color:'#388e3c', bg:'#e8f5e9' },
]

const ORDER_TYPE_LABELS = {
  workshop:'Цех', external:'Вне цеха',
  cutting:'Распил', painting:'Покраска', cnc:'ЧПУ', soft_fabric:'Мягкая мебель',
}
const ORDER_TYPE_COLORS = {
  workshop:'#9c27b0', external:'#388e3c',
  cutting:'#ff9800', painting:'#f44336', cnc:'#2196f3', soft_fabric:'#009688',
}

// ── Канбан заказов по этапам ──────────────────────────────

function OrderKanban() {
  const navigate  = useNavigate()
  const [orderType, setOrderType] = useState('workshop')
  const [orders,    setOrders]    = useState([])
  const [stages,    setStages]    = useState({})
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [search,    setSearch]    = useState('')
  const [dragging,  setDragging]  = useState(null) // { orderId, fromStage }
  const [dragOver,  setDragOver]  = useState(null)
  const [updating,  setUpdating]  = useState({})

  const columns = orderType === 'workshop' ? WORKSHOP_STAGES : EXTERNAL_STAGES

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await api.get('/orders', { params:{ order_type: orderType, limit:300 } })
      const list = (res.data.data||[]).filter(o =>
        o.status !== 'cancelled' && !o.parent_order_id
      )
      setOrders(list)
      const map = {}
      await Promise.all(list.map(async o => {
        try { const r = await api.get(`/orders/${o.id}/stages`); map[o.id] = r.data.data||[] }
        catch { map[o.id] = [] }
      }))
      setStages(map)
    } catch { setError('Ошибка загрузки') }
    finally  { setLoading(false) }
  }, [orderType])

  useEffect(() => { load() }, [load])

  // Активный этап заказа = первый in_progress или первый pending
  const getActiveStageKey = (orderId) => {
    const list = stages[orderId] || []
    const active = list.find(s => s.status === 'in_progress') || list.find(s => s.status === 'pending')
    return active?.stage || null
  }

  const filtered = orders.filter(o => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      formatOrderNumber(o.order_type, o.order_number).toLowerCase().includes(q) ||
      (o.client_name || '').toLowerCase().includes(q) ||
      (o.title || '').toLowerCase().includes(q)
    )
  })

  const getOrdersForColumn = (colKey) =>
    filtered.filter(o => getActiveStageKey(o.id) === colKey)

  // Drag & Drop
  const handleDragStart = (orderId, fromStage) => {
    setDragging({ orderId, fromStage })
  }
  const handleDragEnd   = () => { setDragging(null); setDragOver(null) }
  const handleDragOver  = (e, colKey) => { e.preventDefault(); setDragOver(colKey) }

  const handleDrop = async (e, toStageKey) => {
    e.preventDefault()
    if (!dragging) return
    const { orderId, fromStage } = dragging
    if (fromStage === toStageKey) { setDragging(null); setDragOver(null); return }

    setUpdating(prev => ({ ...prev, [orderId]: true }))
    try {
      const stageList = stages[orderId] || []
      const colKeys   = columns.map(c => c.key)
      const toIdx     = colKeys.indexOf(toStageKey)

      const updates = stageList.map(s => {
        const sIdx = colKeys.indexOf(s.stage)
        if (sIdx < 0)             return s                            // не в этой схеме
        if (sIdx < toIdx)         return { ...s, status: 'done' }    // позади — done
        if (s.stage === toStageKey) return { ...s, status: 'in_progress' } // цель
        return { ...s, status: 'pending' }                            // впереди — pending
      })

      // Отправляем только изменившиеся
      await Promise.all(
        updates
          .filter((s, i) => s.status !== stageList[i]?.status)
          .map(s => api.patch(`/orders/${orderId}/stages/${s.id}`, { status: s.status }))
      )
      setStages(prev => ({ ...prev, [orderId]: updates }))
    } catch { setError('Ошибка обновления этапа') }
    finally {
      setUpdating(prev => ({ ...prev, [orderId]: false }))
      setDragging(null); setDragOver(null)
    }
  }

  const isRed    = d => d && new Date(d) < new Date()
  const isYellow = d => { if(!d) return false; const diff=new Date(d)-new Date(); return diff>=0&&diff<3*24*60*60*1000 }

  return (
    <div>
      {error && <CAlert color="danger" dismissible onClose={() => setError('')}>{error}</CAlert>}

      {/* Тип заказа + поиск */}
      <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
        <div className="d-flex gap-2">
          {[
            { value:'workshop', label:'🏭 Заказы цеха',    color:'#9c27b0' },
            { value:'external', label:'🏠 Заказы вне цеха', color:'#388e3c' },
          ].map(t => {
            const isActive = orderType === t.value
            return (
              <button key={t.value} onClick={() => setOrderType(t.value)}
                style={{
                  padding:'7px 18px', border:`2px solid ${t.color}`, borderRadius:20,
                  background: isActive ? t.color : 'transparent',
                  color: isActive ? '#fff' : t.color,
                  fontSize:13, fontWeight:700, cursor:'pointer', transition:'all 0.15s',
                }}>
                {t.label}
              </button>
            )
          })}
        </div>
        <div style={{ maxWidth:280, flex:1 }}>
          <CInputGroup size="sm">
            <CInputGroupText style={{ background:'#f8f9fa' }}>
              <CIcon icon={cilSearch} style={{ width:14 }} />
            </CInputGroupText>
            <CFormInput placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && (
              <button onClick={() => setSearch('')}
                style={{ border:'1px solid #ced4da', borderLeft:'none', background:'#f8f9fa', padding:'0 10px', cursor:'pointer', borderRadius:'0 4px 4px 0', color:'#888', fontSize:16 }}>×</button>
            )}
          </CInputGroup>
        </div>
        <div className="small text-body-secondary">
          Всего: <strong>{filtered.length}</strong>
        </div>
      </div>

      {loading ? (
        <div className="d-flex justify-content-center py-5"><CSpinner color="primary" /></div>
      ) : (
        <div style={{ overflowX:'auto', paddingBottom:8 }}>
          <div style={{
            display:'grid',
            gridTemplateColumns: `repeat(${columns.length}, minmax(190px, 1fr))`,
            gap:8, alignItems:'start',
            minWidth: columns.length * 200,
          }}>
            {columns.map(col => {
              const colOrders = getOrdersForColumn(col.key)
              const isOver    = dragOver === col.key

              return (
                <div key={col.key}
                  onDragOver={e => handleDragOver(e, col.key)}
                  onDrop={e => handleDrop(e, col.key)}
                  style={{
                    borderRadius:10,
                    border:`2px solid ${isOver ? col.color : col.color + '45'}`,
                    background: isOver ? col.color + '10' : 'var(--cui-card-bg, #fafafa)',
                    minHeight:100, transition:'all 0.15s',
                  }}>

                  {/* Заголовок колонки */}
                  <div style={{
                    padding:'8px 10px', borderRadius:'8px 8px 0 0',
                    background: col.color + '18',
                    borderBottom:`2px solid ${col.color}30`,
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                  }}>
                    <span style={{ fontWeight:700, fontSize:11, color:col.color, lineHeight:1.3 }}>
                      {col.label}
                    </span>
                    <span style={{
                      background:col.color, color:'#fff',
                      borderRadius:10, padding:'0px 6px',
                      fontSize:11, fontWeight:700,
                    }}>{colOrders.length}</span>
                  </div>

                  {/* Карточки */}
                  <div style={{ padding:'6px 5px 8px', display:'flex', flexDirection:'column', gap:5 }}>
                    {colOrders.map(order => {
                      const stageList  = stages[order.id] || []
                      const doneCount  = stageList.filter(s => s.status === 'done').length
                      const totalCount = stageList.length
                      const progress   = totalCount ? Math.round(doneCount / totalCount * 100) : 0
                      const isDragging = dragging?.orderId === order.id
                      const isUpd      = updating[order.id]
                      const deadlineRed    = isRed(order.deadline)
                      const deadlineYellow = !deadlineRed && isYellow(order.deadline)

                      return (
                        <div key={order.id}
                          draggable
                          onDragStart={() => handleDragStart(order.id, col.key)}
                          onDragEnd={handleDragEnd}
                          style={{
                            background:'var(--cui-card-bg, #fff)',
                            borderRadius:7,
                            border:`1px solid ${isDragging ? col.color : 'var(--cui-border-color, #e8e8e8)'}`,
                            padding:'8px 9px',
                            cursor: isDragging ? 'grabbing' : 'grab',
                            opacity: isDragging ? 0.4 : 1,
                            boxShadow: isDragging ? `0 6px 20px ${col.color}44` : '0 1px 2px rgba(0,0,0,0.05)',
                            transition:'opacity 0.15s',
                            position:'relative',
                          }}>

                          {isUpd && (
                            <div style={{ position:'absolute', top:6, right:6 }}>
                              <CSpinner size="sm" style={{ width:11, height:11 }} />
                            </div>
                          )}

                          {/* Номер заказа — кликабельный */}
                          <div style={{ marginBottom:4 }}>
                            <span
                              onClick={e => { e.stopPropagation(); navigate(`/orders/${order.id}`) }}
                              style={{
                                fontSize:10, fontWeight:700,
                                color:col.color, background:col.color+'18',
                                borderRadius:5, padding:'1px 5px',
                                cursor:'pointer', textDecoration:'none',
                              }}>
                              {formatOrderNumber(order.order_type, order.order_number)}
                            </span>
                          </div>

                          {/* Клиент */}
                          {order.client_name && (
                            <div style={{
                              fontSize:12, fontWeight:600,
                              color:'var(--cui-body-color)',
                              marginBottom:2,
                              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                            }}>
                              {order.client_name}
                            </div>
                          )}

                          {/* Название */}
                          {order.title && (
                            <div style={{
                              fontSize:10, color:'var(--cui-secondary-color, #999)',
                              marginBottom:5,
                              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                            }}>
                              {order.title}
                            </div>
                          )}

                          {/* Прогресс */}
                          {totalCount > 0 && (
                            <div style={{ marginBottom:5 }}>
                              <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#aaa', marginBottom:2 }}>
                                <span>{doneCount}/{totalCount}</span>
                                <span>{progress}%</span>
                              </div>
                              <div style={{ height:3, background:'#ebebeb', borderRadius:2, overflow:'hidden' }}>
                                <div style={{
                                  height:'100%', width:`${progress}%`,
                                  background: progress===100 ? '#4CAF50' : col.color,
                                  borderRadius:2,
                                }} />
                              </div>
                            </div>
                          )}

                          {/* Цепочка этапов */}
                          <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginBottom:5 }}>
                            {stageList
                              .filter(s => columns.some(c => c.key === s.stage))
                              .map(s => {
                                const isDone   = s.status === 'done'
                                const isActive = s.status === 'in_progress'
                                const stageCol = columns.find(c => c.key === s.stage)
                                const icon     = isDone ? '✅' : isActive ? '🔄' : s.status === 'skipped' ? '⏭' : '⏳'
                                return (
                                  <span key={s.id} title={STAGE_LABELS[s.stage] || s.stage}
                                    style={{
                                      fontSize:9, padding:'1px 4px', borderRadius:3,
                                      background: isActive ? (stageCol?.color||col.color)+'22' : isDone ? '#4CAF5010' : 'transparent',
                                      border:`1px solid ${isActive ? (stageCol?.color||col.color) : isDone ? '#4CAF5040' : '#e0e0e0'}`,
                                      color: isDone ? '#4CAF50' : isActive ? (stageCol?.color||col.color) : '#bbb',
                                      fontWeight: isActive ? 700 : 400,
                                      whiteSpace:'nowrap',
                                    }}>
                                    {icon}
                                  </span>
                                )
                              })}
                          </div>

                          {/* Срок + оплата */}
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:3 }}>
                            {order.deadline ? (
                              <span style={{
                                fontSize:9, fontWeight:600,
                                color: deadlineRed ? '#F44336' : deadlineYellow ? '#FF9800' : '#bbb',
                                background: deadlineRed ? '#FFEBEE' : deadlineYellow ? '#FFF3E0' : 'transparent',
                                borderRadius:3, padding:(deadlineRed||deadlineYellow)?'1px 4px':0,
                              }}>
                                📅 {new Date(order.deadline).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'})}
                              </span>
                            ) : <span />}
                            {order.payment_status && (
                              <span style={{
                                fontSize:9, fontWeight:700,
                                color: PAYMENT_COLORS[order.payment_status]?.bg || '#999',
                                background:(PAYMENT_COLORS[order.payment_status]?.bg||'#999')+'20',
                                borderRadius:5, padding:'1px 4px',
                              }}>
                                {PAYMENT_LABELS[order.payment_status]}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}

                    {/* Пустая колонка */}
                    {colOrders.length === 0 && (
                      <div style={{
                        textAlign:'center', padding:'14px 0',
                        color: isOver ? col.color : '#ccc',
                        fontSize:11,
                        border:`2px dashed ${isOver ? col.color : '#e8e8e8'}`,
                        borderRadius:6, transition:'all 0.15s',
                      }}>
                        {isOver ? '📥 Перенести сюда' : 'Нет заказов'}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-2 small text-body-secondary">
        💡 Перетащите карточку в другую колонку чтобы перевести заказ на этот этап
      </div>
    </div>
  )
}

// ── Канбан проектов ───────────────────────────────────────

function ProjectKanban() {
  const navigate = useNavigate()
  const [projects,      setProjects]      = useState([])
  const [projectOrders, setProjectOrders] = useState({})
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [dragging,      setDragging]      = useState(null)
  const [dragOver,      setDragOver]      = useState(null)
  const [updating,      setUpdating]      = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/projects')
      const list = res.data.data || []
      setProjects(list)
      const map = {}
      await Promise.all(list.map(async p => {
        try { const r = await api.get(`/projects/${p.id}/orders`); map[p.id] = r.data.data||[] }
        catch { map[p.id] = [] }
      }))
      setProjectOrders(map)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleDragStart = (id) => setDragging(id)
  const handleDragEnd   = () => { setDragging(null); setDragOver(null) }
  const handleDragOver  = (e, col) => { e.preventDefault(); setDragOver(col) }

  const handleDrop = async (e, newStatus) => {
    e.preventDefault()
    if (!dragging) return
    const project = projects.find(p => p.id === dragging)
    if (!project || project.status === newStatus) { setDragging(null); setDragOver(null); return }
    setUpdating(prev => ({ ...prev, [dragging]: true }))
    try {
      await api.patch(`/projects/${dragging}`, { status: newStatus })
      setProjects(prev => prev.map(p => p.id === dragging ? { ...p, status: newStatus } : p))
    } catch {}
    setUpdating(prev => ({ ...prev, [dragging]: false }))
    setDragging(null); setDragOver(null)
  }

  const filtered = projects.filter(p => {
    if (p.status === 'cancelled') return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (p.title || '').toLowerCase().includes(q) ||
      (p.client_name || '').toLowerCase().includes(q) ||
      String(p.project_number || '').includes(q)
    )
  })

  if (loading) return <div className="d-flex justify-content-center py-5"><CSpinner color="primary" /></div>

  return (
    <div>
      <div className="mb-3" style={{ maxWidth:360 }}>
        <CInputGroup size="sm">
          <CInputGroupText style={{ background:'#f8f9fa' }}><CIcon icon={cilSearch} style={{ width:14 }} /></CInputGroupText>
          <CFormInput placeholder="Поиск по проекту, клиенту..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')} style={{ border:'1px solid #ced4da', borderLeft:'none', background:'#f8f9fa', padding:'0 10px', cursor:'pointer', borderRadius:'0 4px 4px 0', color:'#888', fontSize:16 }}>×</button>}
        </CInputGroup>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, alignItems:'start' }}>
        {PROJECT_COLUMNS.map(col => {
          const colProjects = filtered.filter(p => p.status === col.key)
          const isOver = dragOver === col.key
          return (
            <div key={col.key}
              onDragOver={e => handleDragOver(e, col.key)}
              onDrop={e => handleDrop(e, col.key)}
              style={{ borderRadius:10, border:`2px solid ${isOver ? col.color : col.color+'40'}`, background: isOver ? col.color+'18' : col.bg, minHeight:200, transition:'all 0.15s' }}>
              <div style={{ padding:'10px 14px 8px', borderBottom:`2px solid ${col.color}30`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontWeight:700, fontSize:13, color:col.color }}>{col.label}</span>
                <span style={{ background:col.color, color:'#fff', borderRadius:12, padding:'1px 8px', fontSize:11, fontWeight:700 }}>{colProjects.length}</span>
              </div>
              <div style={{ padding:'8px 8px 12px', display:'flex', flexDirection:'column', gap:8 }}>
                {colProjects.map(project => {
                  const orders     = projectOrders[project.id] || []
                  const doneOrders = orders.filter(o => o.status === 'done').length
                  const progress   = orders.length ? Math.round(doneOrders / orders.length * 100) : 0
                  const isDragging = dragging === project.id
                  const isUpd      = updating[project.id]
                  const isOverdue  = project.deadline && new Date(project.deadline) < new Date()
                  return (
                    <div key={project.id}
                      draggable onDragStart={() => handleDragStart(project.id)} onDragEnd={handleDragEnd}
                      onClick={() => navigate(`/projects/${project.id}`)}
                      style={{ background:'#fff', borderRadius:8, border:`1px solid ${isDragging?col.color:'#e0e0e0'}`, padding:'10px 12px', cursor:isDragging?'grabbing':'pointer', opacity:isDragging?0.5:1, boxShadow:isDragging?`0 4px 16px ${col.color}44`:'0 1px 3px rgba(0,0,0,0.06)', transition:'all 0.15s', position:'relative' }}>
                      {isUpd && <div style={{ position:'absolute', top:8, right:8 }}><CSpinner size="sm" style={{ width:12, height:12 }} /></div>}
                      <div style={{ display:'flex', alignItems:'flex-start', gap:6, marginBottom:6 }}>
                        <span style={{ fontSize:10, fontWeight:700, color:col.color, background:col.color+'18', borderRadius:6, padding:'1px 6px', flexShrink:0, lineHeight:1.6 }}>П-{project.project_number}</span>
                        <span style={{ fontSize:12, fontWeight:600, lineHeight:1.3 }}>{project.title}</span>
                      </div>
                      {project.client_name && <div style={{ fontSize:11, color:'#666', marginBottom:6 }}>👤 {project.client_name}</div>}
                      {orders.length > 0 && (
                        <div style={{ marginBottom:6 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#888', marginBottom:3 }}>
                            <span>Заказы: {doneOrders}/{orders.length}</span><span>{progress}%</span>
                          </div>
                          <div style={{ height:4, background:'#e0e0e0', borderRadius:2, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${progress}%`, background:progress===100?'#4CAF50':col.color, transition:'width 0.3s' }} />
                          </div>
                        </div>
                      )}
                      {orders.length > 0 && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:6 }}>
                          {[...new Set(orders.map(o => o.order_type))].map(type => (
                            <span key={type} style={{ fontSize:9, fontWeight:600, color:ORDER_TYPE_COLORS[type]||'#607d8b', background:(ORDER_TYPE_COLORS[type]||'#607d8b')+'18', borderRadius:4, padding:'1px 5px' }}>{ORDER_TYPE_LABELS[type]||type}</span>
                          ))}
                        </div>
                      )}
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        {project.deadline ? (
                          <span style={{ fontSize:10, fontWeight:600, color:isOverdue?'#F44336':'#888', background:isOverdue?'#FFEBEE':'transparent', borderRadius:4, padding:isOverdue?'1px 5px':0 }}>
                            📅 {new Date(project.deadline).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'2-digit'})}
                          </span>
                        ) : <span />}
                        {project.priority && project.priority !== 'medium' && (
                          <span style={{ fontSize:9, fontWeight:700, color:project.priority==='urgent'?'#F44336':project.priority==='high'?'#FF9800':'#4CAF50' }}>
                            {project.priority==='urgent'?'🔴':project.priority==='high'?'🟠':'🟢'}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
                {colProjects.length === 0 && (
                  <div style={{ textAlign:'center', padding:'20px 0', color:'#bbb', fontSize:12 }}>Нет проектов</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Производственный дашборд ──────────────────────────────

function ProductionDashboard() {
  const navigate = useNavigate()
  const [orders,      setOrders]      = useState([])
  const [stages,      setStages]      = useState({})
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [updating,    setUpdating]    = useState({})
  const [search,      setSearch]      = useState('')
  const [filterType,  setFilterType]  = useState('')
  const [serviceView, setServiceView] = useState('main')
  const [sortField,   setSortField]   = useState('order_number')
  const [sortDir,     setSortDir]     = useState('desc')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/orders', { params:{ limit:200 } })
      const all = (res.data.data||[]).filter(o => o.status !== 'cancelled')
      setOrders(all)
      const map = {}
      await Promise.all(all.map(async o => {
        try { const r = await api.get(`/orders/${o.id}/stages`); map[o.id] = r.data.data||[] }
        catch { map[o.id] = [] }
      }))
      setStages(map)
    } catch { setError('Ошибка загрузки') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleSort = field => {
    if (sortField === field) setSortDir(d => d==='asc'?'desc':'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const sorted = [...orders].sort((a,b) => {
    let va, vb
    switch(sortField) {
      case 'order_number':   va=a.order_number||0;                      vb=b.order_number||0;                      break
      case 'client_name':    va=(a.client_name||'').toLowerCase();      vb=(b.client_name||'').toLowerCase();      break
      case 'order_type':     va=a.order_type||'';                       vb=b.order_type||'';                       break
      case 'deadline':       va=a.deadline||'9999';                     vb=b.deadline||'9999';                     break
      case 'payment_status': va=PAYMENT_STATUS_ORDER[a.payment_status]??99; vb=PAYMENT_STATUS_ORDER[b.payment_status]??99; break
      default:               va=a[sortField]||'';                       vb=b[sortField]||''
    }
    if(va<vb) return sortDir==='asc'?-1:1
    if(va>vb) return sortDir==='asc'?1:-1
    return 0
  })

  const filtered = sorted.filter(o => {
    if (filterType && o.order_type !== filterType) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        formatOrderNumber(o.order_type, o.order_number).toLowerCase().includes(q) ||
        (o.client_name||'').toLowerCase().includes(q) ||
        (o.title||'').toLowerCase().includes(q)
      )
    }
    return true
  })

  const activeStages = STAGES_BY_SERVICE[serviceView]?.stages || STAGES_BY_SERVICE.main.stages
  const getStageStatus = (orderId, stageName) => (stages[orderId]||[]).find(s=>s.stage===stageName)||null

  const handleStatusChange = async (orderId, stageId, newStatus) => {
    if (!stageId) return
    setUpdating(prev=>({...prev,[stageId]:true}))
    try {
      await api.patch(`/orders/${orderId}/stages/${stageId}`, { status:newStatus })
      setStages(prev=>({...prev,[orderId]:(prev[orderId]||[]).map(s=>s.id===stageId?{...s,status:newStatus}:s)}))
    } catch { setError('Ошибка обновления') }
    finally { setUpdating(prev=>({...prev,[stageId]:false})) }
  }

  const isRed    = d => d && new Date(d) < new Date()
  const isYellow = d => { if(!d) return false; const diff=new Date(d)-new Date(); return diff>=0&&diff<3*24*60*60*1000 }
  const SortIcon = ({field}) => sortField!==field
    ? <span style={{opacity:0.3,fontSize:9}}> ↕</span>
    : <span style={{fontSize:9}}>{sortDir==='asc'?' ↑':' ↓'}</span>
  const svcDef = STAGES_BY_SERVICE[serviceView]

  if (loading) return <div className="d-flex justify-content-center" style={{minHeight:300}}><CSpinner color="primary" /></div>

  return (
    <div>
      {error && <CAlert color="danger" dismissible onClose={()=>setError('')}>{error}</CAlert>}
      <div className="mb-3">
        <div className="d-flex justify-content-end mb-2">
          <div className="small text-body-secondary">Показано: <strong>{filtered.length}</strong> из <strong>{orders.length}</strong></div>
        </div>
        <div className="mb-2" style={{maxWidth:360}}>
          <CInputGroup size="sm">
            <CInputGroupText style={{background:'#f8f9fa'}}><CIcon icon={cilSearch} style={{width:14}}/></CInputGroupText>
            <CFormInput placeholder="Поиск..." value={search} onChange={e=>setSearch(e.target.value)}/>
            {search && <button onClick={()=>setSearch('')} style={{border:'1px solid #ced4da',borderLeft:'none',background:'#f8f9fa',padding:'0 10px',cursor:'pointer',borderRadius:'0 4px 4px 0',color:'#888',fontSize:16}}>×</button>}
          </CInputGroup>
        </div>
        <div className="d-flex gap-1 flex-wrap mb-2">
          {ORDER_TYPES_FILTER.map(type => {
            const isActive = filterType===type.value
            const count = type.value ? orders.filter(o=>o.order_type===type.value).length : orders.length
            return (
              <button key={type.value} onClick={()=>setFilterType(type.value)}
                style={{padding:'4px 12px',border:`2px solid ${type.color}`,borderRadius:20,background:isActive?type.color:'transparent',color:isActive?'#fff':type.color,fontSize:12,fontWeight:600,cursor:'pointer',transition:'all 0.15s',whiteSpace:'nowrap'}}>
                {type.label} <span style={{marginLeft:5,background:isActive?'rgba(255,255,255,0.3)':type.color+'22',borderRadius:10,padding:'1px 6px',fontSize:11}}>{count}</span>
              </button>
            )
          })}
        </div>
        <div className="d-flex gap-1 flex-wrap align-items-center">
          <span style={{fontSize:11,color:'#888',marginRight:4}}>Этапы:</span>
          {Object.entries(STAGES_BY_SERVICE).map(([key,svc]) => {
            const isActive = serviceView===key
            return (
              <button key={key} onClick={()=>setServiceView(key)}
                style={{padding:'3px 10px',border:`2px solid ${svc.color}`,borderRadius:20,background:isActive?svc.color:'transparent',color:isActive?'#fff':svc.color,fontSize:11,fontWeight:600,cursor:'pointer',transition:'all 0.15s',whiteSpace:'nowrap'}}>
                {svc.label}
              </button>
            )
          })}
        </div>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,tableLayout:'fixed',minWidth:900}}>
          <colgroup>
            <col style={{width:80}}/><col style={{width:'15%'}}/><col style={{width:70}}/>
            {activeStages.map(s=><col key={s} style={{width:`${Math.floor(48/activeStages.length)}%`}}/>)}
            <col style={{width:80}}/><col style={{width:80}}/>
          </colgroup>
          <thead>
            <tr style={{background:'#f5a623',color:'#000',borderBottom:`3px solid ${svcDef?.color||'#c8850a'}`}}>
              <th style={{...thStyle,cursor:'pointer'}} onClick={()=>handleSort('order_number')}>№<SortIcon field="order_number"/></th>
              <th style={{...thStyle,cursor:'pointer'}} onClick={()=>handleSort('client_name')}>Клиент<SortIcon field="client_name"/></th>
              <th style={{...thStyle,cursor:'pointer'}} onClick={()=>handleSort('order_type')}>Тип<SortIcon field="order_type"/></th>
              {activeStages.map(s=><th key={s} style={{...thStyle,background:svcDef?.color||'#f5a623',borderColor:svcDef?.color||'#c8850a'}}>{STAGE_LABELS[s]?.substring(0,8)||s}</th>)}
              <th style={{...thStyle,cursor:'pointer'}} onClick={()=>handleSort('deadline')}>Срок<SortIcon field="deadline"/></th>
              <th style={{...thStyle,cursor:'pointer'}} onClick={()=>handleSort('payment_status')}>Оплата<SortIcon field="payment_status"/></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order,idx)=>{
              const dRed    = isRed(order.deadline)
              const dYellow = !dRed && isYellow(order.deadline)
              const rowBg   = idx%2===0?'#fff':'#fafafa'
              const tColor  = TYPE_COLOR[order.order_type]||'#607d8b'
              const tLabel  = ORDER_TYPES_FILTER.find(t=>t.value===order.order_type)?.label||order.order_type
              return (
                <tr key={order.id} style={{background:rowBg,borderBottom:'1px solid #e0e0e0'}}>
                  <td style={{...tdStyle,textAlign:'center'}}>
                    <span onClick={()=>navigate(`/orders/${order.id}`)} style={{cursor:'pointer',color:'#1976d2',fontWeight:600,textDecoration:'underline'}}>
                      {order.order_number?formatOrderNumber(order.order_type,order.order_number):'—'}
                    </span>
                  </td>
                  <td style={{...tdStyle,maxWidth:0}}>
                    <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:600}}>{order.client_name||'—'}</div>
                    {order.title&&<div style={{fontSize:11,color:'#888',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{order.title}</div>}
                  </td>
                  <td style={{...tdStyle,textAlign:'center'}}>
                    <span style={{fontSize:10,fontWeight:600,color:tColor,background:tColor+'18',borderRadius:10,padding:'2px 6px',display:'inline-block',lineHeight:1.4}}>{tLabel}</span>
                  </td>
                  {activeStages.map(stageName=>{
                    const stageObj = getStageStatus(order.id,stageName)
                    const status   = stageObj?.status||'pending'
                    const colors   = STATUS_COLORS[status]||STATUS_COLORS.pending
                    const isUpd    = stageObj&&updating[stageObj.id]
                    if(!stageObj) return <td key={stageName} style={{...tdStyle,textAlign:'center'}}><span style={{color:'#ccc',fontSize:11}}>—</span></td>
                    return (
                      <td key={stageName} style={{...tdStyle,padding:'2px 4px'}}>
                        <div style={{position:'relative'}}>
                          <select value={status} disabled={isUpd}
                            onChange={e=>handleStatusChange(order.id,stageObj.id,e.target.value)}
                            style={{width:'100%',border:'none',borderRadius:4,padding:'3px 4px',fontSize:11,fontWeight:600,cursor:'pointer',background:colors.bg,color:colors.text,appearance:'none',WebkitAppearance:'none',textAlign:'center',outline:'none'}}>
                            {STATUS_OPTIONS.map(opt=><option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                          {isUpd&&<div style={{position:'absolute',top:0,right:2,bottom:0,display:'flex',alignItems:'center'}}><CSpinner size="sm" style={{width:10,height:10}}/></div>}
                        </div>
                      </td>
                    )
                  })}
                  <td style={{...tdStyle,textAlign:'center',fontWeight:600,color:dRed?'#F44336':dYellow?'#FF9800':'#333',background:dRed?'#FFEBEE':dYellow?'#FFF3E0':'transparent'}}>
                    {order.deadline?new Date(order.deadline).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'2-digit'}):'—'}
                  </td>
                  <td style={{...tdStyle,textAlign:'center'}}>
                    {(()=>{const pc=PAYMENT_COLORS[order.payment_status]||{bg:'#9E9E9E',text:'#fff'};return<div style={{background:pc.bg,color:pc.text,borderRadius:4,padding:'3px 6px',fontSize:11,fontWeight:600,textAlign:'center'}}>{PAYMENT_LABELS[order.payment_status]||order.payment_status}</div>})()}
                  </td>
                </tr>
              )
            })}
            {filtered.length===0&&(
              <tr><td colSpan={activeStages.length+5} style={{textAlign:'center',padding:40,color:'#999'}}>{search||filterType?'Ничего не найдено':'Нет заказов'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="d-flex gap-3 mt-3 flex-wrap">
        {STATUS_OPTIONS.map(opt=>{const c=STATUS_COLORS[opt.value];return(
          <div key={opt.value} className="d-flex align-items-center gap-1">
            <div style={{width:14,height:14,borderRadius:3,background:c.bg,border:opt.value==='pending'?'1px solid #ddd':'none'}}/>
            <span style={{fontSize:11,color:'#666'}}>{opt.label}</span>
          </div>
        )})}
      </div>
    </div>
  )
}

// ── Главный компонент ─────────────────────────────────────

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('production')

  const TABS = [
    { key:'production', label:'📋 Производство'    },
    { key:'orders',     label:'🔀 Канбан заказов'  },
    { key:'projects',   label:'🗂 Канбан проектов' },
  ]

  return (
    <div style={{ padding:'0 0 24px' }}>
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <h5 className="mb-0 fw-bold">Производственный дашборд</h5>
        <div className="d-flex gap-1 flex-wrap">
          {TABS.map(tab => {
            const isActive = activeTab === tab.key
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                style={{
                  padding:'6px 16px', border:'2px solid #9c27b0', borderRadius:20,
                  background: isActive ? '#9c27b0' : 'transparent',
                  color: isActive ? '#fff' : '#9c27b0',
                  fontSize:13, fontWeight:600, cursor:'pointer',
                  transition:'all 0.15s', whiteSpace:'nowrap',
                }}>
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {activeTab === 'production' && <ProductionDashboard />}
      {activeTab === 'orders'     && <OrderKanban />}
      {activeTab === 'projects'   && <ProjectKanban />}
    </div>
  )
}

const thStyle = {
  padding:'10px 6px', fontWeight:800, fontSize:12, textAlign:'center',
  border:'1px solid #c8850a', whiteSpace:'nowrap', overflow:'hidden',
  textOverflow:'ellipsis', color:'#000', letterSpacing:0.3,
  textTransform:'uppercase', boxShadow:'inset 0 -2px 0 rgba(0,0,0,0.15)',
  background:'#f5a623',
}
const tdStyle = {
  padding:'5px 6px', border:'1px solid #e0e0e0',
  verticalAlign:'middle', fontSize:12,
}