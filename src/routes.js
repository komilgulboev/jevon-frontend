import { lazy } from 'react'

const Dashboard        = lazy(() => import('./views/dashboard/Dashboard'))
const Projects         = lazy(() => import('./views/projects/Projects'))
const ProjectDetail    = lazy(() => import('./views/projects/ProjectDetail'))
const Orders           = lazy(() => import('./views/orders/Orders'))
const OrderDetail      = lazy(() => import('./views/orders/OrderDetail'))
const Tasks            = lazy(() => import('./views/tasks/Tasks'))
const Employees        = lazy(() => import('./views/employees/Employees'))
const Timesheet        = lazy(() => import('./views/employees/Timesheet'))
const Expenses         = lazy(() => import('./views/expenses/Expenses'))
const Reports          = lazy(() => import('./views/reports/Reports'))
const ProfitReport     = lazy(() => import('./views/reports/ProfitReport'))
const WarehouseReport  = lazy(() => import('./views/reports/WarehouseReport'))
const WarehouseItems   = lazy(() => import('./views/warehouse/WarehouseItems'))
const Suppliers        = lazy(() => import('./views/warehouse/Suppliers'))
const Receipts         = lazy(() => import('./views/warehouse/Receipts'))
const Clients          = lazy(() => import('./views/clients/Clients'))
const OutgoingInvoices = lazy(() => import('./views/warehouse/OutgoingInvoices'))

const routes = [
  { path: '/',                             exact: true, name: 'Главная'               },
  { path: '/dashboard',                    name: 'Дашборд',               element: Dashboard        },
  { path: '/projects',                     name: 'Проекты',               element: Projects         },
  { path: '/projects/:id',                 name: 'Проект',                element: ProjectDetail    },
  { path: '/orders',                       name: 'Заказы',                element: Orders           },
  { path: '/orders/:id',                   name: 'Заказ',                 element: OrderDetail      },
  { path: '/tasks',                        name: 'Задачи',                element: Tasks            },
  { path: '/employees',                    name: 'Сотрудники',            element: Employees        },
  { path: '/employees/timesheet',          name: 'Табель',                element: Timesheet        },
  { path: '/expenses',                     name: 'Расходы',               element: Expenses         },
  { path: '/reports',                      name: 'Отчёты',                element: Reports          },
  { path: '/reports/profit',               name: 'Доходность',            element: ProfitReport     },
  { path: '/reports/warehouse',            name: 'Отчёт по складу',       element: WarehouseReport  },
  { path: '/warehouse/items',              name: 'Номенклатура',          element: WarehouseItems   },
  { path: '/warehouse/suppliers',          name: 'Поставщики',            element: Suppliers        },
  { path: '/warehouse/receipts',           name: 'Приходные накладные',   element: Receipts         },
  { path: '/warehouse/outgoing-invoices',  name: 'Расходные накладные',   element: OutgoingInvoices },
  { path: '/clients',                      name: 'Клиенты',               element: Clients          },
]

export default routes