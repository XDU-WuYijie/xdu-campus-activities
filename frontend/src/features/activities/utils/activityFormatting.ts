import type { Activity } from '../model'

export function formatActivityTime(value?: string): string {
  if (!value) {
    return '待定'
  }

  return value.replace('T', ' ').slice(0, 16)
}

export function formatActivityTimeRange(
  start?: string,
  end?: string,
): string {
  return `${formatActivityTime(start)} - ${formatActivityTime(end)}`
}

export function getActivityCategory(activity: Activity): string {
  return activity.displayCategory || activity.category || '未分类'
}

export function getActivityImages(activity: Activity): string[] {
  const images = activity.images
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  if (images?.length) {
    return images
  }

  return activity.coverImage ? [activity.coverImage] : []
}

export function getActivityStatus(activity: Activity) {
  if (activity.registered) {
    return { label: '已报名', tone: 'success' as const }
  }

  if (activity.registrationOpen) {
    return { label: '报名中', tone: 'success' as const }
  }

  return { label: '未开放', tone: 'default' as const }
}
