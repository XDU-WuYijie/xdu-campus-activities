import { apiClient } from '../../../api/httpClient'
import type { EntityId, PageResult } from '../../../api/types'
import { normalizeActivity } from '../../activities/api/activityApi'
import type { Activity } from '../../activities'
import type {
  ActivityDraft,
  CheckInDashboard,
  CheckInResult,
  ManagedActivity,
  RegistrationReview,
  ReviewRecord,
} from '../model'

type RawId = number | string

interface RawRegistrationReview
  extends Omit<RegistrationReview, 'activityId' | 'id' | 'userId'> {
  activityId: RawId
  id: RawId
  userId: RawId
}

interface RawReviewRecord
  extends Omit<ReviewRecord, 'bizId' | 'id' | 'targetUserId'> {
  bizId: RawId
  id: RawId
  targetUserId?: RawId
}

interface RawDashboard
  extends Omit<CheckInDashboard, 'activitySummary' | 'recentRecords'> {
  activitySummary?: Omit<
    NonNullable<CheckInDashboard['activitySummary']>,
    'activityId'
  > & { activityId: RawId }
  recentRecords?: Array<
    Omit<CheckInDashboard['recentRecords'][number], 'id'> & { id: RawId }
  >
}

function optionalId(value?: RawId): EntityId | undefined {
  return value === null || value === undefined ? undefined : String(value)
}

export async function fetchManagedActivities(
  params: { current: number; keyword?: string; pageSize: number },
): Promise<PageResult<ManagedActivity>> {
  const page = await apiClient.getPage<Activity>('/activity/manage/mine', {
    params,
  })
  return {
    items: page.items.map((item) => normalizeActivity(item as never)),
    total: page.total,
  }
}

export async function saveActivity(
  draft: ActivityDraft,
): Promise<EntityId | undefined> {
  const result = draft.id
    ? await apiClient.put<RawId | undefined>('/activity', draft)
    : await apiClient.post<RawId | undefined>('/activity', draft)
  return optionalId(result)
}

export async function uploadActivityImage(file: File): Promise<string> {
  const body = new FormData()
  body.append('file', file)
  return apiClient.upload<string>('/upload/activity', body)
}

export function requestActivityOffline(
  activityId: EntityId,
  reviewRemark: string,
): Promise<void> {
  return apiClient.post(`/activity/manage/${activityId}/offline-apply`, {
    reviewRemark,
  })
}

export async function fetchRegistrationReviews(
  current = 1,
  pageSize = 20,
): Promise<PageResult<RegistrationReview>> {
  const page = await apiClient.getPage<RawRegistrationReview>(
    '/activity/manage/registration-reviews',
    { params: { current, pageSize } },
  )
  return {
    items: page.items.map((item) => ({
      ...item,
      activityId: String(item.activityId),
      id: String(item.id),
      userId: String(item.userId),
    })),
    total: page.total,
  }
}

export function reviewRegistration(
  review: RegistrationReview,
  approved: boolean,
  reviewRemark?: string,
): Promise<void> {
  const action =
    review.requestType === 'CANCEL' || Number(review.status) === 4
      ? 'cancel-review'
      : 'review'
  return apiClient.post(
    `/activity/manage/${review.activityId}/registrations/${review.id}/${action}`,
    { approved, reviewRemark },
  )
}

export async function fetchReviewHistory(
  reviewType: 'ACTIVITY_ADMIN' | 'PLATFORM_ADMIN',
  current = 1,
  pageSize = 20,
): Promise<PageResult<ReviewRecord>> {
  const page = await apiClient.getPage<RawReviewRecord>(
    '/review-records/mine',
    { params: { current, pageSize, reviewType } },
  )
  return {
    items: page.items.map((item) => ({
      ...item,
      bizId: String(item.bizId),
      id: String(item.id),
      targetUserId: optionalId(item.targetUserId),
    })),
    total: page.total,
  }
}

export function deleteReviewRecord(recordId: EntityId): Promise<void> {
  return apiClient.delete(`/review-records/${recordId}`)
}

export function clearReviewHistory(
  reviewType: 'ACTIVITY_ADMIN' | 'PLATFORM_ADMIN',
): Promise<void> {
  return apiClient.delete('/review-records/clear', {
    params: { reviewType },
  })
}

export async function fetchCheckInDashboard(
  activityId: EntityId,
): Promise<CheckInDashboard> {
  const dashboard = await apiClient.get<RawDashboard>(
    `/activity/manage/${activityId}/check-in/dashboard`,
  )
  return {
    ...dashboard,
    activitySummary: dashboard.activitySummary
      ? {
          ...dashboard.activitySummary,
          activityId: String(dashboard.activitySummary.activityId),
        }
      : undefined,
    checkInTrendChart: dashboard.checkInTrendChart ?? [],
    recentRecords: (dashboard.recentRecords ?? []).map((item) => ({
      ...item,
      id: String(item.id),
    })),
    registrationTrendChart: dashboard.registrationTrendChart ?? [],
    stats: dashboard.stats ?? {
      checkedInCount: 0,
      checkInRate: 0,
      registeredCount: 0,
      uncheckedCount: 0,
    },
    statusChart: dashboard.statusChart ?? [],
  }
}

export function verifyCheckIn(
  activityId: EntityId,
  displayCode: string,
): Promise<CheckInResult> {
  const requestKey = `checkin-${Date.now()}-${crypto.randomUUID()}`
  return apiClient.post(
    `/activity/manage/${activityId}/check-in/verify`,
    { displayCode },
    { headers: { 'Idempotency-Key': requestKey } },
  )
}
