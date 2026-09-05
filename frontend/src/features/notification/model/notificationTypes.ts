import type { ApiDateTime, EntityId } from '../../../api/types'

export interface NotificationItem {
  bizId?: EntityId
  bizType?: string
  content: string
  createdAt: ApiDateTime
  id: EntityId
  isRead: boolean
  readTime?: ApiDateTime
  receiverRoleCode?: string
  receiverUserId: EntityId
  title: string
  type: string
}

export interface NotificationListParams {
  current?: number
  isRead?: boolean
  pageSize?: number
  type?: string
}

export interface NotificationPushMessage {
  event: 'notification_created'
  payload: NotificationItem
  unreadCount: number
}
