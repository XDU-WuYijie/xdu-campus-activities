import type { EntityId } from './types'

type QueryParamPrimitive = boolean | number | string | null | undefined

export type QueryParams = Readonly<
  Record<
    string,
    QueryParamPrimitive | readonly QueryParamPrimitive[]
  >
>

const authRoot = ['auth'] as const
const activitiesRoot = ['activities'] as const
const registrationRoot = ['registration'] as const
const favoritesRoot = ['favorites'] as const
const discoverRoot = ['discover'] as const
const notificationsRoot = ['notifications'] as const
const profileRoot = ['profile'] as const
const organizerRoot = ['organizer'] as const
const adminRoot = ['admin'] as const

export const queryKeys = {
  auth: {
    all: authRoot,
    currentUser: () => [...authRoot, 'current-user'] as const,
  },
  activities: {
    all: activitiesRoot,
    categories: () => [...activitiesRoot, 'categories'] as const,
    lists: () => [...activitiesRoot, 'list'] as const,
    list: (params: QueryParams) =>
      [...activitiesRoot, 'list', params] as const,
    details: () => [...activitiesRoot, 'detail'] as const,
    detail: (activityId: EntityId) =>
      [...activitiesRoot, 'detail', activityId] as const,
  },
  registration: {
    all: registrationRoot,
    mine: (params: QueryParams = {}) =>
      [...registrationRoot, 'mine', params] as const,
    status: (activityId: EntityId) =>
      [...registrationRoot, 'status', activityId] as const,
  },
  favorites: {
    all: favoritesRoot,
    mine: (params: QueryParams = {}) =>
      [...favoritesRoot, 'mine', params] as const,
  },
  discover: {
    all: discoverRoot,
    posts: (params: QueryParams = {}) =>
      [...discoverRoot, 'posts', params] as const,
    comments: (postId: EntityId, params: QueryParams = {}) =>
      [...discoverRoot, 'comments', postId, params] as const,
    recommendations: (params: QueryParams = {}) =>
      [...discoverRoot, 'recommendations', params] as const,
  },
  notifications: {
    all: notificationsRoot,
    list: (params: QueryParams = {}) =>
      [...notificationsRoot, 'list', params] as const,
    unreadCount: () => [...notificationsRoot, 'unread-count'] as const,
  },
  profile: {
    all: profileRoot,
    detail: (userId: EntityId) =>
      [...profileRoot, 'detail', userId] as const,
    preferences: () => [...profileRoot, 'preferences'] as const,
  },
  organizer: {
    all: organizerRoot,
    activities: (params: QueryParams = {}) =>
      [...organizerRoot, 'activities', params] as const,
    dashboard: () => [...organizerRoot, 'dashboard'] as const,
    registrationReviews: (params: QueryParams = {}) =>
      [...organizerRoot, 'registration-reviews', params] as const,
    reviewHistory: (params: QueryParams = {}) =>
      [...organizerRoot, 'review-history', params] as const,
  },
  admin: {
    all: adminRoot,
    activityReviewQueue: (params: QueryParams = {}) =>
      [...adminRoot, 'activity-review-queue', params] as const,
    activityAiReview: (activityId: EntityId) =>
      [...adminRoot, 'activity-ai-review', activityId] as const,
    organizerApplications: (params: QueryParams = {}) =>
      [...adminRoot, 'organizer-applications', params] as const,
    publishedActivities: (params: QueryParams = {}) =>
      [...adminRoot, 'published-activities', params] as const,
    reviewHistory: (params: QueryParams = {}) =>
      [...adminRoot, 'review-history', params] as const,
  },
} as const
