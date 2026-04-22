import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CRow, CCol, CCard, CCardBody, CCardHeader,
  CBadge, CButton, CSpinner, CAlert,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CForm, CFormInput, CFormLabel, CFormSelect, CFormTextarea,
  CTable, CTableHead, CTableBody, CTableRow,
  CTableHeaderCell, CTableDataCell,
  CNav, CNavItem, CNavLink,
  CProgress, CInputGroup, CInputGroupText,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilArrowLeft, cilHistory,
  cilMoney, cilFile, cilTask, cilCommentSquare,
  cilCalculator, cilPencil, cilPlus, cilLocationPin, cilPeople,
  cilExternalLink, cilSearch,
} from '@coreui/icons'
import api from '../../api/client'
import { useAuth } from '../../AuthContext'
import FileUploader, { FileGallery } from '../../components/FileUploader'
import MaterialsTable from '../../components/MaterialsTable'
import DetailEstimateTable from '../../components/DetailEstimateTable'
import ExpensesTable from '../../components/ExpensesTable'
import OrderProjectLink from '../../components/OrderProjectLink'
import EstimateSectionStages from '../../components/EstimateSectionStages'
import { getOrderStageAssignees, syncOrderStageAssignees } from '../../api/expenses'
import { formatOrderNumber } from '../../utils/orderNumber'
import { ORDER_TABS_ROLES } from '../../config/roles'

const ORDER_TYPE_COLOR = {
  workshop:       'primary',
  external:       'success',
  cutting:        'warning',
  sawing:         'warning',
  cnc:            'info',
  painting:       'danger',
  soft_fabric:    'success',
  soft_furniture: 'success',
}

const ORDER_TYPE_LABELS = {
  workshop:       'Заказ цеха',
  external:       'Заказ вне цеха',
  cutting:        'Распил',
  sawing:         'Распил',
  cnc:            'ЧПУ',
  painting:       'Покраска',
  soft_fabric:    'Мягкая мебель',
  soft_furniture: 'Мягкая мебель',
}

const STATUS_COLOR  = { pending:'secondary', in_progress:'primary', done:'success', skipped:'light', new:'info' }
const PAYMENT_COLOR = { unpaid:'danger', partial:'warning', paid:'success', refund:'secondary' }

const ROLE_LABEL = {
  admin:'Администратор', supervisor:'Руководитель', master:'Мастер',
  manager:'Менеджер', designer:'Дизайнер', cutter:'Раскройщик',
  warehouse:'Складовщик', driver:'Водитель', assembler:'Сборщик', assistant:'Ассистент',
}

