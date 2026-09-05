import type { ButtonProps } from 'antd-mobile'
import { Button } from 'antd-mobile'
import './CampusButton.css'

export type CampusButtonProps = ButtonProps

export function CampusButton({
  className,
  size = 'middle',
  ...props
}: CampusButtonProps) {
  const classes = ['campus-button', className].filter(Boolean).join(' ')

  return <Button className={classes} size={size} {...props} />
}
