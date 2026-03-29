import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CCard, CCardBody, CCardHeader,
  CTable, CTableBody, CTableDataCell,
  CTableHead, CTableHeaderCell, CTableRow,
  CBadge, CButton, CSpinner, CAlert,
  CModal, CModalHeader, CModalTitle,
  CModalBody, CModalFooter,
  CForm, CFormInput, CFormLabel,
  CFormSelect, CFormTextarea,
  CRow, CCol, CProgress,
  CInputGroup, CInputGroupText,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilSearch, cilFolderOpen } from '@coreui/icons'
import api from '../../api/client'
import { useAuth } from '../../AuthContext'

const STATUS_COLOR   = { new:'info', in_progress:'primary', on_hold:'warning', done:'success', cancelled:'danger' }
const STATUS_LABEL   = { new:'Новый', in_progress:'В работе', on_hold:'Ожидание', done:'Готово', cancelled:'Отменён' }
const PRIORITY_COLOR = { low:'success', medium:'warning', high:'danger' }
const PRIORITY_LABEL = { low:'Низкий', medium:'Средний', high:'Высокий' }

const STAGE_LABEL = {
  intake:'Приём заказа', design:'Дизайн', cutting:'Раскрой',
  production:'Производство', warehouse:'Склад',
  delivery:'Доставка', assembly:'Сборка', handover:'Сдача',
}

const EMPTY = {
  title:'', description:'', client_name:'', client_phone:'',
  status:'new', priority:'medium', deadline:'',
}

