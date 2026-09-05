import type { ApiDateTime, EntityId } from '../../../api/types'

export interface DiscoverPost {
  activityCategory?: string
  activityCoverImage?: string
  activityId: EntityId
  activityStartTime?: ApiDateTime
  activityStartTimeText?: string
  activityStatusText?: string
  activityTitle?: string
  commentCount: number
  content: string
  createdAt?: ApiDateTime
  icon?: string
  id: EntityId
  imageUrls: string[]
  liked: boolean
  likeCount: number
  nickName?: string
  userId: EntityId
}

export interface DiscoverComment {
  content: string
  createdAt?: ApiDateTime
  icon?: string
  id: EntityId
  nickName?: string
  postId: EntityId
  userId: EntityId
}

export interface DiscoverRecommendation {
  activityId: EntityId
  categoryName?: string
  coverImage?: string
  displayCategory?: string
  location?: string
  reason?: string
  score?: number
  startTime?: ApiDateTime
  tags: string[]
  title?: string
}

export interface RecommendationPage {
  fallback: boolean
  items: DiscoverRecommendation[]
  message?: string
  total: number
}

export interface EligibleActivity {
  activityCategory?: string
  activityCoverImage?: string
  activityId: EntityId
  activityTitle: string
  eventEndTime?: ApiDateTime
  eventStartTime?: ApiDateTime
}

export interface CreatePostInput {
  activityId: EntityId
  content: string
  imageUrls: string[]
}
