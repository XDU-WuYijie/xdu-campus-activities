import type { ApiDateTime, EntityId } from '../../../api/types'
import type { Activity } from '../../activities'

export interface OrganizerApplication {
  applicantName?: string
  applicantUsername?: string
  createTime?: ApiDateTime
  id: EntityId
  orgName: string
  reason?: string
  userId: EntityId
}

export interface AiSimilarActivity {
  category?: string
  displayCategory?: string
  eventStartTime?: ApiDateTime
  location?: string
  organizerName?: string
  title?: string
}

export interface AiReviewReport {
  activityId: EntityId
  errorMessage?: string
  missingFields: string[]
  modelName?: string
  parseStatus?: string
  problems: string[]
  promptVersion?: string
  reviewComment?: string
  riskLevel?: string
  score?: number
  similarActivities: AiSimilarActivity[]
  similarityAnalysis?: string
  suggestion?: string
  taskStatus?: string
}

export type AdminActivity = Activity
