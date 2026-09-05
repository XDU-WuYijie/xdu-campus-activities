import type { ReactNode } from 'react'
import { Tag } from 'antd-mobile'
import './StatusTag.css'

export type StatusTone =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'

interface StatusTagProps {
  children: ReactNode
  tone?: StatusTone
}

export function StatusTag({
  children,
  tone = 'default',
}: StatusTagProps) {
  return (
    <Tag className={`status-tag status-tag--${tone}`} fill="outline">
      {children}
    </Tag>
  )
}