export default function OrderDetail() {
  const { t }       = useTranslation()
  const { id }      = useParams()
  const navigate    = useNavigate()
  const { hasRole } = useAuth()

  const STAGE_LABELS = {
    intake:     'Приём заказа',
    measure:    'Замер',
    design:     'Дизайн/Смета',
    purchase:   'Закупка',
    production: 'Производство',
    assembly:   'Сборка',
    delivery:   'Доставка',
    handover:   'Сдача клиенту',
    materials: 'Материалы',
    payment:   'Оплата',
    edit:      'Редактирование',
    estimate:  'Смета',
    project:   'Проект',
  }

  const PAYMENT_TYPES = {
    cash: 'Наличные', card: 'Карта', transfer: 'Перевод', other: 'Другое',
  }

  const [order,             setOrder]             = useState(null)
  const [stages,            setStages]            = useState([])
  const [activeStage,       setActiveStage]       = useState(null)
  const [payments,          setPayments]          = useState([])
  const [comments,          setComments]          = useState([])
  const [history,           setHistory]           = useState([])
  const [stageFiles,        setStageFiles]        = useState([])
  const [estimateTotal,     setEstimateTotal]     = useState(0)
  const [estimateSums,      setEstimateSums]      = useState({ services: 0, materials: 0 })
  const [materialsTotal,    setMaterialsTotal]    = useState(0)
  const [estimateStagesKey, setEstimateStagesKey] = useState(0)
  const [activeTab,         setActiveTab]         = useState('stages')
  const [loading,           setLoading]           = useState(true)
  const [error,             setError]             = useState('')
  const [serviceLinks,      setServiceLinks]      = useState([])
  const [assignees,         setAssignees]         = useState([])
  const [allUsers,          setAllUsers]          = useState([])
  const [assignModal,       setAssignModal]       = useState(false)
  const [assignSearch,      setAssignSearch]      = useState('')
  const [selectedUsers,     setSelectedUsers]     = useState([])
  const [assignSaving,      setAssignSaving]      = useState(false)
  const [payModal,          setPayModal]          = useState(false)
  const [completeModal,     setCompleteModal]     = useState(false)
  const [commentModal,      setCommentModal]      = useState(false)
  const [editModal,         setEditModal]         = useState(false)
  const [saving,            setSaving]            = useState(false)
  const [payForm,           setPayForm]           = useState({ amount:'', payment_type:'cash', notes:'' })
  const [completeNote,      setCompleteNote]      = useState('')
  const [commentText,       setCommentText]       = useState('')
  const [editForm,          setEditForm]          = useState({})
  const [estimateSections,  setEstimateSections]  = useState([])
  const [incomeTotal,       setIncomeTotal]       = useState(0)

  const loadEstimateSums = useCallback(async () => {
    try {
      const detailRes = await api.get(`/orders/${id}/detail-estimate`)
      const sections = detailRes.data.data || []
      setEstimateSections(sections)
      const detailTotal = sections.reduce((s, sec) => s + (sec.total_price || 0), 0)

      const estRes = await api.get(`/orders/${id}/estimate`)
      const svc = estRes.data.services  || []
      const mat = estRes.data.materials || []
      const svcTotal = svc.reduce((s, row) => s + (parseFloat(row.total_price) || 0), 0)
      const matTotal = mat.reduce((s, row) => s + (parseFloat(row.total_price) || 0), 0)
      setEstimateSums({ services: svcTotal, materials: matTotal })

      const matsRes = await api.get(`/orders/${id}/materials`)
      const mats = matsRes.data.data || []
      const mTotal = mats.reduce((s, m) => {
        const total = parseFloat(m.total_price) || parseFloat(m.amount) || ((parseFloat(m.quantity) || 0) * (parseFloat(m.unit_price) || 0))
        return s + total
      }, 0)
      setMaterialsTotal(mTotal)

      setEstimateTotal(detailTotal + svcTotal + matTotal + mTotal)

      // Вычисляем доход для external: услуги − материалы
      const svcSum = detailTotal + svcTotal
      const expSum = matTotal + mTotal
      setIncomeTotal(svcSum - expSum)
    } catch {}
  }, [id])

  const loadOrder = useCallback(async () => {
    if (!id || id === 'undefined') return
    try {
      const [orderRes, stagesRes] = await Promise.all([
        api.get(`/orders/${id}`),
        api.get(`/orders/${id}/stages`),
      ])
      const orderData = orderRes.data
      setOrder(orderData)
      const stagesData = stagesRes.data.data || []
      setStages(stagesData)
      const active = stagesData.find(s => s.status === 'in_progress') || stagesData[0]
      if (active && !activeStage) setActiveStage(active.id)
      try {
        const linksRes = await api.get(`/orders/${id}/service-links`)
        setServiceLinks(linksRes.data.data || [])
      } catch { setServiceLinks([]) }
    } catch { setError('Ошибка загрузки заказа') }
    finally  { setLoading(false) }
    try {
      const usersRes = await api.get('/users/assignable')
      setAllUsers(usersRes.data.data || [])
    } catch { setAllUsers([]) }
  }, [id])

  const loadAssignees = useCallback(async (stageId) => {
    if (!stageId) return
    try {
      const res = await getOrderStageAssignees(id, stageId)
      setAssignees(res.data.data || [])
    } catch { setAssignees([]) }
  }, [id])

  const loadTabData = useCallback(async (tab) => {
    if (!id || id === 'undefined') return
    try {
      if (tab === 'payments') {
        const r = await api.get(`/orders/${id}/payments`)
        setPayments(r.data.data || [])
        await loadEstimateSums()
      }
      if (tab === 'calculation' || tab === 'expenses' || tab === 'materials') {
        await loadEstimateSums()
      }
      if (tab === 'comments') {
        const r = await api.get(`/orders/${id}/comments`)
        setComments(r.data.data || [])
      }
      if (tab === 'history') {
        const r = await api.get(`/orders/${id}/history`)
        setHistory(r.data.data || [])
      }
    } catch {}
  }, [id, loadEstimateSums])

  const loadStageFiles = useCallback(async (stageId) => {
    if (!stageId) return
    try {
      const r = await api.get(`/orders/${id}/stages/${stageId}/files`)
      setStageFiles(r.data.data || [])
    } catch { setStageFiles([]) }
  }, [id])

  useEffect(() => { loadOrder() }, [loadOrder])
  useEffect(() => { loadTabData(activeTab) }, [activeTab, loadTabData])
  useEffect(() => {
    if (activeStage) { loadStageFiles(activeStage); loadAssignees(activeStage) }
  }, [activeStage, loadStageFiles, loadAssignees])

  // Синхронизируем estimated_cost для external заказов с реальным доходом
  useEffect(() => {
    if (!order || order.order_type !== 'external' || incomeTotal <= 0) return
    if (Math.round(incomeTotal) === Math.round(order.estimated_cost || 0)) return
    api.patch(`/orders/${id}`, { estimated_cost: Math.round(incomeTotal) })
      .then(() => setOrder(prev => prev ? { ...prev, estimated_cost: Math.round(incomeTotal) } : prev))
      .catch(() => {})
  }, [incomeTotal])

  const openAssignModal = () => {
    setSelectedUsers(assignees.map(a => a.user_id)); setAssignSearch(''); setAssignModal(true)
  }
  const toggleUser = (uid) => setSelectedUsers(prev =>
    prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid]
  )
  const handleAssignSave = async () => {
    setAssignSaving(true)
    try {
      await syncOrderStageAssignees(id, activeStage, selectedUsers)
      setAssignModal(false); loadAssignees(activeStage)
    } catch { setError('Ошибка назначения') }
    finally { setAssignSaving(false) }
  }
  const handleComplete = async () => {
    setSaving(true)
    try {
      await api.post(`/orders/${id}/stages/${activeStage}/complete`, { notes: completeNote })
      setCompleteModal(false); setCompleteNote(''); await loadOrder()
    } catch { setError('Ошибка завершения') }
    finally { setSaving(false) }
  }
  const handlePayment = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await api.post(`/orders/${id}/payments`, { ...payForm, amount: parseFloat(payForm.amount) })
      setPayModal(false); setPayForm({ amount:'', payment_type:'cash', notes:'' })
      loadTabData('payments'); loadOrder()
    } catch { setError('Ошибка оплаты') }
    finally { setSaving(false) }
  }
  const handleComment = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await api.post(`/orders/${id}/comments`, { text: commentText, stage_id: activeStage || '' })
      setCommentModal(false); setCommentText(''); loadTabData('comments')
    } catch { setError('Ошибка комментария') }
    finally { setSaving(false) }
  }
  const handleEdit = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const payload = {
        ...editForm,
        final_cost:     editForm.final_cost     !== '' ? parseFloat(editForm.final_cost)     : undefined,
        estimated_cost: editForm.estimated_cost !== '' ? parseFloat(editForm.estimated_cost) : undefined,
      }
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])
      await api.patch(`/orders/${id}`, payload)
      setEditModal(false); loadOrder()
    } catch { setError('Ошибка сохранения') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="text-center mt-5"><CSpinner color="primary" /></div>
  if (!order)  return <CAlert color="danger">Заказ не найден</CAlert>

  const currentStage      = stages.find(s => s.id === activeStage)
  const doneCount         = stages.filter(s => s.status === 'done').length
  const progress          = stages.length ? Math.round((doneCount / stages.length) * 100) : 0
  const isWorkshop        = order.order_type === 'workshop'
  const isExternal        = order.order_type === 'external'
  const cost              = isExternal
    ? (order.estimated_cost || order.final_cost || 0)
    : (order.final_cost || order.estimated_cost || 0)
  const debt              = cost - (order.paid_amount || 0)
  const isChildOrder      = !!order.parent_order_id
  const canManage         = hasRole('admin', 'supervisor', 'manager')
  const serviceLinksTotal = serviceLinks.reduce((s, l) => s + (l.amount || 0), 0)

  const allTabs = [
    { key:'stages',      label:'Детали',       icon: cilTask          },
    { key:'materials',   label:'Материалы',    icon: cilPlus          },
    { key:'calculation', label:'Смета',        icon: cilCalculator    },
    { key:'comments',    label:'Комментарии',  icon: cilCommentSquare },
    { key:'files',       label:'Файлы',        icon: cilFile          },
    { key:'history',     label:'История',      icon: cilHistory       },
    { key:'expenses',    label:'Расходы',      icon: cilMoney, workshopOnly: true },
    { key:'payments',    label:'Оплата',       icon: cilMoney         },
  ]

  const tabs = allTabs.filter(tab => {
    if (tab.workshopOnly && !isWorkshop) return false
    const roles = ORDER_TABS_ROLES[tab.key]
    if (!roles) return true
    return hasRole(...roles)
  })

  const filteredUsers = allUsers.filter(u => {
    if (!u.is_active) return false
    if (!assignSearch) return true
    const q = String(assignSearch).toLowerCase()
    const name = `${u.full_name||''} ${u.last_name||''}`.toLowerCase()
    const role = String(ROLE_LABEL[u.role_name]||u.role_name||'').toLowerCase()
    return name.includes(q) || role.includes(q)
  })

  return (
    <>
      {error && <CAlert color="danger" dismissible onClose={() => setError('')}>{error}</CAlert>}

      {/* Баннер дочернего заказа */}
      {isChildOrder && canManage && (
        <div className="mb-3 p-3 rounded d-flex justify-content-between align-items-center flex-wrap gap-2"
          style={{ background:'var(--cui-success-bg-subtle)', border:'1px solid var(--cui-success-border-subtle)' }}>
          <div>
            <div className="fw-semibold text-success mb-1">💰 Приход от заказа цеха</div>
            <div className="small text-body-secondary">Создан автоматически из сметы заказа цеха</div>
          </div>
          <div className="d-flex align-items-center gap-3">
            {hasRole('admin') && (
              <div className="text-end">
                <div className="small text-body-secondary">Сумма заказа</div>
                <div className="fw-bold text-success fs-5">+{cost.toLocaleString()} сом.</div>
              </div>
            )}
            <CButton size="sm" color="success" variant="outline" onClick={() => navigate(`/orders/${order.parent_order_id}`)}>
              <CIcon icon={cilExternalLink} className="me-1" />Заказ цеха
            </CButton>
          </div>
        </div>
      )}

      {/* Шапка */}
      <div className="d-flex align-items-start gap-3 mb-3">
        <CButton color="secondary" variant="ghost" size="sm" onClick={() => navigate('/orders')} className="mt-1">
          <CIcon icon={cilArrowLeft} />
        </CButton>
        <div className="flex-grow-1">
          <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
            <CBadge color="secondary" style={{ fontSize:14, fontWeight:700 }}>
              {formatOrderNumber(order.order_type, order.order_number)}
            </CBadge>
            <CBadge color={ORDER_TYPE_COLOR[order.order_type] || 'secondary'}>
              {ORDER_TYPE_LABELS[order.order_type] || order.order_type}
            </CBadge>
            <h5 className="mb-0">{order.title}</h5>
            {canManage && (
              <CButton size="sm" color="secondary" variant="ghost"
                onClick={() => {
                  setEditForm({
                    title:        order.title,
                    description:  order.description  || '',
                    address:      order.address      || '',
                    location_url: order.location_url || '',
                    deadline:     order.deadline     || '',
                    final_cost:   order.final_cost   || '',
                    priority:     order.priority,
                  })
                  setEditModal(true)
                }}>
                <CIcon icon={cilPencil} />
              </CButton>
            )}
          </div>
          <div className="d-flex flex-wrap gap-3 text-body-secondary small">
            {order.client_name  && <span>👤 {order.client_name}</span>}
            {order.client_phone && <span>📞 {order.client_phone}</span>}
            {order.address      && <span>📍 {order.address}</span>}
            {order.deadline     && <span>📅 {order.deadline}</span>}
            {order.location_url && (
              <a href={order.location_url} target="_blank" rel="noopener noreferrer"
                className="d-flex align-items-center gap-1 text-decoration-none" style={{ color:'var(--cui-primary)' }}>
                <CIcon icon={cilLocationPin} style={{ width:14, height:14 }} />
                <span>На карте</span>
              </a>
            )}
          </div>
        </div>
        <div className="text-end" style={{ minWidth:160 }}>
          {hasRole('admin') && (
            <>
              <div className="fw-bold">{cost.toLocaleString()} сом.</div>
              <div className="small text-success">Оплачено: {(order.paid_amount||0).toLocaleString()}</div>
              {debt > 0 && <div className="small text-danger">Долг: {debt.toLocaleString()}</div>}
            </>
          )}
          <CBadge color={PAYMENT_COLOR[order.payment_status]} className="mt-1">
            {t(`orders.payment_${order.payment_status}`, { defaultValue: order.payment_status })}
          </CBadge>
        </div>
      </div>

      {/* Прогресс */}
      <div className="mb-3">
        <div className="d-flex justify-content-between small text-body-secondary mb-1">
          <span>{doneCount} из {stages.length} этапов</span>
          <span>{progress}%</span>
        </div>
        <CProgress value={progress} color="success" style={{ height:5 }} />
      </div>

      <CRow>
        <CCol md={12}>
          <CCard>
            <CCardHeader className="pb-0">
              <CNav variant="tabs" className="card-header-tabs">
                {tabs.map(tab => (
                  <CNavItem key={tab.key}>
                    <CNavLink active={activeTab === tab.key} onClick={() => setActiveTab(tab.key)}
                      style={{ cursor:'pointer', fontSize:12, padding:'6px 10px' }}>
                      <CIcon icon={tab.icon} className="me-1" />{tab.label}
                    </CNavLink>
                  </CNavItem>
                ))}
              </CNav>
            </CCardHeader>

            <CCardBody>

              {/* Этапы */}
              {activeTab === 'stages' && (
                <div>
                  {stages.length > 0 ? (
                    <div className="d-flex flex-column gap-1 mb-3">
                      {stages.filter(s => !(!canManage && s.status === 'done')).map(stage => {
                        const isActive  = stage.id === activeStage
                        const isDone    = stage.status === 'done'
                        const isInProg  = stage.status === 'in_progress'
                        const isSkipped = stage.status === 'skipped'
                        return (
                          <div key={stage.id} onClick={() => setActiveStage(stage.id)}
                            style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', borderRadius:8, cursor:'pointer', border:`1px solid ${isActive?'var(--cui-primary)':'var(--cui-border-color)'}`, background:isActive?'var(--cui-primary-bg-subtle)':isDone?'var(--cui-success-bg-subtle)':'var(--cui-card-bg)', opacity:isSkipped?0.5:1, transition:'all 0.15s' }}>
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              <span style={{ fontSize:14 }}>{isDone?'✅':isInProg?'🔄':isSkipped?'⏭️':'⏳'}</span>
                              <span className="small fw-semibold">{STAGE_LABELS[stage.stage]||stage.stage}</span>
                              {isActive && assignees.map(a => (
                                <span key={a.user_id} className="d-inline-flex align-items-center gap-1"
                                  style={{ background:'var(--cui-primary-bg-subtle)', border:'1px solid var(--cui-primary-border-subtle)', borderRadius:20, padding:'1px 7px', fontSize:11 }}>
                                  {a.avatar_url
                                    ? <img src={a.avatar_url} alt="" style={{ width:14, height:14, borderRadius:'50%', objectFit:'cover' }} />
                                    : <span style={{ width:14, height:14, borderRadius:'50%', background:'var(--cui-primary)', color:'white', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:700 }}>{a.full_name?.charAt(0)}</span>
                                  }
                                  {a.full_name}
                                </span>
                              ))}
                              {isActive && assignees.length === 0 && <span className="small text-body-secondary">Не назначены</span>}
                            </div>
                            <div className="d-flex align-items-center gap-2" onClick={e => e.stopPropagation()}>
                              {isInProg && <CButton size="sm" color="success" variant="outline" onClick={() => setCompleteModal(true)}>✓ Завершить</CButton>}
                              {isInProg && canManage && (
                                <CButton size="sm" color="secondary" variant="outline" onClick={openAssignModal} title="Назначить">
                                  <CIcon icon={cilPeople} style={{ width:12, height:12 }} />
                                </CButton>
                              )}
                              <CBadge color={STATUS_COLOR[stage.status]||'secondary'} style={{ fontSize:10 }}>
                                {t(`order_detail.stage_${stage.status}`, { defaultValue: stage.status })}
                              </CBadge>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center text-body-secondary py-3 small">Этапы не найдены</div>
                  )}

                  {currentStage?.notes && (
                    <div className="p-2 rounded mb-2 small" style={{ background:'var(--cui-secondary-bg)' }}>{currentStage.notes}</div>
                  )}
                  <hr />
                  <CRow className="g-2 small">
                    {[
                      { label:'Тип',      value: ORDER_TYPE_LABELS[order.order_type] || order.order_type },
                      { label:'Приоритет', value: t(`order_detail.priority_${order.priority}`, { defaultValue: order.priority }) },
                      { label:'Статус',   value: t(`order_detail.status_${order.status}`, { defaultValue: order.status }) },
                      { label:'Создан',   value: new Date(order.created_at).toLocaleDateString() },
                    ].filter(f => f.value).map(f => (
                      <CCol xs={6} key={f.label}>
                        <span className="text-body-secondary">{f.label}: </span>
                        <span className="fw-semibold">{f.value}</span>
                      </CCol>
                    ))}
                  </CRow>
                  {order.description && (
                    <div className="mt-2 p-2 rounded small" style={{ background:'var(--cui-secondary-bg)' }}>{order.description}</div>
                  )}
                  {canManage && (
                    <div className="mt-3">
                      <div className="small text-body-secondary fw-semibold mb-2">Проект</div>
                      <OrderProjectLink orderId={order.id} projectId={order.project_id||''} projectTitle={order.project_title||''} onUpdated={loadOrder} />
                    </div>
                  )}
                  <EstimateSectionStages orderId={order.id} canEdit={true} canAssign={canManage} refreshKey={estimateStagesKey} />

                  {/* Связанные заказы услуг */}
                  {serviceLinks.length > 0 && (
                    <div className="mt-3">
                      <div className="small fw-semibold text-body-secondary mb-2">
                        Связанные заказы услуг
                        {hasRole('admin') && serviceLinksTotal > 0 && (
                          <span className={`ms-2 fw-bold ${isWorkshop ? 'text-danger' : 'text-success'}`}>
                            {isWorkshop ? '−' : '+'}{serviceLinksTotal.toLocaleString()} сом.
                          </span>
                        )}
                      </div>
                      <CTable small hover responsive style={{ fontSize:13 }}>
                        <CTableHead>
                          <CTableRow>
                            <CTableHeaderCell>Услуга</CTableHeaderCell>
                            <CTableHeaderCell>Заказ</CTableHeaderCell>
                            <CTableHeaderCell>Статус</CTableHeaderCell>
                            {hasRole('admin') && <CTableHeaderCell className="text-end">Сумма</CTableHeaderCell>}
                            <CTableHeaderCell></CTableHeaderCell>
                          </CTableRow>
                        </CTableHead>
                        <CTableBody>
                          {serviceLinks.map(link => (
                            <CTableRow key={link.id}>
                              <CTableDataCell>
                                <CBadge color={ORDER_TYPE_COLOR[link.child_order_type]||'secondary'}>
                                  {ORDER_TYPE_LABELS[link.child_order_type]||link.service_type}
                                </CBadge>
                              </CTableDataCell>
                              <CTableDataCell className="fw-semibold" style={{ fontSize:12 }}>{link.child_title}</CTableDataCell>
                              <CTableDataCell>
                                {link.child_current_stage
                                  ? <CBadge color="light" className="text-dark" style={{ fontSize:11 }}>{STAGE_LABELS[link.child_current_stage]||link.child_current_stage}</CBadge>
                                  : <CBadge color={STATUS_COLOR[link.child_status]||'secondary'}>{link.child_status==='new'?'Новый':link.child_status==='in_progress'?'В работе':link.child_status==='done'?'Готово':link.child_status}</CBadge>
                                }
                              </CTableDataCell>
                              {hasRole('admin') && (
                                <CTableDataCell className={`text-end fw-semibold ${isWorkshop ? 'text-danger' : 'text-success'}`}>
                                  {isWorkshop ? '−' : '+'}{link.amount.toLocaleString()} сом.
                                </CTableDataCell>
                              )}
                              <CTableDataCell>
                                <CButton size="sm" color="primary" variant="ghost" onClick={() => navigate(`/orders/${link.child_order_id}`)}>
                                  <CIcon icon={cilExternalLink} />
                                </CButton>
                              </CTableDataCell>
                            </CTableRow>
                          ))}
                          {hasRole('admin') && serviceLinksTotal > 0 && (
                            <CTableRow style={{ background: isWorkshop ? 'var(--cui-danger-bg-subtle)' : 'var(--cui-success-bg-subtle)', fontWeight:700 }}>
                              <CTableDataCell colSpan={3} className="text-end small">Итого по услугам:</CTableDataCell>
                              <CTableDataCell className={`text-end ${isWorkshop ? 'text-danger' : 'text-success'}`}>
                                {isWorkshop ? '−' : '+'}{serviceLinksTotal.toLocaleString()} сом.
                              </CTableDataCell>
                              <CTableDataCell />
                            </CTableRow>
                          )}
                        </CTableBody>
                      </CTable>
                    </div>
                  )}
                </div>
              )}

              {/* Материалы */}
              {activeTab === 'materials' && (
                <MaterialsTable
                  orderId={id}
                  order={order}
                  stageName={STAGE_LABELS[currentStage?.stage]||''}
                  canEdit={hasRole('admin','supervisor','manager','master','cutter')}
                  onSaved={() => loadEstimateSums()}
                />
              )}

              {/* Смета */}
              {activeTab === 'calculation' && (
                <DetailEstimateTable orderId={id} order={order} payments={payments}
                  canEdit={hasRole('admin','supervisor','manager','master','cutter')}
                  canEditPrice={hasRole('admin','supervisor')}
                  onSaved={() => { setEstimateStagesKey(k => k+1); loadEstimateSums() }}
                />
              )}

              {/* Оплата */}
              {activeTab === 'payments' && (
                <div>
                  <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">

                    {/* Левая часть — разбивка */}
                    <div className="d-flex flex-wrap gap-3">

                      {/* Распил из старой сметы */}
                      {estimateSums.services > 0 && (
                        <div>
                          <div className="small text-body-secondary">Распил</div>
                          <div className={`fw-bold ${isWorkshop ? 'text-danger' : 'text-success'}`}>
                            {isWorkshop ? '−' : '+'}{Math.round(estimateSums.services).toLocaleString()} сом.
                          </div>
                        </div>
                      )}

                      {/* Разделы из detail-estimate */}
                      {estimateSections.filter(sec => sec.total_price > 0).map(sec => {
                        const SEC_LABELS = { cutting:'Распил', cnc:'ЧПУ', painting:'Покраска', soft:'Мягкая мебель' }
                        return (
                          <div key={sec.service_type}>
                            <div className="small text-body-secondary">{SEC_LABELS[sec.service_type] || sec.service_type}</div>
                            <div className={`fw-bold ${isWorkshop ? 'text-danger' : 'text-success'}`}>
                              {isWorkshop ? '−' : '+'}{Math.round(sec.total_price).toLocaleString()} сом.
                            </div>
                          </div>
                        )
                      })}

                      {/* Материалы из сметы — всегда расход */}
                      {estimateSums.materials > 0 && (
                        <div>
                          <div className="small text-body-secondary">Материалы (смета)</div>
                          <div className="fw-bold text-danger">
                            −{Math.round(estimateSums.materials).toLocaleString()} сом.
                          </div>
                        </div>
                      )}

                      {/* Материалы из вкладки — всегда расход */}
                      {materialsTotal > 0 && (
                        <div>
                          <div className="small text-body-secondary">Материалы</div>
                          <div className="fw-bold text-danger">
                            −{Math.round(materialsTotal).toLocaleString()} сом.
                          </div>
                        </div>
                      )}

                      {/* workshop: Сумма договора + Оплачено + Остаток / Доход */}
                      {isWorkshop && (() => {
                          const paidAmount = order.paid_amount || 0
                          const isPaid = debt <= 0 && paidAmount > 0
                          const workshopIncome = isPaid ? cost - estimateTotal : null
                          return (
                            <>
                              <div style={{ borderLeft:'1px solid var(--cui-border-color)', paddingLeft:12 }}>
                                <div className="small text-body-secondary">Сумма договора</div>
                                <div className="fw-bold">{cost.toLocaleString()} сом.</div>
                              </div>
{estimateTotal > 0 && (
        <div>
          <div className="small text-body-secondary">Расход</div>
          <div className="fw-bold text-danger">−{Math.round(estimateTotal).toLocaleString()} сом.</div>
        </div>
      )}
      {cost > 0 && estimateTotal > 0 && (
        <div>
          <div className="small text-body-secondary">Доход</div>
          {(() => {
            const income = cost - estimateTotal
            return (
              <div className={`fw-bold ${income >= 0 ? 'text-success' : 'text-danger'}`}>
                {income >= 0 ? '+' : ''}{Math.round(income).toLocaleString()} сом.
              </div>
            )
          })()}
        </div>
      )}
      <div>
        <div className="small text-body-secondary">Оплачено</div>
                              <div className="fw-bold text-success">{paidAmount.toLocaleString()} сом.</div>
                            </div>
                            {debt > 0 && (
                              <div>
                                <div className="small text-body-secondary">Остаток</div>
                                <div className="fw-bold text-danger">{debt.toLocaleString()} сом.</div>
                              </div>
                            )}
                            {isPaid && workshopIncome !== null && (
                              <div>
                                <div className="small text-body-secondary">Доход</div>
                                <div className={`fw-bold ${workshopIncome >= 0 ? 'text-success' : 'text-danger'}`}>
                                  {workshopIncome >= 0 ? '+' : ''}{Math.round(workshopIncome).toLocaleString()} сом.
                                </div>
                              </div>
                            )}
                          </>
                        )
                      })()}

                      {/* external: К оплате + Оплачено + Доход + Остаток */}
                      {isExternal && (
                        <>
                          <div style={{ borderLeft:'1px solid var(--cui-border-color)', paddingLeft:12 }}>
                            <div className="small text-body-secondary">К оплате</div>
                            <div className="fw-bold">{cost.toLocaleString()} сом.</div>
                          </div>
                          <div>
                            <div className="small text-body-secondary">Оплачено</div>
                            <div className="fw-bold text-success">{(order.paid_amount||0).toLocaleString()} сом.</div>
                          </div>
                          {incomeTotal !== 0 && (
                            <div>
                              <div className="small text-body-secondary">Доход</div>
                              <div className={`fw-bold ${incomeTotal >= 0 ? 'text-success' : 'text-danger'}`}>
                                {incomeTotal >= 0 ? '+' : ''}{Math.round(incomeTotal).toLocaleString()} сом.
                              </div>
                            </div>
                          )}
                          {debt > 0 && (
                            <div>
                              <div className="small text-body-secondary">Остаток</div>
                              <div className="fw-bold text-danger">{debt.toLocaleString()} сом.</div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Правый угол — итог + кнопка */}
                    <div className="d-flex flex-column align-items-end gap-2">
                      {/* workshop: показываем итого расход из сметы */}
                      {isWorkshop && estimateTotal > 0 && (
                        <div className="p-2 rounded text-end"
                          style={{
                            background: 'var(--cui-danger-bg-subtle)',
                            border: '1px solid var(--cui-danger-border-subtle)',
                            minWidth: 170,
                          }}>
                          <div className="small text-body-secondary">Итого расход (смета)</div>
                          <div className="fw-bold fs-5 text-danger">
                            −{Math.round(estimateTotal).toLocaleString()} сом.
                          </div>
                        </div>
                      )}
                      {/* external: показываем итого приход (доход) */}
                      {isExternal && incomeTotal > 0 && (
                        <div className="p-2 rounded text-end"
                          style={{
                            background: 'var(--cui-success-bg-subtle)',
                            border: '1px solid var(--cui-success-border-subtle)',
                            minWidth: 170,
                          }}>
                          <div className="small text-body-secondary">Итого приход (смета)</div>
                          <div className="fw-bold fs-5 text-success">
                            +{Math.round(incomeTotal).toLocaleString()} сом.
                          </div>
                        </div>
                      )}
                      {canManage && (
                        <CButton size="sm" color="success" onClick={() => setPayModal(true)}>
                          + Добавить оплату
                        </CButton>
                      )}
                    </div>
                  </div>

                  {payments.length === 0 ? (
                    <div className="text-center text-body-secondary py-3 small">Оплат не найдено</div>
                  ) : (
                    <CTable small responsive style={{ fontSize:13 }}>
                      <CTableHead>
                        <CTableRow>
                          <CTableHeaderCell>Сумма</CTableHeaderCell>
                          <CTableHeaderCell>Тип</CTableHeaderCell>
                          <CTableHeaderCell>Принял</CTableHeaderCell>
                          <CTableHeaderCell>Дата</CTableHeaderCell>
                          <CTableHeaderCell>Примечание</CTableHeaderCell>
                        </CTableRow>
                      </CTableHead>
                      <CTableBody>
                        {payments.map(p => (
                          <CTableRow key={p.id}>
                            <CTableDataCell className="fw-semibold text-success">{Number(p.amount).toLocaleString()} сом.</CTableDataCell>
                            <CTableDataCell>{PAYMENT_TYPES[p.payment_type]||p.payment_type}</CTableDataCell>
                            <CTableDataCell>{p.receiver_name||'—'}</CTableDataCell>
                            <CTableDataCell>{new Date(p.paid_at).toLocaleDateString()}</CTableDataCell>
                            <CTableDataCell className="text-body-secondary">{p.notes||'—'}</CTableDataCell>
                          </CTableRow>
                        ))}
                      </CTableBody>
                    </CTable>
                  )}
                </div>
              )}

              {/* Комментарии */}
              {activeTab === 'comments' && (
                <div>
                  <div className="d-flex justify-content-end mb-3">
                    <CButton size="sm" color="primary" variant="outline" onClick={() => setCommentModal(true)}>
                      + Добавить комментарий
                    </CButton>
                  </div>
                  {comments.length === 0 ? (
                    <div className="text-center text-body-secondary py-3 small">Комментариев нет</div>
                  ) : comments.map(c => (
                    <div key={c.id} className="d-flex gap-2 mb-3">
                      <div style={{ width:32, height:32, borderRadius:'50%', flexShrink:0, background:'var(--cui-primary-bg-subtle)', color:'var(--cui-primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:600 }}>
                        {c.author_name?.charAt(0)||'?'}
                      </div>
                      <div className="flex-grow-1">
                        <div className="d-flex gap-2 align-items-center mb-1 flex-wrap">
                          <span className="small fw-semibold">{c.author_name||'Система'}</span>
                          {c.stage_id && <CBadge color="light" className="text-dark" style={{ fontSize:10 }}>{STAGE_LABELS[stages.find(s=>s.id===c.stage_id)?.stage]||''}</CBadge>}
                          <span className="small text-body-secondary">{new Date(c.created_at).toLocaleString()}</span>
                        </div>
                        <div className="p-2 rounded small" style={{ background:'var(--cui-secondary-bg)' }}>{c.text}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Файлы */}
              {activeTab === 'files' && (
                <CRow>
                  <CCol md={5} className="mb-3">
                    <div className="small fw-semibold mb-2">Загрузить в: {STAGE_LABELS[currentStage?.stage]||'—'}</div>
                    {activeStage
                      ? <FileUploader projectId={id} stageId={activeStage} uploadType="project" isOrder={true} onUploaded={() => loadStageFiles(activeStage)} />
                      : <div className="text-body-secondary small">Выберите этап</div>
                    }
                  </CCol>
                  <CCol md={7}>
                    <div className="small fw-semibold mb-2">Файлы: {STAGE_LABELS[currentStage?.stage]} ({stageFiles.length})</div>
                    <FileGallery files={stageFiles} canDelete={hasRole('admin','supervisor')}
                      onDelete={async (fileId) => { await api.delete(`/orders/${id}/stages/${activeStage}/files/${fileId}`); loadStageFiles(activeStage) }} />
                  </CCol>
                </CRow>
              )}

              {/* Расходы — только workshop */}
              {activeTab === 'expenses' && isWorkshop && (
                <ExpensesTable orderId={id} order={order} estimateTotal={estimateTotal}
                  estimateSums={estimateSums} canEdit={canManage} serviceLinks={serviceLinks} />
              )}

              {/* История */}
              {activeTab === 'history' && (
                <div>
                  {history.length === 0
                    ? <div className="text-center text-body-secondary py-3 small">История пуста</div>
                    : history.map((h, i) => {
                        const isMaterial = h.from_stage==='materials', isPayment=h.from_stage==='payment'
                        const isEdit=h.from_stage==='edit', isEstimate=h.from_stage==='estimate'
                        const isFiles=h.from_stage==='files', isProject=h.from_stage==='project'
                        const isDeleted=h.comment?.startsWith('-')
                        let bgColor, textColor, icon
                        if (isPayment)                    { bgColor='var(--cui-success-bg-subtle)'; textColor='var(--cui-success)';         icon='₽'  }
                        else if (isEdit)                  { bgColor='var(--cui-warning-bg-subtle)'; textColor='var(--cui-warning)';         icon='✏'  }
                        else if (isEstimate)              { bgColor='var(--cui-info-bg-subtle)';    textColor='var(--cui-info)';            icon='📐' }
                        else if (isFiles)                 { bgColor='var(--cui-secondary-bg)';      textColor='var(--cui-secondary-color)'; icon='📎' }
                        else if (isProject)               { bgColor='var(--cui-warning-bg-subtle)'; textColor='var(--cui-warning)';         icon='🔗' }
                        else if (isMaterial && isDeleted) { bgColor='var(--cui-danger-bg-subtle)';  textColor='var(--cui-danger)';          icon='−'  }
                        else if (isMaterial)              { bgColor='var(--cui-primary-bg-subtle)'; textColor='var(--cui-primary)';         icon='+'  }
                        else                              { bgColor='var(--cui-primary-bg-subtle)'; textColor='var(--cui-primary)';         icon=h.changer_name?.charAt(0)||'?' }
                        return (
                          <div key={h.id} className="d-flex gap-3 mb-3">
                            <div className="d-flex flex-column align-items-center">
                              <div style={{ width:28, height:28, borderRadius:'50%', flexShrink:0, background:bgColor, color:textColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700 }}>{icon}</div>
                              {i < history.length-1 && <div style={{ width:1, flex:1, background:'var(--cui-border-color)', marginTop:4, minHeight:14 }} />}
                            </div>
                            <div className="pb-2 flex-grow-1">
                              <div className="d-flex gap-2 align-items-center flex-wrap mb-1">
                                <span className="small fw-semibold">{h.changer_name||'Система'}</span>
                                {isPayment  && <CBadge color="success"   style={{ fontSize:10 }}>Оплата</CBadge>}
                                {isEdit     && <CBadge color="warning"   style={{ fontSize:10 }}>Изменение</CBadge>}
                                {isEstimate && <CBadge color="info"      style={{ fontSize:10 }}>Смета</CBadge>}
                                {isFiles    && <CBadge color="secondary" style={{ fontSize:10 }}>Файлы</CBadge>}
                                {isProject  && <CBadge color="warning"   style={{ fontSize:10 }}>Проект</CBadge>}
                                {isMaterial && <CBadge color={isDeleted?'danger':'primary'} style={{ fontSize:10 }}>{isDeleted?'Удалён материал':'Материал'}</CBadge>}
                                {!isMaterial&&!isPayment&&!isEdit&&!isEstimate&&!isFiles&&!isProject&&h.from_stage!==h.to_stage && (
                                  <span className="small text-body-secondary">{STAGE_LABELS[h.from_stage]||h.from_stage} → {STAGE_LABELS[h.to_stage]||h.to_stage}</span>
                                )}
                              </div>
                              {h.comment && (
                                <div className="small p-2 rounded mb-1" style={{ background:isPayment?'var(--cui-success-bg-subtle)':isEdit?'var(--cui-warning-bg-subtle)':isEstimate?'var(--cui-info-bg-subtle)':isFiles?'var(--cui-secondary-bg)':isProject?'var(--cui-warning-bg-subtle)':isMaterial?(isDeleted?'var(--cui-danger-bg-subtle)':'var(--cui-primary-bg-subtle)'):'var(--cui-secondary-bg)', color:isPayment?'var(--cui-success)':isEdit?'var(--cui-warning)':isEstimate?'var(--cui-info)':isProject?'var(--cui-warning)':isMaterial&&isDeleted?'var(--cui-danger)':'inherit', fontFamily:(isMaterial||isPayment||isEdit||isEstimate||isFiles||isProject)?'monospace':'inherit', fontSize:12 }}>
                                  {h.comment}
                                </div>
                              )}
                              <div style={{ fontSize:11, color:'var(--cui-secondary-color)' }}>{new Date(h.created_at).toLocaleString()}</div>
                            </div>
                          </div>
                        )
                      })
                  }
                </div>
              )}

            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Модал: Назначить */}
      <CModal visible={assignModal} onClose={() => { setAssignModal(false); setAssignSearch('') }}>
        <CModalHeader><CModalTitle><CIcon icon={cilPeople} className="me-2" />Назначить: {STAGE_LABELS[currentStage?.stage]}</CModalTitle></CModalHeader>
        <CModalBody>
          <CInputGroup size="sm" className="mb-3">
            <CInputGroupText><CIcon icon={cilSearch} /></CInputGroupText>
            <CFormInput placeholder="Поиск..." value={assignSearch} onChange={e => setAssignSearch(e.target.value)} autoFocus />
            {assignSearch && <CButton color="secondary" variant="outline" type="button" onClick={() => setAssignSearch('')}>×</CButton>}
          </CInputGroup>
          <div style={{ maxHeight:360, overflowY:'auto' }}>
            {filteredUsers.length === 0
              ? <div className="text-center text-body-secondary py-4 small">Не найдено</div>
              : filteredUsers.map(u => {
                  const selected = selectedUsers.includes(u.id)
                  return (
                    <div key={u.id} onClick={() => toggleUser(u.id)}
                      style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', cursor:'pointer', borderRadius:8, marginBottom:4, background:selected?'var(--cui-primary-bg-subtle)':'var(--cui-tertiary-bg)', border:`1px solid ${selected?'var(--cui-primary-border-subtle)':'var(--cui-border-color)'}`, transition:'all 0.1s' }}>
                      <div style={{ width:18, height:18, borderRadius:4, flexShrink:0, background:selected?'var(--cui-primary)':'transparent', border:`2px solid ${selected?'var(--cui-primary)':'var(--cui-border-color)'}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {selected && <span style={{ color:'white', fontSize:12, lineHeight:1 }}>✓</span>}
                      </div>
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt="" style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                        : <div style={{ width:32, height:32, borderRadius:'50%', flexShrink:0, background:'var(--cui-primary)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14 }}>{u.full_name?.charAt(0)}</div>
                      }
                      <div className="flex-grow-1">
                        <div className="fw-semibold small">{u.full_name} {u.last_name}</div>
                        <div className="small text-body-secondary">{ROLE_LABEL[u.role_name]||u.role_name}</div>
                      </div>
                    </div>
                  )
                })
            }
          </div>
          {selectedUsers.length > 0 && (
            <div className="mt-3 p-2 rounded small" style={{ background:'var(--cui-success-bg-subtle)' }}>✅ Выбрано: {selectedUsers.length} чел.</div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={() => { setSelectedUsers([]); setAssignModal(false); setAssignSearch('') }}>Отмена</CButton>
          <CButton color="primary" onClick={handleAssignSave} disabled={assignSaving}>
            {assignSaving ? <CSpinner size="sm" /> : 'Сохранить'}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Модал: Завершить этап */}
      <CModal visible={completeModal} onClose={() => setCompleteModal(false)}>
        <CModalHeader><CModalTitle>Завершить: {STAGE_LABELS[currentStage?.stage]}</CModalTitle></CModalHeader>
        <CModalBody>
          <p className="text-body-secondary small">Подтвердите завершение этапа</p>
          <CFormLabel>Примечание</CFormLabel>
          <CFormTextarea rows={3} value={completeNote} onChange={e => setCompleteNote(e.target.value)} placeholder="Необязательно..." />
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={() => setCompleteModal(false)}>Отмена</CButton>
          <CButton color="success" onClick={handleComplete} disabled={saving}>
            {saving ? <CSpinner size="sm" /> : '✅ Завершить'}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Модал: Платёж */}
      <CModal visible={payModal} onClose={() => setPayModal(false)}>
        <CModalHeader><CModalTitle>Добавить оплату</CModalTitle></CModalHeader>
        <CForm onSubmit={handlePayment}>
          <CModalBody>
            <CRow className="g-3">
              <CCol xs={12}>
                <CFormLabel>Сумма (сом.) *</CFormLabel>
                <CFormInput required type="number" min="1" step="any" value={payForm.amount}
                  onChange={e => setPayForm({...payForm, amount:e.target.value})}
                  placeholder={`Остаток: ${debt.toLocaleString()} сом.`} />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Тип оплаты</CFormLabel>
                <CFormSelect value={payForm.payment_type} onChange={e => setPayForm({...payForm, payment_type:e.target.value})}>
                  <option value="cash">Наличные</option>
                  <option value="card">Карта</option>
                  <option value="transfer">Перевод</option>
                  <option value="other">Другое</option>
                </CFormSelect>
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Примечание</CFormLabel>
                <CFormInput value={payForm.notes} onChange={e => setPayForm({...payForm, notes:e.target.value})} />
              </CCol>
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setPayModal(false)}>Отмена</CButton>
            <CButton type="submit" color="success" disabled={saving}>
              {saving ? <CSpinner size="sm" /> : 'Сохранить'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>

      {/* Модал: Комментарий */}
      <CModal visible={commentModal} onClose={() => setCommentModal(false)}>
        <CModalHeader>
          <CModalTitle>
            Добавить комментарий
            {currentStage && <span className="text-body-secondary ms-2" style={{ fontSize:14 }}>— {STAGE_LABELS[currentStage.stage]}</span>}
          </CModalTitle>
        </CModalHeader>
        <CForm onSubmit={handleComment}>
          <CModalBody>
            <CFormTextarea required rows={4} value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Текст комментария..." />
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setCommentModal(false)}>Отмена</CButton>
            <CButton type="submit" color="primary" disabled={saving}>
              {saving ? <CSpinner size="sm" /> : 'Добавить'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>

      {/* Модал: Редактировать */}
      <CModal visible={editModal} onClose={() => setEditModal(false)}>
        <CModalHeader><CModalTitle>Редактировать заказ</CModalTitle></CModalHeader>
        <CForm onSubmit={handleEdit}>
          <CModalBody>
            <CRow className="g-3">
              <CCol xs={12}>
                <CFormLabel>Название</CFormLabel>
                <CFormInput value={editForm.title||''} onChange={e => setEditForm({...editForm, title:e.target.value})} />
              </CCol>
              {isWorkshop && (
                <CCol xs={6}>
                  <CFormLabel>Сумма договора</CFormLabel>
                  <CFormInput type="number" min="0" step="any" value={editForm.final_cost||''} onChange={e => setEditForm({...editForm, final_cost:e.target.value})} />
                </CCol>
              )}
              <CCol xs={isWorkshop ? 6 : 12}>
                <CFormLabel>Срок</CFormLabel>
                <CFormInput type="date" value={editForm.deadline||''} onChange={e => setEditForm({...editForm, deadline:e.target.value})} />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Адрес</CFormLabel>
                <CFormInput value={editForm.address||''} onChange={e => setEditForm({...editForm, address:e.target.value})} />
              </CCol>
              <CCol xs={12}>
                <CFormLabel><CIcon icon={cilLocationPin} className="me-1" style={{ width:14, height:14 }} />Ссылка на карту</CFormLabel>
                <CFormInput value={editForm.location_url||''} onChange={e => setEditForm({...editForm, location_url:e.target.value})} placeholder="https://maps.google.com/..." />
                {editForm.location_url && <div className="mt-1"><a href={editForm.location_url} target="_blank" rel="noopener noreferrer" className="small text-primary">🗺 Проверить ссылку</a></div>}
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Описание</CFormLabel>
                <CFormTextarea rows={3} value={editForm.description||''} onChange={e => setEditForm({...editForm, description:e.target.value})} />
              </CCol>
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setEditModal(false)}>Отмена</CButton>
            <CButton type="submit" color="primary" disabled={saving}>
              {saving ? <CSpinner size="sm" /> : 'Сохранить'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>
    </>
  )
}