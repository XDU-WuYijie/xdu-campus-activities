import { describe, expect, it } from 'vitest'
import { safeReturnTo, withReturnTo } from './returnTo'

describe('returnTo', () => {
  it('preserves an internal URL with its nested query string', () => {
    const detailUrl =
      '/activities/1?returnTo=%2Factivities%2Fcategories%2F4'

    expect(withReturnTo('/me/registrations', detailUrl)).toBe(
      '/me/registrations?returnTo=%2Factivities%2F1%3FreturnTo%3D%252Factivities%252Fcategories%252F4',
    )
    expect(safeReturnTo(detailUrl, '/me')).toBe(detailUrl)
  })

  it('rejects external and protocol-relative return URLs', () => {
    expect(safeReturnTo('https://example.com', '/me')).toBe('/me')
    expect(safeReturnTo('//example.com/path', '/me')).toBe('/me')
    expect(safeReturnTo(null, '/me')).toBe('/me')
  })
})
