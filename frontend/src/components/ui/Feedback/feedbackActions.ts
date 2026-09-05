import type { ReactNode } from 'react'
import type { DialogConfirmProps, ToastShowProps } from 'antd-mobile'
import { Dialog, Toast } from 'antd-mobile'

export type ToastTone = 'default' | 'success' | 'error' | 'loading'

export async function confirmAction({
  cancelText = '取消',
  confirmText = '确认',
  ...props
}: DialogConfirmProps) {
  return Dialog.confirm({
    cancelText,
    className: 'campus-dialog',
    confirmText,
    ...props,
  })
}

export function showToast(
  content: ReactNode,
  tone: ToastTone = 'default',
  options: Omit<ToastShowProps, 'content' | 'icon'> = {},
) {
  const icon =
    tone === 'success'
      ? 'success'
      : tone === 'error'
        ? 'fail'
        : tone === 'loading'
          ? 'loading'
          : undefined

  return Toast.show({
    content,
    icon,
    position: 'top',
    ...options,
  })
}
