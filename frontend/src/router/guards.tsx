import type { PropsWithChildren } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import {
  getAccessToken,
  getStoredUser,
  hasRequiredAccess,
} from '../features/auth/authSession'

interface RoleRouteProps extends PropsWithChildren {
  requiredPermission?: string
  requiredRole?: string
}

export function AuthenticatedRoute() {
  const location = useLocation()

  if (!getAccessToken()) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`
    return <Navigate replace state={{ returnTo }} to="/login" />
  }

  return <Outlet />
}

export function RoleRoute({
  children,
  requiredPermission,
  requiredRole,
}: RoleRouteProps) {
  const user = getStoredUser()

  if (!hasRequiredAccess(user, { requiredPermission, requiredRole })) {
    return <Navigate replace to="/403" />
  }

  return children
}
