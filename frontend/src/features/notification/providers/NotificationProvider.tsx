import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { useCallback, useEffect, useMemo } from 'react'
import { queryKeys } from '../../../api/queryKeys'
import { showToast } from '../../../components/ui'
import { useAuth } from '../../auth'
import { fetchUnreadCount } from '../api'
import { NotificationContext } from '../model'
import { notificationRealtimeClient } from '../utils'

const UNREAD_STORAGE_KEY = 'campus_notification_unread_count'

function normalizeUnreadCount(count: number): number {
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
}

export function NotificationProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient()
  const { token } = useAuth()
  const unreadQuery = useQuery({
    enabled: Boolean(token),
    initialData: () =>
      normalizeUnreadCount(
        Number(localStorage.getItem(UNREAD_STORAGE_KEY)),
      ),
    queryFn: fetchUnreadCount,
    queryKey: queryKeys.notifications.unreadCount(),
  })

  const setUnreadCount = useCallback(
    (count: number) => {
      const normalized = normalizeUnreadCount(count)
      queryClient.setQueryData(
        queryKeys.notifications.unreadCount(),
        normalized,
      )
      localStorage.setItem(UNREAD_STORAGE_KEY, String(normalized))
    },
    [queryClient],
  )

  const refreshUnreadCount = useCallback(async () => {
    if (!token) {
      setUnreadCount(0)
      return
    }
    const count = await fetchUnreadCount()
    setUnreadCount(count)
  }, [setUnreadCount, token])

  useEffect(() => {
    if (unreadQuery.data !== undefined) {
      localStorage.setItem(
        UNREAD_STORAGE_KEY,
        String(normalizeUnreadCount(unreadQuery.data)),
      )
    }
  }, [unreadQuery.data])

  useEffect(() => {
    if (!token) {
      notificationRealtimeClient.disconnect()
      setUnreadCount(0)
      return
    }

    const unsubscribe = notificationRealtimeClient.subscribe((message) => {
      setUnreadCount(message.unreadCount)
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
      })
      showToast(message.payload.title || '收到一条新通知', 'default', {
        duration: 2000,
      })
    })
    const resume = () => {
      notificationRealtimeClient.reconnectWhenActive()
      void refreshUnreadCount()
    }

    notificationRealtimeClient.connect(token)
    window.addEventListener('online', resume)
    window.addEventListener('focus', resume)
    window.addEventListener('pageshow', resume)
    document.addEventListener('visibilitychange', resume)

    return () => {
      unsubscribe()
      window.removeEventListener('online', resume)
      window.removeEventListener('focus', resume)
      window.removeEventListener('pageshow', resume)
      document.removeEventListener('visibilitychange', resume)
      notificationRealtimeClient.disconnect()
    }
  }, [queryClient, refreshUnreadCount, setUnreadCount, token])

  useEffect(() => {
    const syncAcrossTabs = (event: StorageEvent) => {
      if (event.key !== UNREAD_STORAGE_KEY) {
        return
      }
      queryClient.setQueryData(
        queryKeys.notifications.unreadCount(),
        normalizeUnreadCount(Number(event.newValue)),
      )
    }
    window.addEventListener('storage', syncAcrossTabs)
    return () => window.removeEventListener('storage', syncAcrossTabs)
  }, [queryClient])

  const value = useMemo(
    () => ({
      refreshUnreadCount,
      setUnreadCount,
      unreadCount: normalizeUnreadCount(unreadQuery.data ?? 0),
    }),
    [refreshUnreadCount, setUnreadCount, unreadQuery.data],
  )

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}
