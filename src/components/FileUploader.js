import { useState, useRef } from 'react'
import {
  CButton, CSpinner, CAlert, CProgress, CBadge,
  CFormSelect, CFormLabel,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCloudUpload, cilFile, cilTrash } from '@coreui/icons'
import api from '../api/client'

// ─── Категории файлов ─────────────────────────────────────

export const FILE_CATEGORIES = [
  { key: 'preliminary',  label: 'Предварительные фото', icon: '📷' },
  { key: 'design',       label: 'Дизайн',               icon: '🎨' },
  { key: 'drawing',      label: 'Чертёж',               icon: '📐' },
  { key: 'finished',     label: 'Готовые работы',        icon: '✅' },
  { key: 'installation', label: 'Установка',             icon: '🔧' },
  { key: 'handover',     label: 'Сдача',                 icon: '🤝' },
  { key: 'other',        label: 'Другое',                icon: '📎' },
]

export const CATEGORY_LABEL = Object.fromEntries(FILE_CATEGORIES.map(c => [c.key, c.label]))
export const CATEGORY_ICON  = Object.fromEntries(FILE_CATEGORIES.map(c => [c.key, c.icon]))

const UPLOAD_TYPES = {
  project: { label: 'Файлы', accept: 'image/*,.pdf,.dwg,.ai,.dxf', bucket: 'jevon-projects' },
  design:  { label: 'Дизайн', accept: '.pdf,.dwg,.ai,.png',        bucket: 'jevon-design'   },
  cutting: { label: 'Раскрой', accept: '.pdf,.dxf,.png',            bucket: 'jevon-cutting'  },
}

const isImage = (fileType) => fileType?.startsWith('image/')

// ─── FileUploader ─────────────────────────────────────────

