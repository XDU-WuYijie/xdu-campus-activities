import { apiClient } from '../../../api/httpClient'
import type { EntityId, PageResult } from '../../../api/types'
import type {
  CreatePostInput,
  DiscoverComment,
  DiscoverPost,
  DiscoverRecommendation,
  EligibleActivity,
  RecommendationPage,
} from '../model'

type RawId = number | string

interface RawPost
  extends Omit<DiscoverPost, 'activityId' | 'id' | 'userId'> {
  activityId: RawId
  id: RawId
  userId: RawId
}

interface RawComment
  extends Omit<DiscoverComment, 'id' | 'postId' | 'userId'> {
  id: RawId
  postId: RawId
  userId: RawId
}

interface RawRecommendation
  extends Omit<DiscoverRecommendation, 'activityId'> {
  activityId: RawId
}

interface RawRecommendationPage {
  fallback?: boolean
  message?: string
  records?: RawRecommendation[]
  total?: number
}

interface RawEligibleActivity
  extends Omit<EligibleActivity, 'activityId'> {
  activityId: RawId
}

function normalizePost(post: RawPost): DiscoverPost {
  return {
    ...post,
    activityId: String(post.activityId),
    commentCount: post.commentCount ?? 0,
    id: String(post.id),
    imageUrls: post.imageUrls ?? [],
    liked: Boolean(post.liked),
    likeCount: post.likeCount ?? 0,
    userId: String(post.userId),
  }
}

export async function fetchDiscoverPosts(
  current = 1,
  pageSize = 10,
): Promise<PageResult<DiscoverPost>> {
  const page = await apiClient.getPage<RawPost>('/discover/posts', {
    params: { current, pageSize },
  })
  return {
    items: page.items.map(normalizePost),
    total: page.total,
  }
}

export async function fetchDiscoverComments(
  postId: EntityId,
  current = 1,
  pageSize = 10,
): Promise<PageResult<DiscoverComment>> {
  const page = await apiClient.getPage<RawComment>(
    `/discover/posts/${postId}/comments`,
    { params: { current, pageSize } },
  )
  return {
    items: page.items.map((comment) => ({
      ...comment,
      id: String(comment.id),
      postId: String(comment.postId),
      userId: String(comment.userId),
    })),
    total: page.total,
  }
}

export async function fetchRecommendations(
  current = 1,
  pageSize = 8,
): Promise<RecommendationPage> {
  const page = await apiClient.get<RawRecommendationPage | RawRecommendation[]>(
    '/discover/recommendations',
    { params: { current, pageSize } },
  )
  const payload = Array.isArray(page) ? { records: page } : page
  const items = (payload.records ?? []).map((item) => ({
    ...item,
    activityId: String(item.activityId),
    tags: item.tags ?? [],
  }))
  return {
    fallback: Boolean(payload.fallback),
    items,
    message: payload.message,
    total: payload.total ?? items.length,
  }
}

export function likeDiscoverPost(postId: EntityId): Promise<void> {
  return apiClient.post(`/discover/posts/${postId}/like`)
}

export function unlikeDiscoverPost(postId: EntityId): Promise<void> {
  return apiClient.delete(`/discover/posts/${postId}/like`)
}

export function createDiscoverComment(
  postId: EntityId,
  content: string,
): Promise<void> {
  return apiClient.post(`/discover/posts/${postId}/comments`, { content })
}

export function deleteDiscoverComment(commentId: EntityId): Promise<void> {
  return apiClient.delete(`/discover/comments/${commentId}`)
}

export function deleteDiscoverPost(postId: EntityId): Promise<void> {
  return apiClient.delete(`/discover/posts/${postId}`)
}

export async function fetchEligibleActivities(): Promise<
  EligibleActivity[]
> {
  const activities = await apiClient.get<RawEligibleActivity[]>(
    '/discover/eligible-activities',
  )
  return (activities ?? []).map((activity) => ({
    ...activity,
    activityId: String(activity.activityId),
  }))
}

export async function uploadDiscoverImage(file: File): Promise<string> {
  const body = new FormData()
  body.append('file', file)
  return apiClient.upload<string>('/upload/discover-image', body)
}

export async function createDiscoverPost(
  input: CreatePostInput,
): Promise<DiscoverPost> {
  const post = await apiClient.post<RawPost, CreatePostInput>(
    '/discover/posts',
    input,
  )
  return normalizePost(post)
}
