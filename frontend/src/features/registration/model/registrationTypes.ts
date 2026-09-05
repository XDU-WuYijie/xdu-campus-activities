import type { ApiDateTime, EntityId } from '../../../api/types'
import type {
  RegistrationMode,
  RegistrationStatus,
} from '../../activities'

export interface RegistrationStatusDetail {
  activityId: EntityId
  confirmTime?: ApiDateTime
  failReason?: string
  message: string
  requestId?: string
  status: RegistrationStatus
  userId?: EntityId
  voucherCheckedInTime?: ApiDateTime
  voucherDisplayCode?: string
  voucherId?: EntityId
  voucherIssuedTime?: ApiDateTime
  voucherStatus?: string
}

export interface RegistrationRecord {
  activityCoverImage?: string
  activityId: EntityId
  activityTitle: string
  category?: string
  checkInEnabled: boolean
  checkInStatus: number
  checkInTime?: ApiDateTime
  coverImage?: string
  createTime?: ApiDateTime
  eventEndTime?: ApiDateTime
  eventStartTime?: ApiDateTime
  failReason?: string
  id: EntityId
  location?: string
  organizerName?: string
  registeredCount?: number
  registrationMode?: RegistrationMode
  requestId?: string
  status: number
  statusText?: string
  voucherDisplayCode?: string
  voucherId?: EntityId
  voucherIssuedTime?: ApiDateTime
  voucherStatus?: string
}

export type RegistrationFilter =
  | 'ALL'
  | 'CANCELED'
  | 'CHECKED_IN'
  | 'FINISHED'
  | 'PENDING_CHECK_IN'

export interface RegistrationListParams {
  current: number
  filter: RegistrationFilter
  keyword?: string
  pageSize: number
}

export interface RegistrationPushMessage {
  event: 'activity_register_result'
  payload: RegistrationStatusDetail
}
