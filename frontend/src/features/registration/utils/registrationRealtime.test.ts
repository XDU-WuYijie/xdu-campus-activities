import { describe, expect, it } from 'vitest'
import {
  buildRegistrationSocketUrl,
  parseRegistrationPush,
} from './registrationRealtime'

describe('registration realtime helpers', () => {
  it('builds a secure URL and encodes the token', () => {
    expect(
      buildRegistrationSocketUrl('token +/=', {
        host: 'campus.example.com',
        protocol: 'https:',
      }),
    ).toBe(
      'wss://campus.example.com/api/ws/activity-registration?token=token%20%2B%2F%3D',
    )
  })

  it('accepts registration results and preserves string IDs', () => {
    expect(
      parseRegistrationPush(
        JSON.stringify({
          event: 'activity_register_result',
          payload: {
            activityId: '9007199254740993',
            message: '报名成功',
            status: 'SUCCESS',
            voucherId: '9007199254740994',
          },
        }),
      ),
    ).toMatchObject({
      payload: {
        activityId: '9007199254740993',
        voucherId: '9007199254740994',
      },
    })
  })

  it('ignores heartbeat and unrelated messages', () => {
    expect(parseRegistrationPush('pong')).toBeNull()
    expect(parseRegistrationPush('not-json')).toBeNull()
    expect(parseRegistrationPush('{"event":"other"}')).toBeNull()
  })
})
