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
import { fetchRegistrationStatus } from '../../features/registration'
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

vi.mock('../../features/registration', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../features/registration')>()
  return { ...original, fetchRegistrationStatus: vi.fn() }
})

const mockFetchDetail = vi.mocked(fetchActivityDetail)
const mockFetchRegistrationStatus = vi.mocked(fetchRegistrationStatus)
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
          <Route
            path="/activities/categories/:categoryId"
            element={<LocationProbe />}
          />
          <Route path="/me/registrations" element={<LocationProbe />} />
          <Route path="/" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ActivityDetailPage', () => {
  beforeEach(() => {
    mockFetchDetail.mockReset()
    mockFetchRegistrationStatus.mockReset()
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
      registrationMode: 'AUDIT_REQUIRED',
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
    mockFetchRegistrationStatus.mockResolvedValue({
      activityId: '30',
      message: '未报名',
      status: 'NOT_REGISTERED',
    })
  })

  it('shows detail tabs and returns to the encoded source URL', async () => {
    const user = userEvent.setup()
    renderDetail(
      '/activities/30?returnTo=%2Factivities%2Fcategories%2F10%3FsortBy%3DstartTimeAsc',
    )

    expect(await screen.findByText('人工智能公开课')).toBeInTheDocument()
    expect(screen.getByText('029-12345678')).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: '立即报名' }).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getByRole('button', { name: '收藏活动' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: '常见问题' }))
    expect(
      screen.getByRole('heading', { name: '常见问题' }),
    ).toBeInTheDocument()
    expect(screen.getByText('请携带校园卡')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '返回' }))
    expect(screen.getByLabelText('returned URL')).toHaveTextContent(
      '/activities/categories/10?sortBy=startTimeAsc',
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

  it('does not show a historical cancel reason for a successful registration', async () => {
    mockFetchRegistrationStatus.mockResolvedValueOnce({
      activityId: '30',
      failReason: '退出申请已通过',
      message: '报名成功',
      status: 'SUCCESS',
      voucherDisplayCode: 'XDU-123456',
      voucherId: '40',
      voucherStatus: 'UNUSED',
    })

    renderDetail('/activities/30')

    expect(
      await screen.findByRole('button', { name: '查看签到凭证' }),
    ).toBeInTheDocument()
    const detailHeading = screen.getByRole('heading', {
      name: '活动详情',
    })
    const voucherHeading = screen.getByRole('heading', {
      name: '我的签到凭证',
    })
    expect(
      detailHeading.compareDocumentPosition(voucherHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getByText('报名成功')).toBeInTheDocument()
    expect(screen.queryByText('退出申请已通过')).not.toBeInTheDocument()
  })

  it('keeps the full detail URL when opening my registrations', async () => {
    const user = userEvent.setup()
    mockFetchRegistrationStatus.mockResolvedValueOnce({
      activityId: '30',
      message: '报名成功',
      status: 'SUCCESS',
    })
    renderDetail(
      '/activities/30?returnTo=%2Factivities%2Fcategories%2F10',
    )

    await user.click(
      await screen.findByRole('button', { name: '查看我的报名' }),
    )

    expect(screen.getByLabelText('returned URL')).toHaveTextContent(
      '/me/registrations?returnTo=%2Factivities%2F30%3FreturnTo%3D%252Factivities%252Fcategories%252F10',
    )
  })
})
