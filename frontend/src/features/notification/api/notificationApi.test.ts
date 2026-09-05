import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../../../test/server'
import {
  clearNotifications,
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from './notificationApi'

const success = (data: unknown = null, total: number | null = null) =>
  HttpResponse.json({ data, errorMsg: null, success: true, total })

describe('notificationApi', () => {
  it('normalizes notification IDs and unread count', async () => {
    server.use(
      http.get('*/api/notification/list', () =>
        success(
          [
            {
              bizId: 201,
              content: '报名审核已通过',
              createdAt: '2026-09-05 12:00:00',
              id: '9007199254740993',
              isRead: 0,
              receiverUserId: 101,
              title: '报名成功',
              type: 'REGISTRATION_SUCCESS',
            },
          ],
          1,
        ),
      ),
      http.get('*/api/notification/unread-count', () => success('3')),
    )

    await expect(
      fetchNotifications({ current: 1, pageSize: 10 }),
    ).resolves.toMatchObject({
      items: [
        {
          bizId: '201',
          id: '9007199254740993',
          isRead: false,
          receiverUserId: '101',
        },
      ],
      total: 1,
    })
    await expect(fetchUnreadCount()).resolves.toBe(3)
  })

  it('uses the expected read and clear endpoints', async () => {
    const requests: string[] = []
    server.use(
      http.put('*/api/notification/10/read', ({ request }) => {
        requests.push(`${request.method} read`)
        return success()
      }),
      http.put('*/api/notification/read-all', ({ request }) => {
        requests.push(`${request.method} read-all`)
        return success()
      }),
      http.delete('*/api/notification/clear', ({ request }) => {
        requests.push(`${request.method} clear`)
        return success()
      }),
    )

    await markNotificationRead('10')
    await markAllNotificationsRead()
    await clearNotifications()

    expect(requests).toEqual([
      'PUT read',
      'PUT read-all',
      'DELETE clear',
    ])
  })
})
