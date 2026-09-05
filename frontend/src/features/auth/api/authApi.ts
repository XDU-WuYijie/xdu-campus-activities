import { apiClient } from '../../../api/httpClient'
import { ApiError } from '../../../api/ApiError'
import {
  normalizeSessionUser,
  type SessionUser,
} from '../model'

export async function fetchCurrentUser(): Promise<SessionUser> {
  const user = await apiClient.get<SessionUser | null>('/user/me')
  if (!user) {
    throw new ApiError('用户信息响应为空', { kind: 'unexpected' })
  }
  return normalizeSessionUser(user)
}

export function requestLogout(): Promise<void> {
  return apiClient.post<void>('/user/logout')
}
