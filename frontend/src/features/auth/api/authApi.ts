import { apiClient } from '../../../api/httpClient'
import { ApiError } from '../../../api/ApiError'
import {
  normalizeSessionUser,
  type SessionUser,
} from '../model'

export interface LoginPayload {
  code?: string
  password?: string
  phone: string
}

export async function fetchCurrentUser(): Promise<SessionUser> {
  const user = await apiClient.get<SessionUser | null>('/user/me')
  if (!user) {
    throw new ApiError('用户信息响应为空', { kind: 'unexpected' })
  }
  return normalizeSessionUser(user)
}

export function requestLogin(payload: LoginPayload): Promise<string> {
  return apiClient.post<string, LoginPayload>('/user/login', payload)
}

export function sendLoginCode(phone: string): Promise<void> {
  return apiClient.post<void>('/user/code', undefined, {
    params: { phone },
  })
}

export function requestLogout(): Promise<void> {
  return apiClient.post<void>('/user/logout')
}
