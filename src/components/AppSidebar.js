import React from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import {
  CCloseButton,
  CSidebar,
  CSidebarBrand,
  CSidebarFooter,
  CSidebarHeader,
  CSidebarToggler,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { AppSidebarNav } from './AppSidebarNav'
import { logo } from 'src/assets/brand/logo'
import { sygnet } from 'src/assets/brand/sygnet'
import { useAuth } from '../AuthContext'
import navigation from '../_nav'

const AppSidebar = () => {
  const dispatch   = useDispatch()
  const unfoldable = useSelector((state) => state.sidebarUnfoldable)
  const sidebarShow = useSelector((state) => state.sidebarShow)
  const { t }      = useTranslation()
  const { user, hasRole } = useAuth()

  // Фильтруем пункты меню по роли
  const filteredNav = navigation.filter((item) => {
    if (!item.roles) return true          // нет ограничений — показываем всем
    return hasRole(...item.roles)         // проверяем роль
  })

  // Переводим названия пунктов меню
const translatedNav = filteredNav.map((item) => {
  const { _i18n, roles, ...cleanItem } = item   // убираем _i18n и roles из объекта
  return {
    ...cleanItem,
    name: item._i18n ? t(item.name) : item.name,
    ...(item.items && {
      items: item.items
        .filter((sub) => !sub.roles || hasRole(...sub.roles))
        .map((sub) => {
          const { _i18n: subI18n, roles: subRoles, ...cleanSub } = sub
          return {
            ...cleanSub,
            name: sub._i18n ? t(sub.name) : sub.name,
          }
        }),
    }),
  }
})

  return (
    <CSidebar
      className="border-end"
      colorScheme="dark"
      position="fixed"
      unfoldable={unfoldable}
      visible={sidebarShow}
      onVisibleChange={(visible) => {
        dispatch({ type: 'set', sidebarShow: visible })
      }}
    >
      <CSidebarHeader className="border-bottom">
        <CSidebarBrand to="/">
          <CIcon customClassName="sidebar-brand-full" icon={logo} height={32} />
          <CIcon customClassName="sidebar-brand-narrow" icon={sygnet} height={32} />
        </CSidebarBrand>
        <CCloseButton
          className="d-lg-none"
          dark
          onClick={() => dispatch({ type: 'set', sidebarShow: false })}
        />
      </CSidebarHeader>

      <AppSidebarNav items={translatedNav} />

      <CSidebarFooter className="border-top d-none d-lg-flex">
        <CSidebarToggler
          onClick={() => dispatch({ type: 'set', sidebarUnfoldable: !unfoldable })}
        />
      </CSidebarFooter>
    </CSidebar>
  )
}

export default React.memo(AppSidebar)