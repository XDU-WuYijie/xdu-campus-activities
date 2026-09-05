import type { ReactNode } from 'react'
import { NavBar, SafeArea } from 'antd-mobile'
import { LeftOutline } from 'antd-mobile-icons'
import { useNavigate } from 'react-router-dom'
import './PageHeader.css'

interface PageHeaderProps {
  back?: boolean
  left?: ReactNode
  onBack?: () => void
  right?: ReactNode
  sticky?: boolean
  title: ReactNode
}

export function PageHeader({
  back = true,
  left,
  onBack,
  right,
  sticky = true,
  title,
}: PageHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className={sticky ? 'page-header page-header--sticky' : 'page-header'}>
      <SafeArea position="top" />
      <NavBar
        back={back ? '返回' : null}
        backIcon={back ? <LeftOutline aria-hidden /> : false}
        left={left}
        onBack={back ? (onBack ?? (() => navigate(-1))) : undefined}
        right={right}
      >
        {title}
      </NavBar>
    </header>
  )
}
