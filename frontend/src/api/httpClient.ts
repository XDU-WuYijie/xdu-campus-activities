import axios from 'axios'
import type {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from 'axios'
import {
  clearStoredSession,
  getAccessToken,
} from '../features/auth/model'
import { ApiError } from './ApiError'
import type { ApiResult, PageResult } from './types'

export const DEFAULT_REQUEST_TIMEOUT_MS = 2_000
export const UPLOAD_REQUEST_TIMEOUT_MS = 30_000

interface ApiClientOptions {
  baseURL?: string
  onUnauthorized?: () => void
}

function getErrorMessage(payload: unknown): string | undefined {
  if (typeof payload === 'string' && payload.trim()) {
    return payload
  }

  if (!payload || typeof payload !== 'object') {
    return undefined
  }

  const errorPayload = payload as {
    errorMsg?: unknown
    message?: unknown
  }

  if (typeof errorPayload.errorMsg === 'string' && errorPayload.errorMsg) {
    return errorPayload.errorMsg
  }

  if (typeof errorPayload.message === 'string' && errorPayload.message) {
    return errorPayload.message
  }

  return undefined
}

function redirectToLogin() {
  clearStoredSession()

  if (typeof window === 'undefined' || window.location.pathname === '/login') {
    return
  }

  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`
  const search = new URLSearchParams({ returnTo })
  window.location.replace(`/login?${search.toString()}`)
}

export function unwrapApiResult<T>(result: ApiResult<T>): ApiResult<T> {
  if (!result || typeof result.success !== 'boolean') {
    throw new ApiError('服务器响应格式异常', { kind: 'unexpected' })
  }

  if (!result.success) {
    throw new ApiError(result.errorMsg || '请求处理失败', { kind: 'business' })
  }

  return result
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error
  }

  if (!axios.isAxiosError(error)) {
    return new ApiError('服务器异常', { cause: error, kind: 'unexpected' })
  }

  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return new ApiError('请求超时，请稍后重试', {
      cause: error,
      kind: 'timeout',
    })
  }

  if (!error.response) {
    return new ApiError('网络异常，请检查服务是否可用', {
      cause: error,
      kind: 'network',
    })
  }

  const status = error.response.status
  if (status === 401) {
    return new ApiError('请先登录', {
      cause: error,
      kind: 'unauthorized',
      status,
    })
  }

  return new ApiError(
    getErrorMessage(error.response.data) || '服务器异常',
    {
      cause: error,
      kind: 'http',
      status,
    },
  )
}

export function createApiClient(options: ApiClientOptions = {}) {
  const client: AxiosInstance = axios.create({
    baseURL: options.baseURL ?? '/api',
    timeout: DEFAULT_REQUEST_TIMEOUT_MS,
  })

  client.interceptors.request.use((config) => {
    const token = getAccessToken()
    if (token) {
      config.headers.set('authentication', token)
    }
    return config
  })

  async function execute<T, D = unknown>(
    config: AxiosRequestConfig<D>,
  ): Promise<ApiResult<T>> {
    try {
      const response = await client.request<
        ApiResult<T>,
        AxiosResponse<ApiResult<T>>,
        D
      >(config)
      return unwrapApiResult(response.data)
    } catch (error) {
      const apiError = normalizeApiError(error)
      if (apiError.kind === 'unauthorized') {
        ;(options.onUnauthorized ?? redirectToLogin)()
      }
      throw apiError
    }
  }

  async function request<T, D = unknown>(
    config: AxiosRequestConfig<D>,
  ): Promise<T> {
    const result = await execute<T, D>(config)
    return result.data as T
  }

  return {
    request,
    get<T>(url: string, config?: AxiosRequestConfig) {
      return request<T>({ ...config, method: 'GET', url })
    },
    post<T, D = unknown>(
      url: string,
      data?: D,
      config?: AxiosRequestConfig<D>,
    ) {
      return request<T, D>({ ...config, data, method: 'POST', url })
    },
    put<T, D = unknown>(
      url: string,
      data?: D,
      config?: AxiosRequestConfig<D>,
    ) {
      return request<T, D>({ ...config, data, method: 'PUT', url })
    },
    delete<T>(url: string, config?: AxiosRequestConfig) {
      return request<T>({ ...config, method: 'DELETE', url })
    },
    async getPage<T>(
      url: string,
      config?: AxiosRequestConfig,
    ): Promise<PageResult<T>> {
      const result = await execute<T[]>({ ...config, method: 'GET', url })
      const items = result.data ?? []
      return {
        items,
        total: result.total ?? items.length,
      }
    },
    upload<T>(
      url: string,
      data: FormData,
      config?: Omit<
        AxiosRequestConfig<FormData>,
        'data' | 'method' | 'timeout' | 'url'
      >,
    ) {
      return request<T, FormData>({
        ...config,
        data,
        method: 'POST',
        timeout: UPLOAD_REQUEST_TIMEOUT_MS,
        url,
      })
    },
  }
}

export const apiClient = createApiClient()
