import type { HTMLAttributes, PropsWithChildren } from 'react'
import { SafeArea } from 'antd-mobile'
import './AppShell.css'

type AppShellProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>

interface AppPageProps extends PropsWithChildren<HTMLAttributes<HTMLElement>> {
  hasBottomNav?: boolean
  padded?: boolean
  variant?: 'mobile' | 'wide'
}

function classes(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function AppShell({
  children,
  className,
  ...props
}: AppShellProps) {
  return (
    <div className={classes('app-shell', className)} {...props}>
      {children}
    </div>
  )
}

export function AppPage({
  children,
  className,
  hasBottomNav = false,
  padded = false,
  variant = 'mobile',
  ...props
}: AppPageProps) {
  return (
    <main
      className={classes(
        'app-page',
        variant === 'wide' && 'app-page--wide',
        hasBottomNav && 'app-page--with-bottom-nav',
        padded && 'app-page--padded',
        className,
      )}
      {...props}
    >
      {children}
      {!hasBottomNav ? <SafeArea position="bottom" /> : null}
    </main>
  )
}