export default function FileUploader({
  projectId,
  stageId,
  uploadType = 'project',
  onUploaded,
  isOrder = false,
  defaultCategory = 'other',
}) {
  const inputRef = useRef(null)

  const [files,    setFiles]    = useState([])
  const [category, setCategory] = useState(defaultCategory)
  const [progress, setProgress] = useState(0)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState(false)
  const [dragging, setDragging] = useState(false)

  const typeInfo   = UPLOAD_TYPES[uploadType] || UPLOAD_TYPES.project
  const uploadBase = isOrder ? 'orders' : 'projects'

  const handleSelect = (e) => { setFiles(Array.from(e.target.files)); setSuccess(false); setError('') }
  const handleDrop   = (e) => {
    e.preventDefault(); setDragging(false)
    setFiles(Array.from(e.dataTransfer.files)); setSuccess(false); setError('')
  }
  const handleRemove = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx))

  const handleUpload = async () => {
    if (!files.length) return
    setLoading(true); setProgress(0); setError('')

    const formData = new FormData()
    files.forEach(f => formData.append('files', f))

    try {
      const res = await api.post(
        `/${uploadBase}/${projectId}/stages/${stageId}/upload?type=${uploadType}&category=${category}`,
        formData,
        {
          headers: { 'Content-Type': undefined },
          onUploadProgress: (e) => setProgress(Math.round((e.loaded * 100) / e.total)),
        }
      )
      setSuccess(true)
      setFiles([])
      setProgress(100)
      if (onUploaded) onUploaded(res.data.files)
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка загрузки файлов')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {error   && <CAlert color="danger"  dismissible onClose={() => setError('')}>{error}</CAlert>}
      {success && <CAlert color="success" dismissible onClose={() => setSuccess(false)}>Файлы загружены!</CAlert>}

      {/* Выбор категории */}
      <div className="mb-2">
        <CFormLabel className="small fw-semibold">Категория файлов</CFormLabel>
        <CFormSelect size="sm" value={category} onChange={e => setCategory(e.target.value)}>
          {FILE_CATEGORIES.map(c => (
            <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
          ))}
        </CFormSelect>
      </div>

      {/* Drag & Drop зона */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? 'var(--cui-primary)' : 'var(--cui-border-color)'}`,
          borderRadius: 8, padding: '20px 16px',
          textAlign: 'center', cursor: 'pointer',
          background: dragging ? 'var(--cui-primary-bg-subtle)' : 'var(--cui-card-bg)',
          transition: 'all 0.15s',
        }}
      >
        <CIcon icon={cilCloudUpload} size="xl" className="text-primary mb-2" />
        <div className="small fw-semibold">
          {CATEGORY_ICON[category]} {CATEGORY_LABEL[category]}
        </div>
        <div className="small text-body-secondary mt-1">
          Перетащите файлы или нажмите для выбора
        </div>
        <input ref={inputRef} type="file" multiple accept={typeInfo.accept}
          onChange={handleSelect} style={{ display: 'none' }} />
      </div>

      {/* Список выбранных файлов */}
      {files.length > 0 && (
        <div className="mt-3">
          <div className="small fw-semibold mb-2 text-body-secondary">
            Выбрано: {files.length} файл(ов)
          </div>
          <div className="d-flex flex-column gap-2">
            {files.map((f, idx) => (
              <div key={idx} className="d-flex align-items-center gap-2 p-2 rounded"
                style={{ border: '0.5px solid var(--cui-border-color)', background: 'var(--cui-card-bg)' }}>
                {f.type.startsWith('image/') ? (
                  <img src={URL.createObjectURL(f)} alt={f.name}
                    style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                ) : (
                  <div style={{
                    width: 36, height: 36, borderRadius: 4, flexShrink: 0,
                    background: 'var(--cui-primary-bg-subtle)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CIcon icon={cilFile} className="text-primary" />
                  </div>
                )}
                <div className="flex-grow-1 overflow-hidden">
                  <div className="small fw-semibold text-truncate">{f.name}</div>
                  <div className="small text-body-secondary">{(f.size / 1024).toFixed(0)} KB</div>
                </div>
                <CButton size="sm" color="danger" variant="ghost" onClick={() => handleRemove(idx)}>
                  <CIcon icon={cilTrash} />
                </CButton>
              </div>
            ))}
          </div>

          {loading && (
            <div className="mt-2">
              <CProgress value={progress} color="primary" className="mb-1" />
              <div className="small text-body-secondary text-center">{progress}%</div>
            </div>
          )}

          <CButton color="primary" size="sm" className="mt-2 w-100"
            onClick={handleUpload} disabled={loading}>
            {loading
              ? <><CSpinner size="sm" className="me-2" />Загрузка...</>
              : <><CIcon icon={cilCloudUpload} className="me-1" />Загрузить {files.length} файл(ов)</>}
          </CButton>
        </div>
      )}
    </div>
  )
}

// ─── FileGallery — с группировкой по категориям ───────────

export function FileGallery({ files, onDelete, canDelete }) {
  const [activeCategory, setActiveCategory] = useState('all')

  if (!files?.length) return (
    <div className="text-center text-body-secondary py-3 small">
      Файлы не загружены
    </div>
  )

  // Группируем файлы по категориям
  const grouped = {}
  files.forEach(f => {
    const cat = f.category || 'other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(f)
  })

  const usedCategories = FILE_CATEGORIES.filter(c => grouped[c.key]?.length > 0)
  const showFiles = activeCategory === 'all'
    ? files
    : (grouped[activeCategory] || [])

  return (
    <div>
      {/* Фильтр по категориям — показываем только если есть несколько */}
      {usedCategories.length > 1 && (
        <div className="d-flex flex-wrap gap-1 mb-3">
          <CButton
            size="sm"
            color={activeCategory === 'all' ? 'primary' : 'secondary'}
            variant={activeCategory === 'all' ? undefined : 'outline'}
            onClick={() => setActiveCategory('all')}
          >
            Все ({files.length})
          </CButton>
          {usedCategories.map(c => (
            <CButton
              key={c.key}
              size="sm"
              color={activeCategory === c.key ? 'primary' : 'secondary'}
              variant={activeCategory === c.key ? undefined : 'outline'}
              onClick={() => setActiveCategory(c.key)}
            >
              {c.icon} {c.label} ({grouped[c.key].length})
            </CButton>
          ))}
        </div>
      )}

      {/* Если одна категория — показываем заголовок */}
      {usedCategories.length === 1 && (
        <div className="small fw-semibold text-body-secondary mb-2">
          {CATEGORY_ICON[usedCategories[0].key]} {CATEGORY_LABEL[usedCategories[0].key]}
        </div>
      )}

      {/* Галерея файлов */}
      {activeCategory === 'all' && usedCategories.length > 1 ? (
        // Показываем по группам
        <div className="d-flex flex-column gap-3">
          {usedCategories.map(cat => (
            <div key={cat.key}>
              <div className="small fw-semibold text-body-secondary mb-2">
                {cat.icon} {cat.label}
                <span className="ms-1 text-body-secondary">({grouped[cat.key].length})</span>
              </div>
              <FileGrid files={grouped[cat.key]} onDelete={onDelete} canDelete={canDelete} />
            </div>
          ))}
        </div>
      ) : (
        <FileGrid files={showFiles} onDelete={onDelete} canDelete={canDelete} />
      )}
    </div>
  )
}

// ─── FileGrid — сетка файлов ──────────────────────────────

function FileGrid({ files, onDelete, canDelete }) {
  return (
    <div className="d-flex flex-wrap gap-2">
      {files.map(f => (
        <div key={f.id} style={{ position: 'relative', display: 'inline-block' }}>
          {isImage(f.file_type) ? (
            <a href={f.file_url} target="_blank" rel="noreferrer">
              <img src={f.file_url} alt={f.file_name}
                style={{
                  width: 100, height: 100, objectFit: 'cover',
                  borderRadius: 8, border: '0.5px solid var(--cui-border-color)', display: 'block',
                }} />
            </a>
          ) : (
            <a href={f.file_url} target="_blank" rel="noreferrer"
              className="d-flex flex-column align-items-center p-2 rounded text-decoration-none"
              style={{
                border: '0.5px solid var(--cui-border-color)',
                width: 100, height: 100, justifyContent: 'center',
                background: 'var(--cui-card-bg)', color: 'inherit',
              }}>
              <CIcon icon={cilFile} size="xl" className="mb-1 text-primary" />
              <div className="small text-center text-truncate w-100"
                style={{ fontSize: 10 }} title={f.file_name}>
                {f.file_name}
              </div>
              <CBadge color="secondary" style={{ fontSize: 9 }}>
                {f.file_type?.split('/')[1]?.toUpperCase() || 'FILE'}
              </CBadge>
            </a>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(f.id, f.file_url)}
              style={{
                position: 'absolute', top: -6, right: -6,
                width: 20, height: 20, borderRadius: '50%',
                background: 'var(--cui-danger)', color: 'white',
                border: 'none', cursor: 'pointer', fontSize: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              }}>
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  )
}