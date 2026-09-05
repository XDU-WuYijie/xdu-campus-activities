import { Component, type ErrorInfo, type PropsWithChildren } from 'react'
import { ErrorState } from '../StateFeedback'

interface AppErrorBoundaryState {
  hasError: boolean
}

export class AppErrorBoundary extends Component<
  PropsWithChildren,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled application error', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          description="页面运行异常，请重新加载后再试"
          fullPage
          onRetry={() => window.location.reload()}
          title="页面出现问题"
        />
      )
    }

    return this.props.children
  }
}
