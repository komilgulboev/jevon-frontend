import { useState, useCallback } from 'react'
import {
  CCard, CCardBody, CCardHeader,
  CTable, CTableBody, CTableDataCell,
  CTableHead, CTableHeaderCell, CTableRow,
  CBadge, CSpinner, CAlert, CFormInput, CRow, CCol, CButton,
} from '@coreui/react'
import api from '../../api/client'
import { formatOrderNumber } from '../../utils/orderNumber'

const ORDER_TYPE_LABELS = { workshop: 'Заказ цеха', external: 'Заказ вне цеха' }
const ORDER_TYPE_COLOR  = { workshop: 'primary',    external: 'success' }

const STATUS_LABELS = {
  new: 'Новый', in_progress: 'В работе', on_hold: 'Ожидание',
  done: 'Готово', cancelled: 'Отменён',
}
const STATUS_COLOR = {
  new: 'info', in_progress: 'primary', on_hold: 'warning',
  done: 'success', cancelled: 'danger',
}
const PAYMENT_LABELS = { unpaid: 'Не оплачен', partial: 'Частично', paid: 'Оплачен' }
const PAYMENT_COLOR  = { unpaid: 'danger', partial: 'warning', paid: 'success' }

const SERVICE_LABELS = {
  cutting: 'Распил', sawing: 'Распил',
  cnc: 'ЧПУ', painting: 'Покраска',
  soft: 'Мягкая мебель', soft_fabric: 'Мягкая мебель', soft_furniture: 'Мягкая мебель',
}
const SERVICE_COLOR = {
  cutting: '#ff9800', sawing: '#ff9800',
  cnc: '#2196f3', painting: '#f44336',
  soft: '#4caf50', soft_fabric: '#4caf50', soft_furniture: '#4caf50',
}
const SERVICE_TYPES = [
  { key: 'cutting',  label: 'Распил'        },
  { key: 'cnc',      label: 'ЧПУ'           },
  { key: 'painting', label: 'Покраска'      },
  { key: 'soft',     label: 'Мягкая мебель' },
]

const normalizeServiceKey = (key) =>
  key === 'soft_fabric' || key === 'soft_furniture' ? 'soft'
  : key === 'sawing' ? 'cutting'
  : key

