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
  CProgress,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilArrowLeft, cilCheck, cilHistory,
  cilMoney, cilFile, cilTask, cilCommentSquare,
  cilCalculator, cilPencil, cilPlus, cilLocationPin, cilPeople,
} from '@coreui/icons'
import api from '../../api/client'
import { useAuth } from '../../AuthContext'
import FileUploader, { FileGallery } from '../../components/FileUploader'
import MaterialsTable from '../../components/MaterialsTable'
import DetailEstimateTable from '../../components/DetailEstimateTable'
import ExpensesTable from '../../components/ExpensesTable'
import { getOrderStageAssignees, syncOrderStageAssignees } from '../../api/expenses'

const ORDER_TYPE_COLOR = {
  workshop:'primary', cutting:'warning', painting:'danger',
  cnc:'info', soft_fabric:'success', soft_furniture:'dark',
}
const STATUS_COLOR  = { pending:'secondary', in_progress:'primary', done:'success', skipped:'light' }
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
    intake: t('order_detail.stage_intake'), measure: t('order_detail.stage_measure'),
    design: t('order_detail.stage_design'), purchase: t('order_detail.stage_purchase'),
    production: t('order_detail.stage_production'), assembly: t('order_detail.stage_assembly'),
    delivery: t('order_detail.stage_delivery'), handover: t('order_detail.stage_handover'),
    material: t('order_detail.stage_material'), sawing: t('order_detail.stage_sawing'),
    edging: t('order_detail.stage_edging'), drilling: t('order_detail.stage_drilling'),
    packing: t('order_detail.stage_packing'), shipment: t('order_detail.stage_shipment'),
    calculate: t('order_detail.stage_calculate'), sanding: t('order_detail.stage_sanding'),
    priming: t('order_detail.stage_priming'), painting: t('order_detail.stage_painting'),
    cnc_work: t('order_detail.stage_cnc_work'), assign: t('order_detail.stage_assign'),
    work: t('order_detail.stage_work'),
    materials: t('order_detail.tab_materials'),
    payment: t('order_detail.tab_payments'),
    edit: t('common.edit'),
    estimate: t('order_detail.tab_estimate'),
  }

  const ORDER_TYPE_LABELS = {
    workshop: t('orders.type_workshop'), cutting: t('orders.type_cutting'),
    painting: t('orders.type_painting'), cnc: t('orders.type_cnc'),
    soft_fabric: t('orders.type_soft_fabric'), soft_furniture: t('orders.type_soft_furniture'),
  }

  const PAYMENT_TYPES = {
    cash: t('order_detail.pay_cash'), card: t('order_detail.pay_card'),
    transfer: t('order_detail.pay_transfer'), other: t('order_detail.pay_other'),
  }

  const [order,         setOrder]         = useState(null)
  const [stages,        setStages]        = useState([])
  const [activeStage,   setActiveStage]   = useState(null)
  const [payments,      setPayments]      = useState([])
  const [comments,      setComments]      = useState([])
  const [history,       setHistory]       = useState([])
  const [stageFiles,    setStageFiles]    = useState([])
  const [estimateTotal, setEstimateTotal] = useState(0)
  const [activeTab,     setActiveTab]     = useState('stages')
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')

  // Мультиназначение
  const [assignees,     setAssignees]     = useState([])
  const [allUsers,      setAllUsers]      = useState([])
  const [assignModal,   setAssignModal]   = useState(false)
  const [selectedUsers, setSelectedUsers] = useState([])
  const [assignSaving,  setAssignSaving]  = useState(false)

  const [payModal,      setPayModal]      = useState(false)
  const [completeModal, setCompleteModal] = useState(false)
  const [commentModal,  setCommentModal]  = useState(false)
  const [editModal,     setEditModal]     = useState(false)
  const [saving,        setSaving]        = useState(false)

  const [payForm,      setPayForm]      = useState({ amount:'', payment_type:'cash', notes:'' })
  const [completeNote, setCompleteNote] = useState('')
  const [commentText,  setCommentText]  = useState('')
  const [editForm,     setEditForm]     = useState({})

  const loadOrder = useCallback(async () => {
    if (!id || id === 'undefined') return
    try {
      const [orderRes, stagesRes] = await Promise.all([
        api.get(`/orders/${id}`),
        api.get(`/orders/${id}/stages`),
      ])
      setOrder(orderRes.data)
      const stagesData = stagesRes.data.data || []
      setStages(stagesData)
      const active = stagesData.find(s => s.status === 'in_progress') || stagesData[0]
      if (active && !activeStage) setActiveStage(active.id)
    } catch { setError(t('common.loading')) }
    finally  { setLoading(false) }

    // Загружаем список сотрудников отдельно — только для тех у кого есть доступ
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
      if (tab === 'payments' || tab === 'calculation') {
        const r = await api.get(`/orders/${id}/payments`)
        setPayments(r.data.data || [])
      }
      if (tab === 'calculation' || tab === 'expenses') {
        try {
          const r = await api.get(`/orders/${id}/detail-estimate`)
          const sections = r.data.data || []
          setEstimateTotal(sections.reduce((s, sec) => s + (sec.total_price || 0), 0))
        } catch {}
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
  }, [id])

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
    if (activeStage) {
      loadStageFiles(activeStage)
      loadAssignees(activeStage)
    }
  }, [activeStage, loadStageFiles, loadAssignees])

  // ── Мультиназначение ──────────────────────────────────

  const openAssignModal = () => {
    setSelectedUsers(assignees.map(a => a.user_id))
    setAssignModal(true)
  }

  const toggleUser = (uid) => {
    setSelectedUsers(prev =>
      prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid]
    )
  }

  const handleAssignSave = async () => {
    setAssignSaving(true)
    try {
      await syncOrderStageAssignees(id, activeStage, selectedUsers)
      setAssignModal(false)
      loadAssignees(activeStage)
    } catch { setError('Ошибка назначения сотрудников') }
    finally  { setAssignSaving(false) }
  }

  // ── Обработчики ───────────────────────────────────────

  const handleComplete = async () => {
    setSaving(true)
    try {
      await api.post(`/orders/${id}/stages/${activeStage}/complete`, { notes: completeNote })
      setCompleteModal(false); setCompleteNote(''); await loadOrder()
    } catch { setError(t('common.save')) }
    finally  { setSaving(false) }
  }

  const handlePayment = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await api.post(`/orders/${id}/payments`, { ...payForm, amount: parseFloat(payForm.amount) })
      setPayModal(false)
      setPayForm({ amount:'', payment_type:'cash', notes:'' })
      loadTabData('payments'); loadOrder()
    } catch { setError(t('common.save')) }
    finally  { setSaving(false) }
  }

  const handleComment = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await api.post(`/orders/${id}/comments`, { text: commentText, stage_id: activeStage || '' })
      setCommentModal(false); setCommentText(''); loadTabData('comments')
    } catch { setError(t('common.save')) }
    finally  { setSaving(false) }
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
    } catch { setError(t('common.save')) }
    finally  { setSaving(false) }
  }

  if (loading) return <div className="text-center mt-5"><CSpinner color="primary" /></div>
  if (!order)  return <CAlert color="danger">{t('common.not_found')}</CAlert>

  const currentStage = stages.find(s => s.id === activeStage)
  const doneCount    = stages.filter(s => s.status === 'done').length
  const progress     = stages.length ? Math.round((doneCount / stages.length) * 100) : 0
  const cost         = order.final_cost || order.estimated_cost || 0
  const debt         = cost - (order.paid_amount || 0)
  const isWorkshop   = order.order_type === 'workshop'
  const canManage    = hasRole('admin', 'supervisor', 'manager')

  const tabs = [
    { key:'stages',      label: t('order_detail.tab_details'),   icon: cilTask          },
    { key:'materials',   label: t('order_detail.tab_materials'),  icon: cilPlus          },
    { key:'calculation', label: t('order_detail.tab_estimate'),   icon: cilCalculator    },
    { key:'comments',    label: t('order_detail.tab_comments'),   icon: cilCommentSquare },
    { key:'files',       label: t('order_detail.tab_files'),      icon: cilFile          },
    { key:'history',     label: t('order_detail.tab_history'),    icon: cilHistory       },
    ...(isWorkshop ? [{ key:'expenses', label: t('order_detail.tab_expenses'), icon: cilMoney }] : []),
    ...(hasRole('admin') ? [{ key:'payments', label: t('order_detail.tab_payments'), icon: cilMoney }] : []),
  ]

  return (
    <>
      {error && <CAlert color="danger" dismissible onClose={() => setError('')}>{error}</CAlert>}

      {/* Шапка */}
      <div className="d-flex align-items-start gap-3 mb-3">
        <CButton color="secondary" variant="ghost" size="sm"
          onClick={() => navigate('/orders')} className="mt-1">
          <CIcon icon={cilArrowLeft} />
        </CButton>
        <div className="flex-grow-1">
          <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
            <CBadge color="secondary" style={{ fontSize:14, fontWeight:700 }}>
              #{order.order_number}
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
                className="d-flex align-items-center gap-1 text-decoration-none"
                style={{ color:'var(--cui-primary)' }}>
                <CIcon icon={cilLocationPin} style={{ width:14, height:14 }} />
                <span>{t('order_detail.open_map')}</span>
              </a>
            )}
          </div>
        </div>
        <div className="text-end" style={{ minWidth:160 }}>
          {hasRole('admin') && (
            <>
              <div className="fw-bold">{cost.toLocaleString()} сом.</div>
              <div className="small text-success">
                {t('order_detail.paid')}: {(order.paid_amount||0).toLocaleString()}
              </div>
              {debt > 0 && (
                <div className="small text-danger">{t('order_detail.debt')}: {debt.toLocaleString()}</div>
              )}
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
          <span>{doneCount} {t('order_detail.stages_progress')} {stages.length} {t('order_detail.stages_label')}</span>
          <span>{progress}%</span>
        </div>
        <CProgress value={progress} color="success" style={{ height:5 }} />
      </div>

      <CRow>
        {/* Этапы */}
        <CCol md={3}>
          <CCard className="mb-3">
            <CCardHeader className="d-flex justify-content-between align-items-center py-2">
              <strong className="small">{t('order_detail.stages')}</strong>
              {currentStage?.status === 'in_progress' && (
                <CButton size="sm" color="success" onClick={() => setCompleteModal(true)}>
                  <CIcon icon={cilCheck} className="me-1" />{t('order_detail.complete')}
                </CButton>
              )}
            </CCardHeader>
            <CCardBody className="p-0">
              {stages.map(s => (
                <div key={s.id} onClick={() => setActiveStage(s.id)}
                  style={{
                    padding:'9px 12px', cursor:'pointer',
                    borderLeft:`3px solid ${
                      s.id === activeStage ? 'var(--cui-primary)' :
                      s.status === 'done'  ? 'var(--cui-success)' : 'transparent'
                    }`,
                    background: s.id === activeStage ? 'var(--cui-primary-bg-subtle)' : 'transparent',
                    borderBottom:'0.5px solid var(--cui-border-color)',
                    transition:'all 0.1s',
                  }}>
                  <span className="small fw-semibold">
                    {s.status === 'done'        && '✅ '}
                    {s.status === 'in_progress' && '🔄 '}
                    {s.status === 'pending'     && '⏳ '}
                    {STAGE_LABELS[s.stage] || s.stage}
                  </span>
                  {s.assignee_name && hasRole('admin', 'supervisor', 'manager') && (
                    <div style={{ fontSize:11 }} className="text-body-secondary">
                      👤 {s.assignee_name}
                    </div>
                  )}
                </div>
              ))}
            </CCardBody>
          </CCard>
        </CCol>

        {/* Правая колонка */}
        <CCol md={9}>
          <CCard>
            <CCardHeader className="pb-0">
              <CNav variant="tabs" className="card-header-tabs">
                {tabs.map(tab => (
                  <CNavItem key={tab.key}>
                    <CNavLink active={activeTab === tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      style={{ cursor:'pointer', fontSize:12, padding:'6px 10px' }}>
                      <CIcon icon={tab.icon} className="me-1" />{tab.label}
                    </CNavLink>
                  </CNavItem>
                ))}
              </CNav>
            </CCardHeader>

            <CCardBody>

              {/* Детали */}
              {activeTab === 'stages' && (
                <div>
                  {currentStage ? (
                    <>
                      {/* Шапка этапа с назначенными */}
                      <div className="d-flex justify-content-between align-items-start mb-2 flex-wrap gap-2">
                        <div className="d-flex gap-2 flex-wrap align-items-center">
                          <strong>{STAGE_LABELS[currentStage.stage]}</strong>
                          <CBadge color={STATUS_COLOR[currentStage.status]}>
                            {t(`order_detail.stage_${currentStage.status}`, { defaultValue: currentStage.status })}
                          </CBadge>
                          {/* Назначенные */}
                          {assignees.length > 0 ? assignees.map(a => (
                            <span key={a.user_id}
                              className="d-inline-flex align-items-center gap-1"
                              style={{
                                background:'var(--cui-primary-bg-subtle)',
                                border:'1px solid var(--cui-primary-border-subtle)',
                                borderRadius:20, padding:'2px 8px', fontSize:11,
                              }}>
                              {a.avatar_url ? (
                                <img src={a.avatar_url} alt="" style={{ width:16, height:16, borderRadius:'50%', objectFit:'cover' }} />
                              ) : (
                                <span style={{
                                  width:16, height:16, borderRadius:'50%',
                                  background:'var(--cui-primary)', color:'white',
                                  display:'inline-flex', alignItems:'center', justifyContent:'center',
                                  fontSize:9, fontWeight:700,
                                }}>{a.full_name?.charAt(0)}</span>
                              )}
                              {a.full_name}
                            </span>
                          )) : (
                            <span className="small text-body-secondary">Не назначены</span>
                          )}
                        </div>
                        {/* Кнопка назначения */}
                        {canManage && (
                          <CButton size="sm" color="secondary" variant="outline"
                            onClick={openAssignModal}>
                            <CIcon icon={cilPeople} className="me-1" />Назначить
                          </CButton>
                        )}
                      </div>

                      {currentStage.notes && (
                        <div className="p-2 rounded mb-2 small" style={{ background:'var(--cui-secondary-bg)' }}>
                          {currentStage.notes}
                        </div>
                      )}
                      {currentStage.started_at && (
                        <div className="small text-body-secondary">
                          {t('order_detail.started_at')}: {new Date(currentStage.started_at).toLocaleString()}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center text-body-secondary py-3 small">
                      {t('order_detail.stage_select')}
                    </div>
                  )}
                  <hr />
                  <CRow className="g-2 small">
                    {[
                      { label: t('order_detail.type'),     value: ORDER_TYPE_LABELS[order.order_type] },
                      { label: t('order_detail.priority'), value: order.priority },
                      { label: t('order_detail.status'),   value: order.status },
                      { label: t('order_detail.created'),  value: new Date(order.created_at).toLocaleDateString() },
                    ].filter(f => f.value).map(f => (
                      <CCol xs={6} key={f.label}>
                        <span className="text-body-secondary">{f.label}: </span>
                        <span className="fw-semibold">{f.value}</span>
                      </CCol>
                    ))}
                  </CRow>
                  {order.description && (
                    <div className="mt-2 p-2 rounded small" style={{ background:'var(--cui-secondary-bg)' }}>
                      {order.description}
                    </div>
                  )}
                  {order.location_url && (
                    <div className="mt-2">
                      <a href={order.location_url} target="_blank" rel="noopener noreferrer"
                        className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1">
                        <CIcon icon={cilLocationPin} style={{ width:14, height:14 }} />
                        {t('order_detail.open_location')}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Материалы */}
              {activeTab === 'materials' && (
                <MaterialsTable orderId={id} order={order}
                  stageName={STAGE_LABELS[currentStage?.stage] || ''}
                  canEdit={hasRole('admin','supervisor','manager','master','cutter')} />
              )}

              {/* Смета */}
              {activeTab === 'calculation' && (
                <DetailEstimateTable orderId={id} order={order} payments={payments}
                  canEdit={hasRole('admin','supervisor','manager','master','cutter')}
                  canEditPrice={hasRole('admin','supervisor')} />
              )}

              {/* Оплата */}
              {activeTab === 'payments' && (
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                    <div className="d-flex gap-4">
                      {[
                        { label: t('order_detail.to_pay'),    value: cost.toLocaleString(),                  cls: '' },
                        { label: t('order_detail.paid'),      value: (order.paid_amount||0).toLocaleString(), cls: 'text-success' },
                        { label: t('order_detail.remainder'), value: debt.toLocaleString(),                   cls: debt > 0 ? 'text-danger' : 'text-success' },
                      ].map(item => (
                        <div key={item.label}>
                          <div className="small text-body-secondary">{item.label}</div>
                          <div className={`fw-bold ${item.cls}`}>{item.value} сом.</div>
                        </div>
                      ))}
                    </div>
                    {canManage && (
                      <CButton size="sm" color="success" onClick={() => setPayModal(true)}>
                        + {t('order_detail.pay_title')}
                      </CButton>
                    )}
                  </div>
                  {payments.length === 0 ? (
                    <div className="text-center text-body-secondary py-3 small">
                      {t('order_detail.pay_empty')}
                    </div>
                  ) : (
                    <CTable small responsive style={{ fontSize:13 }}>
                      <CTableHead>
                        <CTableRow>
                          <CTableHeaderCell>{t('order_detail.pay_col_sum')}</CTableHeaderCell>
                          <CTableHeaderCell>{t('order_detail.pay_col_type')}</CTableHeaderCell>
                          <CTableHeaderCell>{t('order_detail.pay_col_received')}</CTableHeaderCell>
                          <CTableHeaderCell>{t('order_detail.pay_col_date')}</CTableHeaderCell>
                          <CTableHeaderCell>{t('order_detail.pay_col_note')}</CTableHeaderCell>
                        </CTableRow>
                      </CTableHead>
                      <CTableBody>
                        {payments.map(p => (
                          <CTableRow key={p.id}>
                            <CTableDataCell className="fw-semibold text-success">
                              {Number(p.amount).toLocaleString()} сом.
                            </CTableDataCell>
                            <CTableDataCell>{PAYMENT_TYPES[p.payment_type] || p.payment_type}</CTableDataCell>
                            <CTableDataCell>{p.receiver_name || '—'}</CTableDataCell>
                            <CTableDataCell>{new Date(p.paid_at).toLocaleDateString()}</CTableDataCell>
                            <CTableDataCell className="text-body-secondary">{p.notes || '—'}</CTableDataCell>
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
                    <CButton size="sm" color="primary" variant="outline"
                      onClick={() => setCommentModal(true)}>
                      + {t('order_detail.comment_add')}
                    </CButton>
                  </div>
                  {comments.length === 0 ? (
                    <div className="text-center text-body-secondary py-3 small">
                      {t('order_detail.comment_empty')}
                    </div>
                  ) : comments.map(c => (
                    <div key={c.id} className="d-flex gap-2 mb-3">
                      <div style={{
                        width:32, height:32, borderRadius:'50%', flexShrink:0,
                        background:'var(--cui-primary-bg-subtle)', color:'var(--cui-primary)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:13, fontWeight:600,
                      }}>
                        {c.author_name?.charAt(0) || '?'}
                      </div>
                      <div className="flex-grow-1">
                        <div className="d-flex gap-2 align-items-center mb-1 flex-wrap">
                          <span className="small fw-semibold">{c.author_name || 'Система'}</span>
                          {c.stage_id && (
                            <CBadge color="light" className="text-dark" style={{ fontSize:10 }}>
                              {STAGE_LABELS[stages.find(s => s.id === c.stage_id)?.stage] || ''}
                            </CBadge>
                          )}
                          <span className="small text-body-secondary">
                            {new Date(c.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="p-2 rounded small" style={{ background:'var(--cui-secondary-bg)' }}>
                          {c.text}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Файлы */}
              {activeTab === 'files' && (
                <CRow>
                  <CCol md={5} className="mb-3">
                    <div className="small fw-semibold mb-2">
                      {t('order_detail.upload_to')}: {STAGE_LABELS[currentStage?.stage] || '—'}
                    </div>
                    {activeStage ? (
                      <FileUploader projectId={id} stageId={activeStage}
                        uploadType={
                          order.order_type === 'cutting'  ? 'cutting' :
                          order.order_type === 'painting' ? 'design'  : 'project'
                        }
                        isOrder={true}
                        onUploaded={() => loadStageFiles(activeStage)} />
                    ) : (
                      <div className="text-body-secondary small">{t('order_detail.stage_select_hint')}</div>
                    )}
                  </CCol>
                  <CCol md={7}>
                    <div className="small fw-semibold mb-2">
                      {t('order_detail.files_of')}: {STAGE_LABELS[currentStage?.stage]} ({stageFiles.length})
                    </div>
                    <FileGallery files={stageFiles}
                      canDelete={hasRole('admin','supervisor')}
                      onDelete={async (fileId) => {
                        await api.delete(`/orders/${id}/stages/${activeStage}/files/${fileId}`)
                        loadStageFiles(activeStage)
                      }} />
                  </CCol>
                </CRow>
              )}

              {/* Расходы */}
              {activeTab === 'expenses' && isWorkshop && (
                <ExpensesTable orderId={id} estimateTotal={estimateTotal}
                  canEdit={canManage} />
              )}

              {/* История */}
              {activeTab === 'history' && (
                <div>
                  {history.length === 0 ? (
                    <div className="text-center text-body-secondary py-3 small">
                      {t('order_detail.history_empty')}
                    </div>
                  ) : history.map((h, i) => {
                    const isMaterial = h.from_stage === 'materials'
                    const isPayment  = h.from_stage === 'payment'
                    const isEdit     = h.from_stage === 'edit'
                    const isEstimate = h.from_stage === 'estimate'
                    const isFiles    = h.from_stage === 'files'
                    const isDeleted  = h.comment?.startsWith('-')

                    let bgColor, textColor, icon
                    if (isPayment)            { bgColor='var(--cui-success-bg-subtle)'; textColor='var(--cui-success)'; icon='₽' }
                    else if (isEdit)          { bgColor='var(--cui-warning-bg-subtle)'; textColor='var(--cui-warning)'; icon='✏' }
                    else if (isEstimate)      { bgColor='var(--cui-info-bg-subtle)';    textColor='var(--cui-info)';    icon='📐' }
                    else if (isFiles)         { bgColor='var(--cui-secondary-bg)';      textColor='var(--cui-secondary-color)'; icon='📎' }
                    else if (isMaterial && isDeleted) { bgColor='var(--cui-danger-bg-subtle)'; textColor='var(--cui-danger)'; icon='−' }
                    else if (isMaterial)      { bgColor='var(--cui-primary-bg-subtle)'; textColor='var(--cui-primary)'; icon='+' }
                    else                      { bgColor='var(--cui-primary-bg-subtle)'; textColor='var(--cui-primary)'; icon=h.changer_name?.charAt(0)||'?' }

                    return (
                      <div key={h.id} className="d-flex gap-3 mb-3">
                        <div className="d-flex flex-column align-items-center">
                          <div style={{
                            width:28, height:28, borderRadius:'50%', flexShrink:0,
                            background:bgColor, color:textColor,
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontSize:13, fontWeight:700,
                          }}>{icon}</div>
                          {i < history.length - 1 && (
                            <div style={{ width:1, flex:1, background:'var(--cui-border-color)', marginTop:4, minHeight:14 }} />
                          )}
                        </div>
                        <div className="pb-2 flex-grow-1">
                          <div className="d-flex gap-2 align-items-center flex-wrap mb-1">
                            <span className="small fw-semibold">{h.changer_name || 'Система'}</span>
                            {isPayment  && <CBadge color="success"   style={{ fontSize:10 }}>{t('order_detail.badge_payment')}</CBadge>}
                            {isEdit     && <CBadge color="warning"   style={{ fontSize:10 }}>{t('order_detail.badge_edited')}</CBadge>}
                            {isEstimate && <CBadge color="info"      style={{ fontSize:10 }}>{t('order_detail.badge_estimate')}</CBadge>}
                            {isFiles    && <CBadge color="secondary" style={{ fontSize:10 }}>{t('order_detail.badge_files')}</CBadge>}
                            {isMaterial && (
                              <CBadge color={isDeleted?'danger':'primary'} style={{ fontSize:10 }}>
                                {isDeleted ? t('order_detail.badge_material_del') : t('order_detail.badge_material_add')}
                              </CBadge>
                            )}
                            {!isMaterial && !isPayment && !isEdit && !isEstimate && !isFiles && h.from_stage !== h.to_stage && (
                              <span className="small text-body-secondary">
                                {STAGE_LABELS[h.from_stage] || h.from_stage} → {STAGE_LABELS[h.to_stage] || h.to_stage}
                              </span>
                            )}
                          </div>
                          {h.comment && (
                            <div className="small p-2 rounded mb-1" style={{
                              background: isPayment?'var(--cui-success-bg-subtle)':isEdit?'var(--cui-warning-bg-subtle)':
                                          isEstimate?'var(--cui-info-bg-subtle)':isFiles?'var(--cui-secondary-bg)':
                                          isMaterial?(isDeleted?'var(--cui-danger-bg-subtle)':'var(--cui-primary-bg-subtle)'):'var(--cui-secondary-bg)',
                              color: isPayment?'var(--cui-success)':isEdit?'var(--cui-warning)':
                                     isEstimate?'var(--cui-info)':isMaterial&&isDeleted?'var(--cui-danger)':'inherit',
                              fontFamily:(isMaterial||isPayment||isEdit||isEstimate||isFiles)?'monospace':'inherit',
                              fontSize:12,
                            }}>{h.comment}</div>
                          )}
                          <div style={{ fontSize:11, color:'var(--cui-secondary-color)' }}>
                            {new Date(h.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Модал: Назначить сотрудников */}
      <CModal visible={assignModal} onClose={() => setAssignModal(false)}>
        <CModalHeader>
          <CModalTitle>
            <CIcon icon={cilPeople} className="me-2" />
            Назначить: {STAGE_LABELS[currentStage?.stage]}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className="small text-body-secondary mb-3">
            Выберите сотрудников для этого этапа.
          </div>
          <div style={{ maxHeight:360, overflowY:'auto' }}>
            {allUsers.filter(u => u.is_active).map(u => {
              const selected = selectedUsers.includes(u.id)
              return (
                <div key={u.id} onClick={() => toggleUser(u.id)}
                  style={{
                    display:'flex', alignItems:'center', gap:12,
                    padding:'10px 12px', cursor:'pointer', borderRadius:8, marginBottom:4,
                    background: selected ? 'var(--cui-primary-bg-subtle)' : 'var(--cui-tertiary-bg)',
                    border:`1px solid ${selected ? 'var(--cui-primary-border-subtle)' : 'var(--cui-border-color)'}`,
                    transition:'all 0.1s',
                  }}>
                  <div style={{
                    width:18, height:18, borderRadius:4, flexShrink:0,
                    background: selected ? 'var(--cui-primary)' : 'transparent',
                    border:`2px solid ${selected ? 'var(--cui-primary)' : 'var(--cui-border-color)'}`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    {selected && <span style={{ color:'white', fontSize:12, lineHeight:1 }}>✓</span>}
                  </div>
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                  ) : (
                    <div style={{
                      width:32, height:32, borderRadius:'50%', flexShrink:0,
                      background:'var(--cui-primary)', color:'white',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontWeight:700, fontSize:14,
                    }}>{u.full_name?.charAt(0)}</div>
                  )}
                  <div className="flex-grow-1">
                    <div className="fw-semibold small">{u.full_name} {u.last_name}</div>
                    <div className="small text-body-secondary">{ROLE_LABEL[u.role_name] || u.role_name}</div>
                  </div>
                </div>
              )
            })}
          </div>
          {selectedUsers.length > 0 && (
            <div className="mt-3 p-2 rounded small" style={{ background:'var(--cui-success-bg-subtle)' }}>
              ✅ Выбрано: {selectedUsers.length} чел.
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={() => {
            setSelectedUsers([]); setAssignModal(false)
          }}>
            {t('common.cancel')}
          </CButton>
          <CButton color="primary" onClick={handleAssignSave} disabled={assignSaving}>
            {assignSaving ? <CSpinner size="sm" /> : t('common.save')}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Модал: Завершить этап */}
      <CModal visible={completeModal} onClose={() => setCompleteModal(false)}>
        <CModalHeader>
          <CModalTitle>{t('order_detail.complete_title')}: {STAGE_LABELS[currentStage?.stage]}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p className="text-body-secondary small">{t('order_detail.complete_hint')}</p>
          <CFormLabel>{t('order_detail.complete_note')}</CFormLabel>
          <CFormTextarea rows={3} value={completeNote}
            onChange={e => setCompleteNote(e.target.value)}
            placeholder={t('order_detail.complete_note_ph')} />
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={() => setCompleteModal(false)}>
            {t('common.cancel')}
          </CButton>
          <CButton color="success" onClick={handleComplete} disabled={saving}>
            {saving ? <CSpinner size="sm" /> : `✅ ${t('order_detail.complete_btn')}`}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Модал: Платёж */}
      <CModal visible={payModal} onClose={() => setPayModal(false)}>
        <CModalHeader><CModalTitle>{t('order_detail.pay_title')}</CModalTitle></CModalHeader>
        <CForm onSubmit={handlePayment}>
          <CModalBody>
            <CRow className="g-3">
              <CCol xs={12}>
                <CFormLabel>{t('order_detail.pay_amount')} *</CFormLabel>
                <CFormInput required type="number" min="1" step="any"
                  value={payForm.amount}
                  onChange={e => setPayForm({...payForm, amount:e.target.value})}
                  placeholder={`${t('order_detail.pay_remainder')}: ${debt.toLocaleString()} сом.`} />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>{t('order_detail.pay_type')}</CFormLabel>
                <CFormSelect value={payForm.payment_type}
                  onChange={e => setPayForm({...payForm, payment_type:e.target.value})}>
                  <option value="cash">{t('order_detail.pay_cash')}</option>
                  <option value="card">{t('order_detail.pay_card')}</option>
                  <option value="transfer">{t('order_detail.pay_transfer')}</option>
                  <option value="other">{t('order_detail.pay_other')}</option>
                </CFormSelect>
              </CCol>
              <CCol xs={12}>
                <CFormLabel>{t('order_detail.pay_note')}</CFormLabel>
                <CFormInput value={payForm.notes}
                  onChange={e => setPayForm({...payForm, notes:e.target.value})}
                  placeholder={t('order_detail.pay_note_ph')} />
              </CCol>
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setPayModal(false)}>
              {t('common.cancel')}
            </CButton>
            <CButton type="submit" color="success" disabled={saving}>
              {saving ? <CSpinner size="sm" /> : t('order_detail.pay_submit')}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>

      {/* Модал: Комментарий */}
      <CModal visible={commentModal} onClose={() => setCommentModal(false)}>
        <CModalHeader>
          <CModalTitle>
            {t('order_detail.comment_add')}
            {currentStage && (
              <span className="text-body-secondary ms-2" style={{ fontSize:14 }}>
                — {STAGE_LABELS[currentStage.stage]}
              </span>
            )}
          </CModalTitle>
        </CModalHeader>
        <CForm onSubmit={handleComment}>
          <CModalBody>
            <CFormTextarea required rows={4} value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder={t('order_detail.comment_ph')} />
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setCommentModal(false)}>
              {t('common.cancel')}
            </CButton>
            <CButton type="submit" color="primary" disabled={saving}>
              {saving ? <CSpinner size="sm" /> : t('common.add')}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>

      {/* Модал: Редактировать заказ */}
      <CModal visible={editModal} onClose={() => setEditModal(false)}>
        <CModalHeader><CModalTitle>{t('order_detail.edit_title')}</CModalTitle></CModalHeader>
        <CForm onSubmit={handleEdit}>
          <CModalBody>
            <CRow className="g-3">
              <CCol xs={12}>
                <CFormLabel>{t('order_detail.edit_name')}</CFormLabel>
                <CFormInput value={editForm.title || ''}
                  onChange={e => setEditForm({...editForm, title:e.target.value})} />
              </CCol>
              <CCol xs={6}>
                <CFormLabel>{t('order_detail.edit_final_cost')}</CFormLabel>
                <CFormInput type="number" min="0" step="any"
                  value={editForm.final_cost || ''}
                  onChange={e => setEditForm({...editForm, final_cost:e.target.value})} />
              </CCol>
              <CCol xs={6}>
                <CFormLabel>{t('order_detail.edit_deadline')}</CFormLabel>
                <CFormInput type="date" value={editForm.deadline || ''}
                  onChange={e => setEditForm({...editForm, deadline:e.target.value})} />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>{t('order_detail.edit_address')}</CFormLabel>
                <CFormInput value={editForm.address || ''}
                  onChange={e => setEditForm({...editForm, address:e.target.value})} />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>
                  <CIcon icon={cilLocationPin} className="me-1" style={{ width:14, height:14 }} />
                  {t('order_detail.edit_location')}
                </CFormLabel>
                <CFormInput value={editForm.location_url || ''}
                  onChange={e => setEditForm({...editForm, location_url:e.target.value})}
                  placeholder={t('order_detail.edit_location_ph')} />
                {editForm.location_url && (
                  <div className="mt-1">
                    <a href={editForm.location_url} target="_blank" rel="noopener noreferrer"
                      className="small text-primary">
                      🗺 {t('order_detail.edit_check_link')}
                    </a>
                  </div>
                )}
              </CCol>
              <CCol xs={12}>
                <CFormLabel>{t('order_detail.edit_description')}</CFormLabel>
                <CFormTextarea rows={3} value={editForm.description || ''}
                  onChange={e => setEditForm({...editForm, description:e.target.value})} />
              </CCol>
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setEditModal(false)}>
              {t('common.cancel')}
            </CButton>
            <CButton type="submit" color="primary" disabled={saving}>
              {saving ? <CSpinner size="sm" /> : t('common.save')}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>
    </>
  )
}