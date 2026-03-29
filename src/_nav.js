import React from 'react'
import CIcon from '@coreui/icons-react'
import {
  cilSpeedometer,
  cilFolderOpen,
  cilTask,
  cilPeople,
  cilSettings,
  cilIndustry,
  cilList,
  cilStorage,
} from '@coreui/icons'
import { CNavGroup, CNavItem, CNavTitle } from '@coreui/react'

const _nav = [
  {
    component: CNavTitle,
    name: 'nav.main',
    _i18n: true,
  },
  {
    component: CNavItem,
    name: 'nav.dashboard',
    to: '/dashboard',
    icon: <CIcon icon={cilSpeedometer} customClassName="nav-icon" />,
    _i18n: true,
  },

  // ── Заказы цеха ──────────────────────────────────────
  {
    component: CNavTitle,
    name: 'Заказы',
  },
  {
    component: CNavItem,
    name: 'Все заказы',
    to: '/orders',
    icon: <CIcon icon={cilList} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'nav.projects',
    to: '/projects',
    icon: <CIcon icon={cilFolderOpen} customClassName="nav-icon" />,
    _i18n: true,
  },
  {
    component: CNavItem,
    name: 'nav.tasks',
    to: '/tasks',
    icon: <CIcon icon={cilTask} customClassName="nav-icon" />,
    _i18n: true,
  },
  {
  component: CNavItem,
  name: 'Клиенты',
  to: '/clients',
  icon: <CIcon icon={cilPeople} customClassName="nav-icon" />,
},

  // ── Склад ─────────────────────────────────────────────
  {
    component: CNavTitle,
    name: 'Склад',
  },
  {
    component: CNavGroup,
    name: 'Склад',
    icon: <CIcon icon={cilStorage} customClassName="nav-icon" />,
    items: [
      {
        component: CNavItem,
        name: 'Номенклатура',
        to: '/warehouse/items',
      },
      {
        component: CNavItem,
        name: 'Поставщики',
        to: '/warehouse/suppliers',
      },
      {
        component: CNavItem,
        name: 'Приходные накладные',
        to: '/warehouse/receipts',
      },
    ],
  },

  // ── Управление ───────────────────────────────────────
  {
    component: CNavTitle,
    name: 'nav.management',
    _i18n: true,
  },
  {
    component: CNavItem,
    name: 'nav.employees',
    to: '/users',
    icon: <CIcon icon={cilPeople} customClassName="nav-icon" />,
    _i18n: true,
    roles: ['admin', 'supervisor'],
  },
  

  // ── Система ──────────────────────────────────────────
  {
    component: CNavTitle,
    name: 'nav.system',
    _i18n: true,
  },
  {
    component: CNavItem,
    name: 'nav.settings',
    to: '/settings',
    icon: <CIcon icon={cilSettings} customClassName="nav-icon" />,
    _i18n: true,
    roles: ['admin'],
  },
  
]

export default _nav