// src/components/EstimateSectionStages.js
import { useEffect, useState, useCallback } from 'react'
import {
  CSpinner, CBadge, CButton,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CFormInput, CInputGroup, CInputGroupText,
} from '@coreui/react'
import { useNavigate } from 'react-router-dom'
import CIcon from '@coreui/icons-react'
import { cilExternalLink, cilPeople, cilSearch } from '@coreui/icons'
import api from '../api/client'
import { getOrderStageAssignees, syncOrderStageAssignees } from '../api/expenses'

const SERVICE_LABELS = {
  cutting:       { label: 'Распил',        icon: '🪚', color: '#ff9800' },
  painting:      { label: 'Покраска',      icon: '🎨', color: '#f44336' },
  cnc:           { label: 'ЧПУ',           icon: '⚙️', color: '#2196f3' },
  soft:          { label: 'Мягкая мебель', icon: '🛋️', color: '#4caf50' },
  soft_fabric:   { label: 'Мягкая мебель', icon: '🛋️', color: '#4caf50' },
  soft_furniture:{ label: 'Мягкая мебель', icon: '🛋️', color: '#4caf50' },
}

const STAGE_LABELS = {
  intake: 'Приём', measure: 'Замер', design: 'Дизайн',
  purchase: 'Закупка', production: 'Производство', assembly: 'Сборка',
  delivery: 'Доставка', handover: 'Сдача',
  material: 'Материал', sawing: 'Распил', edging: 'Кромка',
  drilling: 'Присадка', packing: 'Упаковка', shipment: 'Отгрузка',
  calculate: 'Расчёт', sanding: 'Шлифовка', priming: 'Грунтовка',
  painting: 'Покраска', cnc_work: 'Фрезеровка', assign: 'Назначение',
  work: 'Работа',
}

const STATUS_CONFIG = {
  pending:     { icon: '⏳', bg: 'var(--cui-secondary-bg)' },
  in_progress: { icon: '🔄', bg: 'var(--cui-primary-bg-subtle)' },
  done:        { icon: '✅', bg: 'var(--cui-success-bg-subtle)' },
  skipped:     { icon: '⏭️', bg: 'var(--cui-tertiary-bg)' },
}

const ROLE_LABEL = {
  admin: 'Администратор', supervisor: 'Руководитель', master: 'Мастер',
  manager: 'Менеджер', designer: 'Дизайнер', cutter: 'Раскройщик',
  warehouse: 'Складовщик', driver: 'Водитель', assembler: 'Сборщик',
  assistant: 'Ассистент',
}

  // Сигнатура:
export default function EstimateSectionStages({ orderId, canEdit, canAssign, refreshKey }) {
  const navigate = useNavigate()

  const [sections,      setSections]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [completing,    setCompleting]    = useState(null)

  // Стейт для модала назначения
  const [assignModal,   setAssignModal]   = useState(false)
  const [assignTarget,  setAssignTarget]  = useState(null) // {childOrderId, stageId, stageName, svcColor}
  const [assignees,     setAssignees]     = useState([])
  const [allUsers,      setAllUsers]      = useState([])
  const [selectedUsers, setSelectedUsers] = useState([])
  const [assignSearch,  setAssignSearch]  = useState('')
  const [assignSaving,  setAssignSaving]  = useState(false)

  const load = useCallback(async () => {
    if (!orderId) return
    setLoading(true)
    try {
      const linksRes = await api.get(`/orders/${orderId}/service-links`)
      const links = linksRes.data.data || []

      if (links.length === 0) {
        setSections([])
        setLoading(false)
        return
      }

      const results = await Promise.all(links.map(async link => {
        try {
          const stagesRes = await api.get(`/orders/${link.child_order_id}/stages`)
          const stages = stagesRes.data.data || []

          // Для каждого этапа загружаем assignees
          const stagesWithAssignees = await Promise.all(stages.map(async stage => {
            try {
              const res = await getOrderStageAssignees(link.child_order_id, stage.id)
              return { ...stage, assignees: res.data.data || [] }
            } catch {
              return { ...stage, assignees: [] }
            }
          }))

          return {
            serviceType:    link.service_type,
            childOrderId:   link.child_order_id,
            childOrderType: link.child_order_type,
            childTitle:     link.child_title,
            childStatus:    link.child_status,
            amount:         link.amount || 0,
            stages:         stagesWithAssignees,
          }
        } catch {
          return null
        }
      }))

      setSections(results.filter(Boolean))
    } catch {}
    setLoading(false)
  }, [orderId])

  useEffect(() => { load() }, [load, refreshKey])

  // Загрузить список всех пользователей один раз
  useEffect(() => {
    api.get('/users/assignable')
      .then(r => setAllUsers(r.data.data || []))
      .catch(() => {})
  }, [])

  const handleComplete = async (childOrderId, stageId) => {
    setCompleting(stageId)
    try {
      await api.post(`/orders/${childOrderId}/stages/${stageId}/complete`, { notes: '' })
      load()
    } catch {}
    setCompleting(null)
  }

  const openAssignModal = async (childOrderId, stageId, stageName, svcColor) => {
    setAssignTarget({ childOrderId, stageId, stageName, svcColor })
    setAssignSearch('')
    try {
      const res = await getOrderStageAssignees(childOrderId, stageId)
      const current = res.data.data || []
      setAssignees(current)
      setSelectedUsers(current.map(a => a.user_id))
    } catch {
      setAssignees([])
      setSelectedUsers([])
    }
    setAssignModal(true)
  }

  const toggleUser = (uid) => {
    setSelectedUsers(prev =>
      prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid]
    )
  }

  const handleAssignSave = async () => {
    if (!assignTarget) return
    setAssignSaving(true)
    try {
      await syncOrderStageAssignees(assignTarget.childOrderId, assignTarget.stageId, selectedUsers)
      setAssignModal(false)
      load()
    } catch {}
    setAssignSaving(false)
  }

  const filteredUsers = allUsers.filter(u => {
    if (!u.is_active) return false
    if (!assignSearch) return true
    const q = assignSearch.toLowerCase()
    const name = `${u.full_name || ''} ${u.last_name || ''}`.toLowerCase()
    const role = String(ROLE_LABEL[u.role_name] || u.role_name || '').toLowerCase()
    return name.includes(q) || role.includes(q)
  })

  if (loading) return (
    <div className="text-center py-2 mt-3"><CSpinner size="sm" /></div>
  )

  if (sections.length === 0) return null

  return (
    <div className="mt-3">
      <div className="small fw-semibold text-body-secondary mb-2">Этапы по услугам</div>
      <div className="d-flex flex-column gap-3">
        {sections.map(sec => {
          const svc      = SERVICE_LABELS[sec.serviceType] || SERVICE_LABELS[sec.childOrderType] || { label: sec.serviceType, icon: '📋', color: 'var(--cui-primary)' }
          const doneCount = sec.stages.filter(s => s.status === 'done').length
          const total     = sec.stages.length
          const progress  = total ? Math.round(doneCount / total * 100) : 0
          const allDone   = doneCount === total && total > 0
          const activeStage = sec.stages.find(s => s.status === 'in_progress')

          return (
            <div key={sec.childOrderId} style={{
              border: '1px solid var(--cui-border-color)',
              borderLeft: `3px solid ${svc.color}`,
              borderRadius: 8,
              padding: '10px 14px',
              background: allDone ? 'var(--cui-success-bg-subtle)' : 'var(--cui-card-bg)',
            }}>
              {/* Заголовок */}
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="d-flex align-items-center gap-2">
                  <span style={{ fontSize: 16 }}>{svc.icon}</span>
                  <span className="fw-semibold small">{svc.label}</span>
                  <span className="small text-body-secondary">{doneCount}/{total}</span>
                  {allDone && <CBadge color="success" style={{ fontSize: 10 }}>Готово</CBadge>}
                </div>
                <div className="d-flex align-items-center gap-2">
                  <div style={{ width: 60, height: 4, background: 'var(--cui-secondary-bg)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: allDone ? 'var(--cui-success)' : svc.color, transition: 'width 0.3s' }} />
                  </div>
                  <CButton size="sm" color="secondary" variant="ghost"
                    onClick={() => navigate(`/orders/${sec.childOrderId}`)} title="Открыть заказ">
                    <CIcon icon={cilExternalLink} style={{ width: 12, height: 12 }} />
                  </CButton>
                </div>
              </div>

              {/* Цепочка этапов */}
              <div className="d-flex flex-wrap gap-1 align-items-center">
                {sec.stages.map((stage, idx) => {
                  const cfg      = STATUS_CONFIG[stage.status] || STATUS_CONFIG.pending
                  const isActive = stage.status === 'in_progress'
                  const isDone   = stage.status === 'done'
                  const name     = STAGE_LABELS[stage.stage] || stage.stage

                  return (
                    <div key={stage.id} className="d-flex align-items-center gap-1">
                      {idx > 0 && (
                        <span style={{ color: 'var(--cui-secondary-color)', fontSize: 11, opacity: 0.5 }}>›</span>
                      )}
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        padding: '2px 8px', borderRadius: 12, fontSize: 11,
                        background: cfg.bg,
                        border: `1px solid ${isActive ? svc.color : 'transparent'}`,
                        fontWeight: isActive ? 600 : 400,
                        opacity: isDone ? 0.65 : 1,
                        color: isDone ? 'var(--cui-success)' : isActive ? svc.color : 'inherit',
                      }}>
                        <span>{cfg.icon}</span>
                        <span>{name}</span>
                        {/* Кнопка назначить */}
                        {canAssign  && isActive && (
                          <button
                            onClick={() => openAssignModal(sec.childOrderId, stage.id, name, svc.color)}
                            title="Назначить сотрудника"
                            style={{
                              border: 'none', background: 'transparent',
                              cursor: 'pointer', padding: '0 1px',
                              color: svc.color, fontSize: 11, lineHeight: 1,
                            }}>
                            👤
                          </button>
                        )}
                        {/* Кнопка завершить */}
                        {canEdit && isActive && (
                          <button
                            onClick={() => handleComplete(sec.childOrderId, stage.id)}
                            disabled={completing === stage.id}
                            title="Завершить этап"
                            style={{
                              border: 'none', background: svc.color, color: '#fff',
                              borderRadius: 8, width: 14, height: 14, fontSize: 9,
                              cursor: 'pointer', display: 'inline-flex',
                              alignItems: 'center', justifyContent: 'center',
                              marginLeft: 1, padding: 0, flexShrink: 0,
                            }}>
                            {completing === stage.id ? '…' : '✓'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Назначенные на активном этапе */}
{/* Назначенные на активном этапе */}
{activeStage && activeStage.assignees?.length > 0 && (
  <div className="d-flex flex-wrap gap-1 mt-2">
    {activeStage.assignees.map(a => (
      <span key={a.user_id}
        className="d-inline-flex align-items-center gap-1"
        style={{
          background: 'var(--cui-primary-bg-subtle)',
          border: '1px solid var(--cui-primary-border-subtle)',
          borderRadius: 20, padding: '1px 7px', fontSize: 11,
        }}>
        {a.avatar_url
          ? <img src={a.avatar_url} alt="" style={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'cover' }} />
          : <span style={{ width: 14, height: 14, borderRadius: '50%', background: svc.color, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700 }}>{a.full_name?.charAt(0)}</span>
        }
        {a.full_name}

        {/* ── Кнопка снятия — только если этап не завершён ── */}
        {canAssign && activeStage.status !== 'done' && (
          <button
            onClick={async () => {
              const remaining = activeStage.assignees
                .filter(x => x.user_id !== a.user_id)
                .map(x => x.user_id)
              try {
                await syncOrderStageAssignees(sec.childOrderId, activeStage.id, remaining)
                load()
              } catch {}
            }}
            title={`Снять ${a.full_name}`}
            style={{
              border: 'none', background: 'none', cursor: 'pointer',
              color: 'var(--cui-danger)', fontSize: 13, lineHeight: 1,
              padding: '0 0 0 2px', marginLeft: 1,
            }}>×</button>
        )}
      </span>
    ))}
  </div>
)}
            </div>
          )
        })}
      </div>

      {/* Модал назначения */}
      <CModal visible={assignModal} onClose={() => { setAssignModal(false); setAssignSearch('') }}>
        <CModalHeader>
          <CModalTitle>
            <CIcon icon={cilPeople} className="me-2" />
            Назначить: {assignTarget?.stageName}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CInputGroup size="sm" className="mb-3">
            <CInputGroupText><CIcon icon={cilSearch} /></CInputGroupText>
            <CFormInput
              placeholder="Поиск по имени или роли..."
              value={assignSearch}
              onChange={e => setAssignSearch(e.target.value)}
              autoFocus
            />
            {assignSearch && (
              <CButton color="secondary" variant="outline" type="button"
                onClick={() => setAssignSearch('')}>×</CButton>
            )}
          </CInputGroup>

          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {filteredUsers.length === 0 ? (
              <div className="text-center text-body-secondary py-4 small">Сотрудники не найдены</div>
            ) : filteredUsers.map(u => {
              const selected = selectedUsers.includes(u.id)
              return (
                <div key={u.id} onClick={() => toggleUser(u.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px', cursor: 'pointer', borderRadius: 8, marginBottom: 4,
                    background: selected ? 'var(--cui-primary-bg-subtle)' : 'var(--cui-tertiary-bg)',
                    border: `1px solid ${selected ? 'var(--cui-primary-border-subtle)' : 'var(--cui-border-color)'}`,
                    transition: 'all 0.1s',
                  }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    background: selected ? 'var(--cui-primary)' : 'transparent',
                    border: `2px solid ${selected ? 'var(--cui-primary)' : 'var(--cui-border-color)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {selected && <span style={{ color: 'white', fontSize: 12, lineHeight: 1 }}>✓</span>}
                  </div>
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'var(--cui-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>{u.full_name?.charAt(0)}</div>
                  }
                  <div className="flex-grow-1">
                    <div className="fw-semibold small">{u.full_name} {u.last_name}</div>
                    <div className="small text-body-secondary">{ROLE_LABEL[u.role_name] || u.role_name}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {selectedUsers.length > 0 && (
            <div className="mt-3 p-2 rounded small" style={{ background: 'var(--cui-success-bg-subtle)' }}>
              ✅ Выбрано: {selectedUsers.length} чел.
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline"
            onClick={() => { setSelectedUsers([]); setAssignModal(false); setAssignSearch('') }}>
            Отмена
          </CButton>
          <CButton color="primary" onClick={handleAssignSave} disabled={assignSaving}>
            {assignSaving ? <CSpinner size="sm" /> : 'Сохранить'}
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}