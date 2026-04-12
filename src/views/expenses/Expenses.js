import { useEffect, useState, useCallback } from 'react'
import {
  CCard, CCardBody, CCardHeader,
  CTable, CTableBody, CTableDataCell,
  CTableHead, CTableHeaderCell, CTableRow,
  CBadge, CButton, CSpinner, CAlert,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CForm, CFormInput, CFormLabel, CFormSelect, CFormTextarea,
  CRow, CCol, CInputGroup, CInputGroupText,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilSearch, cilPencil, cilTrash, cilWarning } from '@coreui/icons'
import { getExpenses, getExpenseCategories, createExpense, updateExpense, deleteExpense } from '../../api/expenses'
import { useAuth } from '../../AuthContext'
import api from '../../api/client'

const METHOD_LABEL = { cash: 'Наличные', card: 'Карта', transfer: 'Перевод', other: 'Другое' }
const METHOD_COLOR = { cash: 'success', card: 'info', transfer: 'primary', other: 'secondary' }

const SALARY_CAT  = 'Зарплата'
const PROJECT_CAT = 'Проекты'
const ORDER_CAT   = 'Заказы'

const DEFAULT_CATEGORIES = [
  'Аренда', 'Коммунальные', SALARY_CAT, 'Материалы',
  'Инструменты', 'Транспорт', 'Реклама', ORDER_CAT, PROJECT_CAT, 'Прочее',
]

const EMPTY_FORM = {
  expense_date:   new Date().toISOString().slice(0, 10),
  category:       '',
  description:    '',
  amount:         '',
  method:         'cash',
  linked_user_id: '',
  project_id:     '',
  order_id:       '',
}

