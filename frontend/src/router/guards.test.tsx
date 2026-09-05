import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContextValue } from '../features/auth/model'
import { useAuth } from '../features/auth/model'
import { AuthenticatedRoute, RoleRoute } from './guards'

vi.mock('../features/auth/model', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../features/auth/model')>()
  return { ...original, useAuth: vi.fn() }
})

const mockUseAuth = vi.mocked(useAuth)

function authValue(
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  return {
    currentUser: null,
    establishSession: vi.fn(),
    logout: vi.fn(),
    restoreSession: vi.fn(),
    status: 'anonymous',
    token: null,
    ...overrides,
  }
}

function LocationProbe() {
  const location = useLocation()
  return (
    <>
      <output aria-label="path">{location.pathname}</output>
      <output aria-label="return-to">
        {(location.state as { returnTo?: string } | null)?.returnTo ?? ''}
      </output>
    </>
  )
}

function renderAuthenticatedRoute(initialEntry = '/private') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<AuthenticatedRoute />}>
          <Route element={<div>private content</div>} path="/private" />
        </Route>
        <Route element={<LocationProbe />} path="/login" />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AuthenticatedRoute', () => {
  beforeEach(() => {
    mockUseAuth.mockReset()
  })

  it('shows a pending state while restoring the session', () => {
    mockUseAuth.mockReturnValue(authValue({ status: 'checking' }))

    renderAuthenticatedRoute()

    expect(screen.getByText('正在恢复登录状态')).toBeInTheDocument()
  })

  it('allows retrying a failed session restore', async () => {
    const user = userEvent.setup()
    const restoreSession = vi.fn().mockResolvedValue(null)
    mockUseAuth.mockReturnValue(
      authValue({ restoreSession, status: 'error', token: 'token' }),
    )

    renderAuthenticatedRoute()
    await user.click(screen.getByRole('button', { name: '重试' }))

    expect(restoreSession).toHaveBeenCalledOnce()
  })

  it('redirects anonymous users and preserves the full return path', () => {
    mockUseAuth.mockReturnValue(authValue())

    renderAuthenticatedRoute('/private?from=home#details')

    expect(screen.getByLabelText('path')).toHaveTextContent('/login')
    expect(screen.getByLabelText('return-to')).toHaveTextContent(
      '/private?from=home#details',
    )
  })

  it('renders protected content for authenticated users', () => {
    mockUseAuth.mockReturnValue(
      authValue({
        currentUser: {
          permissions: ['activity:view'],
          roleCodes: ['USER'],
        },
        status: 'authenticated',
        token: 'token',
      }),
    )

    renderAuthenticatedRoute()

    expect(screen.getByText('private content')).toBeInTheDocument()
  })
})

describe('RoleRoute', () => {
  beforeEach(() => {
    mockUseAuth.mockReset()
  })

  function renderRoleRoute() {
    return render(
      <MemoryRouter initialEntries={['/organizer']}>
        <Routes>
          <Route
            element={
              <RoleRoute
                requiredPermission="activity:create"
                requiredRole="ACTIVITY_ADMIN"
              >
                <Outlet />
              </RoleRoute>
            }
          >
            <Route element={<div>organizer content</div>} path="/organizer" />
          </Route>
          <Route element={<div>forbidden</div>} path="/403" />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('allows users with the required role and permission', () => {
    mockUseAuth.mockReturnValue(
      authValue({
        currentUser: {
          permissions: ['activity:create'],
          roleCodes: ['USER', 'ACTIVITY_ADMIN'],
        },
        status: 'authenticated',
        token: 'token',
      }),
    )

    renderRoleRoute()

    expect(screen.getByText('organizer content')).toBeInTheDocument()
  })

  it('redirects users without the required role', () => {
    mockUseAuth.mockReturnValue(
      authValue({
        currentUser: {
          permissions: ['activity:view'],
          roleCodes: ['USER'],
        },
        status: 'authenticated',
        token: 'token',
      }),
    )

    renderRoleRoute()

    expect(screen.getByText('forbidden')).toBeInTheDocument()
  })

  it('redirects users that have the role but lack the permission', () => {
    mockUseAuth.mockReturnValue(
      authValue({
        currentUser: {
          permissions: ['activity:view'],
          roleCodes: ['USER', 'ACTIVITY_ADMIN'],
        },
        status: 'authenticated',
        token: 'token',
      }),
    )

    renderRoleRoute()

    expect(screen.getByText('forbidden')).toBeInTheDocument()
  })
})
