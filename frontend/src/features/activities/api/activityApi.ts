import { apiClient } from '../../../api/httpClient'
import type { EntityId, PageResult } from '../../../api/types'
import type {
  Activity,
  ActivityCategory,
  ActivityListParams,
  ActivityTag,
} from '../model'

type RawEntityId = number | string

interface RawActivityTag extends Omit<ActivityTag, 'categoryId' | 'id'> {
  categoryId: RawEntityId
  id: RawEntityId
}

interface RawActivityCategory
  extends Omit<ActivityCategory, 'id' | 'tags'> {
  id: RawEntityId
  tags?: RawActivityTag[]
}

interface RawActivity
  extends Omit<
    Activity,
    | 'canManage'
    | 'creatorId'
    | 'favorited'
    | 'id'
    | 'registered'
    | 'registeredCount'
    | 'registrationOpen'
    | 'tags'
  > {
  canManage?: boolean
  creatorId: RawEntityId
  favorited?: boolean
  id: RawEntityId
  registered?: boolean
  registeredCount?: number
  registrationOpen?: boolean
  tags?: RawActivityTag[]
}

function normalizeTag(tag: RawActivityTag): ActivityTag {
  return {
    ...tag,
    categoryId: String(tag.categoryId),
    id: String(tag.id),
  }
}

function normalizeActivity(activity: RawActivity): Activity {
  return {
    ...activity,
    canManage: Boolean(activity.canManage),
    creatorId: String(activity.creatorId),
    favorited: Boolean(activity.favorited),
    id: String(activity.id),
    maxParticipants: activity.maxParticipants ?? 0,
    registered: Boolean(activity.registered),
    registeredCount: activity.registeredCount ?? 0,
    registrationOpen: Boolean(activity.registrationOpen),
    tags: (activity.tags ?? []).map(normalizeTag),
  }
}

export async function fetchActivityCategories(): Promise<ActivityCategory[]> {
  const categories = await apiClient.get<RawActivityCategory[]>(
    '/activity/public/categories',
  )

  return (categories ?? []).map((category) => ({
    ...category,
    id: String(category.id),
    tags: (category.tags ?? []).map(normalizeTag),
  }))
}

export async function fetchActivities(
  params: ActivityListParams,
): Promise<PageResult<Activity>> {
  const page = await apiClient.getPage<RawActivity>(
    '/activity/public/list',
    { params },
  )

  return {
    items: page.items.map(normalizeActivity),
    total: page.total,
  }
}

export async function fetchActivityDetail(
  activityId: EntityId,
): Promise<Activity> {
  const activity = await apiClient.get<RawActivity>(
    `/activity/public/${activityId}`,
  )

  return normalizeActivity(activity)
}
