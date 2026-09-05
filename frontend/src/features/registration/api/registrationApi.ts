import { apiClient } from '../../../api/httpClient'
import type { EntityId, PageResult } from '../../../api/types'
import type {
  RegistrationListParams,
  RegistrationRecord,
  RegistrationStatusDetail,
} from '../model'

type RawEntityId = number | string

interface RawRegistrationStatus
  extends Omit<
    RegistrationStatusDetail,
    'activityId' | 'userId' | 'voucherId'
  > {
  activityId: RawEntityId
  userId?: RawEntityId
  voucherId?: RawEntityId
}

interface RawRegistrationRecord
  extends Omit<
    RegistrationRecord,
    'activityId' | 'id' | 'voucherId'
  > {
  activityId: RawEntityId
  id: RawEntityId
  voucherId?: RawEntityId
}

function optionalId(value?: RawEntityId): EntityId | undefined {
  return value === null || value === undefined ? undefined : String(value)
}

export function normalizeRegistrationStatus(
  status: RawRegistrationStatus,
): RegistrationStatusDetail {
  return {
    ...status,
    activityId: String(status.activityId),
    message: status.message ?? '',
    userId: optionalId(status.userId),
    voucherId: optionalId(status.voucherId),
  }
}

function normalizeRegistrationRecord(
  record: RawRegistrationRecord,
): RegistrationRecord {
  return {
    ...record,
    activityId: String(record.activityId),
    checkInEnabled: Boolean(record.checkInEnabled),
    checkInStatus: Number(record.checkInStatus ?? 0),
    id: String(record.id),
    status: Number(record.status),
    voucherId: optionalId(record.voucherId),
  }
}

export async function registerActivity(
  activityId: EntityId,
): Promise<RegistrationStatusDetail> {
  const status = await apiClient.post<RawRegistrationStatus>(
    `/activity/${activityId}/register`,
  )
  return normalizeRegistrationStatus(status)
}

export async function fetchRegistrationStatus(
  activityId: EntityId,
): Promise<RegistrationStatusDetail> {
  const status = await apiClient.get<RawRegistrationStatus>(
    `/activity/${activityId}/register/status`,
  )
  return normalizeRegistrationStatus(status)
}

export function cancelRegistration(activityId: EntityId): Promise<void> {
  return apiClient.delete(`/activity/${activityId}/register`)
}

export async function fetchMyRegistrations(
  params: RegistrationListParams,
): Promise<PageResult<RegistrationRecord>> {
  const page = await apiClient.getPage<RawRegistrationRecord>(
    '/activity/registration/mine',
    { params },
  )
  return {
    items: page.items.map(normalizeRegistrationRecord),
    total: page.total,
  }
}

export function deleteRegistrationRecord(
  registrationId: EntityId,
): Promise<void> {
  return apiClient.delete(
    `/activity/registration/mine/${registrationId}`,
  )
}
