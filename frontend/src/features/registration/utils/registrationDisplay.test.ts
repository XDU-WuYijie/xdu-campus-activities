import { describe, expect, it } from 'vitest'
import { getRegistrationRecordDescription } from './registrationDisplay'

describe('registration display', () => {
  it('hides historical failure text for a successful registration', () => {
    expect(
      getRegistrationRecordDescription({
        failReason: '退出申请已通过',
        status: 1,
      }),
    ).toBe('已受理')
  })

  it('keeps failure text for a rejected registration', () => {
    expect(
      getRegistrationRecordDescription({
        failReason: '报名审核未通过',
        status: 2,
      }),
    ).toBe('报名审核未通过')
  })

  it('hides historical failure text for a canceled registration', () => {
    expect(
      getRegistrationRecordDescription({
        failReason: '退出申请已通过',
        status: 3,
      }),
    ).toBe('已受理')
  })

  it('uses the pending description without a failure reason', () => {
    expect(
      getRegistrationRecordDescription({
        status: 0,
      }),
    ).toBe('系统确认中，请稍候刷新。')
  })
})
