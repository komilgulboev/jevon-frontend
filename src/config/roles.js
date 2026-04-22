// src/config/roles.js
// ─────────────────────────────────────────────────────────────
// Централизованный конфиг доступа по ролям.
// Используется в _nav.js, routes.js и OrderDetail для вкладок.
// Чтобы изменить доступ — редактируй только этот файл.
// ─────────────────────────────────────────────────────────────

// Группы ролей для удобства
export const ROLE_GROUPS = {
  all:       null, // доступно всем авторизованным
  admin:     ['admin'],
  managers:  ['admin', 'supervisor', 'manager'],
  senior:    ['admin', 'supervisor'],
  warehouse: ['admin', 'supervisor', 'manager', 'warehouse', 'seller'],
  workers:   [
    'admin', 'supervisor', 'manager', 'master', 'cutter', 'assembler',
    'designer', 'warehouse', 'driver', 'assistant', 'painter_worker',
    'cutter_worker', 'driller', 'edger', 'cnc_operator',
    'soft_furniture_master', 'sander', 'carpenter', 'installer',
  ],
}

// ── Доступ к страницам ────────────────────────────────────────
// path → массив ролей (null = все авторизованные)
export const ROUTE_ROLES = {
  '/dashboard':                    ROLE_GROUPS.all,
  '/orders':                       ROLE_GROUPS.all,
  '/orders/:id':                   ROLE_GROUPS.all,
  '/projects':                     ROLE_GROUPS.all,
  '/projects/:id':                 ROLE_GROUPS.all,
  '/tasks':                        ROLE_GROUPS.all,
  '/clients':                      ROLE_GROUPS.managers,
  '/expenses':                     ROLE_GROUPS.managers,
  '/reports':                      ROLE_GROUPS.senior,
  '/warehouse/items':              ROLE_GROUPS.warehouse,
  '/warehouse/suppliers':          ROLE_GROUPS.warehouse,
  '/warehouse/receipts':           ROLE_GROUPS.warehouse,
  '/warehouse/outgoing-invoices':  ROLE_GROUPS.warehouse,
  '/employees':                    ROLE_GROUPS.senior,
  '/employees/timesheet':          ROLE_GROUPS.senior,
  '/settings':                     ROLE_GROUPS.admin,
}

// ── Вкладки внутри заказа ─────────────────────────────────────
// key → массив ролей (null = все авторизованные)
export const ORDER_TABS_ROLES = {
  stages:      ROLE_GROUPS.all,       // Детали — все
  materials:   ROLE_GROUPS.all,       // Материалы — все
  calculation: ROLE_GROUPS.all,       // Смета — все
  comments:    ROLE_GROUPS.all,       // Комментарии — все
  files:       ROLE_GROUPS.all,       // Файлы — все
  history:     ROLE_GROUPS.managers,  // История — менеджеры+
  expenses:    ROLE_GROUPS.managers,  // Расходы — менеджеры+
  payments:    ROLE_GROUPS.admin,     // Оплата — только admin
}