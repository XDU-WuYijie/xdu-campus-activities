import type { ApiDateTime, EntityId } from '../../../api/types'

export interface UserProfile {
  birthday?: string
  city?: string
  college?: string
  credits?: number
  gender?: boolean
  grade?: string
  introduce?: string
  mentor?: string
  userId?: EntityId
}

export interface UserProfileUpdate {
  birthday: string | null
  city: string
  college: string
  gender: boolean | null
  grade: string
  introduce: string
  mentor: string
  nickName: string
}

export interface OrganizerApplication {
  applyStatus: 'APPROVED' | 'PENDING' | 'REJECTED' | string
  createTime?: ApiDateTime
  id: EntityId
  orgName: string
  reason: string
  reviewRemark?: string
  reviewTime?: ApiDateTime
  reviewerId?: EntityId
  userId: EntityId
}

export interface OrganizerApplicationInput {
  orgName: string
  reason: string
}

export interface ProfilePost {
  activityCategory?: string
  activityCoverImage?: string
  activityId: EntityId
  activityStatusText?: string
  activityTitle?: string
  commentCount: number
  content: string
  createdAt?: ApiDateTime
  icon?: string
  id: EntityId
  imageUrls: string[]
  likeCount: number
  nickName?: string
  userId: EntityId
}

export interface OrganizerSummary {
  createdActivityTotal: number
  pendingReviewTotal: number
  reviewHistoryTotal: number
}
