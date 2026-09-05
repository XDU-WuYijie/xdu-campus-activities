import type { ApiDateTime, EntityId } from '../../../api/types'

export type ActivityStage =
  | ''
  | 'FINISHED'
  | 'IN_PROGRESS'
  | 'REGISTRATION_NOT_OPEN'
  | 'REGISTRATION_OPEN'

export type ActivitySort =
  | 'composite'
  | 'heatScoreDesc'
  | 'publishTimeDesc'
  | 'signupCountDesc'
  | 'startTimeAsc'

export type RegistrationMode =
  | 'AUDIT_REQUIRED'
  | 'FIRST_COME_FIRST_SERVED'
  | 'REVIEW'

export type RegistrationStatus =
  | 'CANCELED'
  | 'CANCEL_PENDING'
  | 'FAILED'
  | 'NOT_REGISTERED'
  | 'PENDING_CONFIRM'
  | 'PENDING_REVIEW'
  | 'SUCCESS'

export interface ActivityTag {
  categoryId: EntityId
  categoryName: string
  id: EntityId
  name: string
  sortNo: number
}

export interface ActivityCategory {
  id: EntityId
  name: string
  sortNo: number
  tags: ActivityTag[]
}

export interface Activity {
  activityFlow?: string
  canManage: boolean
  category?: string
  checkedIn?: boolean
  contactInfo?: string
  content?: string
  coverImage?: string
  createTime?: ApiDateTime
  creatorId: EntityId
  displayCategory?: string
  eventEndTime?: ApiDateTime
  eventStartTime?: ApiDateTime
  faq?: string
  favorited: boolean
  id: EntityId
  images?: string
  location?: string
  maxParticipants: number
  organizerName?: string
  registered: boolean
  registeredCount: number
  registrationEndTime?: ApiDateTime
  registrationFailReason?: string
  registrationMessage?: string
  registrationMode?: RegistrationMode
  registrationOpen: boolean
  registrationRequestId?: string
  registrationStartTime?: ApiDateTime
  registrationStatus?: RegistrationStatus
  status?: number
  summary?: string
  tags: ActivityTag[]
  title: string
  voucherCheckedInTime?: ApiDateTime
  voucherDisplayCode?: string
  voucherId?: EntityId
  voucherIssuedTime?: ApiDateTime
  voucherStatus?: string
}

export interface ActivityListParams {
  category: string
  current: number
  keyword?: string
  location?: string
  organizerName?: string
  pageSize: number
  sortBy: ActivitySort
  stageFilter?: ActivityStage
  startTimeFrom?: string
  startTimeTo?: string
}
