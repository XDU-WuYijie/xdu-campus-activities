import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/ApiError'

export const DEFAULT_STALE_TIME_MS = 30_000
export const DEFAULT_GC_TIME_MS = 5 * 60_000

function shouldRetry(failureCount: number, error: Error): boolean {
  if (failureCount >= 1) {
    return false
  }

  if (!(error instanceof ApiError)) {
    return true
  }

  return error.kind !== 'business' && error.kind !== 'unauthorized'
}

export const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      retry: false,
    },
    queries: {
      gcTime: DEFAULT_GC_TIME_MS,
      refetchOnWindowFocus: true,
      retry: shouldRetry,
      staleTime: DEFAULT_STALE_TIME_MS,
    },
  },
})
