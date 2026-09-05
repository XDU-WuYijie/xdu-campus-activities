import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearNotifications,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationContext,
} from '../../features/notification'
import { NotificationPage } from './NotificationPage'

vi.mock('../../features/notification', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../features/notification')>()
  return {
    ...original,
    clearNotifications: vi.fn(),
    fetchNotifications: vi.fn(),
    markAllNotificationsRead: vi.fn(),
    markNotificationRead: vi.fn(),
  }
})

function LocationProbe() {
  const location = useLocation()
  return (
    <output aria-label="current URL">
      {location.pathname}
      {location.search}
    </output>
  )
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const setUnreadCount = vi.fn()
  const refreshUnreadCount = vi.fn().mockResolvedValue(undefined)

  render(
    <QueryClientProvider client={queryClient}>
      <NotificationContext.Provider
        value={{ refreshUnreadCount, setUnreadCount, unreadCount: 2 }}
      >
        <MemoryRouter
          initialEntries={['/notifications?returnTo=%2Fdiscover']}
        >
          <Routes>
            <Route path="/notifications" element={<NotificationPage />} />
            <Route
              path="/activities/:activityId"
              element={<LocationProbe />}
            />
            <Route path="/discover" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </NotificationContext.Provider>
    </QueryClientProvider>,
  )

  return { refreshUnreadCount, setUnreadCount }
}

describe('NotificationPage', () => {
  beforeEach(() => {
    vi.mocked(fetchNotifications).mockResolvedValue({
      items: [
        {
          bizId: '99',
          bizType: 'ACTIVITY',
          content: '你的报名申请已通过',
          createdAt: '2026-09-05 12:00:00',
          id: '10',
          isRead: false,
          receiverUserId: '1',
          title: '报名结果',
          type: 'REGISTRATION_SUCCESS',
        },
        {
          content: '欢迎使用通知中心',
          createdAt: '2026-09-05 11:00:00',
          id: '11',
          isRead: true,
          receiverUserId: '1',
          title: '系统通知',
          type: 'CUSTOM',
        },
      ],
      total: 2,
    })
    vi.mocked(markNotificationRead).mockResolvedValue()
    vi.mocked(markAllNotificationsRead).mockResolvedValue()
    vi.mocked(clearNotifications).mockResolvedValue()
  })

  it('renders legacy-aligned notifications and opens the target route', async () => {
    const user = userEvent.setup()
    const { refreshUnreadCount, setUnreadCount } = renderPage()

    expect(await screen.findByText('报名结果')).toBeInTheDocument()
    expect(screen.getByText('共 2 条通知，当前显示 2 条')).toBeInTheDocument()
    expect(screen.getByText('2026-09-05 12:00:00')).toBeInTheDocument()

    await user.click(screen.getByText('报名结果'))

    expect(vi.mocked(markNotificationRead).mock.calls[0][0]).toBe('10')
    expect(setUnreadCount).toHaveBeenCalledWith(1)
    expect(refreshUnreadCount).toHaveBeenCalled()
    expect(await screen.findByLabelText('current URL')).toHaveTextContent(
      '/activities/99',
    )
  })

  it('marks all notifications read and clears the mailbox', async () => {
    const user = userEvent.setup()
    const { setUnreadCount } = renderPage()

    await screen.findByText('报名结果')
    await user.click(screen.getByRole('button', { name: '全部已读' }))
    await waitFor(() => {
      expect(markAllNotificationsRead).toHaveBeenCalled()
    })
    expect(setUnreadCount).toHaveBeenCalledWith(0)

    await user.click(screen.getByRole('button', { name: '清空信箱' }))
    fireEvent.click(
      await screen.findByRole('button', { name: '确认清空' }),
    )
    await waitFor(() => {
      expect(clearNotifications).toHaveBeenCalled()
    })
  })

  it('returns to the recorded source page', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('报名结果')
    await user.click(screen.getByText('返回'))

    expect(await screen.findByLabelText('current URL')).toHaveTextContent(
      '/discover',
    )
  })
})
