import { apiClient } from '../../../api/httpClient'
import type { EntityId, PageResult } from '../../../api/types'
import { normalizeActivity } from '../../activities/api/activityApi'
import type { Activity } from '../../activities'
import type {
  AiReviewReport,
  AdminActivity,
  OrganizerApplication,
} from '../model'

type RawId = number | string

interface RawOrganizerApplication
  extends Omit<OrganizerApplication, 'id' | 'userId'> {
  id: RawId
  userId: RawId
}

interface RawAiReviewReport extends Omit<AiReviewReport, 'activityId'> {
  activityId: RawId
}

export async function fetchPendingActivities(
  keyword = '',
): Promise<AdminActivity[]> {
  const activities = await apiClient.get<Activity[]>(
    '/activity/admin/review-list',
    { params: { keyword } },
  )
  return (activities ?? []).map((item) => normalizeActivity(item as never))
}

export async function fetchPublishedActivities(
  params: { current: number; keyword?: string; pageSize: number },
): Promise<PageResult<AdminActivity>> {
  const page = await apiClient.getPage<Activity>(
    '/activity/admin/published-list',
    { params },
  )
  return {
    items: page.items.map((item) => normalizeActivity(item as never)),
    total: page.total,
  }
}

export function reviewActivity(
  activityId: EntityId,
  approved: boolean,
  reviewRemark?: string,
): Promise<void> {
  return apiClient.post(`/activity/admin/${activityId}/review`, {
    approved,
    reviewRemark,
  })
}

export function offlineActivity(
  activityId: EntityId,
  reviewRemark: string,
): Promise<void> {
  return apiClient.post(`/activity/admin/${activityId}/offline`, {
    approved: false,
    reviewRemark,
  })
}

export async function fetchAiReview(
  activityId: EntityId,
): Promise<AiReviewReport> {
  const report = await apiClient.get<RawAiReviewReport>(
    `/activity/admin/${activityId}/ai-review`,
  )
  return {
    ...report,
    activityId: String(report.activityId),
    missingFields: report.missingFields ?? [],
    problems: report.problems ?? [],
    similarActivities: report.similarActivities ?? [],
  }
}

export async function fetchOrganizerApplications(): Promise<
  OrganizerApplication[]
> {
  const applications = await apiClient.get<RawOrganizerApplication[]>(
    '/user/admin/organizer-applications',
    { params: { status: 'PENDING' } },
  )
  return (applications ?? []).map((item) => ({
    ...item,
    id: String(item.id),
    userId: String(item.userId),
  }))
}

export function reviewOrganizerApplication(
  applicationId: EntityId,
  approved: boolean,
  reviewRemark?: string,
): Promise<void> {
  return apiClient.post(
    `/user/admin/organizer-applications/${applicationId}/review`,
    { approved, reviewRemark },
  )
}
