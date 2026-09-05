import type { ReactNode } from 'react'
import { SafeArea, TabBar } from 'antd-mobile'
import './BottomNav.css'

export interface BottomNavItem {
  badge?: ReactNode
  icon: ReactNode | ((active: boolean) => ReactNode)
  key: string
  label: ReactNode
}

interface BottomNavProps {
  activeKey: string
  items: BottomNavItem[]
  onChange: (key: string) => void
}

export function BottomNav({
  activeKey,
  items,
  onChange,
}: BottomNavProps) {
  return (
    <nav aria-label="主导航" className="bottom-nav">
      <TabBar activeKey={activeKey} onChange={onChange} safeArea={false}>
        {items.map((item) => (
          <TabBar.Item
            badge={item.badge}
            icon={item.icon}
            key={item.key}
            title={item.label}
          />
        ))}
      </TabBar>
      <SafeArea position="bottom" />
    </nav>
  )
}
