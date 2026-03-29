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
import { cilPlus, cilSearch, cilPencil, cilTrash } from '@coreui/icons'
import { getItems, getUnits, getCategories, createItem, updateItem, deleteItem } from '../../api/warehouse'
import { useAuth } from '../../AuthContext'

const EMPTY_FORM = {
  name: '', article: '', category: '',
  unit_id: '', min_stock: '', notes: '', is_active: true,
}

export default function WarehouseItems() {
  const { hasRole } = useAuth()
  const canEdit = hasRole('admin', 'supervisor')

  const [items,      setItems]      = useState([])
  const [units,      setUnits]      = useState([])
  const [categories, setCategories] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [search,     setSearch]     = useState('')
  const [catFilter,  setCatFilter]  = useState('')
  const [modal,      setModal]      = useState(false)
  const [editItem,   setEditItem]   = useState(null)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)

  // ── Загрузка ──────────────────────────────────────────

  const load = useCallback(() => {
    setLoading(true)
    const params = {}
    if (catFilter) params.category = catFilter
    if (search)    params.search   = search

    Promise.all([
      getItems(params),
      getUnits(),
      getCategories(),
    ])
      .then(([itemsRes, unitsRes, catsRes]) => {
        setItems(itemsRes.data.data || [])
        setUnits(unitsRes.data || [])
        setCategories(catsRes.data || [])
      })
      .catch(() => setError('Ошибка загрузки номенклатуры'))
      .finally(() => setLoading(false))
  }, [catFilter, search])

  useEffect(() => { load() }, [load])

  // ── Модал ─────────────────────────────────────────────

  const openCreate = () => {
    setEditItem(null)
    setForm(EMPTY_FORM)
    setModal(true)
  }

  const openEdit = (item) => {
    setEditItem(item)
    setForm({
      name:      item.name,
      article:   item.article,
      category:  item.category,
      unit_id:   item.unit_id || '',
      min_stock: item.min_stock || '',
      notes:     item.notes,
      is_active: item.is_active,
    })
    setModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        unit_id:   form.unit_id   ? parseInt(form.unit_id)   : null,
        min_stock: form.min_stock ? parseFloat(form.min_stock) : 0,
      }
      if (editItem) await updateItem(editItem.id, payload)
      else          await createItem(payload)
      setModal(false)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (item) => {
    if (!window.confirm(`Удалить "${item.name}"?`)) return
    try {
      const res = await deleteItem(item.id)
      setError('')
      load()
      // Если деактивирован — показываем сообщение
      if (res.data.message?.includes('деактивировано')) {
        setError('ℹ️ ' + res.data.message)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка удаления')
    }
  }

  // ── Render ────────────────────────────────────────────

  const balanceColor = (balance, minStock) => {
    if (balance <= 0)          return 'danger'
    if (balance <= minStock)   return 'warning'
    return 'success'
  }

  return (
    <>
      {error && (
        <CAlert color={error.startsWith('ℹ️') ? 'info' : 'danger'} dismissible onClose={() => setError('')}>
          {error}
        </CAlert>
      )}

      <CCard>
        <CCardHeader>
          <div className="d-flex gap-2 flex-wrap align-items-center">
            <strong>Номенклатура</strong>
            <CInputGroup size="sm" style={{ width: 220 }}>
              <CInputGroupText><CIcon icon={cilSearch} /></CInputGroupText>
              <CFormInput
                placeholder="Поиск по названию, артикулу..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </CInputGroup>
            <CFormSelect size="sm" style={{ width: 160 }}
              value={catFilter} onChange={e => setCatFilter(e.target.value)}>
              <option value="">Все категории</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </CFormSelect>
            <div className="ms-auto">
              {canEdit && (
                <CButton color="primary" size="sm" onClick={openCreate}>
                  <CIcon icon={cilPlus} className="me-1" />Добавить
                </CButton>
              )}
            </div>
          </div>
        </CCardHeader>

        <CCardBody className="p-0">
          {loading ? (
            <div className="text-center py-4"><CSpinner /></div>
          ) : (
            <CTable align="middle" hover responsive style={{ fontSize: 13 }} className="mb-0">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Наименование</CTableHeaderCell>
                  <CTableHeaderCell>Артикул</CTableHeaderCell>
                  <CTableHeaderCell>Категория</CTableHeaderCell>
                  <CTableHeaderCell>Ед.</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Приход</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Расход</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Остаток</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Ср. цена</CTableHeaderCell>
                  <CTableHeaderCell>Статус</CTableHeaderCell>
                  {canEdit && <CTableHeaderCell></CTableHeaderCell>}
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {items.length === 0 && (
                  <CTableRow>
                    <CTableDataCell colSpan={9} className="text-center text-body-secondary py-4">
                      Номенклатура не найдена
                    </CTableDataCell>
                  </CTableRow>
                )}
                {items.map(it => (
                  <CTableRow key={it.id}>
                    <CTableDataCell>
                      <div className="fw-semibold">{it.name}</div>
                      {it.notes && <div className="text-body-secondary small">{it.notes}</div>}
                    </CTableDataCell>
                    <CTableDataCell className="text-body-secondary">
                      {it.article || '—'}
                    </CTableDataCell>
                    <CTableDataCell>
                      {it.category
                        ? <CBadge color="light" className="text-dark">{it.category}</CBadge>
                        : '—'}
                    </CTableDataCell>
                    <CTableDataCell>{it.unit || '—'}</CTableDataCell>
                    <CTableDataCell className="text-end">
                      {it.total_in > 0 ? it.total_in.toLocaleString() : '—'}
                    </CTableDataCell>
                    <CTableDataCell className="text-end">
                      {it.total_out > 0 ? it.total_out.toLocaleString() : '—'}
                    </CTableDataCell>
                    <CTableDataCell className="text-end">
                      <CBadge color={balanceColor(it.balance, it.min_stock)}>
                        {it.balance.toLocaleString()} {it.unit}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell className="text-end">
                      {it.avg_price > 0
                        ? `${it.avg_price.toLocaleString()} сом`
                        : '—'}
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={it.is_active ? 'success' : 'secondary'}>
                        {it.is_active ? 'Активен' : 'Неактивен'}
                      </CBadge>
                    </CTableDataCell>
                    {canEdit && (
                      <CTableDataCell>
                        <div className="d-flex gap-1">
                          <CButton size="sm" color="primary" variant="ghost"
                            onClick={() => openEdit(it)}>
                            <CIcon icon={cilPencil} />
                          </CButton>
                          <CButton size="sm" color="danger" variant="ghost"
                            onClick={() => handleDelete(it)}>
                            <CIcon icon={cilTrash} />
                          </CButton>
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

      {/* ── Модал создания/редактирования ── */}
      <CModal visible={modal} onClose={() => setModal(false)}>
        <CModalHeader>
          <CModalTitle>{editItem ? 'Редактировать' : 'Новый материал'}</CModalTitle>
        </CModalHeader>
        <CForm onSubmit={handleSave}>
          <CModalBody>
            <CRow className="g-3">
              <CCol xs={12}>
                <CFormLabel>Наименование *</CFormLabel>
                <CFormInput required value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="ЛДСП 16мм Белый..." />
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Артикул</CFormLabel>
                <CFormInput value={form.article}
                  onChange={e => setForm({ ...form, article: e.target.value })}
                  placeholder="001-ДСП-БЕЛ" />
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Единица измерения</CFormLabel>
                <CFormSelect value={form.unit_id}
                  onChange={e => setForm({ ...form, unit_id: e.target.value })}>
                  <option value="">— выбрать —</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </CFormSelect>
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Категория</CFormLabel>
                <CFormInput value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  placeholder="ДСП, Кромка, Фурнитура..."
                  list="cat-list" />
                <datalist id="cat-list">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Мин. остаток</CFormLabel>
                <CFormInput type="number" min="0" step="any"
                  value={form.min_stock}
                  onChange={e => setForm({ ...form, min_stock: e.target.value })}
                  placeholder="0" />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Примечание</CFormLabel>
                <CFormTextarea rows={2} value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })} />
              </CCol>
              {editItem && (
                <CCol xs={12}>
                  <CFormSelect value={form.is_active ? 'true' : 'false'}
                    onChange={e => setForm({ ...form, is_active: e.target.value === 'true' })}>
                    <option value="true">Активен</option>
                    <option value="false">Неактивен</option>
                  </CFormSelect>
                </CCol>
              )}
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