export default function Expenses() {
  const { hasRole } = useAuth()
  const canEdit   = hasRole('admin', 'supervisor', 'manager')
  const canDelete = hasRole('admin', 'supervisor')

  const [expenses,   setExpenses]   = useState([])
  const [categories, setCategories] = useState([])
  const [total,      setTotal]      = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [search,     setSearch]     = useState('')
  const [filterCat,  setFilterCat]  = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo,   setFilterTo]   = useState('')
  const [modal,      setModal]      = useState(false)
  const [editItem,   setEditItem]   = useState(null)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)

  // Для категории Зарплата
  const [employees,    setEmployees]    = useState([])
  const [salaryInfo,   setSalaryInfo]   = useState(null)
  const [salaryWarn,   setSalaryWarn]   = useState('')

  // Для категории Проекты
  const [projects, setProjects] = useState([])
  // Для категории Заказы
  const [orders, setOrders] = useState([])

  const load = useCallback(() => {
    setLoading(true)
    const params = {}
    if (filterFrom) params.from = filterFrom
    if (filterTo)   params.to   = filterTo
    if (filterCat)  params.category = filterCat

    Promise.all([getExpenses(params), getExpenseCategories()])
      .then(([expRes, catRes]) => {
        setExpenses(expRes.data.data || [])
        setTotal(expRes.data.total || 0)
        const serverCats = catRes.data.data || []
        const merged = [...new Set([...DEFAULT_CATEGORIES, ...serverCats])]
        setCategories(merged.sort())
      })
      .catch(() => setError('Ошибка загрузки'))
      .finally(() => setLoading(false))
  }, [filterFrom, filterTo, filterCat])

  useEffect(() => { load() }, [load])

  // Загружаем сотрудников, проекты и заказы при открытии модала
  useEffect(() => {
    if (!modal) return
    api.get('/users/assignable').then(r => setEmployees(r.data.data || [])).catch(() => {})
    api.get('/projects').then(r => {
      const active = (r.data.data || []).filter(p => p.status !== 'done' && p.status !== 'cancelled')
      setProjects(active)
    }).catch(() => {})
    api.get('/orders').then(r => {
      const active = (r.data.data || []).filter(o => o.status !== 'cancelled' && o.status !== 'done')
      setOrders(active)
    }).catch(() => {})
  }, [modal])

  // При выборе сотрудника в категории Зарплата — проверяем лимит аванса
  useEffect(() => {
    if (form.category !== SALARY_CAT || !form.linked_user_id) {
      setSalaryInfo(null); setSalaryWarn('')
      return
    }
    // Определяем период
    const date = form.expense_date || new Date().toISOString().slice(0, 10)
    const [year, month] = date.split('-')
    const from = `${year}-${month}-01`
    const to   = `${year}-${month}-${new Date(year, month, 0).getDate()}`

    api.get('/users/assignable').then(async () => {
      // Получаем инфо о зарплате через summary
      const res = await api.get('/timesheets/summary', { params: { from, to } })
      const summary = (res.data.data || []).find(s => s.user_id === form.linked_user_id)
      if (summary) {
        setSalaryInfo(summary)
        const today = new Date().getDate()
        const isFirstHalf = today <= 15
        const baseSalary = summary.calculated || 0
        const maxAdvance = baseSalary * 0.5
        const paidAdvance = summary.paid_advance || 0
        const available = isFirstHalf ? Math.max(0, maxAdvance - paidAdvance) : Math.max(0, baseSalary - (summary.total_paid || 0))
        setSalaryInfo({ ...summary, available, isFirstHalf, maxAdvance, baseSalary })
      }
    }).catch(() => {})
  }, [form.linked_user_id, form.category, form.expense_date])

  // Проверка суммы при вводе
  useEffect(() => {
    if (form.category !== SALARY_CAT || !salaryInfo) { setSalaryWarn(''); return }
    const amount = parseFloat(form.amount) || 0
    if (amount > salaryInfo.available) {
      setSalaryWarn(`Превышение! Доступно: ${salaryInfo.available.toLocaleString()} сом.`)
    } else {
      setSalaryWarn('')
    }
  }, [form.amount, salaryInfo, form.category])

  const visible = expenses.filter(e => {
    const q = search.toLowerCase()
    return (
      e.category?.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q) ||
      e.creator_name?.toLowerCase().includes(q) ||
      e.linked_user_name?.toLowerCase().includes(q) ||
      e.project_title?.toLowerCase().includes(q)
    )
  })

  const openCreate = () => {
    setEditItem(null); setForm(EMPTY_FORM)
    setSalaryInfo(null); setSalaryWarn('')
    setModal(true)
  }

  const openEdit = (exp) => {
    setEditItem(exp)
    setForm({
      expense_date:    exp.expense_date || '',
      category:        exp.category     || '',
      description:     exp.description  || '',
      amount:          String(exp.amount || ''),
      method:          exp.method       || 'cash',
      linked_user_id:  exp.linked_user_id  || '',
      project_id:      exp.project_id      || '',
      order_id:        exp.order_id         || '',
    })
    setSalaryInfo(null); setSalaryWarn('')
    setModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (salaryWarn) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        amount: parseFloat(form.amount),
      }
      if (editItem) await updateExpense(editItem.id, payload)
      else          await createExpense(payload)
      setModal(false); load()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка сохранения')
    } finally { setSaving(false) }
  }

  const handleDelete = async (exp) => {
    if (!window.confirm(`Удалить расход "${exp.category}" — ${Number(exp.amount).toLocaleString()} сом.?`)) return
    try { await deleteExpense(exp.id); load() }
    catch { setError('Ошибка удаления') }
  }

  const byCategory = visible.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount
    return acc
  }, {})

  const isSalaryCategory  = form.category === SALARY_CAT
  const isProjectCategory = form.category === PROJECT_CAT
  const isOrderCategory   = form.category === ORDER_CAT

  return (
    <>
      {error && <CAlert color="danger" dismissible onClose={() => setError('')}>{error}</CAlert>}

      {/* Фильтры */}
      <CCard className="mb-3">
        <CCardBody className="py-2">
          <div className="d-flex gap-2 flex-wrap align-items-center">
            <CInputGroup size="sm" style={{ width: 200 }}>
              <CInputGroupText><CIcon icon={cilSearch} /></CInputGroupText>
              <CFormInput placeholder="Поиск..." value={search}
                onChange={e => setSearch(e.target.value)} />
            </CInputGroup>
            <CFormInput type="date" size="sm" style={{ width: 140 }}
              value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
            <CFormInput type="date" size="sm" style={{ width: 140 }}
              value={filterTo} onChange={e => setFilterTo(e.target.value)} />
            <CFormSelect size="sm" style={{ width: 160 }}
              value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              <option value="">Все категории</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </CFormSelect>
            <div className="ms-auto d-flex align-items-center gap-3">
              <div className="text-end">
                <div className="small text-body-secondary">Итого за период</div>
                <div className="fw-bold text-danger fs-5">{total.toLocaleString()} сом.</div>
              </div>
              {canEdit && (
                <CButton color="primary" size="sm" onClick={openCreate}>
                  <CIcon icon={cilPlus} className="me-1" />Добавить
                </CButton>
              )}
            </div>
          </div>
        </CCardBody>
      </CCard>

      <CRow className="g-3">
        {/* Таблица */}
        <CCol md={9}>
          <CCard>
            <CCardHeader><strong>Расходы цеха</strong></CCardHeader>
            <CCardBody className="p-0">
              {loading ? (
                <div className="text-center py-4"><CSpinner /></div>
              ) : (
                <CTable align="middle" hover responsive style={{ fontSize: 13 }} className="mb-0">
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Дата</CTableHeaderCell>
                      <CTableHeaderCell>Категория</CTableHeaderCell>
                      <CTableHeaderCell>Описание / Связь</CTableHeaderCell>
                      <CTableHeaderCell>Метод</CTableHeaderCell>
                      <CTableHeaderCell>Кто добавил</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Сумма</CTableHeaderCell>
                      {(canEdit || canDelete) && <CTableHeaderCell></CTableHeaderCell>}
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {visible.length === 0 && (
                      <CTableRow>
                        <CTableDataCell colSpan={7} className="text-center text-body-secondary py-4">
                          Расходы не найдены
                        </CTableDataCell>
                      </CTableRow>
                    )}
                    {visible.map(exp => (
                      <CTableRow key={exp.id}>
                        <CTableDataCell className="text-body-secondary small">
                          {exp.expense_date}
                        </CTableDataCell>
                        <CTableDataCell>
                          <CBadge color="secondary">{exp.category}</CBadge>
                        </CTableDataCell>
                        <CTableDataCell className="small">
                          <div className="text-body-secondary">{exp.description || '—'}</div>
                          {exp.linked_user_name && (
                            <div className="text-primary">👤 {exp.linked_user_name}</div>
                          )}
                          {exp.project_title && (
                            <div className="text-info">📋 {exp.project_title}</div>
                          )}
                          {exp.order_number && (
                            <div className="text-success">🛒 #{exp.order_number} {exp.order_title}</div>
                          )}
                        </CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={METHOD_COLOR[exp.method] || 'secondary'} style={{ fontSize: 10 }}>
                            {METHOD_LABEL[exp.method] || exp.method}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell className="small">{exp.creator_name || '—'}</CTableDataCell>
                        <CTableDataCell className="text-end fw-semibold text-danger">
                          {Number(exp.amount).toLocaleString()} сом.
                        </CTableDataCell>
                        {(canEdit || canDelete) && (
                          <CTableDataCell>
                            <div className="d-flex gap-1">
                              {canEdit && (
                                <CButton size="sm" color="primary" variant="ghost" onClick={() => openEdit(exp)}>
                                  <CIcon icon={cilPencil} />
                                </CButton>
                              )}
                              {canDelete && (
                                <CButton size="sm" color="danger" variant="ghost" onClick={() => handleDelete(exp)}>
                                  <CIcon icon={cilTrash} />
                                </CButton>
                              )}
                            </div>
                          </CTableDataCell>
                        )}
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              )}
            </CCardBody>
          </CCard>
        </CCol>

        {/* Итоги по категориям */}
        <CCol md={3}>
          <CCard>
            <CCardHeader><strong className="small">По категориям</strong></CCardHeader>
            <CCardBody className="p-0">
              {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, sum]) => (
                <div key={cat} className="d-flex justify-content-between align-items-center px-3 py-2"
                  style={{ borderBottom: '0.5px solid var(--cui-border-color)' }}>
                  <span className="small">{cat}</span>
                  <span className="small fw-semibold text-danger">{sum.toLocaleString()}</span>
                </div>
              ))}
              {Object.keys(byCategory).length === 0 && (
                <div className="text-center text-body-secondary py-3 small">—</div>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Модал */}
      <CModal size="lg" visible={modal} onClose={() => setModal(false)}>
        <CModalHeader>
          <CModalTitle>{editItem ? 'Редактировать расход' : 'Новый расход'}</CModalTitle>
        </CModalHeader>
        <CForm onSubmit={handleSave}>
          <CModalBody>
            <CRow className="g-3">
              <CCol xs={6}>
                <CFormLabel>Дата *</CFormLabel>
                <CFormInput type="date" required value={form.expense_date}
                  onChange={e => setForm({ ...form, expense_date: e.target.value })} />
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Категория *</CFormLabel>
                <CFormSelect required value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value, linked_user_id: '', project_id: '', order_id: '' })}>
                  <option value="">— Выберите —</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </CFormSelect>
              </CCol>

              {/* ── Категория: Зарплата ── */}
              {isSalaryCategory && (
                <CCol xs={12}>
                  <CFormLabel>Сотрудник *</CFormLabel>
                  <CFormSelect required value={form.linked_user_id}
                    onChange={e => setForm({ ...form, linked_user_id: e.target.value })}>
                    <option value="">— Выберите сотрудника —</option>
                    {employees.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} {u.last_name} ({u.role_name})
                      </option>
                    ))}
                  </CFormSelect>

                  {/* Инфо о зарплате */}
                  {salaryInfo && (
                    <div className="mt-2 p-2 rounded small"
                      style={{ background: 'var(--cui-secondary-bg)', border: '1px solid var(--cui-border-color)' }}>
                      <div className="d-flex flex-wrap gap-3">
                        <div>
                          <div className="text-body-secondary">Начислено</div>
                          <div className="fw-bold">{Number(salaryInfo.calculated || 0).toLocaleString()} сом.</div>
                        </div>
                        <div>
                          <div className="text-body-secondary">Уже выплачено</div>
                          <div className="fw-bold text-warning">{Number(salaryInfo.total_paid || 0).toLocaleString()} сом.</div>
                        </div>
                        <div>
                          <div className="text-body-secondary">Доступно сейчас</div>
                          <div className="fw-bold text-success">{Number(salaryInfo.available || 0).toLocaleString()} сом.</div>
                        </div>
                      </div>
                      {salaryInfo.isFirstHalf && (
                        <div className="mt-1 text-body-secondary" style={{ fontSize: 11 }}>
                          ⚠️ До 15-го числа доступно не более 50% от зарплаты
                          ({Number(salaryInfo.maxAdvance || 0).toLocaleString()} сом.)
                        </div>
                      )}
                    </div>
                  )}
                </CCol>
              )}

              {/* ── Категория: Проекты ── */}
              {isProjectCategory && (
                <CCol xs={12}>
                  <CFormLabel>Проект *</CFormLabel>
                  <CFormSelect required value={form.project_id}
                    onChange={e => setForm({ ...form, project_id: e.target.value })}>
                    <option value="">— Выберите проект —</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        #{p.project_number} {p.title} — {p.client_name}
                      </option>
                    ))}
                  </CFormSelect>
                </CCol>
              )}

              {/* ── Категория: Заказы ── */}
              {isOrderCategory && (
                <CCol xs={12}>
                  <CFormLabel>Заказ *</CFormLabel>
                  <CFormSelect required value={form.order_id}
                    onChange={e => setForm({ ...form, order_id: e.target.value })}>
                    <option value="">— Выберите заказ —</option>
                    {orders.map(o => (
                      <option key={o.id} value={o.id}>
                        #{o.order_number} — {o.title}
                        {o.client_name ? ` (${o.client_name})` : ''}
                      </option>
                    ))}
                  </CFormSelect>
                  <div className="small text-body-secondary mt-1">
                    Расход отобразится во вкладке «Расходы» выбранного заказа
                  </div>
                </CCol>
              )}

              <CCol xs={12}>
                <CFormLabel>Сумма (сом.) *</CFormLabel>
                <CFormInput type="number" required min="0" step="any" value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0"
                  style={{ borderColor: salaryWarn ? 'var(--cui-danger)' : undefined }} />
                {salaryWarn && (
                  <div className="small text-danger mt-1 d-flex align-items-center gap-1">
                    <CIcon icon={cilWarning} style={{ width: 14 }} /> {salaryWarn}
                  </div>
                )}
              </CCol>

              <CCol xs={12}>
                <CFormLabel>Метод оплаты</CFormLabel>
                <CFormSelect value={form.method}
                  onChange={e => setForm({ ...form, method: e.target.value })}>
                  <option value="cash">Наличные</option>
                  <option value="card">Карта</option>
                  <option value="transfer">Перевод</option>
                  <option value="other">Другое</option>
                </CFormSelect>
              </CCol>

              <CCol xs={12}>
                <CFormLabel>Описание</CFormLabel>
                <CFormTextarea rows={2} value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Детали расхода..." />
              </CCol>
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setModal(false)}>Отмена</CButton>
            <CButton type="submit" color="primary" disabled={saving || !!salaryWarn}>
              {saving ? <CSpinner size="sm" /> : 'Сохранить'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>
    </>
  )
}