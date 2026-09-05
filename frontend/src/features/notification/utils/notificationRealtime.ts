import { normalizeNotification } from '../api'
import type { NotificationPushMessage } from '../model'

const HEARTBEAT_INTERVAL_MS = 25_000
const RECONNECT_DELAY_MS = 3_000

type MessageListener = (message: NotificationPushMessage) => void

export function buildNotificationSocketUrl(
  token: string,
  location: Pick<Location, 'host' | 'protocol'> = window.location,
) {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${location.host}/api/ws/notification?token=${encodeURIComponent(token)}`
}

export function parseNotificationPush(
  value: string,
): NotificationPushMessage | null {
  if (value === 'pong') {
    return null
  }
  try {
    const message = JSON.parse(value) as Partial<NotificationPushMessage>
    if (
      message.event !== 'notification_created' ||
      !message.payload?.id
    ) {
      return null
    }
    return {
      event: 'notification_created',
      payload: normalizeNotification(
        message.payload as Parameters<typeof normalizeNotification>[0],
      ),
      unreadCount: Math.max(0, Number(message.unreadCount) || 0),
    }
  } catch {
    return null
  }
}

export class NotificationRealtimeClient {
  private heartbeatTimer?: number
  private listeners = new Set<MessageListener>()
  private reconnectTimer?: number
  private socket: WebSocket | null = null
  private token: string | null = null

  connect(token: string) {
    if (!token) {
      this.disconnect()
      return
    }
    if (this.token !== token) {
      this.disconnect()
      this.token = token
    }
    if (
      !navigator.onLine ||
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    ) {
      return
    }
    try {
      const socket = new WebSocket(buildNotificationSocketUrl(token))
      this.socket = socket
      socket.onopen = () => this.startHeartbeat()
      socket.onmessage = (event) => {
        const message = parseNotificationPush(String(event.data))
        if (message) {
          this.listeners.forEach((listener) => listener(message))
        }
      }
      socket.onerror = () => this.reconnect()
      socket.onclose = () => this.reconnect()
    } catch {
      this.reconnect()
    }
  }

  disconnect() {
    this.token = null
    if (this.reconnectTimer !== undefined) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }
    this.closeSocket()
  }

  reconnectWhenActive() {
    if (document.visibilityState === 'visible' && this.token) {
      this.closeSocket()
      this.connect(this.token)
    }
  }

  subscribe(listener: MessageListener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private closeSocket() {
    this.stopHeartbeat()
    if (!this.socket) {
      return
    }
    const socket = this.socket
    this.socket = null
    socket.onclose = null
    socket.onerror = null
    socket.onmessage = null
    if (
      socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING
    ) {
      socket.close()
    }
  }

  private reconnect() {
    this.closeSocket()
    if (
      !this.token ||
      !navigator.onLine ||
      this.reconnectTimer !== undefined
    ) {
      return
    }
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = undefined
      if (this.token) {
        this.connect(this.token)
      }
    }, RECONNECT_DELAY_MS)
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = window.setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send('ping')
      } else {
        this.reconnect()
      }
    }, HEARTBEAT_INTERVAL_MS)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer !== undefined) {
      window.clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = undefined
    }
  }
}

export const notificationRealtimeClient =
  new NotificationRealtimeClient()
