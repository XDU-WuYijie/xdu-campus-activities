import type { ReactNode } from 'react'
import type {
  DialogProps,
  PopupProps,
} from 'antd-mobile'
import { Dialog, Popup, SafeArea } from 'antd-mobile'
import './Feedback.css'

export function CampusDialog({
  bodyClassName,
  className,
  ...props
}: DialogProps) {
  return (
    <Dialog
      bodyClassName={['campus-dialog__body', bodyClassName]
        .filter(Boolean)
        .join(' ')}
      className={['campus-dialog', className].filter(Boolean).join(' ')}
      {...props}
    />
  )
}

interface CampusPopupProps extends PopupProps {
  children: ReactNode
  title?: ReactNode
}

export function CampusPopup({
  bodyClassName,
  children,
  title,
  ...props
}: CampusPopupProps) {
  return (
    <Popup
      bodyClassName={['campus-popup', bodyClassName].filter(Boolean).join(' ')}
      position="bottom"
      showCloseButton={Boolean(title)}
      {...props}
    >
      {title ? <h2 className="campus-popup__title">{title}</h2> : null}
      <div className="campus-popup__content">{children}</div>
      <SafeArea position="bottom" />
    </Popup>
  )
}
