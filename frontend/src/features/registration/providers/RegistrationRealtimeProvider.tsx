import { useQueryClient } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { useEffect } from 'react'
import { queryKeys } from '../../../api/queryKeys'
import { showToast } from '../../../components/ui'
import { useAuth } from '../../auth'
import type {
  RegistrationStatusDetail,
} from '../model'
import {
  buildRegistrationSocketUrl,
  parseRegistrationPush,
} from '../utils'

const HEARTBEAT_INTERVAL_MS = 25_000
const RECONNECT_DELAY_MS = 3_000

function resultToast(status: RegistrationStatusDetail) {
  if (status.status === 'SUCCESS') {
    showToast(status.message || '报名成功', 'success')
  } else if (status.status === 'FAILED') {
    showToast(status.message || '报名失败', 'error')
  } else if (status.status === 'CANCELED') {
    showToast(status.message || '已退出活动', 'success')
  }
}

export function RegistrationRealtimeProvider({
  children,
}: PropsWithChildren) {
  const queryClient = useQueryClient()
  const { token } = useAuth()

  useEffect(() => {
    if (!token) {
      return
    }
    const activeToken: string = token

    let heartbeatTimer: number | undefined
    let reconnectTimer: number | undefined
    let socket: WebSocket | null = null
    let disposed = false

    const clearHeartbeat = () => {
      if (heartbeatTimer !== undefined) {
        window.clearInterval(heartbeatTimer)
        heartbeatTimer = undefined
      }
    }

    const scheduleReconnect = () => {
      if (disposed || reconnectTimer !== undefined || !navigator.onLine) {
        return
      }
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = undefined
        connect()
      }, RECONNECT_DELAY_MS)
    }

    const closeSocket = () => {
      clearHeartbeat()
      if (!socket) {
        return
      }
      const activeSocket = socket
      socket = null
      activeSocket.onclose = null
      activeSocket.onerror = null
      activeSocket.onmessage = null
      if (
        activeSocket.readyState === WebSocket.OPEN ||
        activeSocket.readyState === WebSocket.CONNECTING
      ) {
        activeSocket.close()
      }
    }

    const handleStatus = (status: RegistrationStatusDetail) => {
      queryClient.setQueryData(
        queryKeys.registration.status(status.activityId),
        status,
      )
      void queryClient.invalidateQueries({
        queryKey: queryKeys.registration.all,
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.activities.detail(status.activityId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.activities.lists(),
      })
      resultToast(status)
    }

    function connect() {
      if (
        disposed ||
        !navigator.onLine ||
        socket?.readyState === WebSocket.OPEN ||
        socket?.readyState === WebSocket.CONNECTING
      ) {
        return
      }

      try {
        socket = new WebSocket(buildRegistrationSocketUrl(activeToken))
        socket.onopen = () => {
          clearHeartbeat()
          heartbeatTimer = window.setInterval(() => {
            if (socket?.readyState === WebSocket.OPEN) {
              socket.send('ping')
            } else {
              closeSocket()
              scheduleReconnect()
            }
          }, HEARTBEAT_INTERVAL_MS)
        }
        socket.onmessage = (event) => {
          const message = parseRegistrationPush(String(event.data))
          if (message) {
            handleStatus(message.payload)
          }
        }
        socket.onerror = () => {
          closeSocket()
          scheduleReconnect()
        }
        socket.onclose = () => {
          closeSocket()
          scheduleReconnect()
        }
      } catch {
        closeSocket()
        scheduleReconnect()
      }
    }

    const reconnectWhenActive = () => {
      if (document.visibilityState === 'visible') {
        closeSocket()
        connect()
      }
    }

    connect()
    window.addEventListener('online', reconnectWhenActive)
    window.addEventListener('focus', reconnectWhenActive)
    document.addEventListener('visibilitychange', reconnectWhenActive)

    return () => {
      disposed = true
      if (reconnectTimer !== undefined) {
        window.clearTimeout(reconnectTimer)
      }
      window.removeEventListener('online', reconnectWhenActive)
      window.removeEventListener('focus', reconnectWhenActive)
      document.removeEventListener('visibilitychange', reconnectWhenActive)
      closeSocket()
    }
  }, [queryClient, token])

  return children
}
