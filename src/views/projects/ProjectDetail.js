import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CCard, CCardBody, CCardHeader,
  CBadge, CButton, CSpinner, CAlert,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CForm, CFormInput, CFormLabel, CFormSelect, CFormTextarea,
  CTable, CTableHead, CTableBody, CTableRow,
  CTableHeaderCell, CTableDataCell,
  CNav, CNavItem, CNavLink,
  CProgress, CRow, CCol,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilArrowLeft, cilPlus, cilCheck, cilTrash,
  cilFile, cilHistory, cilMoney, cilTask, cilPeople,
} from '@coreui/icons'
import api from '../../api/client'
import { useAuth } from '../../AuthContext'
import FileUploader, { FileGallery } from '../../components/FileUploader'
import { getProjectStageAssignees, syncProjectStageAssignees } from '../../api/expenses'

const STAGES = [
  { key: 'intake',     label: 'Приём заказа', color: 'info'      },
  { key: 'design',     label: 'Дизайн',        color: 'primary'   },
  { key: 'cutting',    label: 'Раскрой',        color: 'warning'   },
  { key: 'production', label: 'Производство',   color: 'danger'    },
  { key: 'warehouse',  label: 'Склад',          color: 'secondary' },
  { key: 'delivery',   label: 'Доставка',       color: 'dark'      },
  { key: 'assembly',   label: 'Сборка',         color: 'success'   },
  { key: 'handover',   label: 'Сдача',          color: 'success'   },
]

const STAGE_UPLOAD_TYPE = {
  intake: 'project', design: 'design', cutting: 'cutting',
  production: 'project', warehouse: 'project',
  delivery: 'project', assembly: 'project', handover: 'project',
}

const STATUS_COLOR    = { pending:'secondary', in_progress:'primary', done:'success', skipped:'light' }
const STATUS_LABEL    = { pending:'Ожидание', in_progress:'В работе', done:'Готово', skipped:'Пропущен' }
const OP_STATUS_COLOR = { todo:'secondary', in_progress:'primary', done:'success' }
const OP_STATUS_LABEL = { todo:'К выполнению', in_progress:'В работе', done:'Готово' }
const UNITS = ['шт','м','м²','м³','кг','л','упак']

