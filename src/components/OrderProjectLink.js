// src/components/OrderProjectLink.js
import React, { useEffect, useState } from 'react'
import {
  CButton, CFormSelect, CSpinner, CBadge,
  CInputGroup, CInputGroupText
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLink, cilLinkBroken, cilFolder } from '@coreui/icons'
import { formatProjectNumber } from 'src/utils/orderNumber'
import api from 'src/api/client'

/**
 * Блок привязки заказа к проекту — показывается во вкладке "Детали"
 * Props:
 *   orderId       string  — ID заказа
 *   projectId     string  — текущий project_id (может быть '')
 *   projectTitle  string  — название текущего проекта
 *   onUpdated     fn()    — callback после изменения (перезагрузить заказ)
 */
export default function OrderProjectLink({ orderId, projectId, projectTitle, onUpdated }) {
  const [projects, setProjects]   = useState([])
  const [selected, setSelected]   = useState(projectId || '')
  const [loading, setLoading]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [editing, setEditing]     = useState(false)

  // Загрузить список проектов при открытии редактирования
  useEffect(() => {
    if (!editing) return
    setLoading(true)
    api.get('/projects?limit=200')
      .then(r => {
        const list = r.data?.data || r.data?.items || (Array.isArray(r.data) ? r.data : [])
        setProjects(list)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [editing])

  // Синхронизировать selected с props
  useEffect(() => {
    setSelected(projectId || '')
  }, [projectId])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put(`/orders/${orderId}/project`, { project_id: selected })
      setEditing(false)
      onUpdated?.()
    } catch (e) {
      alert('Ошибка сохранения: ' + (e?.response?.data?.error || e.message))
    } finally {
      setSaving(false)
    }
  }

  const handleUnlink = async () => {
    if (!window.confirm('Открепить заказ от проекта?')) return
    setSaving(true)
    try {
      await api.put(`/orders/${orderId}/project`, { project_id: '' })
      setEditing(false)
      onUpdated?.()
    } catch (e) {
      alert('Ошибка: ' + (e?.response?.data?.error || e.message))
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    // Режим просмотра
    return (
      <div className="d-flex align-items-center gap-2 flex-wrap">
        <CIcon icon={cilFolder} className="text-body-secondary flex-shrink-0" />
        {projectId && projectTitle ? (
          <>
            <CBadge color="info" className="px-2 py-1 fs-6">
              {projectTitle}
            </CBadge>
            <CButton
              size="sm" color="secondary" variant="ghost"
              onClick={() => setEditing(true)}
              title="Изменить проект"
            >
              Изменить
            </CButton>
            <CButton
              size="sm" color="danger" variant="ghost"
              onClick={handleUnlink}
              disabled={saving}
              title="Открепить от проекта"
            >
              {saving ? <CSpinner size="sm" /> : <CIcon icon={cilLinkBroken} />}
            </CButton>
          </>
        ) : (
          <>
            <span className="text-body-secondary small">Не привязан к проекту</span>
            <CButton
              size="sm" color="primary" variant="ghost"
              onClick={() => setEditing(true)}
            >
              <CIcon icon={cilLink} className="me-1" />
              Привязать
            </CButton>
          </>
        )}
      </div>
    )
  }

  // Режим редактирования
  return (
    <div className="d-flex align-items-center gap-2 flex-wrap">
      <CInputGroup style={{ maxWidth: 360 }}>
        <CInputGroupText>
          <CIcon icon={cilFolder} />
        </CInputGroupText>
        {loading ? (
          <div className="form-control d-flex align-items-center">
            <CSpinner size="sm" className="me-2" /> Загрузка...
          </div>
        ) : (
          <CFormSelect
            value={selected}
            onChange={e => setSelected(e.target.value)}
          >
            <option value="">— без проекта —</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.project_number ? `${formatProjectNumber(p.project_number)} — ${p.title}` : p.title}
              </option>
            ))}
          </CFormSelect>
        )}
      </CInputGroup>
      <CButton
        size="sm" color="success"
        onClick={handleSave}
        disabled={saving || loading}
      >
        {saving ? <CSpinner size="sm" /> : 'Сохранить'}
      </CButton>
      <CButton
        size="sm" color="secondary" variant="ghost"
        onClick={() => { setEditing(false); setSelected(projectId || '') }}
        disabled={saving}
      >
        Отмена
      </CButton>
    </div>
  )
}