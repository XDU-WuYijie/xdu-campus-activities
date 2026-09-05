import type { PropsWithChildren } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import {
  ErrorState,
  LoadingState,
} from '../components/ui'
import { hasRequiredAccess, useAuth } from '../features/auth/model'

interface RoleRouteProps extends PropsWithChildren {
  requiredPermission?: string
  requiredRole?: string
}

export function AuthenticatedRoute() {
  const location = useLocation()
  const { restoreSession, status } = useAuth()

  if (status === 'checking') {
    return <LoadingState description="正在恢复登录状态" fullPage />
  }

  if (status === 'error') {
    return (
      <ErrorState
        description="请检查网络后重试"
        fullPage
        onRetry={() => void restoreSession()}
        title="暂时无法验证登录状态"
      />
    )
  }

  if (status === 'anonymous') {
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
  const { currentUser } = useAuth()

  if (
    !hasRequiredAccess(currentUser, { requiredPermission, requiredRole })
  ) {
    return <Navigate replace to="/403" />
  }

  return children
}