const ROLE_LABEL = {
  admin:'Администратор', supervisor:'Руководитель', master:'Мастер',
  manager:'Менеджер', designer:'Дизайнер', cutter:'Раскройщик',
  warehouse:'Складовщик', driver:'Водитель', assembler:'Сборщик', assistant:'Ассистент',
}

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { hasRole } = useAuth()

  const [project,       setProject]       = useState(null)
  const [stages,        setStages]        = useState([])
  const [activeStage,   setActiveStage]   = useState(null)
  const [stageDetail,   setStageDetail]   = useState(null)
  const [catalog,       setCatalog]       = useState([])
  const [history,       setHistory]       = useState([])
  const [allMaterials,  setAllMaterials]  = useState([])
  const [totalCost,     setTotalCost]     = useState(0)
  const [activeTab,     setActiveTab]     = useState('operations')
  const [loading,       setLoading]       = useState(true)
  const [stageLoading,  setStageLoading]  = useState(false)
  const [error,         setError]         = useState('')

  // Мультиназначение
  const [assignees,      setAssignees]      = useState([])   // текущие назначенные
  const [allUsers,       setAllUsers]       = useState([])   // все сотрудники
  const [assignModal,    setAssignModal]    = useState(false)
  const [selectedUsers,  setSelectedUsers]  = useState([])   // выбранные в модале
  const [assignSaving,   setAssignSaving]   = useState(false)

  const [opModal,       setOpModal]       = useState(false)
  const [matModal,      setMatModal]      = useState(false)
  const [completeModal, setCompleteModal] = useState(false)
  const [selectedOp,    setSelectedOp]    = useState(null)

  const [opForm,       setOpForm]       = useState({ catalog_id:'', custom_name:'', notes:'' })
  const [matForm,      setMatForm]      = useState({ name:'', quantity:1, unit:'шт', unit_price:0, supplier:'', supplier_phone:'', purchased_at:'', notes:'' })
  const [completeNote, setCompleteNote] = useState('')
  const [saving,       setSaving]       = useState(false)

  // ── Загрузка ─────────────────────────────────────────

  const loadProject = useCallback(async () => {
    try {
      const [projRes, stagesRes, catalogRes, usersRes] = await Promise.all([
        api.get('/projects'),
        api.get(`/projects/${id}/stages`),
        api.get('/catalog/operations'),
        api.get('/users/assignable'),
      ])
      const proj = projRes.data.data?.find(p => p.id === id)
      setProject(proj || null)
      const stagesData = stagesRes.data.data || []
      setStages(stagesData)
      setCatalog(catalogRes.data.data || [])
      setAllUsers(usersRes.data.data || [])
      const first = stagesData.find(s => s.status === 'in_progress') || stagesData[0]
      if (first) setActiveStage(first.id)
    } catch {
      setError('Ошибка загрузки проекта')
    } finally {
      setLoading(false)
    }
  }, [id])

  const loadStageDetail = useCallback(async (stageId) => {
    if (!stageId) return
    setStageLoading(true)
    try {
      const [detailRes, assigneesRes] = await Promise.all([
        api.get(`/projects/${id}/stages/${stageId}`),
        getProjectStageAssignees(id, stageId),
      ])
      setStageDetail(detailRes.data)
      setAssignees(assigneesRes.data.data || [])
    } catch {
      setError('Ошибка загрузки этапа')
    } finally {
      setStageLoading(false)
    }
  }, [id])

  const loadHistory     = useCallback(async () => {
    const res = await api.get(`/projects/${id}/history`)
    setHistory(res.data.data || [])
  }, [id])

  const loadAllMaterials = useCallback(async () => {
    const res = await api.get(`/projects/${id}/materials`)
    setAllMaterials(res.data.data || [])
    setTotalCost(res.data.total_cost || 0)
  }, [id])

  useEffect(() => { loadProject() }, [loadProject])
  useEffect(() => { if (activeStage) loadStageDetail(activeStage) }, [activeStage, loadStageDetail])
  useEffect(() => { if (activeTab === 'history') loadHistory() }, [activeTab, loadHistory])
  useEffect(() => { if (activeTab === 'materials') loadAllMaterials() }, [activeTab, loadAllMaterials])

  // ── Мультиназначение ──────────────────────────────────

  const openAssignModal = () => {
    setSelectedUsers(assignees.map(a => a.user_id))
    setAssignModal(true)
  }

  const toggleUser = (uid) => {
    setSelectedUsers(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    )
  }

  const handleAssignSave = async () => {
    setAssignSaving(true)
    try {
      await syncProjectStageAssignees(id, activeStage, selectedUsers)
      setAssignModal(false)
      loadStageDetail(activeStage)
    } catch {
      setError('Ошибка назначения сотрудников')
    } finally {
      setAssignSaving(false)
    }
  }

  // ── Завершение этапа ──────────────────────────────────

  const handleComplete = async () => {
    setSaving(true)
    try {
      await api.post(`/projects/${id}/stages/${activeStage}/complete`, { notes: completeNote })
      setCompleteModal(false)
      setCompleteNote('')
      await loadProject()
      await loadStageDetail(activeStage)
    } catch {
      setError('Ошибка завершения этапа')
    } finally {
      setSaving(false)
    }
  }

  // ── Операции ──────────────────────────────────────────

  const handleCreateOp = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await api.post(`/projects/${id}/operations`, {
        stage_id:    activeStage,
        catalog_id:  opForm.catalog_id ? parseInt(opForm.catalog_id) : null,
        custom_name: opForm.custom_name,
        notes:       opForm.notes,
      })
      setOpModal(false)
      setOpForm({ catalog_id:'', custom_name:'', notes:'' })
      loadStageDetail(activeStage)
    } catch { setError('Ошибка создания операции') }
    finally  { setSaving(false) }
  }

  const handleOpStatus = async (opId, status) => {
    await api.patch(`/projects/${id}/operations/${opId}`, { status })
    loadStageDetail(activeStage)
  }

  const handleDeleteOp = async (opId) => {
    if (!window.confirm('Удалить операцию?')) return
    await api.delete(`/projects/${id}/operations/${opId}`)
    loadStageDetail(activeStage)
  }

  // ── Материалы ─────────────────────────────────────────

  const handleCreateMat = async (e) => {
    e.preventDefault()
    if (!selectedOp) return
    setSaving(true)
    try {
      await api.post(`/projects/${id}/operations/${selectedOp}/materials`, matForm)
      setMatModal(false)
      setMatForm({ name:'', quantity:1, unit:'шт', unit_price:0, supplier:'', supplier_phone:'', purchased_at:'', notes:'' })
      setSelectedOp(null)
      loadStageDetail(activeStage)
    } catch { setError('Ошибка добавления материала') }
    finally  { setSaving(false) }
  }

  const handleDeleteMat = async (opId, matId) => {
    if (!window.confirm('Удалить материал?')) return
    await api.delete(`/projects/${id}/operations/${opId}/materials/${matId}`)
    loadStageDetail(activeStage)
  }

  // ── Файлы ─────────────────────────────────────────────

  const handleDeleteFile = async (fileId, fileUrl) => {
    if (!window.confirm('Удалить файл?')) return
    try {
      await api.delete(`/projects/${id}/stages/${activeStage}/files/${fileId}`)
      await api.delete('/files', { data: { file_url: fileUrl } })
      loadStageDetail(activeStage)
    } catch { setError('Ошибка удаления файла') }
  }

  // ── Рендер ────────────────────────────────────────────

  if (loading) return <div className="text-center mt-5"><CSpinner color="primary" /></div>
  if (!project) return <CAlert color="danger">Проект не найден</CAlert>

  const currentStage    = stages.find(s => s.id === activeStage)
  const currentStageDef = STAGES.find(s => s.key === currentStage?.stage)
  const doneCount       = stages.filter(s => s.status === 'done').length
  const progress        = stages.length > 0 ? Math.round((doneCount / stages.length) * 100) : 0
  const uploadType      = STAGE_UPLOAD_TYPE[currentStage?.stage] || 'project'
  const canManage       = hasRole('admin', 'supervisor', 'manager')

  return (
    <>
      {error && <CAlert color="danger" dismissible onClose={() => setError('')}>{error}</CAlert>}

      {/* ── Шапка ── */}
      <div className="d-flex align-items-start gap-3 mb-4">
        <CButton color="secondary" variant="ghost" size="sm"
          onClick={() => navigate('/projects')} className="mt-1">
          <CIcon icon={cilArrowLeft} />
        </CButton>
        <div className="flex-grow-1">
          <div className="d-flex align-items-center gap-2 mb-1">
            <CBadge color="secondary" style={{ fontSize:14, fontWeight:700 }}>
              #{project.project_number}
            </CBadge>
            <h4 className="mb-0">{project.title}</h4>
          </div>
          <div className="text-body-secondary small d-flex flex-wrap gap-3">
            {project.client_name  && <span>👤 {project.client_name}</span>}
            {project.client_phone && <span>📞 {project.client_phone}</span>}
            {project.deadline     && <span>📅 {project.deadline}</span>}
          </div>
        </div>
        <div className="text-end">
          <div className="small text-body-secondary mb-1">{doneCount} из {stages.length} этапов</div>
          <CProgress thin value={progress} color="success" style={{ width:140 }} />
          <div className="small text-body-secondary mt-1">{progress}%</div>
        </div>
      </div>

      {/* ── Карточки этапов ── */}
      <div className="d-flex gap-2 mb-4 overflow-auto pb-2">
        {STAGES.map(stageDef => {
          const stage = stages.find(s => s.stage === stageDef.key)
          if (!stage) return null
          const isActive = stage.id === activeStage
          return (
            <div key={stageDef.key} onClick={() => setActiveStage(stage.id)}
              style={{
                minWidth:115, cursor:'pointer',
                border:`2px solid ${isActive ? 'var(--cui-primary)' : 'var(--cui-border-color)'}`,
                borderRadius:8, padding:'10px 12px',
                background: isActive ? 'var(--cui-primary-bg-subtle)' : 'var(--cui-card-bg)',
                transition:'all 0.15s', userSelect:'none',
              }}>
              <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:0.4, color:'var(--cui-secondary-color)', marginBottom:4 }}>
                {stageDef.label}
              </div>
              <CBadge color={STATUS_COLOR[stage.status]} style={{ fontSize:10 }}>
                {STATUS_LABEL[stage.status]}
              </CBadge>
              <div style={{ fontSize:16, marginTop:4 }}>
                {stage.status === 'done'        && '✅'}
                {stage.status === 'in_progress' && '🔄'}
                {stage.status === 'pending'     && '⏳'}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Детали этапа ── */}
      {currentStage && (
        <CCard>
          <CCardHeader className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <strong>{currentStageDef?.label}</strong>
              <CBadge color={STATUS_COLOR[currentStage.status]}>
                {STATUS_LABEL[currentStage.status]}
              </CBadge>

              {/* Назначенные сотрудники */}
              {assignees.length > 0 ? (
                <div className="d-flex align-items-center gap-1 flex-wrap">
                  {assignees.map(a => (
                    <span key={a.user_id} className="d-inline-flex align-items-center gap-1"
                      style={{
                        background: 'var(--cui-primary-bg-subtle)',
                        border: '1px solid var(--cui-primary-border-subtle)',
                        borderRadius: 20, padding: '2px 8px', fontSize: 11,
                      }}>
                      {a.avatar_url ? (
                        <img src={a.avatar_url} alt="" style={{ width:16, height:16, borderRadius:'50%', objectFit:'cover' }} />
                      ) : (
                        <span style={{
                          width:16, height:16, borderRadius:'50%', background:'var(--cui-primary)',
                          color:'white', display:'inline-flex', alignItems:'center', justifyContent:'center',
                          fontSize:9, fontWeight:700,
                        }}>{a.full_name?.charAt(0)}</span>
                      )}
                      {a.full_name}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="small text-body-secondary">Не назначены</span>
              )}
            </div>

            <div className="d-flex gap-2 flex-wrap">
              {/* Кнопка назначения */}
              {canManage && (
                <CButton size="sm" color="secondary" variant="outline"
                  onClick={openAssignModal}>
                  <CIcon icon={cilPeople} className="me-1" />Назначить
                </CButton>
              )}
              {currentStage.status === 'in_progress' && (
                <>
                  <CButton size="sm" color="primary" variant="outline"
                    onClick={() => setOpModal(true)}>
                    <CIcon icon={cilPlus} className="me-1" />Операция
                  </CButton>
                  <CButton size="sm" color="success"
                    onClick={() => setCompleteModal(true)}>
                    <CIcon icon={cilCheck} className="me-1" />Завершить
                  </CButton>
                </>
              )}
            </div>
          </CCardHeader>

          <CCardBody>
            <CNav variant="tabs" className="mb-3">
              {[
                { key:'operations', label:'Операции', icon:cilTask     },
                { key:'materials',  label:'Материалы', icon:cilMoney   },
                { key:'files',      label:'Файлы',     icon:cilFile    },
                { key:'history',    label:'История',   icon:cilHistory },
              ].map(tab => (
                <CNavItem key={tab.key}>
                  <CNavLink active={activeTab === tab.key}
                    onClick={() => setActiveTab(tab.key)} style={{ cursor:'pointer' }}>
                    <CIcon icon={tab.icon} className="me-1" />{tab.label}
                  </CNavLink>
                </CNavItem>
              ))}
            </CNav>

            {stageLoading ? (
              <div className="text-center py-4"><CSpinner /></div>
            ) : (
              <>
                {/* ── Операции ── */}
                {activeTab === 'operations' && (
                  <div>
                    {!stageDetail?.operations?.length ? (
                      <div className="text-center text-body-secondary py-4">
                        Нет операций. Нажмите «Операция» чтобы добавить.
                      </div>
                    ) : stageDetail.operations.map(op => (
                      <CCard key={op.id} className="mb-3" style={{ border:'0.5px solid var(--cui-border-color)' }}>
                        <CCardHeader className="d-flex align-items-center justify-content-between py-2">
                          <div className="d-flex align-items-center gap-2">
                            <strong className="small">{op.catalog_name || op.custom_name}</strong>
                            <CBadge color={OP_STATUS_COLOR[op.status]} style={{ fontSize:11 }}>
                              {OP_STATUS_LABEL[op.status]}
                            </CBadge>
                            {op.assignee_name && (
                              <span className="text-body-secondary" style={{ fontSize:12 }}>
                                👤 {op.assignee_name}
                              </span>
                            )}
                          </div>
                          <div className="d-flex gap-1">
                            {op.status !== 'done' && (
                              <CButton size="sm" color="success" variant="outline"
                                onClick={() => handleOpStatus(op.id, op.status === 'todo' ? 'in_progress' : 'done')}>
                                {op.status === 'todo' ? 'Начать' : 'Завершить'}
                              </CButton>
                            )}
                            <CButton size="sm" color="primary" variant="outline"
                              onClick={() => { setSelectedOp(op.id); setMatModal(true) }}>
                              <CIcon icon={cilPlus} /> Материал
                            </CButton>
                            {hasRole('admin','supervisor') && (
                              <CButton size="sm" color="danger" variant="ghost"
                                onClick={() => handleDeleteOp(op.id)}>
                                <CIcon icon={cilTrash} />
                              </CButton>
                            )}
                          </div>
                        </CCardHeader>
                        {op.materials?.length > 0 && (
                          <CCardBody className="pt-2 pb-2">
                            <div className="small text-body-secondary mb-1 fw-semibold">Материалы:</div>
                            <CTable small responsive style={{ fontSize:13 }}>
                              <CTableHead>
                                <CTableRow>
                                  <CTableHeaderCell>Название</CTableHeaderCell>
                                  <CTableHeaderCell>Кол-во</CTableHeaderCell>
                                  <CTableHeaderCell>Цена/ед.</CTableHeaderCell>
                                  <CTableHeaderCell>Сумма</CTableHeaderCell>
                                  <CTableHeaderCell>Поставщик</CTableHeaderCell>
                                  <CTableHeaderCell></CTableHeaderCell>
                                </CTableRow>
                              </CTableHead>
                              <CTableBody>
                                {op.materials.map(mat => (
                                  <CTableRow key={mat.id}>
                                    <CTableDataCell>{mat.name}</CTableDataCell>
                                    <CTableDataCell>{mat.quantity} {mat.unit}</CTableDataCell>
                                    <CTableDataCell>{Number(mat.unit_price).toLocaleString()} сом.</CTableDataCell>
                                    <CTableDataCell className="fw-semibold">
                                      {Number(mat.total_price).toLocaleString()} сом.
                                    </CTableDataCell>
                                    <CTableDataCell className="text-body-secondary">
                                      <div>{mat.supplier || '—'}</div>
                                      {mat.supplier_phone && <div>{mat.supplier_phone}</div>}
                                    </CTableDataCell>
                                    <CTableDataCell>
                                      {hasRole('admin','supervisor') && (
                                        <CButton size="sm" color="danger" variant="ghost"
                                          onClick={() => handleDeleteMat(op.id, mat.id)}>
                                          <CIcon icon={cilTrash} />
                                        </CButton>
                                      )}
                                    </CTableDataCell>
                                  </CTableRow>
                                ))}
                              </CTableBody>
                            </CTable>
                          </CCardBody>
                        )}
                      </CCard>
                    ))}
                  </div>
                )}

                {/* ── Все материалы ── */}
                {activeTab === 'materials' && (
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <span className="text-body-secondary small">Все материалы по проекту</span>
                      <div className="fw-semibold">
                        Итого: <span className="text-success">{Number(totalCost).toLocaleString()} сом.</span>
                      </div>
                    </div>
                    <CTable hover responsive style={{ fontSize:13 }}>
                      <CTableHead>
                        <CTableRow>
                          <CTableHeaderCell>Материал</CTableHeaderCell>
                          <CTableHeaderCell>Кол-во</CTableHeaderCell>
                          <CTableHeaderCell>Цена/ед.</CTableHeaderCell>
                          <CTableHeaderCell>Сумма</CTableHeaderCell>
                          <CTableHeaderCell>Поставщик</CTableHeaderCell>
                          <CTableHeaderCell>Дата</CTableHeaderCell>
                        </CTableRow>
                      </CTableHead>
                      <CTableBody>
                        {allMaterials.length === 0 ? (
                          <CTableRow>
                            <CTableDataCell colSpan={6} className="text-center text-body-secondary py-3">
                              Материалы не добавлены
                            </CTableDataCell>
                          </CTableRow>
                        ) : allMaterials.map(mat => (
                          <CTableRow key={mat.id}>
                            <CTableDataCell className="fw-semibold">{mat.name}</CTableDataCell>
                            <CTableDataCell>{mat.quantity} {mat.unit}</CTableDataCell>
                            <CTableDataCell>{Number(mat.unit_price).toLocaleString()}</CTableDataCell>
                            <CTableDataCell className="fw-semibold text-success">
                              {Number(mat.total_price).toLocaleString()} сом.
                            </CTableDataCell>
                            <CTableDataCell>
                              <div>{mat.supplier || '—'}</div>
                              {mat.supplier_phone && <div className="text-body-secondary">{mat.supplier_phone}</div>}
                            </CTableDataCell>
                            <CTableDataCell className="text-body-secondary">
                              {mat.purchased_at?.slice(0,10) || '—'}
                            </CTableDataCell>
                          </CTableRow>
                        ))}
                      </CTableBody>
                    </CTable>
                  </div>
                )}

                {/* ── Файлы ── */}
                {activeTab === 'files' && (
                  <CRow>
                    <CCol md={4} className="mb-3">
                      <div className="small fw-semibold mb-2">Загрузить файлы</div>
                      <FileUploader projectId={id} stageId={activeStage}
                        uploadType={uploadType}
                        onUploaded={() => loadStageDetail(activeStage)} />
                    </CCol>
                    <CCol md={8}>
                      <div className="small fw-semibold mb-2">
                        Файлы этапа ({stageDetail?.files?.length || 0})
                      </div>
                      <FileGallery files={stageDetail?.files}
                        canDelete={hasRole('admin','supervisor','designer')}
                        onDelete={handleDeleteFile} />
                    </CCol>
                  </CRow>
                )}

                {/* ── История ── */}
                {activeTab === 'history' && (
                  <div>
                    {history.length === 0 ? (
                      <div className="text-center text-body-secondary py-4">История пуста</div>
                    ) : history.map((h, i) => (
                      <div key={h.id} className="d-flex gap-3 mb-3">
                        <div className="d-flex flex-column align-items-center">
                          <div style={{
                            width:32, height:32, borderRadius:'50%',
                            background:'var(--cui-primary-bg-subtle)', color:'var(--cui-primary)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontSize:14, fontWeight:600, flexShrink:0,
                          }}>
                            {h.changer_name?.charAt(0) || '?'}
                          </div>
                          {i < history.length - 1 && (
                            <div style={{ width:1, flex:1, background:'var(--cui-border-color)', minHeight:20, marginTop:4 }} />
                          )}
                        </div>
                        <div className="pb-3">
                          <div className="small fw-semibold">{h.changer_name || 'Система'}</div>
                          <div className="small text-body-secondary">
                            {STAGES.find(s => s.key === h.from_stage)?.label || h.from_stage}
                            {' → '}
                            {STAGES.find(s => s.key === h.to_stage)?.label || h.to_stage}
                          </div>
                          {h.comment && <div className="small mt-1">{h.comment}</div>}
                          <div style={{ fontSize:11, color:'var(--cui-secondary-color)' }}>
                            {new Date(h.created_at).toLocaleString('ru-RU')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CCardBody>
        </CCard>
      )}

      {/* ── Модал: Назначить сотрудников ── */}
      <CModal visible={assignModal} onClose={() => setAssignModal(false)}>
        <CModalHeader>
          <CModalTitle>
            <CIcon icon={cilPeople} className="me-2" />
            Назначить на этап: {currentStageDef?.label}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className="small text-body-secondary mb-3">
            Выберите сотрудников для этого этапа. Можно назначить несколько.
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {allUsers.filter(u => u.is_active).map(u => {
              const selected = selectedUsers.includes(u.id)
              return (
                <div key={u.id}
                  onClick={() => toggleUser(u.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px', cursor: 'pointer', borderRadius: 8,
                    marginBottom: 4,
                    background: selected ? 'var(--cui-primary-bg-subtle)' : 'var(--cui-tertiary-bg)',
                    border: `1px solid ${selected ? 'var(--cui-primary-border-subtle)' : 'var(--cui-border-color)'}`,
                    transition: 'all 0.1s',
                  }}>
                  {/* Чекбокс */}
                  <div style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    background: selected ? 'var(--cui-primary)' : 'transparent',
                    border: `2px solid ${selected ? 'var(--cui-primary)' : 'var(--cui-border-color)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {selected && <span style={{ color: 'white', fontSize: 12, lineHeight: 1 }}>✓</span>}
                  </div>
                  {/* Аватар */}
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                  ) : (
                    <div style={{
                      width:32, height:32, borderRadius:'50%', flexShrink:0,
                      background:'var(--cui-primary)', color:'white',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontWeight:700, fontSize:14,
                    }}>
                      {u.full_name?.charAt(0)}
                    </div>
                  )}
                  {/* Имя и роль */}
                  <div className="flex-grow-1">
                    <div className="fw-semibold small">
                      {u.full_name} {u.last_name}
                    </div>
                    <div className="small text-body-secondary">
                      {ROLE_LABEL[u.role_name] || u.role_name}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {selectedUsers.length > 0 && (
            <div className="mt-3 p-2 rounded small"
              style={{ background: 'var(--cui-success-bg-subtle)' }}>
              ✅ Выбрано: {selectedUsers.length} чел.
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={() => {
            setSelectedUsers([]); setAssignModal(false)
          }}>
            Отмена
          </CButton>
          <CButton color="primary" onClick={handleAssignSave} disabled={assignSaving}>
            {assignSaving ? <CSpinner size="sm" /> : 'Сохранить'}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* ── Модал: Операция ── */}
      <CModal visible={opModal} onClose={() => setOpModal(false)}>
        <CModalHeader><CModalTitle>Добавить операцию</CModalTitle></CModalHeader>
        <CForm onSubmit={handleCreateOp}>
          <CModalBody>
            <CRow className="g-3">
              <CCol xs={12}>
                <CFormLabel>Из каталога</CFormLabel>
                <CFormSelect value={opForm.catalog_id}
                  onChange={e => setOpForm({ ...opForm, catalog_id:e.target.value, custom_name:'' })}>
                  <option value="">— выбрать из каталога —</option>
                  {catalog.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.category})</option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Или своя операция</CFormLabel>
                <CFormInput placeholder="Название операции" value={opForm.custom_name}
                  onChange={e => setOpForm({ ...opForm, custom_name:e.target.value, catalog_id:'' })} />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Примечание</CFormLabel>
                <CFormTextarea rows={2} value={opForm.notes}
                  onChange={e => setOpForm({ ...opForm, notes:e.target.value })} />
              </CCol>
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setOpModal(false)}>Отмена</CButton>
            <CButton type="submit" color="primary" disabled={saving}>
              {saving ? <CSpinner size="sm" /> : 'Добавить'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>

      {/* ── Модал: Материал ── */}
      <CModal size="lg" visible={matModal} onClose={() => setMatModal(false)}>
        <CModalHeader><CModalTitle>Добавить материал</CModalTitle></CModalHeader>
        <CForm onSubmit={handleCreateMat}>
          <CModalBody>
            <CRow className="g-3">
              <CCol xs={12}>
                <CFormLabel>Название материала *</CFormLabel>
                <CFormInput required value={matForm.name}
                  onChange={e => setMatForm({ ...matForm, name:e.target.value })}
                  placeholder="МДФ 16мм, Кромка ПВХ и т.д." />
              </CCol>
              <CCol xs={4}>
                <CFormLabel>Количество *</CFormLabel>
                <CFormInput type="number" required min="0" step="0.001"
                  value={matForm.quantity}
                  onChange={e => setMatForm({ ...matForm, quantity:parseFloat(e.target.value)||0 })} />
              </CCol>
              <CCol xs={4}>
                <CFormLabel>Единица</CFormLabel>
                <CFormSelect value={matForm.unit}
                  onChange={e => setMatForm({ ...matForm, unit:e.target.value })}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </CFormSelect>
              </CCol>
              <CCol xs={4}>
                <CFormLabel>Цена за единицу</CFormLabel>
                <CFormInput type="number" min="0" step="0.01"
                  value={matForm.unit_price}
                  onChange={e => setMatForm({ ...matForm, unit_price:parseFloat(e.target.value)||0 })} />
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Поставщик</CFormLabel>
                <CFormInput value={matForm.supplier}
                  onChange={e => setMatForm({ ...matForm, supplier:e.target.value })}
                  placeholder="Название магазина/компании" />
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Телефон поставщика</CFormLabel>
                <CFormInput value={matForm.supplier_phone}
                  onChange={e => setMatForm({ ...matForm, supplier_phone:e.target.value })}
                  placeholder="+992 00 000 00 00" />
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Дата покупки</CFormLabel>
                <CFormInput type="date" value={matForm.purchased_at}
                  onChange={e => setMatForm({ ...matForm, purchased_at:e.target.value })} />
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Примечание</CFormLabel>
                <CFormInput value={matForm.notes}
                  onChange={e => setMatForm({ ...matForm, notes:e.target.value })} />
              </CCol>
              <CCol xs={12}>
                <div className="p-2 rounded" style={{ background:'var(--cui-success-bg-subtle)' }}>
                  <span className="small text-body-secondary">Итого: </span>
                  <strong className="text-success">
                    {(matForm.quantity * matForm.unit_price).toLocaleString()} сом.
                  </strong>
                </div>
              </CCol>
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setMatModal(false)}>Отмена</CButton>
            <CButton type="submit" color="primary" disabled={saving}>
              {saving ? <CSpinner size="sm" /> : 'Добавить'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>

      {/* ── Модал: Завершить этап ── */}
      <CModal visible={completeModal} onClose={() => setCompleteModal(false)}>
        <CModalHeader><CModalTitle>Завершить этап</CModalTitle></CModalHeader>
        <CModalBody>
          <p className="text-body-secondary small">
            После завершения проект автоматически перейдёт на следующий этап.
          </p>
          <CFormLabel>Примечание</CFormLabel>
          <CFormTextarea rows={3} value={completeNote}
            onChange={e => setCompleteNote(e.target.value)}
            placeholder="Что было сделано, особые замечания..." />
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={() => setCompleteModal(false)}>Отмена</CButton>
          <CButton color="success" onClick={handleComplete} disabled={saving}>
            {saving ? <CSpinner size="sm" /> : '✅ Завершить этап'}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}