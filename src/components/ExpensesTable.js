import { useState, useEffect, useCallback } from 'react'
import {
  CTable, CTableHead, CTableBody, CTableRow,
  CTableHeaderCell, CTableDataCell,
  CButton, CSpinner, CAlert, CBadge,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CForm, CFormInput, CFormLabel, CFormSelect, CFormTextarea,
  CRow, CCol,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilTrash } from '@coreui/icons'
import api from '../api/client'

const METHOD_LABELS = {
  cash:     'Наличные',
  card:     'Карта',
  transfer: 'Перевод',
  other:    'Другое',
}
const METHOD_COLORS = {
  cash: 'success', card: 'info', transfer: 'primary', other: 'secondary',
}

export default function ExpensesTable({ orderId, estimateTotal = 0, canEdit = true }) {
  const [expenses, setExpenses] = useState([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const [form, setForm] = useState({
    name: '', amount: '', expense_date: '', description: '', method: 'cash',
  })

  const load = useCallback(async () => {
    if (!orderId || orderId === 'undefined') return
    try {
      const r = await api.get(`/orders/${orderId}/expenses`)
      setExpenses(r.data.data || [])
      setTotal(r.data.total  || 0)
    } catch {}
    setLoading(false)
  }, [orderId])

  useEffect(() => { load() }, [load])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!orderId || orderId === 'undefined') return
    setSaving(true)
    setError('')
    try {
      await api.post(`/orders/${orderId}/expenses`, {
        ...form,
        amount: parseFloat(form.amount),
      })
      setModal(false)
      setForm({ name:'', amount:'', expense_date:'', description:'', method:'cash' })
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить расход?')) return
    await api.delete(`/orders/${orderId}/expenses/${id}`)
    load()
  }

  const profit = estimateTotal - total

  if (loading) return <div className="text-center py-3"><CSpinner size="sm" /></div>

  return (
    <div>
      {/* Итоговая карточка */}
      <div className="d-flex gap-3 mb-4 flex-wrap">
        <div className="p-3 rounded flex-grow-1 text-center"
          style={{ background:'var(--cui-info-bg-subtle)', border:'1px solid var(--cui-info)' }}>
          <div className="small text-body-secondary mb-1">Смета (доход)</div>
          <div className="fw-bold fs-5">{estimateTotal.toLocaleString()} сом.</div>
        </div>
        <div className="p-3 rounded flex-grow-1 text-center"
          style={{ background:'var(--cui-danger-bg-subtle)', border:'1px solid var(--cui-danger)' }}>
          <div className="small text-body-secondary mb-1">Расходы</div>
          <div className="fw-bold fs-5 text-danger">{total.toLocaleString()} сом.</div>
        </div>
        <div className="p-3 rounded flex-grow-1 text-center"
          style={{
            background: profit >= 0 ? 'var(--cui-success-bg-subtle)' : 'var(--cui-danger-bg-subtle)',
            border: `1px solid ${profit >= 0 ? 'var(--cui-success)' : 'var(--cui-danger)'}`,
          }}>
          <div className="small text-body-secondary mb-1">Чистая прибыль</div>
          <div className={`fw-bold fs-5 ${profit >= 0 ? 'text-success' : 'text-danger'}`}>
            {profit.toLocaleString()} сом.
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="small text-body-secondary">
          Всего расходов: <strong>{expenses.length}</strong>
        </div>
        {canEdit && (
          <CButton size="sm" color="danger" variant="outline" onClick={() => setModal(true)}>
            <CIcon icon={cilPlus} className="me-1" />Добавить расход
          </CButton>
        )}
      </div>

      {/* Таблица */}
      {expenses.length === 0 ? (
        <div className="text-center text-body-secondary py-4 small">
          Расходы не добавлены
        </div>
      ) : (
        <CTable small responsive style={{ fontSize:13 }}>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Наименование расхода</CTableHeaderCell>
              <CTableHeaderCell>Сумма</CTableHeaderCell>
              <CTableHeaderCell>Дата</CTableHeaderCell>
              <CTableHeaderCell>Метод</CTableHeaderCell>
              <CTableHeaderCell>Описание</CTableHeaderCell>
              {canEdit && <CTableHeaderCell></CTableHeaderCell>}
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {expenses.map(e => (
              <CTableRow key={e.id}>
                <CTableDataCell className="fw-semibold">{e.name}</CTableDataCell>
                <CTableDataCell className="text-danger fw-bold">
                  {Number(e.amount).toLocaleString()} сом.
                </CTableDataCell>
                <CTableDataCell className="text-body-secondary">
                  {e.expense_date || '—'}
                </CTableDataCell>
                <CTableDataCell>
                  <CBadge color={METHOD_COLORS[e.method] || 'secondary'}>
                    {METHOD_LABELS[e.method] || e.method}
                  </CBadge>
                </CTableDataCell>
                <CTableDataCell className="text-body-secondary">
                  {e.description || '—'}
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
            {/* Итого */}
            <CTableRow style={{ background:'var(--cui-secondary-bg)', fontWeight:700 }}>
              <CTableDataCell>Итого расходов:</CTableDataCell>
              <CTableDataCell className="text-danger">
                {total.toLocaleString()} сом.
              </CTableDataCell>
              <CTableDataCell colSpan={canEdit ? 4 : 3} />
            </CTableRow>
          </CTableBody>
        </CTable>
      )}

      {/* Модал добавления */}
      <CModal visible={modal} onClose={() => setModal(false)}>
        <CModalHeader><CModalTitle>Добавить расход</CModalTitle></CModalHeader>
        <CForm onSubmit={handleCreate}>
          <CModalBody>
            {error && <CAlert color="danger">{error}</CAlert>}
            <CRow className="g-3">
              <CCol xs={12}>
                <CFormLabel>Наименование *</CFormLabel>
                <CFormInput required value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  placeholder="Материалы, зарплата мастера..." />
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Сумма (сом.) *</CFormLabel>
                <CFormInput required type="number" min="0" step="any"
                  value={form.amount}
                  onChange={e => setForm({...form, amount: e.target.value})} />
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Дата</CFormLabel>
                <CFormInput type="date" value={form.expense_date}
                  onChange={e => setForm({...form, expense_date: e.target.value})} />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Метод оплаты</CFormLabel>
                <CFormSelect value={form.method}
                  onChange={e => setForm({...form, method: e.target.value})}>
                  <option value="cash">Наличные</option>
                  <option value="card">Карта</option>
                  <option value="transfer">Перевод</option>
                  <option value="other">Другое</option>
                </CFormSelect>
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Описание</CFormLabel>
                <CFormTextarea rows={2} value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                  placeholder="Дополнительная информация..." />
              </CCol>
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setModal(false)}>
              Отмена
            </CButton>
            <CButton type="submit" color="danger" disabled={saving}>
              {saving ? <CSpinner size="sm" /> : 'Добавить'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>
    </div>
  )
}