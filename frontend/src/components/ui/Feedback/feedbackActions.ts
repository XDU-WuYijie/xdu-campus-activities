import { createElement, type ReactNode } from 'react'
import type { DialogConfirmProps, ToastShowProps } from 'antd-mobile'
import { Dialog, TextArea, Toast } from 'antd-mobile'

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

export async function promptText(
  title: string,
  placeholder: string,
  required = true,
): Promise<string | null> {
  let value = ''
  const confirmed = await Dialog.confirm({
    cancelText: '取消',
    className: 'campus-dialog',
    confirmText: '确认',
    content: createElement(TextArea, {
      autoSize: { minRows: 3, maxRows: 6 },
      onChange: (nextValue) => {
        value = nextValue
      },
      placeholder,
    }),
    onConfirm: async () => {
      if (required && !value.trim()) {
        showToast('请填写原因', 'error')
        throw new Error('reason-required')
      }
    },
    title,
  })
  return confirmed ? value.trim() : null
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
