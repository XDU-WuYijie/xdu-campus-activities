import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildNotificationSocketUrl,
  NotificationRealtimeClient,
  parseNotificationPush,
} from './notificationRealtime'

class FakeWebSocket {
  static CLOSED = 3
  static CONNECTING = 0
  static OPEN = 1
  static instances: FakeWebSocket[] = []

  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onopen: (() => void) | null = null
  readyState = FakeWebSocket.CONNECTING
  sent: string[] = []
  url: string

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED
  }

  open() {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }

  send(value: string) {
    this.sent.push(value)
  }
}

describe('notificationRealtime', () => {
  afterEach(() => {
    FakeWebSocket.instances = []
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('builds an encoded websocket URL and parses pushes', () => {
    expect(
      buildNotificationSocketUrl('a+b', {
        host: 'campus.example.com',
        protocol: 'https:',
      }),
    ).toBe(
      'wss://campus.example.com/api/ws/notification?token=a%2Bb',
    )
    expect(parseNotificationPush('pong')).toBeNull()
    expect(
      parseNotificationPush(
        JSON.stringify({
          event: 'notification_created',
          payload: {
            content: '活动地点已更新',
            createdAt: '2026-09-05 12:00:00',
            id: 10,
            isRead: false,
            receiverUserId: 20,
            title: '地点变更',
            type: 'ACTIVITY_LOCATION_CHANGED',
          },
          unreadCount: 2,
        }),
      ),
    ).toMatchObject({
      payload: { id: '10', receiverUserId: '20' },
      unreadCount: 2,
    })
  })

  it('keeps one socket, sends heartbeats, and reconnects', () => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const client = new NotificationRealtimeClient()
    const listener = vi.fn()
    client.subscribe(listener)

    client.connect('token')
    client.connect('token')
    expect(FakeWebSocket.instances).toHaveLength(1)

    const first = FakeWebSocket.instances[0]
    first.open()
    vi.advanceTimersByTime(25_000)
    expect(first.sent).toEqual(['ping'])

    first.onmessage?.({
      data: JSON.stringify({
        event: 'notification_created',
        payload: {
          content: '',
          createdAt: '2026-09-05 12:00:00',
          id: 11,
          isRead: false,
          receiverUserId: 20,
          title: '新通知',
          type: 'CUSTOM',
        },
        unreadCount: 4,
      }),
    })
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ unreadCount: 4 }),
    )

    first.readyState = FakeWebSocket.CLOSED
    first.onclose?.()
    vi.advanceTimersByTime(3_000)
    expect(FakeWebSocket.instances).toHaveLength(2)

    client.disconnect()
  })
})
