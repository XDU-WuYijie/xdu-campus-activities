import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/ApiError'
import { showToast } from '../../components/ui'
import {
  requestLogin,
  sendLoginCode,
} from '../../features/auth/api'
import type { AuthContextValue, SessionUser } from '../../features/auth/model'
import { useAuth } from '../../features/auth/model'
import { LoginPage } from './LoginPage'

vi.mock('../../features/auth/api', () => ({
  requestLogin: vi.fn(),
  sendLoginCode: vi.fn(),
}))

vi.mock('../../features/auth/model', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../features/auth/model')>()
  return { ...original, useAuth: vi.fn() }
})

vi.mock('../../components/ui', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../components/ui')>()
  return { ...original, showToast: vi.fn() }
})

const mockRequestLogin = vi.mocked(requestLogin)
const mockSendLoginCode = vi.mocked(sendLoginCode)
const mockShowToast = vi.mocked(showToast)
const mockUseAuth = vi.mocked(useAuth)

const regularUser: SessionUser = {
  id: '9007199254740993',
  permissions: [],
  roleCodes: ['USER'],
}

function authValue(
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  return {
    currentUser: null,
    establishSession: vi.fn().mockResolvedValue(regularUser),
    logout: vi.fn(),
    restoreSession: vi.fn(),
    status: 'anonymous',
    token: null,
    ...overrides,
  }
}

function LocationProbe() {
  const location = useLocation()
  return <div aria-label="current path">{location.pathname}</div>
}

function renderLogin(initialEntry: string | { pathname: string; state: unknown }) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function agreeToTerms(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole('checkbox', {
      name: '同意用户协议和隐私政策',
    }),
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    mockRequestLogin.mockReset()
    mockSendLoginCode.mockReset()
    mockShowToast.mockReset()
    mockUseAuth.mockReturnValue(authValue())
  })

  it('sends the verification code and starts the countdown', async () => {
    const user = userEvent.setup()
    mockSendLoginCode.mockResolvedValue(undefined)
    renderLogin('/login')

    await user.type(screen.getByPlaceholderText('请输入手机号'), '13800138000')
    await user.click(screen.getByRole('button', { name: '获取验证码' }))

    await waitFor(() => {
      expect(mockSendLoginCode).toHaveBeenCalledWith('13800138000')
      expect(screen.getByRole('button', { name: '60 秒' })).toBeDisabled()
    })
    expect(mockShowToast).toHaveBeenCalledWith('验证码已发送', 'success')
  })

  it('logs in with a code and returns to the protected route', async () => {
    const user = userEvent.setup()
    const establishSession = vi.fn().mockResolvedValue(regularUser)
    mockUseAuth.mockReturnValue(authValue({ establishSession }))
    mockRequestLogin.mockResolvedValue('user-token')
    renderLogin({
      pathname: '/login',
      state: { returnTo: '/activities/9007199254740993' },
    })

    await user.type(screen.getByPlaceholderText('请输入手机号'), '13800138000')
    await user.type(screen.getByPlaceholderText('6 位验证码'), 'ABC123')
    await agreeToTerms(user)
    await user.click(screen.getByRole('button', { name: '登录' }))

    await waitFor(() => {
      expect(mockRequestLogin).toHaveBeenCalledWith({
        code: 'ABC123',
        phone: '13800138000',
      })
      expect(establishSession).toHaveBeenCalledWith('user-token')
      expect(screen.getByLabelText('current path')).toHaveTextContent(
        '/activities/9007199254740993',
      )
    })
  })

  it('routes a platform administrator to the admin dashboard', async () => {
    const user = userEvent.setup()
    const adminUser: SessionUser = {
      id: '1',
      permissions: ['platform:user_manage'],
      roleCodes: ['PLATFORM_ADMIN'],
    }
    mockUseAuth.mockReturnValue(
      authValue({
        establishSession: vi.fn().mockResolvedValue(adminUser),
      }),
    )
    mockRequestLogin.mockResolvedValue('admin-token')
    renderLogin('/login')

    await user.click(screen.getByRole('tab', { name: '密码登录' }))
    await user.type(screen.getByPlaceholderText('请输入手机号或账号'), 'admin')
    await user.type(screen.getByPlaceholderText('请输入密码'), '123456')
    await agreeToTerms(user)
    await user.click(screen.getByRole('button', { name: '登录' }))

    await waitFor(() => {
      expect(mockRequestLogin).toHaveBeenCalledWith({
        password: '123456',
        phone: 'admin',
      })
      expect(screen.getByLabelText('current path')).toHaveTextContent('/admin')
    })
  })

  it('shows the backend login error without discarding the form', async () => {
    const user = userEvent.setup()
    mockRequestLogin.mockRejectedValue(
      new ApiError('账号或密码错误', { kind: 'business' }),
    )
    renderLogin('/login')

    await user.click(screen.getByRole('tab', { name: '密码登录' }))
    await user.type(screen.getByPlaceholderText('请输入手机号或账号'), 'admin')
    await user.type(screen.getByPlaceholderText('请输入密码'), 'wrong')
    await agreeToTerms(user)
    await user.click(screen.getByRole('button', { name: '登录' }))

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('账号或密码错误', 'error')
    })
    expect(screen.getByPlaceholderText('请输入手机号或账号')).toHaveValue(
      'admin',
    )
  })
})
