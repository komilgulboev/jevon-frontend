import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CCard, CCardBody, CCardHeader,
  CTable, CTableBody, CTableDataCell,
  CTableHead, CTableHeaderCell, CTableRow,
  CBadge, CButton, CSpinner, CAlert,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CForm, CFormInput, CFormLabel, CFormSelect,
  CRow, CCol, CInputGroup, CInputGroupText, CTooltip,
  CNav, CNavItem, CNavLink,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilSearch, cilPencil, cilLockLocked } from '@coreui/icons'
import { getEmployees, createEmployee, updateEmployee, toggleEmployee, getRoles } from '../../api/employees'
import { useAuth } from '../../AuthContext'

// ─── SVG иконки ───────────────────────────────────────────

const WhatsAppIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#25D366">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

const TelegramIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#229ED9">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
)

const waUrl = (p) => `https://wa.me/${p.replace(/[\s\-()+ ]/g, '')}`
const tgUrl = (t) => t.startsWith('@') ? `https://t.me/${t.slice(1)}` : `https://t.me/${t}`

const ROLE_COLOR = {
  admin: 'danger', supervisor: 'primary', master: 'success',
  manager: 'info', designer: 'warning', cutter: 'secondary',
  warehouse: 'dark', driver: 'light', assembler: 'success', assistant: 'secondary',
}

const CONTRACT_COLOR = { employment: 'success', gph: 'info', ip: 'warning', none: 'secondary' }

const EMPTY_FORM = {
  full_name: '', last_name: '', phone: '', email: '',
  password: '', role_id: '',
  whatsapp: '', telegram: '', address: '',
  salary: '', hourly_rate: '', contract_type: 'none',
}

