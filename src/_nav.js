import React from 'react'
import CIcon from '@coreui/icons-react'
import {
  cilSpeedometer, cilFolderOpen, cilTask,
  cilPeople, cilSettings, cilList, cilStorage,
  cilGroup, cilMoney, cilChartLine,
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
     roles: ['admin'],
  },

  // ── Заказы ───────────────────────────────────────────────
  {
    component: CNavTitle,
    name: 'nav.orders',
    _i18n: true,
  },
  {
    component: CNavItem,
    name: 'nav.all_orders',
    to: '/orders',
    icon: <CIcon icon={cilList} customClassName="nav-icon" />,
    _i18n: true,
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
    name: 'nav.clients',
    to: '/clients',
    icon: <CIcon icon={cilPeople} customClassName="nav-icon" />,
    _i18n: true,
    roles: ['admin', 'supervisor', 'manager'],
  },

  // ── Финансы ──────────────────────────────────────────────
  {
    component: CNavTitle,
    name: 'nav.finance',
    _i18n: true,
  },
  {
    component: CNavItem,
    name: 'nav.expenses',
    to: '/expenses',
    icon: <CIcon icon={cilMoney} customClassName="nav-icon" />,
    _i18n: true,
    roles: ['admin', 'supervisor', 'manager'],
  },
  {
    component: CNavItem,
    name: 'nav.reports',
    to: '/reports',
    icon: <CIcon icon={cilChartLine} customClassName="nav-icon" />,
    _i18n: true,
    roles: ['admin', 'supervisor'],
  },

  // ── Склад ─────────────────────────────────────────────────
  {
    component: CNavTitle,
    name: 'nav.warehouse',
    _i18n: true,
  },
  {
    component: CNavGroup,
    name: 'nav.warehouse',
    icon: <CIcon icon={cilStorage} customClassName="nav-icon" />,
    _i18n: true,
    roles: ['admin', 'supervisor', 'manager', 'warehouse', 'seller'],
    items: [
      { component: CNavItem, name: 'nav.items',     to: '/warehouse/items',     _i18n: true  },
      { component: CNavItem, name: 'nav.suppliers', to: '/warehouse/suppliers', _i18n: true  },
      { component: CNavItem, name: 'nav.receipts',  to: '/warehouse/receipts',  _i18n: true  },
      { component: CNavItem, name: 'nav.outgoing_invoices', to: '/warehouse/outgoing-invoices', _i18n: true },
    ],
  },

  // ── Управление ───────────────────────────────────────────
  {
    component: CNavTitle,
    name: 'nav.management',
    _i18n: true,
  },
  {
    component: CNavItem,
    name: 'nav.employees',
    to: '/employees',
    icon: <CIcon icon={cilGroup} customClassName="nav-icon" />,
    _i18n: true,
    roles: ['admin', 'supervisor'],
  },
  {
    component: CNavItem,
    name: 'nav.timesheet',
    to: '/employees/timesheet',
    icon: <CIcon icon={cilTask} customClassName="nav-icon" />,
    _i18n: true,
    roles: ['admin', 'supervisor'],
  },

  // ── Система ──────────────────────────────────────────────
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