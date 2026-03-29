import { useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  CContainer,
  CHeader,
  CHeaderNav,
  CHeaderToggler,
  CDropdown,
  CDropdownToggle,
  CDropdownMenu,
  CDropdownItem,
  CDropdownDivider,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilMenu, cilAccountLogout, cilSettings } from '@coreui/icons'

import LanguageSwitcher from './LanguageSwitcher'
import { useAuth } from '../AuthContext'

export default function AppHeader() {
  const dispatch   = useDispatch()
  const navigate   = useNavigate()
  const { user, logout } = useAuth()
  const headerRef  = useRef()

  const sidebarShow = useSelector((state) => state.sidebarShow)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  // Инициалы для аватара
  const initials = user?.full_name
    ?.split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U'

  return (
    <CHeader position="sticky" className="mb-4 p-0" ref={headerRef}>
      <CContainer fluid className="border-bottom px-4">

        {/* Кнопка toggle сайдбара */}
        <CHeaderToggler
          onClick={() => dispatch({ type: 'set', sidebarShow: !sidebarShow })}
          style={{ marginInlineStart: '-14px' }}
        >
          <CIcon icon={cilMenu} size="lg" />
        </CHeaderToggler>

        {/* Правая часть хедера */}
        <CHeaderNav className="ms-auto gap-1">

          {/* ── Переключатель языка ── */}
          <LanguageSwitcher />

          {/* ── Меню пользователя ── */}
          <CDropdown variant="nav-item">
            <CDropdownToggle
              className="d-flex align-items-center gap-2 py-0"
              caret={false}
            >
              <div
                className="rounded-circle d-flex align-items-center justify-content-center fw-semibold"
                style={{
                  width: 32, height: 32, fontSize: 12,
                  background: 'var(--cui-primary)',
                  color: 'white',
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              <span className="d-none d-md-inline small fw-medium">
                {user?.full_name}
              </span>
            </CDropdownToggle>

            <CDropdownMenu className="pt-0">
              <CDropdownItem
                className="text-body-secondary small py-2 px-3"
                style={{ cursor: 'default' }}
              >
                {user?.role_name}
              </CDropdownItem>
              <CDropdownDivider />
              <CDropdownItem
                onClick={() => navigate('/settings')}
                style={{ cursor: 'pointer' }}
              >
                <CIcon icon={cilSettings} className="me-2" />
                Настройки
              </CDropdownItem>
              <CDropdownItem
                onClick={handleLogout}
                className="text-danger"
                style={{ cursor: 'pointer' }}
              >
                <CIcon icon={cilAccountLogout} className="me-2" />
                Выйти
              </CDropdownItem>
            </CDropdownMenu>
          </CDropdown>

        </CHeaderNav>
      </CContainer>
    </CHeader>
  )
}
