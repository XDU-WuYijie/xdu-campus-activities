export const TOKEN_STORAGE_KEY = 'token'
export const USER_STORAGE_KEY = 'currentUser'

export interface SessionUser {
  id?: string
  nickName?: string
  icon?: string
  roleType?: number
  roleCodes: string[]
  permissions: string[]
}

export interface AccessRequirement {
  requiredPermission?: string
  requiredRole?: string
}

const sessionListeners = new Set<() => void>()

function emitSessionChange() {
  sessionListeners.forEach((listener) => listener())
}

function readStorageValue(key: string): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  return localStorage.getItem(key) ?? sessionStorage.getItem(key)
}

function removeStorageValue(key: string) {
  if (typeof window === 'undefined') {
    return
  }

  localStorage.removeItem(key)
  sessionStorage.removeItem(key)
}

function writeStorageValue(key: string, value: string) {
  if (typeof window === 'undefined') {
    return
  }

  localStorage.setItem(key, value)
  sessionStorage.setItem(key, value)
}

export function getAccessToken(): string | null {
  return readStorageValue(TOKEN_STORAGE_KEY)
}

export function setAccessToken(token: string) {
  writeStorageValue(TOKEN_STORAGE_KEY, token)
  emitSessionChange()
}

export function setStoredUser(user: SessionUser) {
  writeStorageValue(USER_STORAGE_KEY, JSON.stringify(normalizeSessionUser(user)))
}

export function clearStoredSession() {
  removeStorageValue(TOKEN_STORAGE_KEY)
  removeStorageValue(USER_STORAGE_KEY)
  emitSessionChange()
}

export function syncStoredSession() {
  emitSessionChange()
}

export function subscribeStoredSession(listener: () => void) {
  sessionListeners.add(listener)
  return () => sessionListeners.delete(listener)
}

export function getStoredUser(): SessionUser | null {
  const rawUser = readStorageValue(USER_STORAGE_KEY)
  if (!rawUser) {
    return null
  }

  try {
    const user = JSON.parse(rawUser) as Partial<SessionUser>
    return normalizeSessionUser(user)
  } catch {
    removeStorageValue(USER_STORAGE_KEY)
    return null
  }
}

export function normalizeSessionUser(
  user: Partial<SessionUser>,
): SessionUser {
  return {
    ...user,
    id: user.id === undefined ? undefined : String(user.id),
    roleCodes: Array.isArray(user.roleCodes) ? user.roleCodes : [],
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
  }
}

export function hasRequiredAccess(
  user: SessionUser | null,
  requirement: AccessRequirement,
): boolean {
  if (!user) {
    return false
  }

  const hasRequiredRole =
    !requirement.requiredRole ||
    user.roleCodes.includes(requirement.requiredRole)
  const hasRequiredPermission =
    !requirement.requiredPermission ||
    user.permissions.includes(requirement.requiredPermission)

  return hasRequiredRole && hasRequiredPermission
}
