import { lazy } from 'react'

const Dashboard      = lazy(() => import('./views/dashboard/Dashboard'))
const Projects       = lazy(() => import('./views/projects/Projects'))
const ProjectDetail  = lazy(() => import('./views/projects/ProjectDetail'))
const Orders         = lazy(() => import('./views/orders/Orders'))
const OrderDetail    = lazy(() => import('./views/orders/OrderDetail'))

// ── Склад ─────────────────────────────────────────────
const WarehouseItems = lazy(() => import('./views/warehouse/WarehouseItems'))
const Suppliers      = lazy(() => import('./views/warehouse/Suppliers'))
const Receipts       = lazy(() => import('./views/warehouse/Receipts'))

// -- Clients ---------
const Clients = lazy(() => import('./views/clients/Clients'))

const routes = [
  { path: '/',                    exact: true, name: 'Главная'             },
  { path: '/dashboard',           name: 'Дашборд',             element: Dashboard      },
  { path: '/projects',            name: 'Проекты',             element: Projects       },
  { path: '/projects/:id',        name: 'Проект',              element: ProjectDetail  },
  { path: '/orders',              name: 'Заказы',              element: Orders         },
  { path: '/orders/:id',          name: 'Заказ',               element: OrderDetail    },

  // ── Склад ──────────────────────────────────────────
  { path: '/warehouse/items',     name: 'Номенклатура',        element: WarehouseItems },
  { path: '/warehouse/suppliers', name: 'Поставщики',          element: Suppliers      },
  { path: '/warehouse/receipts',  name: 'Приходные накладные', element: Receipts       },

  // -- Clients ---------
  { path: '/clients', name: 'Клиенты', element: Clients },
]

export default routes