import type { PropsWithChildren } from 'react'
import { ConfigProvider } from 'antd-mobile'
import zhCN from 'antd-mobile/es/locales/zh-CN'

export function AppProviders({ children }: PropsWithChildren) {
  return <ConfigProvider locale={zhCN}>{children}</ConfigProvider>
}
