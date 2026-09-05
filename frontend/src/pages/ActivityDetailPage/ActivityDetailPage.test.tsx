import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchActivityDetail } from '../../features/activities'
import { useAuth } from '../../features/auth'
import { ActivityDetailPage } from './ActivityDetailPage'

vi.mock('../../features/activities', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../features/activities')>()
  return { ...original, fetchActivityDetail: vi.fn() }
})

vi.mock('../../features/auth', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../features/auth')>()
  return { ...original, useAuth: vi.fn() }
})

const mockFetchDetail = vi.mocked(fetchActivityDetail)
const mockUseAuth = vi.mocked(useAuth)

function LocationProbe() {
  const location = useLocation()
  return (
    <output aria-label="returned URL">
      {location.pathname}
      {location.search}
    </output>
  )
}

function renderDetail(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/activities/:activityId"
            element={<ActivityDetailPage />}
          />
          <Route path="/" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ActivityDetailPage', () => {
  beforeEach(() => {
    mockFetchDetail.mockReset()
    mockUseAuth.mockReturnValue({
      currentUser: {
        id: '1',
        permissions: [],
        roleCodes: ['USER'],
      },
      establishSession: vi.fn(),
      logout: vi.fn(),
      restoreSession: vi.fn(),
      status: 'authenticated',
      token: 'token',
    })
    mockFetchDetail.mockResolvedValue({
      activityFlow: '签到后进入会场',
      canManage: false,
      contactInfo: '029-12345678',
      content: '活动详细介绍',
      creatorId: '20',
      faq: '请携带校园卡',
      favorited: false,
      id: '30',
      location: '南校区礼堂',
      maxParticipants: 100,
      organizerName: '学生工作处',
      registered: false,
      registeredCount: 20,
      registrationMode: 'REVIEW',
      registrationOpen: true,
      summary: '面向全校学生',
      tags: [
        {
          categoryId: '10',
          categoryName: '学术讲座',
          id: '11',
          name: '人工智能',
          sortNo: 1,
        },
      ],
      title: '人工智能公开课',
    })
  })

  it('shows detail tabs and returns to the encoded source URL', async () => {
    const user = userEvent.setup()
    renderDetail(
      '/activities/30?returnTo=%2F%3Fcategory%3D%E5%AD%A6%E6%9C%AF%E8%AE%B2%E5%BA%A7',
    )

    expect(await screen.findByText('人工智能公开课')).toBeInTheDocument()
    expect(screen.getByText('029-12345678')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: '常见问题' }))
    expect(
      screen.getByRole('heading', { name: '常见问题' }),
    ).toBeInTheDocument()
    expect(screen.getByText('请携带校园卡')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '返回' }))
    expect(screen.getByLabelText('returned URL')).toHaveTextContent(
      '/?category=学术讲座',
    )
  })

  it('shows organizer actions only for a manageable activity', async () => {
    mockFetchDetail.mockResolvedValueOnce({
      ...(await mockFetchDetail('30')),
      canManage: true,
    })
    renderDetail('/activities/30')

    expect(
      await screen.findByRole('button', { name: '签到管理' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '编辑活动' }),
    ).toBeInTheDocument()
  })
})
