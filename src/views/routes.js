import { lazy } from 'react'

const Dashboard    = lazy(() => import('./views/dashboard/Dashboard'))
const Projects     = lazy(() => import('./views/projects/Projects'))
const ProjectDetail = lazy(() => import('./views/projects/ProjectDetail'))
const Orders       = lazy(() => import('./views/orders/Orders'))
const OrderDetail  = lazy(() => import('./views/orders/OrderDetail'))

const routes = [
  { path: '/',              exact: true, name: 'Главная'   },
  { path: '/dashboard',     name: 'Дашборд',    element: Dashboard     },
  { path: '/projects',      name: 'Проекты',    element: Projects      },
  { path: '/projects/:id',  name: 'Проект',     element: ProjectDetail },
  { path: '/orders',        name: 'Заказы',     element: Orders        },
  { path: '/orders/:id',    name: 'Заказ',      element: OrderDetail   },
]

export default routes
