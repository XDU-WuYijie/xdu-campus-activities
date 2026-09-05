import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearStoredSession,
  getAccessToken,
  getStoredUser,
  hasRequiredAccess,
  setAccessToken,
  setStoredUser,
  subscribeStoredSession,
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
} from './authSession'

describe('authSession', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('persists the token in local and session storage', () => {
    setAccessToken('token-1')

    expect(getAccessToken()).toBe('token-1')
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('token-1')
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBe('token-1')
  })

  it('normalizes and restores a stored user', () => {
    setStoredUser({
      id: '9007199254740993',
      nickName: '测试用户',
      permissions: ['activity:view'],
      roleCodes: ['USER'],
    })

    expect(getStoredUser()).toEqual({
      id: '9007199254740993',
      nickName: '测试用户',
      permissions: ['activity:view'],
      roleCodes: ['USER'],
    })
  })

  it('removes malformed user data', () => {
    localStorage.setItem(USER_STORAGE_KEY, '{invalid')

    expect(getStoredUser()).toBeNull()
    expect(localStorage.getItem(USER_STORAGE_KEY)).toBeNull()
  })

  it('notifies active subscribers when the session changes', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeStoredSession(listener)

    setAccessToken('token-1')
    clearStoredSession()
    unsubscribe()
    setAccessToken('token-2')

    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('requires every configured role and permission', () => {
    const user = {
      permissions: ['activity:create'],
      roleCodes: ['USER', 'ACTIVITY_ADMIN'],
    }

    expect(
      hasRequiredAccess(user, {
        requiredPermission: 'activity:create',
        requiredRole: 'ACTIVITY_ADMIN',
      }),
    ).toBe(true)
    expect(
      hasRequiredAccess(user, { requiredRole: 'PLATFORM_ADMIN' }),
    ).toBe(false)
    expect(hasRequiredAccess(null, {})).toBe(false)
  })
})
