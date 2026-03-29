import { useTranslation } from 'react-i18next'
import {
  CDropdown,
  CDropdownToggle,
  CDropdownMenu,
  CDropdownItem,
} from '@coreui/react'

// Флаги и названия языков
const LANGUAGES = [
  { code: 'ru', label: 'Русский',    flag: '🇷🇺' },
  { code: 'en', label: 'English',    flag: '🇬🇧' },
  { code: 'tg', label: 'Тоҷикӣ',    flag: '🇹🇯' },
]

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()

  const current = LANGUAGES.find((l) => l.code === i18n.language)
    || LANGUAGES[0]

  const handleChange = (code) => {
    i18n.changeLanguage(code)
    // Сохраняется в localStorage автоматически через LanguageDetector
  }

  return (
    <CDropdown variant="nav-item">
      <CDropdownToggle
        className="d-flex align-items-center gap-1 py-0"
        caret={false}
      >
        <span style={{ fontSize: 20 }}>{current.flag}</span>
        <span
          className="d-none d-md-inline"
          style={{ fontSize: 13, fontWeight: 500 }}
        >
          {current.code.toUpperCase()}
        </span>
      </CDropdownToggle>

      <CDropdownMenu className="pt-0" style={{ minWidth: 150 }}>
        {LANGUAGES.map((lang) => (
          <CDropdownItem
            key={lang.code}
            onClick={() => handleChange(lang.code)}
            active={lang.code === i18n.language}
            style={{ cursor: 'pointer' }}
          >
            <span className="me-2" style={{ fontSize: 18 }}>{lang.flag}</span>
            {lang.label}
          </CDropdownItem>
        ))}
      </CDropdownMenu>
    </CDropdown>
  )
}
