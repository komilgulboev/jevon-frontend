import { useEffect, useState, useCallback } from 'react'
import {
  CCard, CCardBody, CCardHeader,
  CTable, CTableBody, CTableDataCell,
  CTableHead, CTableHeaderCell, CTableRow,
  CBadge, CButton, CSpinner, CAlert,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CForm, CFormInput, CFormLabel, CFormSelect, CFormTextarea,
  CRow, CCol, CInputGroup, CInputGroupText,
  CNav, CNavItem, CNavLink,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilSearch, cilPencil } from '@coreui/icons'
import api from '../../api/client'
import { useAuth } from '../../AuthContext'

const STATUS_COLOR = {
  todo: 'secondary', in_progress: 'primary',
  review: 'warning', done: 'success', cancelled: 'danger',
}
const STATUS_LABEL = {
  todo: 'Не начата', in_progress: 'В работе',
  review: 'На проверке', done: 'Готово', cancelled: 'Отменена',
}
const PRIORITY_COLOR = { low: 'secondary', medium: 'info', high: 'warning', urgent: 'danger' }
const PRIORITY_LABEL = { low: 'Низкий', medium: 'Средний', high: 'Высокий', urgent: 'Срочный' }

// ── Компонент страницы ────────────────────────────────────────

const EMPTY_FORM = {
  project_id: '', title: '', description: '',
  assigned_to: '', status: 'todo', priority: 'medium', due_date: '',
}

