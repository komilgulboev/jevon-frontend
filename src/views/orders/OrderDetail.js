import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
  cilCalculator, cilPencil, cilPlus, cilLocationPin,
} from '@coreui/icons'
import api from '../../api/client'
import { useAuth } from '../../AuthContext'
import FileUploader, { FileGallery } from '../../components/FileUploader'
import MaterialsTable from '../../components/MaterialsTable'
import DetailEstimateTable from '../../components/DetailEstimateTable'
import ExpensesTable from '../../components/ExpensesTable'

const ORDER_TYPE_LABELS = {
  workshop:'Заказ цеха', cutting:'Распил',
  painting:'Покраска', cnc:'ЧПУ',
  soft_fabric:'Обивка', soft_furniture:'Мягкая мебель',
}
const ORDER_TYPE_COLOR = {
  workshop:'primary', cutting:'warning', painting:'danger',
  cnc:'info', soft_fabric:'success', soft_furniture:'dark',
}
const STAGE_LABELS = {
  intake:'Приём заказа', measure:'Замер', design:'Дизайн/Смета',
  purchase:'Закупка', production:'Производство', assembly:'Сборка',
  delivery:'Доставка', handover:'Сдача клиенту', material:'Приём материала',
  sawing:'Распил', edging:'Кромкование', drilling:'Присадка',
  packing:'Упаковка', shipment:'Отгрузка', calculate:'Расчёт',
  sanding:'Шлифовка', priming:'Грунтовка', painting:'Покраска',
  cnc_work:'Фрезеровка', assign:'Назначение', work:'Работа',
  materials:'Материалы', payment:'Оплата', edit:'Редактирование',
  estimate:'Смета',
}
const STATUS_COLOR  = { pending:'secondary', in_progress:'primary', done:'success', skipped:'light' }
const STATUS_LABEL  = { pending:'Ожидание', in_progress:'В работе', done:'Готово', skipped:'Пропущен' }
const PAYMENT_COLOR = { unpaid:'danger', partial:'warning', paid:'success', refund:'secondary' }
const PAYMENT_LABEL = { unpaid:'Не оплачен', partial:'Частично', paid:'Оплачен', refund:'Возврат' }
const PAYMENT_TYPES = { cash:'Наличные', card:'Карта', transfer:'Перевод', other:'Другое' }

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { hasRole } = useAuth()

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
    } catch { setError('Ошибка загрузки заказа') }
    finally  { setLoading(false) }
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
          const total = sections.reduce((s, sec) => s + (sec.total_price || 0), 0)
          setEstimateTotal(total)
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
  useEffect(() => { if (activeStage) loadStageFiles(activeStage) }, [activeStage, loadStageFiles])

  const handleComplete = async () => {
    setSaving(true)
    try {
      await api.post(`/orders/${id}/stages/${activeStage}/complete`, { notes: completeNote })
      setCompleteModal(false)
      setCompleteNote('')
      await loadOrder()
    } catch { setError('Ошибка завершения этапа') }
    finally  { setSaving(false) }
  }

  const handlePayment = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post(`/orders/${id}/payments`, { ...payForm, amount: parseFloat(payForm.amount) })
      setPayModal(false)
      setPayForm({ amount:'', payment_type:'cash', notes:'' })
      loadTabData('payments')
      loadOrder()
    } catch { setError('Ошибка добавления оплаты') }
    finally  { setSaving(false) }
  }

  const handleComment = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post(`/orders/${id}/comments`, {
        text: commentText, stage_id: activeStage || '',
      })
      setCommentModal(false)
      setCommentText('')
      loadTabData('comments')
    } catch { setError('Ошибка добавления комментария') }
    finally  { setSaving(false) }
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...editForm,
        final_cost:     editForm.final_cost     !== '' ? parseFloat(editForm.final_cost)     : undefined,
        estimated_cost: editForm.estimated_cost !== '' ? parseFloat(editForm.estimated_cost) : undefined,
      }
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])
      await api.patch(`/orders/${id}`, payload)
      setEditModal(false)
      loadOrder()
    } catch { setError('Ошибка обновления заказа') }
    finally  { setSaving(false) }
  }

  if (loading) return <div className="text-center mt-5"><CSpinner color="primary" /></div>
  if (!order)  return <CAlert color="danger">Заказ не найден</CAlert>

  const currentStage = stages.find(s => s.id === activeStage)
  const doneCount    = stages.filter(s => s.status === 'done').length
  const progress     = stages.length ? Math.round((doneCount / stages.length) * 100) : 0
  const cost         = order.final_cost || order.estimated_cost || 0
  const debt         = cost - (order.paid_amount || 0)

  const isWorkshop = order.order_type === 'workshop'
  const tabs = [
    { key:'stages',      label:'Детали',      icon:cilTask          },
    { key:'materials',   label:'Материалы',   icon:cilPlus          },
    { key:'calculation', label:'Смета',        icon:cilCalculator    },
    { key:'payments',    label:'Оплата',      icon:cilMoney         },
    { key:'comments',    label:'Комментарии', icon:cilCommentSquare },
    { key:'files',       label:'Файлы',       icon:cilFile          },
    { key:'history',     label:'История',     icon:cilHistory       },
    ...(isWorkshop ? [{ key:'expenses', label:'Расходы', icon:cilMoney }] : []),
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
            {hasRole('admin','supervisor','manager') && (
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
            {/* ── Локация — кликабельная ссылка ── */}
            {order.location_url && (
              <a
                href={order.location_url}
                target="_blank"
                rel="noopener noreferrer"
                className="d-flex align-items-center gap-1 text-decoration-none"
                style={{ color: 'var(--cui-primary)' }}
              >
                <CIcon icon={cilLocationPin} style={{ width: 14, height: 14 }} />
                <span>Открыть на карте</span>
              </a>
            )}
          </div>
        </div>
        <div className="text-end" style={{ minWidth:160 }}>
          <div className="fw-bold">{cost.toLocaleString()} сом.</div>
          <div className="small text-success">
            Оплачено: {(order.paid_amount||0).toLocaleString()}
          </div>
          {debt > 0 && <div className="small text-danger">Долг: {debt.toLocaleString()}</div>}
          <CBadge color={PAYMENT_COLOR[order.payment_status]} className="mt-1">
            {PAYMENT_LABEL[order.payment_status]}
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
        {/* Этапы */}
        <CCol md={3}>
          <CCard className="mb-3">
            <CCardHeader className="d-flex justify-content-between align-items-center py-2">
              <strong className="small">Этапы</strong>
              {currentStage?.status === 'in_progress' && (
                <CButton size="sm" color="success" onClick={() => setCompleteModal(true)}>
                  <CIcon icon={cilCheck} className="me-1" />Завершить
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
                  {s.assignee_name && (
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
                {tabs.map(t => (
                  <CNavItem key={t.key}>
                    <CNavLink active={activeTab === t.key}
                      onClick={() => setActiveTab(t.key)}
                      style={{ cursor:'pointer', fontSize:12, padding:'6px 10px' }}>
                      <CIcon icon={t.icon} className="me-1" />{t.label}
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
                      <div className="d-flex gap-2 mb-2 flex-wrap">
                        <strong>{STAGE_LABELS[currentStage.stage]}</strong>
                        <CBadge color={STATUS_COLOR[currentStage.status]}>
                          {STATUS_LABEL[currentStage.status]}
                        </CBadge>
                        {currentStage.assignee_name && (
                          <span className="small text-body-secondary">
                            👤 {currentStage.assignee_name}
                          </span>
                        )}
                      </div>
                      {currentStage.notes && (
                        <div className="p-2 rounded mb-2 small"
                          style={{ background:'var(--cui-secondary-bg)' }}>
                          {currentStage.notes}
                        </div>
                      )}
                      {currentStage.started_at && (
                        <div className="small text-body-secondary">
                          Начат: {new Date(currentStage.started_at).toLocaleString('ru-RU')}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center text-body-secondary py-3 small">Выберите этап</div>
                  )}
                  <hr />
                  <CRow className="g-2 small">
                    {[
                      { label:'Тип',       value: ORDER_TYPE_LABELS[order.order_type] },
                      { label:'Приоритет', value: order.priority },
                      { label:'Статус',    value: order.status },
                      { label:'Создан',    value: new Date(order.created_at).toLocaleDateString('ru-RU') },
                    ].filter(f => f.value).map(f => (
                      <CCol xs={6} key={f.label}>
                        <span className="text-body-secondary">{f.label}: </span>
                        <span className="fw-semibold">{f.value}</span>
                      </CCol>
                    ))}
                  </CRow>
                  {order.description && (
                    <div className="mt-2 p-2 rounded small"
                      style={{ background:'var(--cui-secondary-bg)' }}>
                      {order.description}
                    </div>
                  )}
                  {/* Локация в деталях */}
                  {order.location_url && (
                    <div className="mt-2">
                      <a href={order.location_url} target="_blank" rel="noopener noreferrer"
                        className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1">
                        <CIcon icon={cilLocationPin} style={{ width:14, height:14 }} />
                        Открыть локацию на карте
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Материалы */}
              {activeTab === 'materials' && (
                <MaterialsTable
                  orderId={id}
                  order={order}
                  stageName={STAGE_LABELS[currentStage?.stage] || ''}
                  canEdit={hasRole('admin','supervisor','manager','master','cutter')}
                />
              )}

              {/* Смета */}
              {activeTab === 'calculation' && (
                <DetailEstimateTable
                  orderId={id}
                  order={order}
                  payments={payments}
                  canEdit={hasRole('admin','supervisor','manager','master','cutter')}
                  canEditPrice={hasRole('admin','supervisor')}
                />
              )}

              {/* Оплата */}
              {activeTab === 'payments' && (
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                    <div className="d-flex gap-4">
                      <div>
                        <div className="small text-body-secondary">К оплате</div>
                        <div className="fw-bold">{cost.toLocaleString()} сом.</div>
                      </div>
                      <div>
                        <div className="small text-body-secondary">Оплачено</div>
                        <div className="fw-bold text-success">
                          {(order.paid_amount||0).toLocaleString()} сом.
                        </div>
                      </div>
                      <div>
                        <div className="small text-body-secondary">Остаток</div>
                        <div className={`fw-bold ${debt > 0 ? 'text-danger':'text-success'}`}>
                          {debt.toLocaleString()} сом.
                        </div>
                      </div>
                    </div>
                    {hasRole('admin','supervisor','manager') && (
                      <CButton size="sm" color="success" onClick={() => setPayModal(true)}>
                        + Платёж
                      </CButton>
                    )}
                  </div>
                  {payments.length === 0 ? (
                    <div className="text-center text-body-secondary py-3 small">
                      Платежи не зарегистрированы
                    </div>
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
                            <CTableDataCell className="fw-semibold text-success">
                              {Number(p.amount).toLocaleString()} сом.
                            </CTableDataCell>
                            <CTableDataCell>
                              {PAYMENT_TYPES[p.payment_type] || p.payment_type}
                            </CTableDataCell>
                            <CTableDataCell>{p.receiver_name || '—'}</CTableDataCell>
                            <CTableDataCell>
                              {new Date(p.paid_at).toLocaleDateString('ru-RU')}
                            </CTableDataCell>
                            <CTableDataCell className="text-body-secondary">
                              {p.notes || '—'}
                            </CTableDataCell>
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
                      + Комментарий
                    </CButton>
                  </div>
                  {comments.length === 0 ? (
                    <div className="text-center text-body-secondary py-3 small">
                      Комментарии отсутствуют
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
                            {new Date(c.created_at).toLocaleString('ru-RU')}
                          </span>
                        </div>
                        <div className="p-2 rounded small"
                          style={{ background:'var(--cui-secondary-bg)' }}>
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
                      Загрузить в: {STAGE_LABELS[currentStage?.stage] || '—'}
                    </div>
                    {activeStage ? (
                      <FileUploader
                        projectId={id}
                        stageId={activeStage}
                        uploadType={
                          order.order_type === 'cutting'  ? 'cutting' :
                          order.order_type === 'painting' ? 'design'  : 'project'
                        }
                        isOrder={true}
                        onUploaded={() => loadStageFiles(activeStage)}
                      />
                    ) : (
                      <div className="text-body-secondary small">Выберите этап слева</div>
                    )}
                  </CCol>
                  <CCol md={7}>
                    <div className="small fw-semibold mb-2">
                      Файлы: {STAGE_LABELS[currentStage?.stage]} ({stageFiles.length})
                    </div>
                    <FileGallery
                      files={stageFiles}
                      canDelete={hasRole('admin','supervisor')}
                      onDelete={async (fileId) => {
                        await api.delete(`/orders/${id}/stages/${activeStage}/files/${fileId}`)
                        loadStageFiles(activeStage)
                      }}
                    />
                  </CCol>
                </CRow>
              )}

              {/* Расходы */}
              {activeTab === 'expenses' && isWorkshop && (
                <ExpensesTable
                  orderId={id}
                  estimateTotal={estimateTotal}
                  canEdit={hasRole('admin','supervisor','manager')}
                />
              )}

              {/* История */}
              {activeTab === 'history' && (
                <div>
                  {history.length === 0 ? (
                    <div className="text-center text-body-secondary py-3 small">История пуста</div>
                  ) : history.map((h, i) => {
                    const isMaterial = h.from_stage === 'materials'
                    const isPayment  = h.from_stage === 'payment'
                    const isEdit     = h.from_stage === 'edit'
                    const isEstimate = h.from_stage === 'estimate'
                    const isFiles    = h.from_stage === 'files'
                    const isDeleted  = h.comment?.startsWith('-')

                    let bgColor, textColor, icon
                    if (isPayment) {
                      bgColor = 'var(--cui-success-bg-subtle)'; textColor = 'var(--cui-success)'; icon = '₽'
                    } else if (isEdit) {
                      bgColor = 'var(--cui-warning-bg-subtle)'; textColor = 'var(--cui-warning)'; icon = '✏'
                    } else if (isEstimate) {
                      bgColor = 'var(--cui-info-bg-subtle)'; textColor = 'var(--cui-info)'; icon = '📐'
                    } else if (isFiles) {
                      bgColor = 'var(--cui-secondary-bg)'; textColor = 'var(--cui-secondary-color)'; icon = '📎'
                    } else if (isMaterial && isDeleted) {
                      bgColor = 'var(--cui-danger-bg-subtle)'; textColor = 'var(--cui-danger)'; icon = '−'
                    } else if (isMaterial) {
                      bgColor = 'var(--cui-primary-bg-subtle)'; textColor = 'var(--cui-primary)'; icon = '+'
                    } else {
                      bgColor = 'var(--cui-primary-bg-subtle)'; textColor = 'var(--cui-primary)'
                      icon = h.changer_name?.charAt(0) || '?'
                    }

                    return (
                      <div key={h.id} className="d-flex gap-3 mb-3">
                        <div className="d-flex flex-column align-items-center">
                          <div style={{
                            width:28, height:28, borderRadius:'50%', flexShrink:0,
                            background:bgColor, color:textColor,
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontSize:13, fontWeight:700,
                          }}>
                            {icon}
                          </div>
                          {i < history.length - 1 && (
                            <div style={{ width:1, flex:1, background:'var(--cui-border-color)', marginTop:4, minHeight:14 }} />
                          )}
                        </div>
                        <div className="pb-2 flex-grow-1">
                          <div className="d-flex gap-2 align-items-center flex-wrap mb-1">
                            <span className="small fw-semibold">{h.changer_name || 'Система'}</span>
                            {isPayment  && <CBadge color="success"   style={{ fontSize:10 }}>Оплата</CBadge>}
                            {isEdit     && <CBadge color="warning"   style={{ fontSize:10 }}>Изменён заказ</CBadge>}
                            {isEstimate && <CBadge color="info"      style={{ fontSize:10 }}>Смета обновлена</CBadge>}
                            {isFiles    && <CBadge color="secondary" style={{ fontSize:10 }}>Файлы</CBadge>}
                            {isMaterial && (
                              <CBadge color={isDeleted ? 'danger':'primary'} style={{ fontSize:10 }}>
                                {isDeleted ? 'Удалён материал' : 'Добавлен материал'}
                              </CBadge>
                            )}
                            {!isMaterial && !isPayment && !isEdit && !isEstimate && !isFiles && h.from_stage !== h.to_stage && (
                              <span className="small text-body-secondary">
                                {STAGE_LABELS[h.from_stage] || h.from_stage}
                                {' → '}
                                {STAGE_LABELS[h.to_stage] || h.to_stage}
                              </span>
                            )}
                          </div>
                          {h.comment && (
                            <div className="small p-2 rounded mb-1" style={{
                              background: isPayment   ? 'var(--cui-success-bg-subtle)' :
                                          isEdit      ? 'var(--cui-warning-bg-subtle)'  :
                                          isEstimate  ? 'var(--cui-info-bg-subtle)'     :
                                          isFiles     ? 'var(--cui-secondary-bg)'       :
                                          isMaterial  ? (isDeleted ? 'var(--cui-danger-bg-subtle)' : 'var(--cui-primary-bg-subtle)')
                                          : 'var(--cui-secondary-bg)',
                              color: isPayment  ? 'var(--cui-success)' :
                                     isEdit     ? 'var(--cui-warning)'  :
                                     isEstimate ? 'var(--cui-info)'     :
                                     isMaterial && isDeleted ? 'var(--cui-danger)' : 'inherit',
                              fontFamily: (isMaterial || isPayment || isEdit || isEstimate || isFiles) ? 'monospace' : 'inherit',
                              fontSize: 12,
                            }}>
                              {h.comment}
                            </div>
                          )}
                          <div style={{ fontSize:11, color:'var(--cui-secondary-color)' }}>
                            {new Date(h.created_at).toLocaleString('ru-RU')}
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

      {/* Модал: Завершить этап */}
      <CModal visible={completeModal} onClose={() => setCompleteModal(false)}>
        <CModalHeader>
          <CModalTitle>Завершить: {STAGE_LABELS[currentStage?.stage]}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p className="text-body-secondary small">После завершения заказ перейдёт на следующий этап.</p>
          <CFormLabel>Примечание</CFormLabel>
          <CFormTextarea rows={3} value={completeNote}
            onChange={e => setCompleteNote(e.target.value)}
            placeholder="Что было сделано..." />
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={() => setCompleteModal(false)}>Отмена</CButton>
          <CButton color="success" onClick={handleComplete} disabled={saving}>
            {saving ? <CSpinner size="sm" /> : '✅ Завершить'}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Модал: Добавить платёж */}
      <CModal visible={payModal} onClose={() => setPayModal(false)}>
        <CModalHeader><CModalTitle>Добавить платёж</CModalTitle></CModalHeader>
        <CForm onSubmit={handlePayment}>
          <CModalBody>
            <CRow className="g-3">
              <CCol xs={12}>
                <CFormLabel>Сумма (сом.) *</CFormLabel>
                <CFormInput required type="number" min="1" step="any"
                  value={payForm.amount}
                  onChange={e => setPayForm({...payForm, amount:e.target.value})}
                  placeholder={`Остаток: ${debt.toLocaleString()} сом.`} />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Тип оплаты</CFormLabel>
                <CFormSelect value={payForm.payment_type}
                  onChange={e => setPayForm({...payForm, payment_type:e.target.value})}>
                  <option value="cash">Наличные</option>
                  <option value="card">Карта</option>
                  <option value="transfer">Перевод</option>
                  <option value="other">Другое</option>
                </CFormSelect>
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Примечание</CFormLabel>
                <CFormInput value={payForm.notes}
                  onChange={e => setPayForm({...payForm, notes:e.target.value})}
                  placeholder="Аванс, доплата..." />
              </CCol>
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setPayModal(false)}>Отмена</CButton>
            <CButton type="submit" color="success" disabled={saving}>
              {saving ? <CSpinner size="sm" /> : 'Записать платёж'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>

      {/* Модал: Комментарий */}
      <CModal visible={commentModal} onClose={() => setCommentModal(false)}>
        <CModalHeader>
          <CModalTitle>
            Комментарий
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
              placeholder="Ваш комментарий..." />
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setCommentModal(false)}>Отмена</CButton>
            <CButton type="submit" color="primary" disabled={saving}>
              {saving ? <CSpinner size="sm" /> : 'Добавить'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>

      {/* Модал: Редактировать заказ */}
      <CModal visible={editModal} onClose={() => setEditModal(false)}>
        <CModalHeader><CModalTitle>Редактировать заказ</CModalTitle></CModalHeader>
        <CForm onSubmit={handleEdit}>
          <CModalBody>
            <CRow className="g-3">
              <CCol xs={12}>
                <CFormLabel>Название</CFormLabel>
                <CFormInput value={editForm.title || ''}
                  onChange={e => setEditForm({...editForm, title:e.target.value})} />
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Итоговая стоимость (сом.)</CFormLabel>
                <CFormInput type="number" min="0" step="any"
                  value={editForm.final_cost || ''}
                  onChange={e => setEditForm({...editForm, final_cost:e.target.value})} />
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Срок</CFormLabel>
                <CFormInput type="date" value={editForm.deadline || ''}
                  onChange={e => setEditForm({...editForm, deadline:e.target.value})} />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Адрес</CFormLabel>
                <CFormInput value={editForm.address || ''}
                  onChange={e => setEditForm({...editForm, address:e.target.value})}
                  placeholder="Улица, дом, район..." />
              </CCol>
              {/* ── Локация ── */}
              <CCol xs={12}>
                <CFormLabel>
                  <CIcon icon={cilLocationPin} className="me-1" style={{ width:14, height:14 }} />
                  Ссылка на локацию
                </CFormLabel>
                <CFormInput
                  value={editForm.location_url || ''}
                  onChange={e => setEditForm({...editForm, location_url:e.target.value})}
                  placeholder="https://maps.google.com/... или https://2gis.com/..."
                />
                {editForm.location_url && (
                  <div className="mt-1">
                    <a href={editForm.location_url} target="_blank" rel="noopener noreferrer"
                      className="small text-primary">
                      🗺 Проверить ссылку
                    </a>
                  </div>
                )}
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Описание</CFormLabel>
                <CFormTextarea rows={3} value={editForm.description || ''}
                  onChange={e => setEditForm({...editForm, description:e.target.value})} />
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