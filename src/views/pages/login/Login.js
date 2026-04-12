import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CButton, CCard, CCardBody, CCardGroup, CCol, CContainer,
  CForm, CFormInput, CInputGroup, CInputGroupText, CRow,
  CAlert, CSpinner, CDropdown, CDropdownToggle, CDropdownMenu, CDropdownItem,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLockLocked, cilPhone } from '@coreui/icons'
import { useAuth } from '../../../AuthContext'

const LANGUAGES = [
  { code: 'ru', flag: '🇷🇺', label: 'RU' },
  { code: 'en', flag: '🇬🇧', label: 'EN' },
  { code: 'tg', flag: '🇹🇯', label: 'TG' },
]

export default function Login() {
  const navigate    = useNavigate()
  const { login }   = useAuth()
  const { t, i18n } = useTranslation()

  const [phone,    setPhone]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(phone, password)
      switch (user.role_name) {
        case 'admin':
        case 'supervisor':
          navigate('/dashboard')
          break
        default:
          navigate('/tasks')
      }
    } catch (err) {
      const msg = err.response?.data?.error
      setError(msg || 'Неверный номер телефона или пароль')
    } finally {
      setLoading(false)
    }
  }

  const currentLang = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0]

  return (
    <div className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        <div className="d-flex justify-content-end mb-3">
          <CDropdown>
            <CDropdownToggle color="secondary" variant="outline" size="sm">
              <span className="me-1">{currentLang.flag}</span>
              {currentLang.label}
            </CDropdownToggle>
            <CDropdownMenu>
              {LANGUAGES.map((lang) => (
                <CDropdownItem
                  key={lang.code}
                  onClick={() => i18n.changeLanguage(lang.code)}
                  active={lang.code === i18n.language}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="me-2">{lang.flag}</span>
                  {lang.label === 'RU' ? 'Русский'
                    : lang.label === 'EN' ? 'English'
                    : 'Тоҷикӣ'}
                </CDropdownItem>
              ))}
            </CDropdownMenu>
          </CDropdown>
        </div>

        <CRow className="justify-content-center">
          <CCol md={8}>
            <CCardGroup>
              <CCard className="p-4">
                <CCardBody>
                  <CForm onSubmit={handleSubmit}>
                    <h1>{t('login.title')}</h1>
                    <p className="text-body-secondary">{t('login.subtitle')}</p>

                    {error && (
                      <CAlert color="danger" dismissible onClose={() => setError('')}>
                        {error}
                      </CAlert>
                    )}

                    {/* Телефон */}
                    <CInputGroup className="mb-3">
                      <CInputGroupText>
                        <CIcon icon={cilPhone} />
                      </CInputGroupText>
                      <CFormInput
                        type="tel"
                        placeholder="Номер телефона"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                      />
                    </CInputGroup>

                    {/* Пароль */}
                    <CInputGroup className="mb-4">
                      <CInputGroupText>
                        <CIcon icon={cilLockLocked} />
                      </CInputGroupText>
                      <CFormInput
                        type="password"
                        placeholder={t('login.password')}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </CInputGroup>

                    <CRow>
                      <CCol xs={6}>
                        <CButton color="primary" className="px-4" type="submit" disabled={loading}>
                          {loading ? (
                            <><CSpinner size="sm" className="me-2" />{t('login.submitting')}</>
                          ) : t('login.submit')}
                        </CButton>
                      </CCol>
                    </CRow>
                  </CForm>
                </CCardBody>
              </CCard>

              <CCard className="text-white py-5" style={{ width: '44%', background: '#0d6efd' }}>
                <CCardBody className="text-center d-flex flex-column justify-content-center">
                  <div>
                    <h2>{t('login.brand_title')}</h2>
                    <p className="mt-3" style={{ opacity: 0.85, lineHeight: 1.6 }}>
                      {t('login.brand_desc')}
                    </p>
                    <div className="mt-4 d-flex flex-wrap gap-2 justify-content-center">
                      {[
                        t('login.role_admin'),
                        t('login.role_supervisor'),
                        t('login.role_master'),
                        t('login.role_assistant'),
                      ].map((role) => (
                        <span key={role} className="badge"
                          style={{ background: 'rgba(255,255,255,0.2)', fontSize: 12, padding: '6px 12px' }}>
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                </CCardBody>
              </CCard>
            </CCardGroup>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}