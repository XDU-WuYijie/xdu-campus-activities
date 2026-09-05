import type { ReactNode } from 'react'
import { DotLoading, ErrorBlock } from 'antd-mobile'
import { CampusButton } from '../CampusButton'
import './StateFeedback.css'

interface StateFeedbackProps {
  action?: ReactNode
  description?: string
  fullPage?: boolean
  title?: string
}

interface ErrorStateProps extends StateFeedbackProps {
  onRetry?: () => void
}

export function LoadingState({
  description = '正在加载',
  fullPage = false,
}: Pick<StateFeedbackProps, 'description' | 'fullPage'>) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={fullPage ? 'state-feedback state-feedback--page' : 'state-feedback'}
    >
      <DotLoading color="primary" />
      <span>{description}</span>
    </div>
  )
}

export function EmptyState({
  action,
  description = '暂时没有内容',
  fullPage = false,
  title = '暂无数据',
}: StateFeedbackProps) {
  return (
    <div className={fullPage ? 'state-feedback state-feedback--page' : 'state-feedback'}>
      <ErrorBlock description={description} status="empty" title={title} />
      {action}
    </div>
  )
}

export function ErrorState({
  action,
  description = '请检查网络后重试',
  fullPage = false,
  onRetry,
  title = '加载失败',
}: ErrorStateProps) {
  const retryAction =
    action ??
    (onRetry ? (
      <CampusButton color="primary" fill="outline" onClick={onRetry}>
        重试
      </CampusButton>
    ) : null)

  return (
    <div
      aria-live="polite"
      className={fullPage ? 'state-feedback state-feedback--page' : 'state-feedback'}
      role="alert"
    >
      <ErrorBlock description={description} status="default" title={title} />
      {retryAction}
    </div>
  )
}
