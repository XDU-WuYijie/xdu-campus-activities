import { apiClient } from '../../../api/httpClient'
import type { EntityId, PageResult } from '../../../api/types'
import type { ActivityTag } from '../../activities'
import type {
  OrganizerApplication,
  OrganizerApplicationInput,
  OrganizerSummary,
  ProfilePost,
  UserProfile,
  UserProfileUpdate,
} from '../model'

type RawId = number | string

interface RawUserProfile extends Omit<UserProfile, 'userId'> {
  userId?: RawId
}

interface RawOrganizerApplication
  extends Omit<
    OrganizerApplication,
    'id' | 'reviewerId' | 'userId'
  > {
  id: RawId
  reviewerId?: RawId
  userId: RawId
}

interface RawActivityTag
  extends Omit<ActivityTag, 'categoryId' | 'id'> {
  categoryId: RawId
  id: RawId
}

interface RawProfilePost
  extends Omit<ProfilePost, 'activityId' | 'id' | 'userId'> {
  activityId: RawId
  id: RawId
  userId: RawId
}

function optionalId(value?: RawId): EntityId | undefined {
  return value === null || value === undefined ? undefined : String(value)
}

export async function fetchUserProfile(
  userId: EntityId,
): Promise<UserProfile> {
  const profile = await apiClient.get<RawUserProfile | null>(
    `/user/info/${userId}`,
  )
  return profile
    ? { ...profile, userId: optionalId(profile.userId) }
    : {}
}

export function updateUserProfile(input: UserProfileUpdate): Promise<void> {
  return apiClient.put('/user/profile', input)
}

export async function uploadAvatar(file: File): Promise<string> {
  const body = new FormData()
  body.append('file', file)
  return apiClient.upload<string>('/user/avatar', body)
}

export async function fetchPreferenceTags(): Promise<ActivityTag[]> {
  const tags = await apiClient.get<RawActivityTag[]>(
    '/user/preferences/activity-tags',
  )
  return (tags ?? []).map((tag) => ({
    ...tag,
    categoryId: String(tag.categoryId),
    id: String(tag.id),
  }))
}

export async function updatePreferenceTags(
  tagIds: EntityId[],
): Promise<ActivityTag[]> {
  const tags = await apiClient.put<RawActivityTag[]>(
    '/user/preferences/activity-tags',
    { tagIds },
  )
  return (tags ?? []).map((tag) => ({
    ...tag,
    categoryId: String(tag.categoryId),
    id: String(tag.id),
  }))
}

export async function fetchOrganizerApplication(): Promise<
  OrganizerApplication | null
> {
  const application =
    await apiClient.get<RawOrganizerApplication | null>(
      '/user/organizer/apply/me',
    )
  return application
    ? {
        ...application,
        id: String(application.id),
        reviewerId: optionalId(application.reviewerId),
        userId: String(application.userId),
      }
    : null
}

export function applyForOrganizer(
  input: OrganizerApplicationInput,
): Promise<void> {
  return apiClient.post('/user/organizer/apply', input)
}

export async function fetchMyPosts(
  userId: EntityId,
  current = 1,
  pageSize = 6,
): Promise<PageResult<ProfilePost>> {
  const page = await apiClient.getPage<RawProfilePost>('/discover/posts', {
    params: { current, pageSize, userId },
  })
  return {
    items: page.items.map((post) => ({
      ...post,
      activityId: String(post.activityId),
      commentCount: post.commentCount ?? 0,
      id: String(post.id),
      imageUrls: post.imageUrls ?? [],
      likeCount: post.likeCount ?? 0,
      userId: String(post.userId),
    })),
    total: page.total,
  }
}

export function deleteMyPost(postId: EntityId): Promise<void> {
  return apiClient.delete(`/discover/posts/${postId}`)
}

export async function fetchOrganizerSummary(): Promise<OrganizerSummary> {
  const [activities, reviews, history] = await Promise.all([
    apiClient.getPage<unknown>('/activity/manage/mine', {
      params: { current: 1, pageSize: 1 },
    }),
    apiClient.getPage<unknown>('/activity/manage/registration-reviews', {
      params: { current: 1, pageSize: 1 },
    }),
    apiClient.getPage<unknown>('/review-records/mine', {
      params: { current: 1, pageSize: 1, reviewType: 'ACTIVITY_ADMIN' },
    }),
  ])
  return {
    createdActivityTotal: activities.total,
    pendingReviewTotal: reviews.total,
    reviewHistoryTotal: history.total,
  }
}
