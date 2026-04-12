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
import { cilPlus, cilTrash, cilClipboard } from '@coreui/icons'
import api from '../api/client'

const METHOD_LABELS = { cash: 'Наличные', card: 'Карта', transfer: 'Перевод', other: 'Другое' }
const METHOD_COLORS = { cash: 'success', card: 'info', transfer: 'primary', other: 'secondary' }

// Коэффициенты расхода по категории (кг/м²)
const CATEGORY_RATES = { 'Краска': 0.35, 'КРАСКА': 0.35, 'Кра': 0.35, 'ГРУНТ': 0.45, 'Грунт': 0.45, 'ЛАК': 0.25, 'Лак': 0.25 }

function normalizeCategory(cat) {
  if (!cat) return null
  const c = cat.trim().toUpperCase()
  if (c.startsWith('КРА')) return 'Краска'
  if (c.startsWith('ГРУ')) return 'Грунт'
  if (c.startsWith('ЛАК')) return 'Лак'
  return null
}

function getCategoryRate(cat) {
  const norm = normalizeCategory(cat)
  if (norm === 'Краска') return 0.35
  if (norm === 'Грунт')  return 0.45
  if (norm === 'Лак')    return 0.25
  return null
}

export default function ExpensesTable({ orderId, order, estimateTotal = 0, canEdit = true }) {
  const [expenses,  setExpenses]  = useState([])
  const [total,     setTotal]     = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  // Состояние для заявки на склад
  const [invoiceModal,   setInvoiceModal]   = useState(false)
  const [invoiceItems,   setInvoiceItems]   = useState([]) // позиции заявки
  const [invoiceSaving,  setInvoiceSaving]  = useState(false)
  const [invoiceError,   setInvoiceError]   = useState('')
  const [invoiceSuccess, setInvoiceSuccess] = useState(false)
  const [warehouseItems, setWarehouseItems] = useState([]) // для lookup категорий

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

  // ── Подготовка заявки из Сметы ────────────────────────────

  const buildInvoiceItems = useCallback(async () => {
    try {
      // 1. Загружаем строки сметы Покраски
      const estimateRes = await api.get(`/orders/${orderId}/detail-estimate`)
      const sections = estimateRes.data.data || []
      const paintSection = sections.find(s => s.service_type === 'painting')

      if (!paintSection || !paintSection.rows?.length) {
        setInvoiceError('В Смете нет данных по Покраске с выбранными продуктами')
        return []
      }

      // 2. Загружаем номенклатуру для получения категорий
      const warehouseRes = await api.get('/warehouse/items')
      const wItems = warehouseRes.data.data || []
      setWarehouseItems(wItems)

      // 3. Группируем по product_id → суммируем area_m2
      const grouped = {}

      // Сначала обрабатываем строки с выбранным продуктом (Краска)
      for (const row of paintSection.rows) {
        if (!row.product_id) continue
        const area = parseFloat(row.area_m2) || 0
        if (area <= 0) continue

        const wItem = wItems.find(i => i.id === row.product_id)
        const category = row.product_category || wItem?.category || ''
        const norm = normalizeCategory(category)
        if (norm !== 'Краска') continue // в заявку только краска по продуктам

        if (!grouped[row.product_id]) {
          grouped[row.product_id] = {
            item_id:    row.product_id,
            item_name:  row.product_name || wItem?.name || '—',
            category:   category,
            unit:       wItem?.unit || 'кг',
            total_area: 0,
            sale_price: wItem?.sale_price || 0,
          }
        }
        grouped[row.product_id].total_area += area
      }

      // 4. Считаем общую площадь для Грунта и Лака (все строки)
      const totalArea = paintSection.rows.reduce((s, r) => s + (parseFloat(r.area_m2) || 0), 0)

      // 5. Ищем Грунт и Лак в номенклатуре
      const gruntItem = wItems.find(i => normalizeCategory(i.category) === 'Грунт' && i.is_active !== false)
      const lakItem   = wItems.find(i => normalizeCategory(i.category) === 'Лак'   && i.is_active !== false)

      const result = []

      // Краска — по продуктам
      for (const g of Object.values(grouped)) {
        const rate = getCategoryRate(g.category) || 0.35
        const qty  = parseFloat((g.total_area * rate).toFixed(3))
        if (qty > 0) {
          result.push({
            item_id:    g.item_id,
            item_name:  g.item_name,
            unit:       g.unit,
            quantity:   qty,
            sale_price: g.sale_price,
            category:   'Краска',
            area_info:  `${g.total_area.toFixed(2)} м² × ${rate} кг/м²`,
          })
        }
      }

      // Грунт — по общей площади
      if (totalArea > 0) {
        const gruntQty = parseFloat((totalArea * 0.45).toFixed(3))
        result.push({
          item_id:    gruntItem?.id    || '',
          item_name:  gruntItem?.name  || 'Грунт',
          unit:       gruntItem?.unit  || 'кг',
          quantity:   gruntQty,
          sale_price: gruntItem?.sale_price || 0,
          category:   'Грунт',
          area_info:  `${totalArea.toFixed(2)} м² × 0.45 кг/м²`,
          no_item:    !gruntItem,
        })
      }

      // Лак — по общей площади
      if (totalArea > 0) {
        const lakQty = parseFloat((totalArea * 0.25).toFixed(3))
        result.push({
          item_id:    lakItem?.id    || '',
          item_name:  lakItem?.name  || 'Лак',
          unit:       lakItem?.unit  || 'кг',
          quantity:   lakQty,
          sale_price: lakItem?.sale_price || 0,
          category:   'Лак',
          area_info:  `${totalArea.toFixed(2)} м² × 0.25 кг/м²`,
          no_item:    !lakItem,
        })
      }

      return result
    } catch (e) {
      setInvoiceError('Ошибка загрузки данных сметы')
      return []
    }
  }, [orderId])

  const openInvoiceModal = async () => {
    setInvoiceError('')
    setInvoiceSuccess(false)
    setInvoiceItems([])
    setInvoiceModal(true)
    const items = await buildInvoiceItems()
    setInvoiceItems(items)
  }

  const updateInvoiceItem = (idx, field, value) => {
    setInvoiceItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, [field]: field === 'quantity' || field === 'sale_price' ? parseFloat(value) || 0 : value } : item
    ))
  }

  const removeInvoiceItem = (idx) => {
    setInvoiceItems(prev => prev.filter((_, i) => i !== idx))
  }

  const handleCreateInvoice = async () => {
    const validItems = invoiceItems.filter(i => i.item_id && i.quantity > 0)
    if (validItems.length === 0) {
      setInvoiceError('Нет позиций для создания заявки')
      return
    }

    setInvoiceSaving(true)
    setInvoiceError('')
    try {
      await api.post('/warehouse/outgoing-invoices', {
        invoice_type: 'order',
        order_id:     orderId,
        notes:        `Заявка из Сметы заказа #${order?.order_number || ''}`,
        items: validItems.map(i => ({
          item_id:    i.item_id,
          quantity:   i.quantity,
          sale_price: i.sale_price || 0,
        })),
      })
      setInvoiceSuccess(true)
    } catch (e) {
      setInvoiceError(e.response?.data?.error || 'Ошибка создания заявки')
    } finally {
      setInvoiceSaving(false)
    }
  }

  // ── Обработчики расходов ──────────────────────────────────

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
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div className="small text-body-secondary">
          Всего расходов: <strong>{expenses.length}</strong>
        </div>
        <div className="d-flex gap-2">
          {/* Кнопка заявки из Сметы — только для заказов с Покраской */}
          {canEdit && (
            <CButton size="sm" color="primary" variant="outline" onClick={openInvoiceModal}>
              <CIcon icon={cilClipboard} className="me-1" />Создать заявку со Склада
            </CButton>
          )}
          {canEdit && (
            <CButton size="sm" color="danger" variant="outline" onClick={() => setModal(true)}>
              <CIcon icon={cilPlus} className="me-1" />Добавить расход
            </CButton>
          )}
        </div>
      </div>

      {/* Таблица расходов */}
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
                <CTableDataCell className="text-body-secondary">{e.expense_date || '—'}</CTableDataCell>
                <CTableDataCell>
                  <CBadge color={METHOD_COLORS[e.method] || 'secondary'}>
                    {METHOD_LABELS[e.method] || e.method}
                  </CBadge>
                </CTableDataCell>
                <CTableDataCell className="text-body-secondary">{e.description || '—'}</CTableDataCell>
                {canEdit && (
                  <CTableDataCell>
                    <CButton size="sm" color="danger" variant="ghost" onClick={() => handleDelete(e.id)}>
                      <CIcon icon={cilTrash} />
                    </CButton>
                  </CTableDataCell>
                )}
              </CTableRow>
            ))}
            <CTableRow style={{ background:'var(--cui-secondary-bg)', fontWeight:700 }}>
              <CTableDataCell>Итого расходов:</CTableDataCell>
              <CTableDataCell className="text-danger">{total.toLocaleString()} сом.</CTableDataCell>
              <CTableDataCell colSpan={canEdit ? 4 : 3} />
            </CTableRow>
          </CTableBody>
        </CTable>
      )}

      {/* ── Модал: Заявка со Склада ── */}
      <CModal size="lg" visible={invoiceModal} onClose={() => setInvoiceModal(false)}>
        <CModalHeader>
          <CModalTitle>
            <CIcon icon={cilClipboard} className="me-2" />
            Создать заявку со Склада
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {invoiceError && <CAlert color="danger" className="mb-3">{invoiceError}</CAlert>}

          {invoiceSuccess ? (
            <CAlert color="success">
              ✅ Заявка успешно создана! Она появилась на странице{' '}
              <a href="/warehouse/outgoing-invoices" target="_blank" rel="noopener noreferrer">
                Расходных накладных
              </a>{' '}
              со статусом «Черновик». После закупки товаров снабженец подтвердит накладную.
            </CAlert>
          ) : invoiceItems.length === 0 && !invoiceError ? (
            <div className="text-center py-4">
              <CSpinner size="sm" className="me-2" />Загрузка данных из Сметы...
            </div>
          ) : invoiceItems.length > 0 ? (
            <>
              <p className="small text-body-secondary mb-3">
                Перечень рассчитан на основе данных Сметы (Покраска).
                Проверьте количество и укажите цену продажи если нужно.
              </p>
              <CTable small bordered style={{ fontSize: 13 }}>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Продукт</CTableHeaderCell>
                    <CTableHeaderCell className="text-center" style={{ width: 70 }}>Ед.</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 100 }}>Кол-во</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 110 }}>Цена прод.</CTableHeaderCell>
                    <CTableHeaderCell className="text-body-secondary" style={{ width: 150, fontSize: 11 }}>Расчёт</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 40 }}></CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {invoiceItems.map((item, idx) => (
                    <CTableRow key={idx} style={{
                      background: item.no_item ? 'var(--cui-warning-bg-subtle)' : 'transparent'
                    }}>
                      <CTableDataCell>
                        <div className="fw-semibold">{item.item_name}</div>
                        <div style={{ fontSize: 11 }}>
                          <CBadge color={
                            item.category === 'Краска' ? 'danger' :
                            item.category === 'Грунт'  ? 'warning' : 'secondary'
                          } style={{ fontSize: 10 }}>{item.category}</CBadge>
                          {item.no_item && (
                            <span className="text-warning ms-1" style={{ fontSize: 11 }}>
                              ⚠️ не найден в номенклатуре
                            </span>
                          )}
                        </div>
                      </CTableDataCell>
                      <CTableDataCell className="text-center">{item.unit}</CTableDataCell>
                      <CTableDataCell>
                        <CFormInput
                          type="number" size="sm" min="0.001" step="any"
                          value={item.quantity}
                          onChange={e => updateInvoiceItem(idx, 'quantity', e.target.value)}
                          style={{ textAlign: 'right' }}
                        />
                      </CTableDataCell>
                      <CTableDataCell>
                        <CFormInput
                          type="number" size="sm" min="0" step="any"
                          value={item.sale_price || ''}
                          placeholder="0"
                          onChange={e => updateInvoiceItem(idx, 'sale_price', e.target.value)}
                          style={{ textAlign: 'right' }}
                        />
                      </CTableDataCell>
                      <CTableDataCell className="text-body-secondary" style={{ fontSize: 11 }}>
                        {item.area_info}
                      </CTableDataCell>
                      <CTableDataCell className="text-center">
                        <button
                          onClick={() => removeInvoiceItem(idx)}
                          style={{ border:'none', background:'none', cursor:'pointer', color:'var(--cui-danger)', fontSize:16 }}>
                          ×
                        </button>
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
              {invoiceItems.some(i => i.no_item) && (
                <CAlert color="warning" className="mt-2 py-2 small">
                  ⚠️ Некоторые продукты не найдены в номенклатуре склада.
                  Они будут пропущены при создании заявки.
                  Добавьте их сначала через <strong>Склад → Номенклатура</strong>.
                </CAlert>
              )}
            </>
          ) : null}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={() => setInvoiceModal(false)}>
            {invoiceSuccess ? 'Закрыть' : 'Отмена'}
          </CButton>
          {!invoiceSuccess && invoiceItems.length > 0 && (
            <CButton color="primary" disabled={invoiceSaving} onClick={handleCreateInvoice}>
              {invoiceSaving
                ? <><CSpinner size="sm" className="me-1" />Создание...</>
                : <><CIcon icon={cilClipboard} className="me-1" />Создать заявку</>
              }
            </CButton>
          )}
        </CModalFooter>
      </CModal>

      {/* ── Модал: Добавить расход ── */}
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
            <CButton color="secondary" variant="outline" onClick={() => setModal(false)}>Отмена</CButton>
            <CButton type="submit" color="danger" disabled={saving}>
              {saving ? <CSpinner size="sm" /> : 'Добавить'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>
    </div>
  )
}