import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react'
import { queryKeys } from '../../api/queryKeys'
import { fetchCurrentUser, requestLogout } from './authApi'
import { AuthContext, type AuthStatus } from './authContext'
import {
  clearStoredSession,
  getAccessToken,
  setAccessToken,
  setStoredUser,
  subscribeStoredSession,
  syncStoredSession,
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
} from './authSession'

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient()
  const token = useSyncExternalStore(
    subscribeStoredSession,
    getAccessToken,
    () => null,
  )

  const currentUserQuery = useQuery({
    enabled: Boolean(token),
    queryFn: fetchCurrentUser,
    queryKey: queryKeys.auth.currentUser(),
    refetchOnMount: 'always',
    staleTime: 0,
  })

  const resetSession = useCallback(() => {
    clearStoredSession()
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    if (!currentUserQuery.data) {
      return
    }

    setStoredUser(currentUserQuery.data)
  }, [currentUserQuery.data])

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== TOKEN_STORAGE_KEY) {
        return
      }

      if (!event.newValue) {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY)
        sessionStorage.removeItem(USER_STORAGE_KEY)
        syncStoredSession()
        queryClient.clear()
        return
      }

      sessionStorage.setItem(TOKEN_STORAGE_KEY, event.newValue)
      sessionStorage.removeItem(USER_STORAGE_KEY)
      syncStoredSession()
      queryClient.clear()
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [queryClient])

  const restoreSession = useCallback(async () => {
    const activeToken = getAccessToken()
    if (!activeToken) {
      resetSession()
      return null
    }

    try {
      const user = await queryClient.query({
        queryFn: fetchCurrentUser,
        queryKey: queryKeys.auth.currentUser(),
        staleTime: 0,
      })
      setStoredUser(user)
      return user
    } catch {
      return null
    }
  }, [queryClient, resetSession])

  const establishSession = useCallback(
    async (nextToken: string) => {
      const normalizedToken = nextToken.trim()
      if (!normalizedToken) {
        throw new Error('登录凭证不能为空')
      }

      clearStoredSession()
      queryClient.clear()
      setAccessToken(normalizedToken)

      try {
        const user = await queryClient.query({
          queryFn: fetchCurrentUser,
          queryKey: queryKeys.auth.currentUser(),
          staleTime: 0,
        })
        setStoredUser(user)
        return user
      } catch (error) {
        resetSession()
        throw error
      }
    },
    [queryClient, resetSession],
  )

  const logout = useCallback(async () => {
    try {
      if (token) {
        await requestLogout()
      }
    } finally {
      resetSession()
    }
  }, [resetSession, token])

  let status: AuthStatus
  if (!token) {
    status = 'anonymous'
  } else if (currentUserQuery.isError) {
    status = 'error'
  } else if (currentUserQuery.isSuccess) {
    status = 'authenticated'
  } else {
    status = 'checking'
  }

  const currentUser = currentUserQuery.data ?? null
  const value = useMemo(
    () => ({
      currentUser,
      establishSession,
      logout,
      restoreSession,
      status,
      token,
    }),
    [
      currentUser,
      establishSession,
      logout,
      restoreSession,
      status,
      token,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
