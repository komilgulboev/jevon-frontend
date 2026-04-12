import { useEffect, useState, useCallback } from 'react'
import {
  CCard, CCardBody, CCardHeader,
  CTable, CTableBody, CTableDataCell,
  CTableHead, CTableHeaderCell, CTableRow,
  CBadge, CButton, CSpinner, CAlert,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CForm, CFormInput, CFormLabel, CFormSelect,
  CRow, CCol, CNav, CNavItem, CNavLink, CProgress,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilTrash, cilReload, cilMoney } from '@coreui/icons'
import {
  getTimesheets, getTimesheetSummary,
  createTimesheet, deleteTimesheet, autoFillTimesheets,
} from '../../api/expenses'
import api from '../../api/client'
import { useAuth } from '../../AuthContext'

const today        = new Date()
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
const todayStr     = today.toISOString().slice(0, 10)

export default function Timesheet() {
  const { hasRole } = useAuth()
  const canEdit = hasRole('admin', 'supervisor')

  const [activeTab,   setActiveTab]   = useState('summary')
  const [from,        setFrom]        = useState(firstOfMonth)
  const [to,          setTo]          = useState(todayStr)
  const [filterUser,  setFilterUser]  = useState('')

  const [summary,     setSummary]     = useState([])
  const [entries,     setEntries]     = useState([])
  const [employees,   setEmployees]   = useState([])
  const [payments,    setPayments]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [modal,       setModal]       = useState(false)
  const [payModal,    setPayModal]    = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [autoFilling, setAutoFilling] = useState(false)
  const [payTarget,   setPayTarget]   = useState(null) // summary строка для выплаты

  const [form, setForm] = useState({
    user_id: '', work_date: todayStr,
    hours: '8', check_in: '', check_out: '', notes: '',
  })
  const [payForm, setPayForm] = useState({
    user_id: '', amount: '', period_from: firstOfMonth, period_to: todayStr,
    payment_type: 'salary', method: 'cash', notes: '',
  })

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      getTimesheetSummary({ from, to }),
      getTimesheets({ from, to, user_id: filterUser }),
      api.get('/users/assignable'),
      api.get('/salary-payments', { params: { from, to } }),
    ])
      .then(([summaryRes, entriesRes, empRes, payRes]) => {
        setSummary(summaryRes.data.data   || [])
        setEntries(entriesRes.data.data   || [])
        setEmployees(empRes.data.data     || [])
        setPayments(payRes.data.data      || [])
      })
      .catch(() => setError('Ошибка загрузки'))
      .finally(() => setLoading(false))
  }, [from, to, filterUser])

  useEffect(() => { load() }, [load])

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await createTimesheet({ ...form, hours: parseFloat(form.hours) })
      setModal(false); load()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка сохранения')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить запись?')) return
    try { await deleteTimesheet(id); load() }
    catch { setError('Ошибка удаления') }
  }

  const handleAutoFill = async () => {
    setAutoFilling(true)
    try {
      const res = await autoFillTimesheets({ from, to })
      alert(`Добавлено записей: ${res.data.added || 0}`)
      load()
    } catch { setError('Ошибка автозаполнения') }
    finally { setAutoFilling(false) }
  }

  const openPayModal = (s) => {
    setPayTarget(s)
    setPayForm({
      user_id:      s.user_id,
      amount:       String(Math.max(0, s.remaining || 0).toFixed(0)),
      period_from:  from,
      period_to:    to,
      payment_type: 'salary',
      method:       'cash',
      notes:        '',
    })
    setPayModal(true)
  }

  const handlePayCreate = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await api.post('/salary-payments', { ...payForm, amount: parseFloat(payForm.amount) })
      setPayModal(false); load()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка выплаты')
    } finally { setSaving(false) }
  }

  const handlePayDelete = async (id) => {
    if (!window.confirm('Удалить запись о выплате?')) return
    try {
      await api.delete(`/salary-payments/${id}`)
      load()
    } catch { setError('Ошибка удаления') }
  }

  const totalSalary  = summary.reduce((s, e) => s + (e.total_to_pay || 0), 0)
  const totalPaid    = summary.reduce((s, e) => s + (e.total_paid || 0), 0)
  const totalRemains = summary.reduce((s, e) => s + (e.remaining || 0), 0)

  return (
    <>
      {error && <CAlert color="danger" dismissible onClose={() => setError('')}>{error}</CAlert>}

      {/* Фильтры */}
      <CCard className="mb-3">
        <CCardBody className="py-2">
          <div className="d-flex gap-2 align-items-end flex-wrap">
            <div>
              <div className="small text-body-secondary mb-1">С</div>
              <CFormInput type="date" size="sm" value={from}
                onChange={e => setFrom(e.target.value)} style={{ width: 140 }} />
            </div>
            <div>
              <div className="small text-body-secondary mb-1">По</div>
              <CFormInput type="date" size="sm" value={to}
                onChange={e => setTo(e.target.value)} style={{ width: 140 }} />
            </div>
            <div>
              <div className="small text-body-secondary mb-1">Сотрудник</div>
              <CFormSelect size="sm" style={{ width: 200 }}
                value={filterUser} onChange={e => setFilterUser(e.target.value)}>
                <option value="">Все сотрудники</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.full_name} {e.last_name}</option>
                ))}
              </CFormSelect>
            </div>
            <div className="ms-auto d-flex align-items-center gap-3">
              {/* Сводные суммы */}
              <div className="d-flex gap-3 text-center">
                <div>
                  <div className="small text-body-secondary">К выплате</div>
                  <div className="fw-bold text-info">{totalSalary.toLocaleString()} сом.</div>
                </div>
                <div>
                  <div className="small text-body-secondary">Выплачено</div>
                  <div className="fw-bold text-success">{totalPaid.toLocaleString()} сом.</div>
                </div>
                <div>
                  <div className="small text-body-secondary">Остаток</div>
                  <div className={`fw-bold ${totalRemains > 0 ? 'text-danger' : 'text-success'}`}>
                    {totalRemains.toLocaleString()} сом.
                  </div>
                </div>
              </div>
              {canEdit && (
                <>
                  <CButton color="secondary" size="sm" variant="outline"
                    onClick={handleAutoFill} disabled={autoFilling}>
                    <CIcon icon={cilReload} className="me-1" />
                    {autoFilling ? 'Заполняю...' : 'Авто-заполнить'}
                  </CButton>
                  <CButton color="primary" size="sm" onClick={() => {
                    setForm({ user_id: '', work_date: todayStr, hours: '8', check_in: '', check_out: '', notes: '' })
                    setModal(true)
                  }}>
                    <CIcon icon={cilPlus} className="me-1" />Добавить
                  </CButton>
                </>
              )}
            </div>
          </div>
        </CCardBody>
      </CCard>

      <CCard>
        <CCardHeader className="pb-0">
          <CNav variant="tabs" className="card-header-tabs">
            {[
              { key: 'summary',  label: '📊 Сводная ведомость' },
              { key: 'entries',  label: '📋 Записи табеля'     },
              { key: 'payments', label: '💳 Выплаты'           },
            ].map(tab => (
              <CNavItem key={tab.key}>
                <CNavLink active={activeTab === tab.key}
                  onClick={() => setActiveTab(tab.key)} style={{ cursor: 'pointer' }}>
                  {tab.label}
                </CNavLink>
              </CNavItem>
            ))}
          </CNav>
        </CCardHeader>

        <CCardBody className="p-0">
          {loading ? (
            <div className="text-center py-4"><CSpinner /></div>
          ) : (
            <>
              {/* ── Сводная ведомость ── */}
              {activeTab === 'summary' && (
                <CTable align="middle" hover responsive style={{ fontSize: 13 }} className="mb-0">
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Сотрудник</CTableHeaderCell>
                      <CTableHeaderCell className="text-center">Дней</CTableHeaderCell>
                      <CTableHeaderCell className="text-center">Часов</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Базовая</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Бонус сборки</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Итого</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Выплачено</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Остаток</CTableHeaderCell>
                      {canEdit && <CTableHeaderCell></CTableHeaderCell>}
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {summary.length === 0 && (
                      <CTableRow>
                        <CTableDataCell colSpan={9} className="text-center text-body-secondary py-4">
                          Нет данных за выбранный период
                        </CTableDataCell>
                      </CTableRow>
                    )}
                    {summary.map(s => (
                      <CTableRow key={s.user_id}>
                        <CTableDataCell>
                          <div className="fw-semibold">{s.full_name}</div>
                          <CBadge color="secondary" style={{ fontSize: 9 }}>{s.role_name}</CBadge>
                        </CTableDataCell>
                        <CTableDataCell className="text-center">{s.work_days || '—'}</CTableDataCell>
                        <CTableDataCell className="text-center">
                          {s.total_hours > 0 ? `${s.total_hours}ч` : '—'}
                        </CTableDataCell>
                        <CTableDataCell className="text-end">
                          {s.calculated > 0 ? `${Number(s.calculated).toLocaleString()} сом.` : '—'}
                        </CTableDataCell>
                        <CTableDataCell className="text-end">
                          {s.assembly_bonus > 0 ? (
                            <span className="text-success fw-semibold">
                              +{Number(s.assembly_bonus).toLocaleString()} сом.
                            </span>
                          ) : '—'}
                        </CTableDataCell>
                        <CTableDataCell className="text-end fw-bold text-info">
                          {s.total_to_pay > 0 ? `${Number(s.total_to_pay).toLocaleString()} сом.` : '—'}
                        </CTableDataCell>
                        <CTableDataCell className="text-end">
                          {s.total_paid > 0 ? (
                            <span className="text-success">{Number(s.total_paid).toLocaleString()} сом.</span>
                          ) : '—'}
                        </CTableDataCell>
                        <CTableDataCell className="text-end">
                          {s.remaining > 0 ? (
                            <span className="fw-bold text-danger">{Number(s.remaining).toLocaleString()} сом.</span>
                          ) : s.remaining < 0 ? (
                            <span className="text-warning">Переплата</span>
                          ) : (
                            <CBadge color="success">✓</CBadge>
                          )}
                        </CTableDataCell>
                        {canEdit && (
                          <CTableDataCell>
                            {s.remaining > 0 && (
                              <CButton size="sm" color="success" onClick={() => openPayModal(s)}>
                                <CIcon icon={cilMoney} className="me-1" />Выплатить
                              </CButton>
                            )}
                          </CTableDataCell>
                        )}
                      </CTableRow>
                    ))}
                    {summary.length > 0 && (
                      <CTableRow style={{ background: 'var(--cui-secondary-bg)', fontWeight: 700 }}>
                        <CTableDataCell colSpan={5}>Итого</CTableDataCell>
                        <CTableDataCell className="text-end text-info">
                          {totalSalary.toLocaleString()} сом.
                        </CTableDataCell>
                        <CTableDataCell className="text-end text-success">
                          {totalPaid.toLocaleString()} сом.
                        </CTableDataCell>
                        <CTableDataCell className="text-end text-danger">
                          {totalRemains.toLocaleString()} сом.
                        </CTableDataCell>
                        {canEdit && <CTableDataCell />}
                      </CTableRow>
                    )}
                  </CTableBody>
                </CTable>
              )}

              {/* ── Записи табеля ── */}
              {activeTab === 'entries' && (
                <CTable align="middle" hover responsive style={{ fontSize: 13 }} className="mb-0">
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Дата</CTableHeaderCell>
                      <CTableHeaderCell>Сотрудник</CTableHeaderCell>
                      <CTableHeaderCell className="text-center">Приход</CTableHeaderCell>
                      <CTableHeaderCell className="text-center">Уход</CTableHeaderCell>
                      <CTableHeaderCell className="text-center">Часов</CTableHeaderCell>
                      <CTableHeaderCell>Источник</CTableHeaderCell>
                      <CTableHeaderCell>Примечание</CTableHeaderCell>
                      {canEdit && <CTableHeaderCell></CTableHeaderCell>}
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {entries.length === 0 && (
                      <CTableRow>
                        <CTableDataCell colSpan={8} className="text-center text-body-secondary py-4">
                          Нет записей. Используйте «Авто-заполнить» или добавьте вручную.
                        </CTableDataCell>
                      </CTableRow>
                    )}
                    {entries.map(e => (
                      <CTableRow key={e.id}>
                        <CTableDataCell className="small text-body-secondary">{e.work_date}</CTableDataCell>
                        <CTableDataCell>
                          <div className="fw-semibold">{e.full_name}</div>
                          <div className="small text-body-secondary">{e.role_name}</div>
                        </CTableDataCell>
                        <CTableDataCell className="text-center small">
                          {e.check_in || '—'}
                        </CTableDataCell>
                        <CTableDataCell className="text-center small">
                          {e.check_out || '—'}
                        </CTableDataCell>
                        <CTableDataCell className="text-center fw-semibold">
                          {e.hours}ч
                        </CTableDataCell>
                        <CTableDataCell>
                          <CBadge color="light" className="text-dark" style={{ fontSize: 10 }}>
                            {e.source_type === 'order_stage'   ? 'Этап заказа' :
                             e.source_type === 'project_stage' ? 'Этап проекта' :
                             e.source_type === 'task'          ? 'Задача' :
                             e.source_type                     ? e.source_type : 'Ручной'}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell className="small text-body-secondary">
                          {e.notes || '—'}
                        </CTableDataCell>
                        {canEdit && (
                          <CTableDataCell>
                            <CButton size="sm" color="danger" variant="ghost"
                              onClick={() => handleDelete(e.id)}>
                              <CIcon icon={cilTrash} />
                            </CButton>
                          </CTableDataCell>
                        )}
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              )}

              {/* ── Выплаты ── */}
              {activeTab === 'payments' && (
                <CTable align="middle" hover responsive style={{ fontSize: 13 }} className="mb-0">
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Дата</CTableHeaderCell>
                      <CTableHeaderCell>Сотрудник</CTableHeaderCell>
                      <CTableHeaderCell>Период</CTableHeaderCell>
                      <CTableHeaderCell>Тип</CTableHeaderCell>
                      <CTableHeaderCell>Метод</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Сумма</CTableHeaderCell>
                      <CTableHeaderCell>Выплатил</CTableHeaderCell>
                      {canEdit && <CTableHeaderCell></CTableHeaderCell>}
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {payments.length === 0 && (
                      <CTableRow>
                        <CTableDataCell colSpan={8} className="text-center text-body-secondary py-4">
                          Выплат нет
                        </CTableDataCell>
                      </CTableRow>
                    )}
                    {payments.map(p => (
                      <CTableRow key={p.id}>
                        <CTableDataCell className="small text-body-secondary">
                          {new Date(p.paid_at).toLocaleDateString('ru-RU')}
                        </CTableDataCell>
                        <CTableDataCell className="fw-semibold">{p.full_name}</CTableDataCell>
                        <CTableDataCell className="small text-body-secondary">
                          {p.period_from} — {p.period_to}
                        </CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={p.payment_type === 'advance' ? 'warning' : 'success'}>
                            {p.payment_type === 'advance' ? 'Аванс' : 'Зарплата'}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell className="small">
                          {{ cash:'Наличные', card:'Карта', transfer:'Перевод' }[p.method] || p.method}
                        </CTableDataCell>
                        <CTableDataCell className="text-end fw-bold text-success">
                          {Number(p.amount).toLocaleString()} сом.
                        </CTableDataCell>
                        <CTableDataCell className="small text-body-secondary">
                          {p.paid_by_name || '—'}
                        </CTableDataCell>
                        {canEdit && (
                          <CTableDataCell>
                            <CButton size="sm" color="danger" variant="ghost"
                              onClick={() => handlePayDelete(p.id)}>
                              <CIcon icon={cilTrash} />
                            </CButton>
                          </CTableDataCell>
                        )}
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              )}
            </>
          )}
        </CCardBody>
      </CCard>

      {/* Модал добавления записи */}
      <CModal visible={modal} onClose={() => setModal(false)}>
        <CModalHeader><CModalTitle>Добавить запись в табель</CModalTitle></CModalHeader>
        <CForm onSubmit={handleCreate}>
          <CModalBody>
            <CRow className="g-3">
              <CCol xs={12}>
                <CFormLabel>Сотрудник *</CFormLabel>
                <CFormSelect required value={form.user_id}
                  onChange={e => setForm({ ...form, user_id: e.target.value })}>
                  <option value="">— Выберите сотрудника —</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} {emp.last_name}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Дата *</CFormLabel>
                <CFormInput type="date" required value={form.work_date}
                  onChange={e => setForm({ ...form, work_date: e.target.value })} />
              </CCol>
              <CCol xs={4}>
                <CFormLabel>Приход</CFormLabel>
                <CFormInput type="time" value={form.check_in}
                  onChange={e => setForm({ ...form, check_in: e.target.value })} />
              </CCol>
              <CCol xs={4}>
                <CFormLabel>Уход</CFormLabel>
                <CFormInput type="time" value={form.check_out}
                  onChange={e => {
                    const co = e.target.value
                    // Авто-расчёт часов
                    if (form.check_in && co) {
                      const [h1, m1] = form.check_in.split(':').map(Number)
                      const [h2, m2] = co.split(':').map(Number)
                      const diff = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60
                      if (diff > 0) setForm({ ...form, check_out: co, hours: String(diff.toFixed(1)) })
                      else setForm({ ...form, check_out: co })
                    } else {
                      setForm({ ...form, check_out: co })
                    }
                  }} />
              </CCol>
              <CCol xs={4}>
                <CFormLabel>Часов</CFormLabel>
                <CFormInput type="number" min="1" max="24" step="0.5"
                  value={form.hours}
                  onChange={e => setForm({ ...form, hours: e.target.value })} />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Примечание</CFormLabel>
                <CFormInput value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Описание работы..." />
              </CCol>
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setModal(false)}>Отмена</CButton>
            <CButton type="submit" color="primary" disabled={saving}>
              {saving ? <CSpinner size="sm" /> : 'Сохранить'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>

      {/* Модал выплаты зарплаты */}
      <CModal visible={payModal} onClose={() => setPayModal(false)}>
        <CModalHeader>
          <CModalTitle>Выплата зарплаты — {payTarget?.full_name}</CModalTitle>
        </CModalHeader>
        <CForm onSubmit={handlePayCreate}>
          <CModalBody>
            {payTarget && (
              <div className="mb-3 p-2 rounded small" style={{ background: 'var(--cui-secondary-bg)' }}>
                <CRow className="g-2 text-center">
                  {[
                    { label: 'Базовая',      value: payTarget.calculated,     cls: '' },
                    { label: 'Бонус сборки', value: payTarget.assembly_bonus, cls: 'text-success' },
                    { label: 'Итого',        value: payTarget.total_to_pay,   cls: 'text-info fw-bold' },
                    { label: 'Выплачено',    value: payTarget.total_paid,     cls: 'text-warning' },
                    { label: 'Остаток',      value: payTarget.remaining,      cls: 'text-danger fw-bold' },
                  ].map(item => (
                    <CCol xs={4} key={item.label}>
                      <div className="text-body-secondary" style={{ fontSize: 10 }}>{item.label}</div>
                      <div className={`small fw-semibold ${item.cls}`}>
                        {Number(item.value || 0).toLocaleString()} сом.
                      </div>
                    </CCol>
                  ))}
                </CRow>
              </div>
            )}
            <CRow className="g-3">
              <CCol xs={12}>
                <CFormLabel>Тип выплаты</CFormLabel>
                <CFormSelect value={payForm.payment_type}
                  onChange={e => setPayForm({ ...payForm, payment_type: e.target.value })}>
                  <option value="salary">Зарплата</option>
                  <option value="advance">Аванс (до 50%)</option>
                </CFormSelect>
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Сумма *</CFormLabel>
                <CFormInput required type="number" min="1" step="any"
                  value={payForm.amount}
                  onChange={e => setPayForm({ ...payForm, amount: e.target.value })} />
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Период с</CFormLabel>
                <CFormInput type="date" value={payForm.period_from}
                  onChange={e => setPayForm({ ...payForm, period_from: e.target.value })} />
              </CCol>
              <CCol xs={6}>
                <CFormLabel>по</CFormLabel>
                <CFormInput type="date" value={payForm.period_to}
                  onChange={e => setPayForm({ ...payForm, period_to: e.target.value })} />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Метод</CFormLabel>
                <CFormSelect value={payForm.method}
                  onChange={e => setPayForm({ ...payForm, method: e.target.value })}>
                  <option value="cash">Наличные</option>
                  <option value="card">Карта</option>
                  <option value="transfer">Перевод</option>
                </CFormSelect>
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Примечание</CFormLabel>
                <CFormInput value={payForm.notes}
                  onChange={e => setPayForm({ ...payForm, notes: e.target.value })} />
              </CCol>
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setPayModal(false)}>Отмена</CButton>
            <CButton type="submit" color="success" disabled={saving}>
              {saving ? <CSpinner size="sm" /> : '💳 Выплатить'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>
    </>
  )
}