import type { ApiDateTime, EntityId } from '../../../api/types'
import type { Activity, RegistrationMode } from '../../activities'

export interface ActivityDraft {
  activityFlow: string
  category: string
  contactInfo: string
  content: string
  coverImage: string
  eventEndTime: string
  eventStartTime: string
  faq: string
  id?: EntityId
  images: string
  location: string
  maxParticipants: number
  organizerName: string
  registrationEndTime: string
  registrationMode: RegistrationMode
  registrationStartTime: string
  summary: string
  tagIds: EntityId[]
  title: string
}

export interface ManagedActivity extends Activity {
  reviewRemark?: string
}

export interface RegistrationReview {
  activityId: EntityId
  activityTitle?: string
  applyReason?: string
  cancelReason?: string
  createTime?: ApiDateTime
  id: EntityId
  requestType?: string
  status?: number | string
  userId: EntityId
  userNickName?: string
  userPhone?: string
}

export interface ReviewRecord {
  action: string
  bizId: EntityId
  bizTitle: string
  bizType: string
  createdAt?: ApiDateTime
  id: EntityId
  remark?: string
  targetName?: string
  targetUserId?: EntityId
}

export interface CheckInStats {
  checkedInCount: number
  checkInRate: number
  registeredCount: number
  uncheckedCount: number
}

export interface TrendPoint {
  label: string
  value: number
}

export interface CheckInRecord {
  createTime?: ApiDateTime
  id: EntityId
  responseBody?: string
}

export interface CheckInDashboard {
  activitySummary?: {
    activityId: EntityId
    eventEndTime?: ApiDateTime
    eventStartTime?: ApiDateTime
    location?: string
    maxParticipants: number
    registrationEndTime?: ApiDateTime
    registrationStartTime?: ApiDateTime
    title: string
  }
  checkInTrendChart: TrendPoint[]
  recentRecords: CheckInRecord[]
  registrationTrendChart: TrendPoint[]
  stats: CheckInStats
  statusChart: TrendPoint[]
}

export interface CheckInResult {
  checkedInTime?: ApiDateTime
  displayCode?: string
  message?: string
  resultStatus?: string
  userNickName?: string
}
