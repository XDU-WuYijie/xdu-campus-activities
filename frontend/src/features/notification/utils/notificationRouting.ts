import type { NotificationItem } from '../model'

const ACTIVITY_DETAIL_TYPES = new Set([
  'REGISTRATION_SUCCESS',
  'REGISTRATION_FAILED',
  'REGISTRATION_CANCEL_APPROVED',
  'REGISTRATION_CANCEL_REJECTED',
  'ACTIVITY_SUBMITTED',
  'ACTIVITY_APPROVED',
  'ACTIVITY_REJECTED',
  'ACTIVITY_OFFLINE',
  'ACTIVITY_OFFLINE_APPLY_SUBMITTED',
  'ACTIVITY_OFFLINE_APPLY_APPROVED',
  'ACTIVITY_OFFLINE_APPLY_REJECTED',
  'ACTIVITY_LOCATION_CHANGED',
])

export function resolveNotificationTarget(
  notification: Pick<NotificationItem, 'bizId' | 'bizType' | 'type'>,
): string | null {
  const { bizId, bizType, type } = notification

  if (
    type === 'REGISTRATION_REVIEW_PENDING' ||
    type === 'REGISTRATION_CANCEL_REVIEW_PENDING'
  ) {
    return '/me?tab=reviews'
  }
  if (ACTIVITY_DETAIL_TYPES.has(type) && bizId) {
    return `/activities/${bizId}`
  }
  if (type === 'DISCOVER_POST_LIKED' || type === 'DISCOVER_POST_COMMENTED') {
    return '/discover'
  }
  if (
    type === 'ACTIVITY_REVIEW_PENDING' ||
    type === 'ACTIVITY_OFFLINE_REVIEW_PENDING'
  ) {
    return '/admin?tab=activities#activities'
  }
  if (type === 'ORGANIZER_APPLY_PENDING') {
    return '/admin?tab=organizers#organizers'
  }
  if (
    type === 'ORGANIZER_APPLY_APPROVED' ||
    type === 'ORGANIZER_APPLY_REJECTED'
  ) {
    return '/me/profile?tab=organizer'
  }
  if (
    (bizType === 'REGISTRATION' || bizType === 'ACTIVITY') &&
    bizId
  ) {
    return `/activities/${bizId}`
  }
  if (bizType === 'DISCOVER_POST') {
    return '/discover'
  }
  if (bizType === 'ORGANIZER_APPLICATION') {
    return '/me/profile?tab=organizer'
  }
  return null
}

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  ACTIVITY_APPROVED: '审核通过',
  ACTIVITY_LOCATION_CHANGED: '地点变更',
  ACTIVITY_OFFLINE: '活动下架',
  ACTIVITY_OFFLINE_APPLY_APPROVED: '下架申请通过',
  ACTIVITY_OFFLINE_APPLY_REJECTED: '下架申请驳回',
  ACTIVITY_OFFLINE_APPLY_SUBMITTED: '下架申请提交',
  ACTIVITY_OFFLINE_REVIEW_PENDING: '下架待审核',
  ACTIVITY_REJECTED: '审核驳回',
  ACTIVITY_REVIEW_PENDING: '待审核活动',
  ACTIVITY_SUBMITTED: '活动提交',
  DISCOVER_POST_COMMENTED: '动态评论',
  DISCOVER_POST_LIKED: '动态点赞',
  ORGANIZER_APPLY_APPROVED: '申请通过',
  ORGANIZER_APPLY_PENDING: '主办方申请',
  ORGANIZER_APPLY_REJECTED: '申请驳回',
  REGISTRATION_CANCEL_APPROVED: '退出通过',
  REGISTRATION_CANCEL_REJECTED: '退出驳回',
  REGISTRATION_CANCEL_REVIEW_PENDING: '退出待审核',
  REGISTRATION_FAILED: '报名失败',
  REGISTRATION_REVIEW_PENDING: '报名待审核',
  REGISTRATION_SUCCESS: '报名成功',
}

export function getNotificationTypeLabel(type: string): string {
  return NOTIFICATION_TYPE_LABELS[type] ?? type ?? '通知'
}
