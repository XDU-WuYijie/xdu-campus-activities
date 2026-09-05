import type { PropsWithChildren } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd-mobile'
import zhCN from 'antd-mobile/es/locales/zh-CN'
import { AppErrorBoundary } from '../components/ui'
import { AuthProvider } from '../features/auth/providers'
import { RegistrationRealtimeProvider } from '../features/registration/providers'
import { queryClient } from './queryClient'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={zhCN}>
        <AppErrorBoundary>
          <AuthProvider>
            <RegistrationRealtimeProvider>
              {children}
            </RegistrationRealtimeProvider>
          </AuthProvider>
        </AppErrorBoundary>
      </ConfigProvider>
    </QueryClientProvider>
  )
}
