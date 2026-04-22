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

const today        = new Date()
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
const todayStr     = today.toISOString().slice(0, 10)

function monthKey(dateStr) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(key) {
  const [y, m] = key.split('-')
  const months = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']
  return `${months[parseInt(m) - 1]} ${y}`
}

export default function Reports() {
  const [from,    setFrom]    = useState(firstOfMonth)
  const [to,      setTo]      = useState(todayStr)
  const [report,  setReport]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const loadReport = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [ordersRes, expensesRes, salaryRes, salaryPayRes] = await Promise.all([
        api.get('/orders/stats'),
        api.get('/expenses', { params: { from, to } }),
        getTimesheetSummary({ from, to }),
        api.get('/salary-payments', { params: { from, to } }).catch(() => ({ data: { data: [] } })),
      ])

      const orderStats         = ordersRes.data
      const expensesAll        = expensesRes.data.data || []
      const workshopExpenses   = expensesRes.data.total || 0

      // Расходы по категориям
      const expensesByCategory = expensesAll.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount
        return acc
      }, {})

      // Аренда — фильтруем категорию "Аренда" по месяцам
      const rentByMonth = {}
      expensesAll
        .filter(e => e.category?.toLowerCase().includes('аренд'))
        .forEach(e => {
          const mk = monthKey(e.expense_date || e.created_at)
          rentByMonth[mk] = (rentByMonth[mk] || 0) + e.amount
        })

      // Расходы по заказам (привязанные к order_id)
      const orderExpenses = expensesAll.filter(e => e.order_id)
      const orderExpensesByOrder = orderExpenses.reduce((acc, e) => {
        const key = e.order_id
        if (!acc[key]) acc[key] = { order_id: key, order_title: e.order_title || e.order_id, total: 0, items: [] }
        acc[key].total += e.amount
        acc[key].items.push(e)
        return acc
      }, {})

      // Зарплата по месяцам — начислено (из табеля)
      const salaryData = salaryRes.data.data || []
      const totalSalary = salaryData.reduce((s, e) => s + (e.calculated || 0), 0)

      // Зарплата — выплачено из salary_payments
      const salaryPayments = salaryPayRes.data.data || []
      const totalPaid      = salaryPayments.reduce((s, p) => s + (p.amount || 0), 0)
      const totalDebt      = Math.max(0, totalSalary - totalPaid)

      // Выплаты по месяцам
      const paidByMonth = {}
      salaryPayments.forEach(p => {
        const mk = monthKey(p.payment_date || p.created_at)
        paidByMonth[mk] = (paidByMonth[mk] || 0) + (p.amount || 0)
      })

      // Начислено по месяцам (из табеля — нет прямой разбивки, показываем одним периодом)
      const salaryByEmployee = salaryData.map(s => ({
        ...s,
        paid:  salaryPayments.filter(p => p.user_id === s.user_id).reduce((sum, p) => sum + (p.amount || 0), 0),
        debt:  Math.max(0, (s.calculated || 0) - salaryPayments.filter(p => p.user_id === s.user_id).reduce((sum, p) => sum + (p.amount || 0), 0)),
      }))

      setReport({
        orderStats,
        revenue: orderStats.total_revenue || 0,
        workshopExpenses,
        expensesByCategory,
        rentByMonth,
        orderExpensesByOrder: Object.values(orderExpensesByOrder),
        salaryData,
        salaryByEmployee,
        totalSalary,
        totalPaid,
        totalDebt,
        paidByMonth,
        totalExpenses: workshopExpenses + totalSalary,
        profit: (orderStats.total_revenue || 0) - workshopExpenses - totalSalary,
      })
    } catch (err) {
      setError('Ошибка формирования отчёта: ' + (err.message || ''))
    } finally { setLoading(false) }
  }, [from, to])

  const profitColor = report?.profit >= 0 ? 'success' : 'danger'

  return (
    <>
      {error && <CAlert color="danger" dismissible onClose={() => setError('')}>{error}</CAlert>}

      {/* Фильтр */}
      <CCard className="mb-4">
        <CCardBody>
          <div className="d-flex gap-3 align-items-end flex-wrap">
            <div>
              <CFormLabel className="small mb-1">Период с</CFormLabel>
              <CFormInput type="date" size="sm" value={from}
                onChange={e => setFrom(e.target.value)} style={{ width:150 }} />
            </div>
            <div>
              <CFormLabel className="small mb-1">по</CFormLabel>
              <CFormInput type="date" size="sm" value={to}
                onChange={e => setTo(e.target.value)} style={{ width:150 }} />
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
          {/* Сводные карточки */}
          <CRow className="g-3 mb-4">
            {[
              { label:'Доходы (оплачено)',  value:report.revenue,          color:'success', icon:'💰' },
              { label:'Расходы цеха',       value:report.workshopExpenses, color:'warning', icon:'🏭' },
              { label:'Зарплаты (начисл.)', value:report.totalSalary,      color:'info',    icon:'👥' },
              { label:'Прибыль',            value:report.profit,           color:profitColor, icon:'📈' },
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

          {/* Структура */}
          {report.revenue > 0 && (
            <CCard className="mb-4">
              <CCardHeader><strong>Структура доходов и расходов</strong></CCardHeader>
              <CCardBody>
                {[
                  { label:'Расходы цеха', value:report.workshopExpenses, color:'warning' },
                  { label:'Зарплаты',     value:report.totalSalary,      color:'info'    },
                  { label:'Прибыль',      value:Math.max(0,report.profit), color:profitColor },
                ].map(item => (
                  <div className="mb-3" key={item.label}>
                    <div className="d-flex justify-content-between small mb-1">
                      <span className={item.label==='Прибыль'?`text-${profitColor} fw-semibold`:''}>{item.label}</span>
                      <span>{((item.value/report.revenue)*100).toFixed(1)}%</span>
                    </div>
                    <CProgress value={(item.value/report.revenue)*100} color={item.color} style={{ height:8 }} />
                  </div>
                ))}
              </CCardBody>
            </CCard>
          )}

          <CRow className="g-3 mb-3">
            {/* Расходы по категориям */}
            <CCol md={6}>
              <CCard className="h-100">
                <CCardHeader><strong>Расходы по категориям</strong></CCardHeader>
                <CCardBody className="p-0">
                  {Object.entries(report.expensesByCategory).length === 0 ? (
                    <div className="text-center text-body-secondary py-4 small">Нет расходов</div>
                  ) : (
                    <CTable small responsive className="mb-0" style={{ fontSize:13 }}>
                      <CTableHead>
                        <CTableRow>
                          <CTableHeaderCell>Категория</CTableHeaderCell>
                          <CTableHeaderCell className="text-end">Сумма</CTableHeaderCell>
                          <CTableHeaderCell className="text-end">%</CTableHeaderCell>
                        </CTableRow>
                      </CTableHead>
                      <CTableBody>
                        {Object.entries(report.expensesByCategory)
                          .sort((a,b) => b[1]-a[1])
                          .map(([cat, sum]) => (
                            <CTableRow key={cat}>
                              <CTableDataCell><CBadge color="secondary">{cat}</CBadge></CTableDataCell>
                              <CTableDataCell className="text-end fw-semibold">{sum.toLocaleString()} сом.</CTableDataCell>
                              <CTableDataCell className="text-end text-body-secondary">
                                {report.workshopExpenses > 0 ? ((sum/report.workshopExpenses)*100).toFixed(0) : 0}%
                              </CTableDataCell>
                            </CTableRow>
                          ))}
                        <CTableRow style={{ background:'var(--cui-secondary-bg)' }}>
                          <CTableDataCell className="fw-bold">Итого</CTableDataCell>
                          <CTableDataCell className="text-end fw-bold text-warning">{report.workshopExpenses.toLocaleString()} сом.</CTableDataCell>
                          <CTableDataCell className="text-end">100%</CTableDataCell>
                        </CTableRow>
                      </CTableBody>
                    </CTable>
                  )}
                </CCardBody>
              </CCard>
            </CCol>

            {/* Аренда по месяцам */}
            <CCol md={6}>
              <CCard className="h-100">
                <CCardHeader><strong>🏠 Аренда по месяцам</strong></CCardHeader>
                <CCardBody className="p-0">
                  {Object.keys(report.rentByMonth).length === 0 ? (
                    <div className="text-center text-body-secondary py-4 small">
                      Нет расходов с категорией «Аренда»
                    </div>
                  ) : (
                    <CTable small responsive className="mb-0" style={{ fontSize:13 }}>
                      <CTableHead>
                        <CTableRow>
                          <CTableHeaderCell>Месяц</CTableHeaderCell>
                          <CTableHeaderCell className="text-end">Сумма</CTableHeaderCell>
                        </CTableRow>
                      </CTableHead>
                      <CTableBody>
                        {Object.entries(report.rentByMonth)
                          .sort((a,b) => a[0].localeCompare(b[0]))
                          .map(([mk, sum]) => (
                            <CTableRow key={mk}>
                              <CTableDataCell className="fw-semibold">{monthLabel(mk)}</CTableDataCell>
                              <CTableDataCell className="text-end fw-semibold text-warning">
                                {sum.toLocaleString()} сом.
                              </CTableDataCell>
                            </CTableRow>
                          ))}
                        <CTableRow style={{ background:'var(--cui-secondary-bg)' }}>
                          <CTableDataCell className="fw-bold">Итого</CTableDataCell>
                          <CTableDataCell className="text-end fw-bold text-warning">
                            {Object.values(report.rentByMonth).reduce((s,v)=>s+v,0).toLocaleString()} сом.
                          </CTableDataCell>
                        </CTableRow>
                      </CTableBody>
                    </CTable>
                  )}
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>

          {/* Зарплата — начислено / выплачено / долг */}
          <CCard className="mb-3">
            <CCardHeader>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <strong>👥 Зарплата сотрудников</strong>
                <div className="d-flex gap-3 small">
                  <span>Начислено: <strong className="text-info">{report.totalSalary.toLocaleString()} сом.</strong></span>
                  <span>Выплачено: <strong className="text-success">{report.totalPaid.toLocaleString()} сом.</strong></span>
                  <span>Долг: <strong className={report.totalDebt > 0 ? 'text-danger' : 'text-success'}>{report.totalDebt.toLocaleString()} сом.</strong></span>
                </div>
              </div>
            </CCardHeader>
            <CCardBody className="p-0">
              {report.salaryByEmployee.filter(s => s.calculated > 0 || s.total_hours > 0).length === 0 ? (
                <div className="text-center text-body-secondary py-4 small">Нет данных</div>
              ) : (
                <CTable small responsive className="mb-0" style={{ fontSize:13 }}>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Сотрудник</CTableHeaderCell>
                      <CTableHeaderCell className="text-center">Часов</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Начислено</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Выплачено</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Долг</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {report.salaryByEmployee
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
                            {s.calculated > 0 ? `${Number(s.calculated).toLocaleString()} сом.` : '—'}
                          </CTableDataCell>
                          <CTableDataCell className="text-end fw-semibold text-success">
                            {s.paid > 0 ? `${Number(s.paid).toLocaleString()} сом.` : '—'}
                          </CTableDataCell>
                          <CTableDataCell className="text-end fw-semibold">
                            {s.debt > 0
                              ? <span className="text-danger">{Number(s.debt).toLocaleString()} сом.</span>
                              : <span className="text-success">—</span>}
                          </CTableDataCell>
                        </CTableRow>
                      ))}
                    <CTableRow style={{ background:'var(--cui-secondary-bg)', fontWeight:700 }}>
                      <CTableDataCell colSpan={2}>Итого</CTableDataCell>
                      <CTableDataCell className="text-end text-info">{report.totalSalary.toLocaleString()} сом.</CTableDataCell>
                      <CTableDataCell className="text-end text-success">{report.totalPaid.toLocaleString()} сом.</CTableDataCell>
                      <CTableDataCell className={`text-end ${report.totalDebt > 0 ? 'text-danger' : 'text-success'}`}>
                        {report.totalDebt > 0 ? `${report.totalDebt.toLocaleString()} сом.` : '—'}
                      </CTableDataCell>
                    </CTableRow>
                  </CTableBody>
                </CTable>
              )}
            </CCardBody>
          </CCard>

          {/* Расходы по заказам */}
          {report.orderExpensesByOrder.length > 0 && (
            <CCard className="mb-3">
              <CCardHeader><strong>📦 Расходы по заказам</strong></CCardHeader>
              <CCardBody className="p-0">
                <CTable small responsive className="mb-0" style={{ fontSize:13 }}>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Заказ</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Сумма расходов</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {report.orderExpensesByOrder
                      .sort((a,b) => b.total - a.total)
                      .map(oe => (
                        <CTableRow key={oe.order_id}>
                          <CTableDataCell className="fw-semibold">{oe.order_title}</CTableDataCell>
                          <CTableDataCell className="text-end fw-semibold text-warning">
                            {oe.total.toLocaleString()} сом.
                          </CTableDataCell>
                        </CTableRow>
                      ))}
                    <CTableRow style={{ background:'var(--cui-secondary-bg)', fontWeight:700 }}>
                      <CTableDataCell>Итого</CTableDataCell>
                      <CTableDataCell className="text-end text-warning">
                        {report.orderExpensesByOrder.reduce((s,o)=>s+o.total,0).toLocaleString()} сом.
                      </CTableDataCell>
                    </CTableRow>
                  </CTableBody>
                </CTable>
              </CCardBody>
            </CCard>
          )}

          {/* Итоговая строка */}
          <CCard>
            <CCardBody>
              <CRow className="g-2 text-center">
                {[
                  { label:'Всего заказов',  value:report.orderStats?.total_orders,  suffix:'шт.' },
                  { label:'Завершено',      value:report.orderStats?.done_orders,   suffix:'шт.' },
                  { label:'Не оплачено',    value:report.orderStats?.unpaid_orders, suffix:'шт.' },
                  { label:'Общий долг',     value:Number(report.orderStats?.total_debt||0).toLocaleString(), suffix:'сом.' },
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