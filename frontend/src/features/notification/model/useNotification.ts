import { useContext } from 'react'
import { NotificationContext } from './notificationContext'

export function useNotification() {
  return useContext(NotificationContext)
}