export default function Employees() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const isAdmin = hasRole('admin')

  const [employees, setEmployees] = useState([])
  const [roles,     setRoles]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [search,    setSearch]    = useState('')
  const [modal,     setModal]     = useState(false)
  const [editItem,  setEditItem]  = useState(null)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [saving,    setSaving]    = useState(false)
  const [activeTab, setActiveTab] = useState('info')

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([getEmployees(), getRoles()])
      .then(([empRes, rolesRes]) => {
        setEmployees(empRes.data.data || [])
        setRoles(rolesRes.data.data || [])
      })
      .catch(() => setError(t('common.loading')))
      .finally(() => setLoading(false))
  }, [t])

  useEffect(() => { load() }, [load])

  const visible = employees.filter(e => {
    const q = search.toLowerCase()
    return (
      e.full_name?.toLowerCase().includes(q) ||
      e.last_name?.toLowerCase().includes(q) ||
      e.phone?.includes(q) ||
      e.role_name?.toLowerCase().includes(q)
    )
  })

  const openCreate = () => {
    setEditItem(null); setForm(EMPTY_FORM); setActiveTab('info'); setModal(true)
  }

  const openEdit = (emp) => {
    setEditItem(emp)
    setForm({
      full_name:     emp.full_name     || '',
      last_name:     emp.last_name     || '',
      phone:         emp.phone         || '',
      email:         emp.email         || '',
      password:      '',
      role_id:       emp.role_id ? String(emp.role_id) : '',
      whatsapp:      emp.whatsapp      || '',
      telegram:      emp.telegram      || '',
      address:       emp.address       || '',
      salary:        emp.salary        != null ? String(emp.salary) : '',
      hourly_rate:   emp.hourly_rate   != null ? String(emp.hourly_rate) : '',
      contract_type: emp.contract_type || 'none',
    })
    setActiveTab('info'); setModal(true)
  }

  const handleSave = async (ev) => {
    ev.preventDefault(); setSaving(true)
    try {
      if (editItem) {
        const patch = {
          role_id:       form.role_id     ? parseInt(form.role_id)       : undefined,
          full_name:     form.full_name   || undefined,
          last_name:     form.last_name,
          phone:         form.phone       || undefined,
          email:         form.email,
          whatsapp:      form.whatsapp,
          telegram:      form.telegram,
          address:       form.address,
          salary:        form.salary      ? parseFloat(form.salary)      : null,
          hourly_rate:   form.hourly_rate ? parseFloat(form.hourly_rate) : null,
          contract_type: form.contract_type,
        }
        if (form.password) patch.password = form.password
        await updateEmployee(editItem.id, patch)
      } else {
        await createEmployee({
          role_id:       parseInt(form.role_id),
          full_name:     form.full_name,
          last_name:     form.last_name,
          phone:         form.phone,
          email:         form.email,
          password:      form.password,
          whatsapp:      form.whatsapp,
          telegram:      form.telegram,
          address:       form.address,
          salary:        form.salary      ? parseFloat(form.salary)      : null,
          hourly_rate:   form.hourly_rate ? parseFloat(form.hourly_rate) : null,
          contract_type: form.contract_type,
        })
      }
      setModal(false); load()
    } catch (err) {
      setError(err.response?.data?.error || t('common.save'))
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (emp) => {
    const action = emp.is_active ? t('employees.deactivate') : t('employees.activate')
    if (!window.confirm(`${action} — ${emp.full_name} ${emp.last_name}?`)) return
    try { await toggleEmployee(emp.id); load() }
    catch (err) { setError(err.response?.data?.error || '') }
  }

  const contractTypes = [
    { value: 'employment', label: t('employees.contract_employment') },
    { value: 'gph',        label: t('employees.contract_gph')        },
    { value: 'ip',         label: t('employees.contract_ip')         },
    { value: 'none',       label: t('employees.contract_none')       },
  ]

  return (
    <>
      {error && <CAlert color="danger" dismissible onClose={() => setError('')}>{error}</CAlert>}

      <CCard>
        <CCardHeader>
          <div className="d-flex gap-2 flex-wrap align-items-center">
            <strong>{t('employees.title')}</strong>
            <CInputGroup size="sm" style={{ width: 280 }}>
              <CInputGroupText><CIcon icon={cilSearch} /></CInputGroupText>
              <CFormInput
                placeholder={t('employees.search')}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </CInputGroup>
            <div className="ms-auto">
              {isAdmin && (
                <CButton color="primary" size="sm" onClick={openCreate}>
                  <CIcon icon={cilPlus} className="me-1" />{t('employees.add')}
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
                  <CTableHeaderCell>{t('employees.first_name')}</CTableHeaderCell>
                  <CTableHeaderCell>{t('employees.role')}</CTableHeaderCell>
                  <CTableHeaderCell>{t('employees.contacts')}</CTableHeaderCell>
                  <CTableHeaderCell>{t('employees.messengers')}</CTableHeaderCell>
                  <CTableHeaderCell>{t('employees.contract')}</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">{t('employees.salary')}</CTableHeaderCell>
                  <CTableHeaderCell>{t('common.status')}</CTableHeaderCell>
                  {isAdmin && <CTableHeaderCell></CTableHeaderCell>}
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {visible.length === 0 && (
                  <CTableRow>
                    <CTableDataCell colSpan={8} className="text-center text-body-secondary py-4">
                      {t('employees.not_found')}
                    </CTableDataCell>
                  </CTableRow>
                )}
                {visible.map(emp => (
                  <CTableRow key={emp.id}>
                    <CTableDataCell>
                      <div className="d-flex align-items-center gap-2">
                        {emp.avatar_url ? (
                          <img src={emp.avatar_url} alt=""
                            style={{ width:34, height:34, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                        ) : (
                          <div style={{
                            width:34, height:34, borderRadius:'50%', flexShrink:0,
                            background:'var(--cui-primary-bg-subtle)', color:'var(--cui-primary)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontWeight:700, fontSize:14,
                          }}>
                            {emp.full_name?.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="fw-semibold">{emp.full_name} {emp.last_name}</div>
                          {emp.address && <div className="text-body-secondary small">📍 {emp.address}</div>}
                        </div>
                      </div>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={ROLE_COLOR[emp.role_name] || 'secondary'}>
                        {t(`employees.role_${emp.role_name}`, { defaultValue: emp.role_name })}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      {emp.phone && <div className="small">📞 {emp.phone}</div>}
                      {emp.email && <div className="small text-body-secondary">✉️ {emp.email}</div>}
                      {!emp.phone && !emp.email && '—'}
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className="d-flex gap-2">
                        {emp.whatsapp ? (
                          <CTooltip content={`WhatsApp: ${emp.whatsapp}`}>
                            <a href={waUrl(emp.whatsapp)} target="_blank" rel="noopener noreferrer"
                              style={{ lineHeight:1, display:'inline-flex' }}>
                              <WhatsAppIcon size={20} />
                            </a>
                          </CTooltip>
                        ) : <span style={{ opacity:0.2 }}><WhatsAppIcon size={20} /></span>}
                        {emp.telegram ? (
                          <CTooltip content={`Telegram: ${emp.telegram}`}>
                            <a href={tgUrl(emp.telegram)} target="_blank" rel="noopener noreferrer"
                              style={{ lineHeight:1, display:'inline-flex' }}>
                              <TelegramIcon size={20} />
                            </a>
                          </CTooltip>
                        ) : <span style={{ opacity:0.2 }}><TelegramIcon size={20} /></span>}
                      </div>
                    </CTableDataCell>
                    <CTableDataCell>
                      {emp.contract_type && emp.contract_type !== 'none' ? (
                        <CBadge color={CONTRACT_COLOR[emp.contract_type] || 'secondary'} style={{ fontSize:10 }}>
                          {t(`employees.contract_${emp.contract_type}`, { defaultValue: emp.contract_type })}
                        </CBadge>
                      ) : <span className="text-body-secondary small">—</span>}
                    </CTableDataCell>
                    <CTableDataCell className="text-end">
                      {emp.salary != null && (
                        <div className="fw-semibold">{Number(emp.salary).toLocaleString()} сом/мес</div>
                      )}
                      {emp.hourly_rate != null && (
                        <div className="small text-body-secondary">
                          {Number(emp.hourly_rate).toLocaleString()} сом/час
                        </div>
                      )}
                      {emp.salary == null && emp.hourly_rate == null && (
                        <span className="text-body-secondary">—</span>
                      )}
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={emp.is_active ? 'success' : 'secondary'}>
                        {emp.is_active ? t('common.active') : t('common.inactive')}
                      </CBadge>
                    </CTableDataCell>
                    {isAdmin && (
                      <CTableDataCell>
                        <div className="d-flex gap-1">
                          <CButton size="sm" color="primary" variant="ghost" onClick={() => openEdit(emp)}>
                            <CIcon icon={cilPencil} />
                          </CButton>
                          <CButton size="sm"
                            color={emp.is_active ? 'danger' : 'success'}
                            variant="ghost"
                            onClick={() => handleToggle(emp)}>
                            {emp.is_active ? '🔒' : '🔓'}
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

      {/* ── Модал ── */}
      <CModal size="lg" visible={modal} onClose={() => setModal(false)}>
        <CModalHeader>
          <CModalTitle>
            {editItem
              ? `✏️ ${editItem.full_name} ${editItem.last_name}`
              : t('employees.add')}
          </CModalTitle>
        </CModalHeader>
        <CForm onSubmit={handleSave}>
          <CModalBody>
            <CNav variant="tabs" className="mb-3">
              {[
                { key: 'info',   label: `👤 ${t('employees.tab_info')}`   },
                { key: 'auth',   label: `🔐 ${t('employees.tab_access')}` },
                { key: 'salary', label: `💰 ${t('employees.tab_salary')}` },
              ].map(tab => (
                <CNavItem key={tab.key}>
                  <CNavLink active={activeTab === tab.key}
                    onClick={() => setActiveTab(tab.key)} style={{ cursor: 'pointer' }}>
                    {tab.label}
                  </CNavLink>
                </CNavItem>
              ))}
            </CNav>

            {/* Основное */}
            {activeTab === 'info' && (
              <CRow className="g-3">
                <CCol xs={6}>
                  <CFormLabel>{t('employees.first_name')} *</CFormLabel>
                  <CFormInput required value={form.full_name}
                    onChange={e => setForm({ ...form, full_name: e.target.value })} />
                </CCol>
                <CCol xs={6}>
                  <CFormLabel>{t('employees.last_name')}</CFormLabel>
                  <CFormInput value={form.last_name}
                    onChange={e => setForm({ ...form, last_name: e.target.value })} />
                </CCol>
                <CCol xs={12}>
                  <CFormLabel>{t('employees.role')} *</CFormLabel>
                  <CFormSelect required value={form.role_id}
                    onChange={e => setForm({ ...form, role_id: e.target.value })}>
                    <option value="">—</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>
                        {t(`employees.role_${r.name}`, { defaultValue: r.name })}
                      </option>
                    ))}
                  </CFormSelect>
                </CCol>
                <CCol xs={6}>
                  <CFormLabel><WhatsAppIcon size={14} /> WhatsApp</CFormLabel>
                  <CFormInput value={form.whatsapp}
                    onChange={e => setForm({ ...form, whatsapp: e.target.value })}
                    placeholder="+992 XX XXX XX XX" />
                </CCol>
                <CCol xs={6}>
                  <CFormLabel><TelegramIcon size={14} /> Telegram</CFormLabel>
                  <CFormInput value={form.telegram}
                    onChange={e => setForm({ ...form, telegram: e.target.value })}
                    placeholder="@username" />
                </CCol>
                <CCol xs={12}>
                  <CFormLabel>{t('common.address')}</CFormLabel>
                  <CFormInput value={form.address}
                    onChange={e => setForm({ ...form, address: e.target.value })} />
                </CCol>
              </CRow>
            )}

            {/* Доступ */}
            {activeTab === 'auth' && (
              <CRow className="g-3">
                <CCol xs={12}>
                  <div className="p-3 rounded"
                    style={{ background:'var(--cui-info-bg-subtle)', border:'1px solid var(--cui-info-border-subtle)' }}>
                    <div className="small fw-semibold text-info mb-1">
                      <CIcon icon={cilLockLocked} className="me-1" />
                      {t('employees.tab_access')}
                    </div>
                    <div className="small text-body-secondary">{t('employees.login_hint')}</div>
                  </div>
                </CCol>
                <CCol xs={12}>
                  <CFormLabel>{t('employees.phone_login')} *</CFormLabel>
                  <CFormInput required value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="+992 XX XXX XX XX" />
                </CCol>
                <CCol xs={12}>
                  <CFormLabel>Email</CFormLabel>
                  <CFormInput type="email" value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })} />
                </CCol>
                <CCol xs={12}>
                  <CFormLabel>
                    {editItem ? t('employees.new_password') : `${t('employees.password')} *`}
                  </CFormLabel>
                  <CFormInput type="password"
                    required={!editItem}
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder={editItem ? '••••••' : t('employees.password_hint')}
                    minLength={form.password ? 6 : undefined}
                  />
                </CCol>
              </CRow>
            )}

            {/* Зарплата */}
            {activeTab === 'salary' && (
              <CRow className="g-3">
                <CCol xs={12}>
                  <CFormLabel>{t('employees.contract_type')}</CFormLabel>
                  <CFormSelect value={form.contract_type}
                    onChange={e => setForm({ ...form, contract_type: e.target.value })}>
                    {contractTypes.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </CFormSelect>
                </CCol>
                <CCol xs={6}>
                  <CFormLabel>{t('employees.salary_monthly')}</CFormLabel>
                  <CFormInput type="number" min="0" step="any" value={form.salary}
                    onChange={e => setForm({ ...form, salary: e.target.value })} placeholder="0" />
                </CCol>
                <CCol xs={6}>
                  <CFormLabel>{t('employees.salary_hourly')}</CFormLabel>
                  <CFormInput type="number" min="0" step="any" value={form.hourly_rate}
                    onChange={e => setForm({ ...form, hourly_rate: e.target.value })} placeholder="0" />
                </CCol>
                <CCol xs={12}>
                  <div className="p-2 rounded small text-body-secondary"
                    style={{ background:'var(--cui-tertiary-bg)' }}>
                    💡 {t('employees.contract_hint')}
                  </div>
                </CCol>
              </CRow>
            )}
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setModal(false)}>
              {t('common.cancel')}
            </CButton>
            <CButton type="submit" color="primary" disabled={saving}>
              {saving ? <CSpinner size="sm" /> : t('common.save')}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>
    </>
  )
}