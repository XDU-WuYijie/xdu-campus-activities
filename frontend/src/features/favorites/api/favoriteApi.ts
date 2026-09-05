import { apiClient } from '../../../api/httpClient'
import type { EntityId, PageResult } from '../../../api/types'
import { normalizeActivity } from '../../activities/api'
import type { Activity } from '../../activities/model'

export interface FavoriteListParams {
  current: number
  keyword?: string
  pageSize: number
}

type RawFavoriteActivity = Parameters<typeof normalizeActivity>[0]

export function favoriteActivity(activityId: EntityId): Promise<void> {
  return apiClient.post(`/activity/${activityId}/favorite`)
}

export function unfavoriteActivity(activityId: EntityId): Promise<void> {
  return apiClient.delete(`/activity/${activityId}/favorite`)
}

export async function fetchMyFavorites(
  params: FavoriteListParams,
): Promise<PageResult<Activity>> {
  const page = await apiClient.getPage<RawFavoriteActivity>(
    '/activity/favorite/mine',
    { params },
  )
  return {
    items: page.items.map(normalizeActivity),
    total: page.total,
  }
}