export default function ProfitReport() {
  const [orders,   setOrders]   = useState([])
  const [links,    setLinks]    = useState({})
  const [loading,  setLoading]  = useState(false)
  const [loaded,   setLoaded]   = useState(false)
  const [error,    setError]    = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [wRes, eRes] = await Promise.all([
        api.get('/orders?order_type=workshop'),
        api.get('/orders?order_type=external'),
      ])
      let all = [
        ...(wRes.data.data || []),
        ...(eRes.data.data || []),
      ].filter(o => !o.parent_order_id)

      // Фильтр по дате
      if (dateFrom || dateTo) {
        all = all.filter(o => {
          const d = new Date(o.created_at)
          if (dateFrom && d < new Date(dateFrom)) return false
          if (dateTo   && d > new Date(dateTo + 'T23:59:59')) return false
          return true
        })
      }

      all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      setOrders(all)

      const linksMap = {}
      await Promise.all(all.map(async o => {
        try {
          const r = await api.get(`/orders/${o.id}/service-links`)
          linksMap[o.id] = r.data.data || []
        } catch { linksMap[o.id] = [] }
      }))
      setLinks(linksMap)
      setLoaded(true)
    } catch { setError('Ошибка загрузки') }
    finally  { setLoading(false) }
  }, [dateFrom, dateTo])

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ru-RU') : '—'

  // Считаем итоги
  const calcOrder = (o) => {
    const contract   = o.final_cost || o.estimated_cost || 0
    const orderLinks = links[o.id] || []
    const expense    = orderLinks.reduce((s, l) => s + (l.amount || 0), 0)
    return { contract, expense, income: contract - expense, orderLinks }
  }

  const workshop = orders.filter(o => o.order_type === 'workshop')
  const external = orders.filter(o => o.order_type === 'external')

  const sumGroup = (group) => group.reduce((acc, o) => {
    const { contract, expense, income } = calcOrder(o)
    acc.contract += contract; acc.expense += expense; acc.income += income
    return acc
  }, { contract: 0, expense: 0, income: 0 })

  const totalsAll      = sumGroup(orders)
  const totalsWorkshop = sumGroup(workshop)
  const totalsExternal = sumGroup(external)

  // Разбивка по услугам
  const serviceBreakdown = SERVICE_TYPES.reduce((acc, s) => { acc[s.key] = 0; return acc }, {})
  orders.forEach(o => {
    ;(links[o.id] || []).forEach(l => {
      const key = normalizeServiceKey(l.service_type)
      if (serviceBreakdown.hasOwnProperty(key)) serviceBreakdown[key] += l.amount || 0
    })
  })

  const SummaryCard = ({ label, contract, expense, income, color }) => (
    <div className="p-3 rounded" style={{
      background: `var(--cui-${color}-bg-subtle)`,
      border: `1px solid var(--cui-${color}-border-subtle)`,
    }}>
      <div className={`fw-semibold text-${color} mb-2`} style={{ fontSize: 13 }}>{label}</div>
      <div className="d-flex gap-3 flex-wrap">
        <div>
          <div style={{ fontSize: 11 }} className="text-body-secondary">Договор</div>
          <div className="fw-bold">{Math.round(contract).toLocaleString()} сом.</div>
        </div>
        <div>
          <div style={{ fontSize: 11 }} className="text-body-secondary">Расход</div>
          <div className="fw-bold text-danger">−{Math.round(expense).toLocaleString()} сом.</div>
        </div>
        <div>
          <div style={{ fontSize: 11 }} className="text-body-secondary">Доход</div>
          <div className={`fw-bold ${income >= 0 ? 'text-success' : 'text-danger'}`}>
            {income >= 0 ? '+' : ''}{Math.round(income).toLocaleString()} сом.
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {error && <CAlert color="danger" dismissible onClose={() => setError('')}>{error}</CAlert>}

      <CCard>
        <CCardHeader>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
            <div>
              <h5 className="mb-0">📊 Отчёт доходности</h5>
              <div className="small text-body-secondary">По дате создания заказа</div>
            </div>
            <div className="d-flex gap-2 align-items-center flex-wrap">
              <CFormInput type="date" size="sm" style={{ width:145 }} value={dateFrom}
                onChange={e => setDateFrom(e.target.value)} />
              <span className="text-body-secondary small">—</span>
              <CFormInput type="date" size="sm" style={{ width:145 }} value={dateTo}
                onChange={e => setDateTo(e.target.value)} />
              {(dateFrom || dateTo) && (
                <CButton size="sm" color="secondary" variant="outline"
                  onClick={() => { setDateFrom(''); setDateTo('') }}>×</CButton>
              )}
              <CButton color="primary" size="sm" disabled={loading} onClick={load}>
                {loading ? <CSpinner size="sm" className="me-1" /> : '📊 '}
                Отчёт
              </CButton>
            </div>
          </div>
        </CCardHeader>

        {!loaded && !loading && (
          <CCardBody>
            <div className="text-center text-body-secondary py-5">
              <div style={{ fontSize: 40, marginBottom: 8 }}>📊</div>
              <div className="fw-semibold mb-1">Выберите период и нажмите «Отчёт»</div>
              <div className="small">Или нажмите «Отчёт» без фильтра для просмотра всех заказов</div>
            </div>
          </CCardBody>
        )}

        {loading && (
          <CCardBody className="text-center py-5">
            <CSpinner color="primary" />
            <div className="small text-body-secondary mt-2">Загрузка данных...</div>
          </CCardBody>
        )}

        {loaded && !loading && (
          <CCardBody>

            {/* Разбивка по типу заказа */}
            <CRow className="g-3 mb-4">
              <CCol xs={12} md={4}>
                <SummaryCard label="Все заказы" color="secondary"
                  contract={totalsAll.contract} expense={totalsAll.expense} income={totalsAll.income} />
              </CCol>
              <CCol xs={12} md={4}>
                <SummaryCard label="🏭 Заказы цеха" color="primary"
                  contract={totalsWorkshop.contract} expense={totalsWorkshop.expense} income={totalsWorkshop.income} />
              </CCol>
              <CCol xs={12} md={4}>
                <SummaryCard label="🏢 Заказы вне цеха" color="success"
                  contract={totalsExternal.contract} expense={totalsExternal.expense} income={totalsExternal.income} />
              </CCol>
            </CRow>

            {/* Разбивка по услугам */}
            {Object.values(serviceBreakdown).some(v => v > 0) && (
              <div className="mb-4">
                <div className="small fw-semibold text-body-secondary mb-2">Расход по типам услуг</div>
                <div className="d-flex flex-wrap gap-2">
                  {SERVICE_TYPES.map(svc => {
                    const amount = serviceBreakdown[svc.key] || 0
                    if (!amount) return null
                    const color = SERVICE_COLOR[svc.key] || '#9da5b1'
                    return (
                      <div key={svc.key} style={{
                        padding: '8px 16px', borderRadius: 8,
                        background: color + '15', border: `1px solid ${color}40`,
                        minWidth: 120,
                      }}>
                        <div style={{ fontSize: 11, color, fontWeight: 600, marginBottom: 2 }}>{svc.label}</div>
                        <div className="fw-bold" style={{ fontSize: 14 }}>
                          {Math.round(amount).toLocaleString()} сом.
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Таблица */}
            <CTable responsive style={{ fontSize: 12 }}>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ width: 80 }}>№</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 100 }}>Тип</CTableHeaderCell>
                  <CTableHeaderCell>Заказ</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 80 }}>Статус</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 80 }}>Оплата</CTableHeaderCell>
                  <CTableHeaderCell>Услуги</CTableHeaderCell>
                  <CTableHeaderCell className="text-end" style={{ width: 110 }}>Расход</CTableHeaderCell>
                  <CTableHeaderCell className="text-end" style={{ width: 120 }}>Договор</CTableHeaderCell>
                  <CTableHeaderCell className="text-end" style={{ width: 110 }}>Доход</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 85 }}>Принят</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 85 }}>Сдача</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {orders.length === 0 && (
                  <CTableRow>
                    <CTableDataCell colSpan={11} className="text-center text-body-secondary py-4">
                      Нет данных за выбранный период
                    </CTableDataCell>
                  </CTableRow>
                )}
                {orders.map(o => {
                  const { contract, expense, income, orderLinks } = calcOrder(o)
                  const tColor = ORDER_TYPE_COLOR[o.order_type] || 'secondary'

                  return (
                    <CTableRow key={o.id} style={{ cursor:'pointer', verticalAlign:'middle' }}
                      onClick={() => window.open(`/orders/${o.id}`, '_blank')}>

                      <CTableDataCell>
                        <CBadge color="secondary" style={{ fontSize:11, fontWeight:700 }}>
                          {formatOrderNumber(o.order_type, o.order_number)}
                        </CBadge>
                      </CTableDataCell>

                      <CTableDataCell>
                        <CBadge color={tColor} style={{ fontSize:10 }}>
                          {ORDER_TYPE_LABELS[o.order_type] || o.order_type}
                        </CBadge>
                      </CTableDataCell>

                      <CTableDataCell>
                        <div className="fw-semibold" style={{ fontSize:12 }}>{o.title}</div>
                        {o.client_name && (
                          <div className="text-body-secondary" style={{ fontSize:11 }}>👤 {o.client_name}</div>
                        )}
                      </CTableDataCell>

                      <CTableDataCell>
                        <CBadge color={STATUS_COLOR[o.status] || 'secondary'} style={{ fontSize:10 }}>
                          {STATUS_LABELS[o.status] || o.status}
                        </CBadge>
                      </CTableDataCell>

                      <CTableDataCell>
                        <CBadge color={PAYMENT_COLOR[o.payment_status] || 'secondary'} style={{ fontSize:10 }}>
                          {PAYMENT_LABELS[o.payment_status] || o.payment_status}
                        </CBadge>
                      </CTableDataCell>

                      <CTableDataCell>
                        {orderLinks.length === 0 ? (
                          <span className="text-body-secondary">—</span>
                        ) : (
                          <div className="d-flex flex-wrap gap-1">
                            {orderLinks.map(link => {
                              const sColor = SERVICE_COLOR[link.service_type] || '#9da5b1'
                              const sLabel = SERVICE_LABELS[link.service_type] || link.service_type
                              return (
                                <div key={link.id} style={{
                                  display:'inline-flex', alignItems:'center', gap:3,
                                  padding:'1px 6px', borderRadius:4, fontSize:10,
                                  background: sColor + '15', border:`1px solid ${sColor}40`,
                                  color: sColor, fontWeight:600,
                                }}>
                                  {sLabel}
                                  <span style={{ color:'var(--cui-body-color)', fontWeight:400 }}>
                                    {Math.round(link.amount).toLocaleString()}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </CTableDataCell>

                      <CTableDataCell className="text-end">
                        {expense > 0
                          ? <span className="fw-semibold text-danger">−{Math.round(expense).toLocaleString()} сом.</span>
                          : <span className="text-body-secondary">—</span>}
                      </CTableDataCell>

                      <CTableDataCell className="text-end">
                        {contract > 0
                          ? <span className="fw-semibold">{Math.round(contract).toLocaleString()} сом.</span>
                          : <span className="text-body-secondary">—</span>}
                      </CTableDataCell>

                      <CTableDataCell className="text-end">
                        {(contract > 0 || expense > 0) ? (
                          <span className={`fw-bold ${income >= 0 ? 'text-success' : 'text-danger'}`}>
                            {income >= 0 ? '+' : ''}{Math.round(income).toLocaleString()} сом.
                          </span>
                        ) : <span className="text-body-secondary">—</span>}
                      </CTableDataCell>

                      <CTableDataCell className="small text-body-secondary">
                        {fmtDate(o.created_at)}
                      </CTableDataCell>
                      <CTableDataCell className="small text-body-secondary">
                        {o.deadline ? fmtDate(o.deadline) : '—'}
                      </CTableDataCell>
                    </CTableRow>
                  )
                })}
              </CTableBody>

              {orders.length > 0 && (
                <tfoot>
                  <CTableRow style={{ fontWeight:700, background:'var(--cui-secondary-bg)', borderTop:'2px solid var(--cui-border-color)' }}>
                    <CTableDataCell colSpan={6} className="text-end small">
                      Итого ({orders.length} заказов):
                    </CTableDataCell>
                    <CTableDataCell className="text-end text-danger">
                      −{Math.round(totalsAll.expense).toLocaleString()} сом.
                    </CTableDataCell>
                    <CTableDataCell className="text-end">
                      {Math.round(totalsAll.contract).toLocaleString()} сом.
                    </CTableDataCell>
                    <CTableDataCell className={`text-end ${totalsAll.income >= 0 ? 'text-success' : 'text-danger'}`}>
                      {totalsAll.income >= 0 ? '+' : ''}{Math.round(totalsAll.income).toLocaleString()} сом.
                    </CTableDataCell>
                    <CTableDataCell colSpan={2} />
                  </CTableRow>
                </tfoot>
              )}
            </CTable>
          </CCardBody>
        )}
      </CCard>
    </>
  )
}