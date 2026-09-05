import axios from 'axios'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearStoredSession, setAccessToken } from '../features/auth/model'
import { server } from '../test/server'
import {
  createApiClient,
  normalizeApiError,
  unwrapApiResult,
} from './httpClient'

describe('httpClient', () => {
  afterEach(() => {
    clearStoredSession()
  })

  it('unwraps successful responses and rejects invalid envelopes', () => {
    expect(
      unwrapApiResult({
        data: { id: '1' },
        errorMsg: null,
        success: true,
        total: 0,
      }),
    ).toMatchObject({ data: { id: '1' }, success: true })

    expect(() =>
      unwrapApiResult({ data: null } as never),
    ).toThrow('服务器响应格式异常')
    expect(() =>
      unwrapApiResult({
        data: null,
        errorMsg: '活动不存在',
        success: false,
        total: 0,
      }),
    ).toThrow('活动不存在')
  })

  it('normalizes unexpected, timeout, network and unauthorized errors', () => {
    expect(normalizeApiError(new Error('boom'))).toMatchObject({
      kind: 'unexpected',
      message: '服务器异常',
    })
    expect(
      normalizeApiError(new axios.AxiosError('timeout', 'ETIMEDOUT')),
    ).toMatchObject({
      kind: 'timeout',
      message: '请求超时，请稍后重试',
    })
    expect(normalizeApiError(new axios.AxiosError('offline'))).toMatchObject({
      kind: 'network',
      message: '网络异常，请检查服务是否可用',
    })
    expect(
      normalizeApiError(
        new axios.AxiosError(
          'unauthorized',
          undefined,
          undefined,
          undefined,
          {
            config: {} as never,
            data: {},
            headers: {},
            status: 401,
            statusText: 'Unauthorized',
          },
        ),
      ),
    ).toMatchObject({
      kind: 'unauthorized',
      message: '请先登录',
      status: 401,
    })
  })

  it('attaches the access token and keeps page totals from the envelope', async () => {
    setAccessToken('session-token')
    let authentication = ''
    server.use(
      http.get('/test-api/items', ({ request }) => {
        authentication = request.headers.get('authentication') ?? ''
        return HttpResponse.json({
          data: [{ id: '1' }],
          success: true,
          total: 8,
        })
      }),
    )

    const client = createApiClient({ baseURL: '/test-api' })
    await expect(client.getPage<{ id: string }>('/items')).resolves.toEqual({
      items: [{ id: '1' }],
      total: 8,
    })
    expect(authentication).toBe('session-token')
  })

  it('uses item length when a successful page omits total', async () => {
    server.use(
      http.get('/test-api/items-without-total', () =>
        HttpResponse.json({
          data: [{ id: '1' }, { id: '2' }],
          success: true,
        }),
      ),
    )

    const client = createApiClient({ baseURL: '/test-api' })
    await expect(
      client.getPage<{ id: string }>('/items-without-total'),
    ).resolves.toEqual({
      items: [{ id: '1' }, { id: '2' }],
      total: 2,
    })
  })

  it('calls the unauthorized hook and rethrows an ApiError for 401', async () => {
    const onUnauthorized = vi.fn()
    server.use(
      http.get('/test-api/private', () =>
        HttpResponse.json(
          { errorMsg: 'token expired', success: false },
          { status: 401 },
        ),
      ),
    )

    const client = createApiClient({ baseURL: '/test-api', onUnauthorized })
    const request = client.get('/private')

    await expect(request).rejects.toMatchObject({
      kind: 'unauthorized',
      message: '请先登录',
      status: 401,
    })
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })
})
