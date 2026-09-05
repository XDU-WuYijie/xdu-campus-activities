export const TOKEN_STORAGE_KEY = 'token'
export const USER_STORAGE_KEY = 'currentUser'

export interface SessionUser {
  id?: string
  nickName?: string
  icon?: string
  roleCodes: string[]
  permissions: string[]
}

export interface AccessRequirement {
  requiredPermission?: string
  requiredRole?: string
}

function readStorageValue(key: string): string | null {
  return localStorage.getItem(key) ?? sessionStorage.getItem(key)
}

export function getAccessToken(): string | null {
  return readStorageValue(TOKEN_STORAGE_KEY)
}

export function getStoredUser(): SessionUser | null {
  const rawUser = readStorageValue(USER_STORAGE_KEY)
  if (!rawUser) {
    return null
  }

  try {
    const user = JSON.parse(rawUser) as Partial<SessionUser>
    return {
      ...user,
      id: user.id === undefined ? undefined : String(user.id),
      roleCodes: Array.isArray(user.roleCodes) ? user.roleCodes : [],
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
    }
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY)
    sessionStorage.removeItem(USER_STORAGE_KEY)
    return null
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
