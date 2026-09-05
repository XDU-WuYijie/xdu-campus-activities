import type { RegistrationRecord } from '../model'

export function getRegistrationRecordDescription(
  record: Pick<RegistrationRecord, 'failReason' | 'status'>,
) {
  if (record.status === 1) {
    return '已受理'
  }
  if (record.failReason) {
    return record.failReason
  }
  return record.status === 0 ? '系统确认中，请稍候刷新。' : '已受理'
}
