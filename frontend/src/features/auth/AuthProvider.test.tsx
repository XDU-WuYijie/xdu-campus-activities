import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PropsWithChildren } from 'react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../../test/server'
import { AuthProvider } from './AuthProvider'
import {
  getAccessToken,
  getStoredUser,
  setAccessToken,
} from './authSession'
import { useAuth } from './useAuth'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
}

function AuthProbe() {
  const { currentUser, establishSession, logout, status } = useAuth()

  return (
    <>
      <output aria-label="status">{status}</output>
      <output aria-label="user">{currentUser?.nickName ?? ''}</output>
      <button onClick={() => void establishSession('new-token')}>
        establish
      </button>
      <button onClick={() => void logout()}>logout</button>
    </>
  )
}

function renderAuth(queryClient = createTestQueryClient()) {
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    )
  }

  return {
    queryClient,
    ...render(<AuthProbe />, { wrapper: Wrapper }),
  }
}

describe('AuthProvider', () => {
  it('starts anonymous when no token exists', () => {
    renderAuth()

    expect(screen.getByLabelText('status')).toHaveTextContent('anonymous')
    expect(screen.getByLabelText('user')).toBeEmptyDOMElement()
  })

  it('restores the current user when a token exists', async () => {
    setAccessToken('stored-token')
    server.use(
      http.get('*/api/user/me', ({ request }) => {
        expect(request.headers.get('authentication')).toBe('stored-token')
        return HttpResponse.json({
          data: {
            id: '9007199254740993',
            nickName: '活动负责人',
            permissions: ['activity:create'],
            roleCodes: ['ACTIVITY_ADMIN'],
          },
          errorMsg: null,
          success: true,
          total: null,
        })
      }),
    )

    renderAuth()

    expect(screen.getByLabelText('status')).toHaveTextContent('checking')
    await waitFor(() =>
      expect(screen.getByLabelText('status')).toHaveTextContent(
        'authenticated',
      ),
    )
    expect(screen.getByLabelText('user')).toHaveTextContent('活动负责人')
    expect(getStoredUser()?.id).toBe('9007199254740993')
  })

  it('establishes a session from a new token', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('*/api/user/me', ({ request }) => {
        expect(request.headers.get('authentication')).toBe('new-token')
        return HttpResponse.json({
          data: {
            id: '7',
            nickName: '新用户',
            permissions: [],
            roleCodes: ['USER'],
          },
          errorMsg: null,
          success: true,
          total: null,
        })
      }),
    )
    renderAuth()

    await user.click(screen.getByRole('button', { name: 'establish' }))

    await waitFor(() =>
      expect(screen.getByLabelText('status')).toHaveTextContent(
        'authenticated',
      ),
    )
    expect(getAccessToken()).toBe('new-token')
    expect(screen.getByLabelText('user')).toHaveTextContent('新用户')
  })

  it('clears local session and query data after logout', async () => {
    const user = userEvent.setup()
    setAccessToken('token-to-clear')
    let logoutCalled = false
    server.use(
      http.get('*/api/user/me', () =>
        HttpResponse.json({
          data: {
            id: '8',
            nickName: '待退出用户',
            permissions: [],
            roleCodes: ['USER'],
          },
          errorMsg: null,
          success: true,
          total: null,
        }),
      ),
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
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(['private-data'], 'secret')
    renderAuth(queryClient)
    await screen.findByText('待退出用户')

    await user.click(screen.getByRole('button', { name: 'logout' }))

    await waitFor(() =>
      expect(screen.getByLabelText('status')).toHaveTextContent('anonymous'),
    )
    expect(logoutCalled).toBe(true)
    expect(getAccessToken()).toBeNull()
    expect(getStoredUser()).toBeNull()
    expect(queryClient.getQueryData(['private-data'])).toBeUndefined()
  })
})