export default function Projects() {
  const { hasRole } = useAuth()
  const navigate    = useNavigate()

  const [projects, setProjects] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('')
  const [modal,    setModal]    = useState(false)
  const [form,     setForm]     = useState(EMPTY)
  const [saving,   setSaving]   = useState(false)

  const loadProjects = () => {
    setLoading(true)
    const q = filter ? `?status=${filter}` : ''
    api.get(`/projects${q}`)
      .then(r => setProjects(r.data.data || []))
      .catch(() => setError('Ошибка загрузки проектов'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadProjects() }, [filter])

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.post('/projects', form)
      setModal(false)
      setForm(EMPTY)
      if (res.data.id) {
        navigate(`/projects/${res.data.id}`)
      } else {
        loadProjects()
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка создания проекта')
    } finally {
      setSaving(false)
    }
  }

  const visible = projects.filter(p =>
    p.title?.toLowerCase().includes(search.toLowerCase()) ||
    p.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    String(p.project_number)?.includes(search)
  )

  return (
    <>
      {error && <CAlert color="danger" dismissible onClose={() => setError('')}>{error}</CAlert>}

      <CCard>
        <CCardHeader className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <strong>Проекты</strong>
          <div className="d-flex gap-2 align-items-center flex-wrap">
            <CFormSelect size="sm" style={{ width: 160 }} value={filter}
              onChange={e => setFilter(e.target.value)}>
              <option value="">Все статусы</option>
              <option value="new">Новые</option>
              <option value="in_progress">В работе</option>
              <option value="on_hold">Ожидание</option>
              <option value="done">Готовые</option>
            </CFormSelect>
            <CInputGroup size="sm" style={{ width: 220 }}>
              <CInputGroupText><CIcon icon={cilSearch} /></CInputGroupText>
              <CFormInput
                placeholder="Поиск по названию, клиенту, #..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </CInputGroup>
            {hasRole('admin', 'supervisor', 'manager') && (
              <CButton color="primary" size="sm" onClick={() => setModal(true)}>
                <CIcon icon={cilPlus} className="me-1" />Новый проект
              </CButton>
            )}
          </div>
        </CCardHeader>

        <CCardBody>
          {loading ? (
            <div className="text-center py-4"><CSpinner /></div>
          ) : (
            <CTable align="middle" hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ width: 60 }}>#</CTableHeaderCell>
                  <CTableHeaderCell>Проект</CTableHeaderCell>
                  <CTableHeaderCell>Клиент</CTableHeaderCell>
                  <CTableHeaderCell>Этап</CTableHeaderCell>
                  <CTableHeaderCell>Приоритет</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 140 }}>Прогресс</CTableHeaderCell>
                  <CTableHeaderCell>Дедлайн</CTableHeaderCell>
                  <CTableHeaderCell></CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {visible.length === 0 && (
                  <CTableRow>
                    <CTableDataCell colSpan={8} className="text-center text-body-secondary py-4">
                      Проекты не найдены
                    </CTableDataCell>
                  </CTableRow>
                )}
                {visible.map(p => (
                  <CTableRow
                    key={p.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/projects/${p.id}`)}
                  >
                    <CTableDataCell>
                      <CBadge color="secondary" style={{ fontSize: 12, fontWeight: 600 }}>
                        #{p.project_number}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className="fw-semibold">{p.title}</div>
                      <div className="small text-body-secondary">{p.total_tasks} задач</div>
                    </CTableDataCell>
                    <CTableDataCell className="small">
                      <div>{p.client_name || '—'}</div>
                      {p.client_phone && (
                        <div className="text-body-secondary">{p.client_phone}</div>
                      )}
                    </CTableDataCell>
                    <CTableDataCell>
                      {p.current_stage ? (
                        <CBadge color="primary" style={{ fontSize: 11 }}>
                          {STAGE_LABEL[p.current_stage] || p.current_stage}
                        </CBadge>
                      ) : (
                        <CBadge color={STATUS_COLOR[p.status] || 'secondary'}>
                          {STATUS_LABEL[p.status] || p.status}
                        </CBadge>
                      )}
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={PRIORITY_COLOR[p.priority] || 'secondary'}>
                        {PRIORITY_LABEL[p.priority] || p.priority}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className="small text-body-secondary mb-1">{p.progress}%</div>
                      <CProgress thin color={STATUS_COLOR[p.status] || 'primary'} value={p.progress} />
                    </CTableDataCell>
                    <CTableDataCell className="small">{p.deadline || '—'}</CTableDataCell>
                    <CTableDataCell onClick={e => e.stopPropagation()}>
                      <CButton
                        size="sm" color="primary" variant="ghost"
                        onClick={() => navigate(`/projects/${p.id}`)}
                      >
                        <CIcon icon={cilFolderOpen} />
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>

      {/* ── Модал создания ── */}
      <CModal size="lg" visible={modal} onClose={() => setModal(false)}>
        <CModalHeader><CModalTitle>Новый проект</CModalTitle></CModalHeader>
        <CForm onSubmit={handleCreate}>
          <CModalBody>
            <CRow className="g-3">
              <CCol xs={12}>
                <CFormLabel>Название проекта *</CFormLabel>
                <CFormInput
                  required value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Кухонный гарнитур"
                />
              </CCol>
              <CCol xs={12} md={6}>
                <CFormLabel>Имя клиента</CFormLabel>
                <CFormInput
                  value={form.client_name}
                  onChange={e => setForm({ ...form, client_name: e.target.value })}
                  placeholder="Иванов Иван"
                />
              </CCol>
              <CCol xs={12} md={6}>
                <CFormLabel>Телефон клиента</CFormLabel>
                <CFormInput
                  value={form.client_phone}
                  onChange={e => setForm({ ...form, client_phone: e.target.value })}
                  placeholder="+992 00 000 00 00"
                />
              </CCol>
              <CCol xs={12} md={4}>
                <CFormLabel>Приоритет</CFormLabel>
                <CFormSelect value={form.priority}
                  onChange={e => setForm({ ...form, priority: e.target.value })}>
                  <option value="low">Низкий</option>
                  <option value="medium">Средний</option>
                  <option value="high">Высокий</option>
                </CFormSelect>
              </CCol>
              <CCol xs={12} md={4}>
                <CFormLabel>Дедлайн</CFormLabel>
                <CFormInput type="date" value={form.deadline}
                  onChange={e => setForm({ ...form, deadline: e.target.value })} />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Описание</CFormLabel>
                <CFormTextarea rows={3} value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Описание проекта..."
                />
              </CCol>
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setModal(false)}>
              Отмена
            </CButton>
            <CButton type="submit" color="primary" disabled={saving}>
              {saving ? <CSpinner size="sm" /> : 'Создать проект'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>
    </>
  )
}