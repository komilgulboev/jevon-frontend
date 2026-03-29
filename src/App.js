import React, { Suspense, useEffect } from 'react'
import { HashRouter, Route, Routes, Navigate, Outlet } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { CSpinner, useColorModes } from '@coreui/react'
import './scss/style.scss'
import './scss/examples.scss'

import { AuthProvider, useAuth } from './AuthContext'

// Layouts
const DefaultLayout = React.lazy(() => import('./layout/DefaultLayout'))

// Pages
const Login    = React.lazy(() => import('./views/pages/login/Login'))
const Register = React.lazy(() => import('./views/pages/register/Register'))
const Page404  = React.lazy(() => import('./views/pages/page404/Page404'))
const Page500  = React.lazy(() => import('./views/pages/page500/Page500'))

// Требует авторизации — иначе редирект на /login
function RequireAuth() {
  const { user } = useAuth()
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

const App = () => {
  const { isColorModeSet, setColorMode } = useColorModes('coreui-free-react-admin-template-theme')
  const storedTheme = useSelector((state) => state.theme)

useEffect(() => {
  const urlParams = new URLSearchParams(window.location.href.split('?')[1])
  const theme = urlParams.get('theme') && urlParams.get('theme').match(/^[A-Za-z0-9\s]+/)[0]
  if (theme) {
    setColorMode(theme)
    return
  }
  if (isColorModeSet()) {
    return
  }
  setColorMode(storedTheme || 'light')
}, [])
  return (
    <HashRouter>
      <AuthProvider>
        <Suspense
          fallback={
            <div className="pt-3 text-center">
              <CSpinner color="primary" variant="grow" />
            </div>
          }
        >
          <Routes>
            {/* Публичные маршруты */}
            <Route path="/login"    name="Login Page"    element={<Login />} />
            <Route path="/register" name="Register Page" element={<Register />} />
            <Route path="/404"      name="Page 404"      element={<Page404 />} />
            <Route path="/500"      name="Page 500"      element={<Page500 />} />

            {/* Защищённые маршруты */}
            <Route element={<RequireAuth />}>
              <Route path="*" name="Home" element={<DefaultLayout />} />
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </HashRouter>
  )
}

export default App