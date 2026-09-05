import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { ApiError } from '../../../api/ApiError'
import { server } from '../../../test/server'
import { fetchCurrentUser, requestLogout } from './authApi'
import { setAccessToken } from '../model'

describe('authApi', () => {
  it('fetches and normalizes the current user with authentication', async () => {
    setAccessToken('token-1')
    server.use(
      http.get('*/api/user/me', ({ request }) => {
        expect(request.headers.get('authentication')).toBe('token-1')
        return HttpResponse.json({
          data: {
            id: '9007199254740993',
            permissions: ['activity:create'],
            roleCodes: ['ACTIVITY_ADMIN'],
          },
          errorMsg: null,
          success: true,
          total: null,
        })
      }),
    )

    await expect(fetchCurrentUser()).resolves.toMatchObject({
      id: '9007199254740993',
      permissions: ['activity:create'],
      roleCodes: ['ACTIVITY_ADMIN'],
    })
  })

  it('rejects an empty successful user response', async () => {
    server.use(
      http.get('*/api/user/me', () =>
        HttpResponse.json({
          data: null,
          errorMsg: null,
          success: true,
          total: null,
        }),
      ),
    )

    await expect(fetchCurrentUser()).rejects.toMatchObject({
      kind: 'unexpected',
      message: '用户信息响应为空',
    } satisfies Partial<ApiError>)
  })

  it('calls the logout endpoint', async () => {
    let logoutCalled = false
    server.use(
      http.post('*/api/user/logout', () => {
        logoutCalled = true
        return HttpResponse.json({
          data: null,
          errorMsg: null,
          success: true,
          total: null,
        })
      }),
    )

    await requestLogout()

    expect(logoutCalled).toBe(true)
  })
})
