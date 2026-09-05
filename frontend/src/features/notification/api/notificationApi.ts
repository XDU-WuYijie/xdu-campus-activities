import { apiClient } from '../../../api/httpClient'
import type { EntityId, PageResult } from '../../../api/types'
import type {
  NotificationItem,
  NotificationListParams,
} from '../model'

type RawId = number | string

interface RawNotification
  extends Omit<
    NotificationItem,
    'bizId' | 'id' | 'receiverUserId'
  > {
  bizId?: RawId | null
  id: RawId
  receiverUserId: RawId
}

export function normalizeNotification(
  notification: RawNotification,
): NotificationItem {
  return {
    ...notification,
    bizId:
      notification.bizId === null ||
      notification.bizId === undefined
        ? undefined
        : String(notification.bizId),
    content: notification.content ?? '',
    id: String(notification.id),
    isRead: Boolean(notification.isRead),
    receiverUserId: String(notification.receiverUserId),
  }
}

export async function fetchNotifications(
  params: NotificationListParams,
): Promise<PageResult<NotificationItem>> {
  const page = await apiClient.getPage<RawNotification>(
    '/notification/list',
    { params },
  )
  return {
    items: page.items.map(normalizeNotification),
    total: page.total,
  }
}

export async function fetchUnreadCount(): Promise<number> {
  const count = await apiClient.get<number | string>(
    '/notification/unread-count',
  )
  const value = Number(count)
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

export function markNotificationRead(
  notificationId: EntityId,
): Promise<void> {
  return apiClient.put(`/notification/${notificationId}/read`)
}

export function markAllNotificationsRead(): Promise<void> {
  return apiClient.put('/notification/read-all')
}

export function clearNotifications(): Promise<void> {
  return apiClient.delete('/notification/clear')
}
