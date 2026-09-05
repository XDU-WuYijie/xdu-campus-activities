import { describe, expect, it } from 'vitest'
import {
  getNotificationTypeLabel,
  resolveNotificationTarget,
} from './notificationRouting'

describe('notificationRouting', () => {
  it.each([
    ['REGISTRATION_REVIEW_PENDING', '1', '/me?tab=reviews'],
    ['REGISTRATION_SUCCESS', '9007199254740993', '/activities/9007199254740993'],
    ['DISCOVER_POST_COMMENTED', '2', '/discover'],
    ['ACTIVITY_REVIEW_PENDING', '3', '/admin?tab=activities#activities'],
    ['ORGANIZER_APPLY_PENDING', '4', '/admin?tab=organizers#organizers'],
    ['ORGANIZER_APPLY_APPROVED', '5', '/me/profile?tab=organizer'],
  ])('maps %s to its business destination', (type, bizId, expected) => {
    expect(
      resolveNotificationTarget({
        bizId,
        bizType: '',
        type,
      }),
    ).toBe(expected)
  })

  it('falls back to business type and keeps unknown notifications in place', () => {
    expect(
      resolveNotificationTarget({
        bizId: '20',
        bizType: 'ACTIVITY',
        type: 'UNKNOWN',
      }),
    ).toBe('/activities/20')
    expect(
      resolveNotificationTarget({
        bizType: 'OTHER',
        type: 'UNKNOWN',
      }),
    ).toBeNull()
    expect(getNotificationTypeLabel('DISCOVER_POST_LIKED')).toBe('动态点赞')
    expect(getNotificationTypeLabel('CUSTOM')).toBe('CUSTOM')
  })
})