export default function Tasks() {
  const { hasRole } = useAuth()

  const [tasks,     setTasks]     = useState([])
  const [projects,  setProjects]  = useState([])
  const [users,     setUsers]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [search,    setSearch]    = useState('')
  const [statusF,   setStatusF]   = useState('')
  const [modal,     setModal]     = useState(false)
  const [editItem,  setEditItem]  = useState(null)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [saving,    setSaving]    = useState(false)
  const [activeTab, setActiveTab] = useState('tasks')

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get('/tasks'),
      api.get('/projects'),
      api.get('/users/assignable'),
    ])
      .then(([tasksRes, projRes, usersRes]) => {
        setTasks(tasksRes.data.data   || [])
        setProjects(projRes.data.data || [])
        setUsers(usersRes.data.data   || [])
      })
      .catch(() => setError('Ошибка загрузки'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const visible = tasks.filter(t => {
    if (statusF && t.status !== statusF) return false
    const q = search.toLowerCase()
    return (
      t.title?.toLowerCase().includes(q) ||
      t.assigned_to_name?.toLowerCase().includes(q) ||
      t.project_title?.toLowerCase().includes(q)
    )
  })

  const openCreate = () => {
    setEditItem(null); setForm(EMPTY_FORM); setModal(true)
  }

  const openEdit = (task) => {
    setEditItem(task)
    setForm({
      project_id:  task.project_id  || '',
      title:       task.title       || '',
      description: task.description || '',
      assigned_to: task.assigned_to || '',
      status:      task.status      || 'todo',
      priority:    task.priority    || 'medium',
      due_date:    task.due_date    || '',
    })
    setModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      if (editItem) await api.patch(`/tasks/${editItem.id}`, form)
      else          await api.post('/tasks', form)
      setModal(false); load()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка сохранения')
    } finally { setSaving(false) }
  }

  const handleStatusChange = async (task, status) => {
    try {
      await api.patch(`/tasks/${task.id}/status`, { status })
      load()
    } catch { setError('Ошибка обновления статуса') }
  }

  // Группировка задач по статусу для канбана
  const byStatus = {
    todo:        tasks.filter(t => t.status === 'todo'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    review:      tasks.filter(t => t.status === 'review'),
    done:        tasks.filter(t => t.status === 'done'),
  }

  return (
    <>
      {error && <CAlert color="danger" dismissible onClose={() => setError('')}>{error}</CAlert>}

      <CCard>
        <CCardHeader className="pb-0">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <strong>Задачи</strong>
            {hasRole('admin', 'supervisor') && (
              <CButton color="primary" size="sm" onClick={openCreate}>
                <CIcon icon={cilPlus} className="me-1" />Новая задача
              </CButton>
            )}
          </div>
          <CNav variant="tabs" className="card-header-tabs">
            {[
              { key: 'tasks',  label: 'Список' },
              { key: 'kanban', label: 'Канбан'  },
            ].map(tab => (
              <CNavItem key={tab.key}>
                <CNavLink active={activeTab === tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{ cursor: 'pointer' }}>
                  {tab.label}
                </CNavLink>
              </CNavItem>
            ))}
          </CNav>
        </CCardHeader>

        <CCardBody>
          {loading ? (
            <div className="text-center py-4"><CSpinner /></div>
          ) : (
            <>
              {/* ── Список задач ── */}
              {activeTab === 'tasks' && (
                <>
                  <div className="d-flex gap-2 mb-3 flex-wrap">
                    <CInputGroup size="sm" style={{ width: 220 }}>
                      <CInputGroupText><CIcon icon={cilSearch} /></CInputGroupText>
                      <CFormInput placeholder="Поиск..." value={search}
                        onChange={e => setSearch(e.target.value)} />
                    </CInputGroup>
                    <CFormSelect size="sm" style={{ width: 150 }}
                      value={statusF} onChange={e => setStatusF(e.target.value)}>
                      <option value="">Все статусы</option>
                      {Object.entries(STATUS_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </CFormSelect>
                  </div>

                  <CTable align="middle" hover responsive style={{ fontSize: 13 }}>
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell>Задача</CTableHeaderCell>
                        <CTableHeaderCell>Проект</CTableHeaderCell>
                        <CTableHeaderCell>Исполнитель</CTableHeaderCell>
                        <CTableHeaderCell>Приоритет</CTableHeaderCell>
                        <CTableHeaderCell>Статус</CTableHeaderCell>
                        <CTableHeaderCell>Срок</CTableHeaderCell>
                        {hasRole('admin', 'supervisor') && <CTableHeaderCell></CTableHeaderCell>}
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {visible.length === 0 && (
                        <CTableRow>
                          <CTableDataCell colSpan={7} className="text-center text-body-secondary py-4">
                            Задачи не найдены
                          </CTableDataCell>
                        </CTableRow>
                      )}
                      {visible.map(task => (
                        <CTableRow key={task.id}>
                          <CTableDataCell>
                            <div className="fw-semibold">{task.title}</div>
                            {task.description && (
                              <div className="small text-body-secondary">
                                {task.description.slice(0, 60)}{task.description.length > 60 ? '…' : ''}
                              </div>
                            )}
                          </CTableDataCell>
                          <CTableDataCell className="small text-body-secondary">
                            {task.project_title || '—'}
                          </CTableDataCell>
                          <CTableDataCell className="small">
                            {task.assigned_to_name || '—'}
                          </CTableDataCell>
                          <CTableDataCell>
                            <CBadge color={PRIORITY_COLOR[task.priority] || 'secondary'} style={{ fontSize: 10 }}>
                              {PRIORITY_LABEL[task.priority] || task.priority}
                            </CBadge>
                          </CTableDataCell>
                          <CTableDataCell>
                            <CFormSelect size="sm" style={{ width: 130, fontSize: 12 }}
                              value={task.status}
                              onChange={e => handleStatusChange(task, e.target.value)}>
                              {Object.entries(STATUS_LABEL).map(([v, l]) => (
                                <option key={v} value={v}>{l}</option>
                              ))}
                            </CFormSelect>
                          </CTableDataCell>
                          <CTableDataCell className="small">
                            {task.due_date ? (
                              <span className={
                                new Date(task.due_date) < new Date() && task.status !== 'done'
                                  ? 'text-danger fw-semibold' : 'text-body-secondary'
                              }>
                                {task.due_date}
                                {new Date(task.due_date) < new Date() && task.status !== 'done' && ' ⚠️'}
                              </span>
                            ) : '—'}
                          </CTableDataCell>
                          {hasRole('admin', 'supervisor') && (
                            <CTableDataCell>
                              <CButton size="sm" color="primary" variant="ghost"
                                onClick={() => openEdit(task)}>
                                <CIcon icon={cilPencil} />
                              </CButton>
                            </CTableDataCell>
                          )}
                        </CTableRow>
                      ))}
                    </CTableBody>
                  </CTable>
                </>
              )}

              {/* ── Канбан ── */}
              {activeTab === 'kanban' && (
                <div className="d-flex gap-3 overflow-auto pb-2">
                  {Object.entries(STATUS_LABEL).filter(([k]) => k !== 'cancelled').map(([status, label]) => (
                    <div key={status} style={{ minWidth: 240, flex: 1 }}>
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <CBadge color={STATUS_COLOR[status]}>{label}</CBadge>
                        <span className="small text-body-secondary">
                          {byStatus[status]?.length || 0}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(byStatus[status] || []).map(task => (
                          <div key={task.id} className="p-2 rounded"
                            style={{
                              background: 'var(--cui-secondary-bg)',
                              border: '1px solid var(--cui-border-color)',
                              cursor: 'pointer',
                            }}
                            onClick={() => hasRole('admin', 'supervisor') && openEdit(task)}>
                            <div className="small fw-semibold mb-1">{task.title}</div>
                            <div className="d-flex justify-content-between align-items-center">
                              <CBadge color={PRIORITY_COLOR[task.priority] || 'secondary'}
                                style={{ fontSize: 9 }}>
                                {PRIORITY_LABEL[task.priority]}
                              </CBadge>
                              {task.assigned_to_name && (
                                <span className="small text-body-secondary">
                                  👤 {task.assigned_to_name}
                                </span>
                              )}
                            </div>
                            {task.due_date && (
                              <div className="small text-body-secondary mt-1">
                                📅 {task.due_date}
                              </div>
                            )}
                          </div>
                        ))}
                        {(byStatus[status] || []).length === 0 && (
                          <div className="text-center text-body-secondary small py-3"
                            style={{ border: '1px dashed var(--cui-border-color)', borderRadius: 6 }}>
                            Пусто
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </>
          )}
        </CCardBody>
      </CCard>

      {/* Модал создания/редактирования задачи */}
      <CModal size="lg" visible={modal} onClose={() => setModal(false)}>
        <CModalHeader>
          <CModalTitle>{editItem ? 'Редактировать задачу' : 'Новая задача'}</CModalTitle>
        </CModalHeader>
        <CForm onSubmit={handleSave}>
          <CModalBody>
            <CRow className="g-3">
              <CCol xs={12}>
                <CFormLabel>Название *</CFormLabel>
                <CFormInput required value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Название задачи" />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Проект</CFormLabel>
                <CFormSelect value={form.project_id}
                  onChange={e => setForm({ ...form, project_id: e.target.value })}>
                  <option value="">— Без проекта —</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Исполнитель</CFormLabel>
                <CFormSelect value={form.assigned_to}
                  onChange={e => setForm({ ...form, assigned_to: e.target.value })}>
                  <option value="">— Не назначен —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} {u.last_name} ({u.role_name})
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Приоритет</CFormLabel>
                <CFormSelect value={form.priority}
                  onChange={e => setForm({ ...form, priority: e.target.value })}>
                  <option value="low">Низкий</option>
                  <option value="medium">Средний</option>
                  <option value="high">Высокий</option>
                  <option value="urgent">Срочный 🔴</option>
                </CFormSelect>
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Статус</CFormLabel>
                <CFormSelect value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}>
                  {Object.entries(STATUS_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Срок</CFormLabel>
                <CFormInput type="date" value={form.due_date}
                  onChange={e => setForm({ ...form, due_date: e.target.value })} />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Описание</CFormLabel>
                <CFormTextarea rows={3} value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Детали задачи..." />
              </CCol>
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setModal(false)}>
              Отмена
            </CButton>
            <CButton type="submit" color="primary" disabled={saving}>
              {saving ? <CSpinner size="sm" /> : 'Сохранить'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>
    </>
  )
}