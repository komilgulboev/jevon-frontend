import { useState, useCallback } from 'react'
import {
  CCard, CCardBody, CCardHeader,
  CRow, CCol, CButton, CSpinner, CAlert,
  CFormInput, CFormLabel, CTable, CTableHead,
  CTableBody, CTableRow, CTableHeaderCell, CTableDataCell,
  CProgress, CBadge,
} from '@coreui/react'
import api from '../../api/client'
import { getTimesheetSummary } from '../../api/expenses'

const today      = new Date()
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
const todayStr   = today.toISOString().slice(0, 10)

export default function Reports() {
  const [from,     setFrom]     = useState(firstOfMonth)
  const [to,       setTo]       = useState(todayStr)
  const [report,   setReport]   = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const loadReport = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [ordersRes, expensesRes, salaryRes] = await Promise.all([
        api.get('/orders/stats'),
        api.get('/expenses', { params: { from, to } }),
        getTimesheetSummary({ from, to }),
      ])

      // Доходы от заказов (оплаченные)
      const orderStats = ordersRes.data

      // Расходы по заказам
      const workshopExpenses = expensesRes.data.total || 0
      const expensesByCategory = expensesRes.data.data?.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount
        return acc
      }, {}) || {}

      // Зарплаты
      const salaryData   = salaryRes.data.data || []
      const totalSalary  = salaryData.reduce((s, e) => s + (e.calculated || 0), 0)

      setReport({
        orderStats,
        revenue:          orderStats.total_revenue || 0,
        workshopExpenses,
        expensesByCategory,
        salaryData,
        totalSalary,
        totalExpenses:    workshopExpenses + totalSalary,
        profit:           (orderStats.total_revenue || 0) - workshopExpenses - totalSalary,
      })
    } catch (err) {
      setError('Ошибка формирования отчёта')
    } finally { setLoading(false) }
  }, [from, to])

  const profitColor = report?.profit >= 0 ? 'success' : 'danger'

  return (
    <>
      {error && <CAlert color="danger" dismissible onClose={() => setError('')}>{error}</CAlert>}

      {/* Фильтр периода */}
      <CCard className="mb-4">
        <CCardBody>
          <div className="d-flex gap-3 align-items-end flex-wrap">
            <div>
              <CFormLabel className="small mb-1">Период с</CFormLabel>
              <CFormInput type="date" size="sm" value={from}
                onChange={e => setFrom(e.target.value)} style={{ width: 150 }} />
            </div>
            <div>
              <CFormLabel className="small mb-1">по</CFormLabel>
              <CFormInput type="date" size="sm" value={to}
                onChange={e => setTo(e.target.value)} style={{ width: 150 }} />
            </div>
            <CButton color="primary" onClick={loadReport} disabled={loading}>
              {loading ? <CSpinner size="sm" className="me-1" /> : null}
              Сформировать отчёт
            </CButton>
          </div>
        </CCardBody>
      </CCard>

      {report && (
        <>
          {/* ── Сводные карточки ── */}
          <CRow className="g-3 mb-4">
            {[
              { label: 'Доходы (оплачено)',   value: report.revenue,          color: 'success', icon: '💰' },
              { label: 'Расходы цеха',        value: report.workshopExpenses, color: 'warning', icon: '🏭' },
              { label: 'Зарплаты',            value: report.totalSalary,      color: 'info',    icon: '👥' },
              { label: 'Прибыль',             value: report.profit,           color: profitColor, icon: '📈' },
            ].map(card => (
              <CCol xs={6} md={3} key={card.label}>
                <CCard className="text-center h-100">
                  <CCardBody className="py-3">
                    <div className="fs-3 mb-1">{card.icon}</div>
                    <div className={`fs-5 fw-bold text-${card.color}`}>
                      {Number(card.value).toLocaleString()} сом.
                    </div>
                    <div className="small text-body-secondary">{card.label}</div>
                  </CCardBody>
                </CCard>
              </CCol>
            ))}
          </CRow>

          {/* ── Визуализация соотношения ── */}
          {report.revenue > 0 && (
            <CCard className="mb-4">
              <CCardHeader><strong>Структура доходов и расходов</strong></CCardHeader>
              <CCardBody>
                <div className="mb-3">
                  <div className="d-flex justify-content-between small mb-1">
                    <span>Расходы цеха</span>
                    <span>{((report.workshopExpenses / report.revenue) * 100).toFixed(1)}%</span>
                  </div>
                  <CProgress value={(report.workshopExpenses / report.revenue) * 100}
                    color="warning" style={{ height: 8 }} />
                </div>
                <div className="mb-3">
                  <div className="d-flex justify-content-between small mb-1">
                    <span>Зарплаты</span>
                    <span>{((report.totalSalary / report.revenue) * 100).toFixed(1)}%</span>
                  </div>
                  <CProgress value={(report.totalSalary / report.revenue) * 100}
                    color="info" style={{ height: 8 }} />
                </div>
                <div>
                  <div className="d-flex justify-content-between small mb-1">
                    <span className={`text-${profitColor} fw-semibold`}>Прибыль</span>
                    <span className={`text-${profitColor} fw-semibold`}>
                      {((report.profit / report.revenue) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <CProgress value={Math.max(0, (report.profit / report.revenue) * 100)}
                    color={profitColor} style={{ height: 8 }} />
                </div>
              </CCardBody>
            </CCard>
          )}

          <CRow className="g-3">
            {/* Расходы по категориям */}
            <CCol md={6}>
              <CCard className="h-100">
                <CCardHeader><strong>Расходы по категориям</strong></CCardHeader>
                <CCardBody className="p-0">
                  {Object.entries(report.expensesByCategory).length === 0 ? (
                    <div className="text-center text-body-secondary py-4 small">Нет расходов</div>
                  ) : (
                    <CTable small responsive className="mb-0" style={{ fontSize: 13 }}>
                      <CTableHead>
                        <CTableRow>
                          <CTableHeaderCell>Категория</CTableHeaderCell>
                          <CTableHeaderCell className="text-end">Сумма</CTableHeaderCell>
                          <CTableHeaderCell className="text-end">%</CTableHeaderCell>
                        </CTableRow>
                      </CTableHead>
                      <CTableBody>
                        {Object.entries(report.expensesByCategory)
                          .sort((a, b) => b[1] - a[1])
                          .map(([cat, sum]) => (
                            <CTableRow key={cat}>
                              <CTableDataCell>
                                <CBadge color="secondary">{cat}</CBadge>
                              </CTableDataCell>
                              <CTableDataCell className="text-end fw-semibold">
                                {sum.toLocaleString()} сом.
                              </CTableDataCell>
                              <CTableDataCell className="text-end text-body-secondary">
                                {report.workshopExpenses > 0
                                  ? ((sum / report.workshopExpenses) * 100).toFixed(0)
                                  : 0}%
                              </CTableDataCell>
                            </CTableRow>
                          ))}
                        <CTableRow style={{ background: 'var(--cui-secondary-bg)' }}>
                          <CTableDataCell className="fw-bold">Итого</CTableDataCell>
                          <CTableDataCell className="text-end fw-bold text-warning">
                            {report.workshopExpenses.toLocaleString()} сом.
                          </CTableDataCell>
                          <CTableDataCell className="text-end">100%</CTableDataCell>
                        </CTableRow>
                      </CTableBody>
                    </CTable>
                  )}
                </CCardBody>
              </CCard>
            </CCol>

            {/* Зарплаты по сотрудникам */}
            <CCol md={6}>
              <CCard className="h-100">
                <CCardHeader><strong>Зарплаты сотрудников</strong></CCardHeader>
                <CCardBody className="p-0">
                  {report.salaryData.length === 0 ? (
                    <div className="text-center text-body-secondary py-4 small">Нет данных</div>
                  ) : (
                    <CTable small responsive className="mb-0" style={{ fontSize: 13 }}>
                      <CTableHead>
                        <CTableRow>
                          <CTableHeaderCell>Сотрудник</CTableHeaderCell>
                          <CTableHeaderCell className="text-center">Часов</CTableHeaderCell>
                          <CTableHeaderCell className="text-end">К выплате</CTableHeaderCell>
                        </CTableRow>
                      </CTableHead>
                      <CTableBody>
                        {report.salaryData
                          .filter(s => s.calculated > 0 || s.total_hours > 0)
                          .map(s => (
                            <CTableRow key={s.user_id}>
                              <CTableDataCell>
                                <div className="fw-semibold">{s.full_name}</div>
                                <div className="small text-body-secondary">{s.role_name}</div>
                              </CTableDataCell>
                              <CTableDataCell className="text-center small">
                                {s.total_hours > 0 ? `${s.total_hours}ч` : '—'}
                              </CTableDataCell>
                              <CTableDataCell className="text-end fw-semibold text-info">
                                {s.calculated > 0
                                  ? `${Number(s.calculated).toLocaleString()} сом.`
                                  : '—'}
                              </CTableDataCell>
                            </CTableRow>
                          ))}
                        <CTableRow style={{ background: 'var(--cui-secondary-bg)' }}>
                          <CTableDataCell className="fw-bold" colSpan={2}>Итого</CTableDataCell>
                          <CTableDataCell className="text-end fw-bold text-info">
                            {report.totalSalary.toLocaleString()} сом.
                          </CTableDataCell>
                        </CTableRow>
                      </CTableBody>
                    </CTable>
                  )}
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>

          {/* Итоговая строка */}
          <CCard className="mt-3">
            <CCardBody>
              <CRow className="g-2 text-center">
                {[
                  { label: 'Всего заказов',  value: report.orderStats?.total_orders,  suffix: 'шт.' },
                  { label: 'Завершено',       value: report.orderStats?.done_orders,   suffix: 'шт.' },
                  { label: 'Не оплачено',     value: report.orderStats?.unpaid_orders, suffix: 'шт.' },
                  { label: 'Общий долг',      value: Number(report.orderStats?.total_debt || 0).toLocaleString(), suffix: 'сом.' },
                ].map(item => (
                  <CCol xs={6} md={3} key={item.label}>
                    <div className="small text-body-secondary">{item.label}</div>
                    <div className="fw-bold">{item.value} {item.suffix}</div>
                  </CCol>
                ))}
              </CRow>
            </CCardBody>
          </CCard>
        </>
      )}
    </>
  )
}