import { createContext } from 'react'

export interface NotificationContextValue {
  refreshUnreadCount: () => Promise<void>
  setUnreadCount: (count: number) => void
  unreadCount: number
}

export const NotificationContext =
  createContext<NotificationContextValue>({
    refreshUnreadCount: async () => undefined,
    setUnreadCount: () => undefined,
    unreadCount: 0,
  })
