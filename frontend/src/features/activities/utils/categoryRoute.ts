import type { EntityId } from '../../../api/types'
import type { ActivityCategory } from '../model'

export function getCategoryPathSegment(
  category: Pick<ActivityCategory, 'id'>,
): EntityId {
  return category.id
}

export function resolveCategoryName(
  categoryId: EntityId,
  categories: ActivityCategory[] = [],
): string | undefined {
  return categories.find((category) => category.id === categoryId)?.name
}
