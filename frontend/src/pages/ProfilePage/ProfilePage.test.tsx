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
import { useAuth } from '../../features/auth'
import { fetchMyFavorites } from '../../features/favorites'
import {
  fetchMyPosts,
  fetchPreferenceTags,
  fetchUserProfile,
} from '../../features/profile'
import {
  fetchManagedActivities,
  fetchRegistrationReviews,
  fetchReviewHistory,
} from '../../features/organizer'
import { fetchMyRegistrations } from '../../features/registration'
import { ProfilePage } from './ProfilePage'

vi.mock('../../features/auth', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../features/auth')>()
  return { ...original, useAuth: vi.fn() }
})
vi.mock('../../features/favorites', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../features/favorites')>()
  return { ...original, fetchMyFavorites: vi.fn() }
})
vi.mock('../../features/registration', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../features/registration')>()
  return { ...original, fetchMyRegistrations: vi.fn() }
})
vi.mock('../../features/profile', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../features/profile')>()
  return {
    ...original,
    fetchMyPosts: vi.fn(),
    fetchPreferenceTags: vi.fn(),
    fetchUserProfile: vi.fn(),
  }
})
vi.mock('../../features/organizer', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../features/organizer')>()
  return {
    ...original,
    fetchManagedActivities: vi.fn(),
    fetchRegistrationReviews: vi.fn(),
    fetchReviewHistory: vi.fn(),
  }
})

function LocationProbe() {
  const location = useLocation()
  return <output aria-label="current URL">{location.pathname}{location.search}</output>
}

function renderProfile() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/me']}>
        <Routes>
          <Route path="/me" element={<ProfilePage />} />
          <Route path="/discover/create" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      currentUser: {
        id: '101',
        nickName: '小明',
        permissions: [],
        roleCodes: ['USER'],
      },
      establishSession: vi.fn(),
      logout: vi.fn(),
      restoreSession: vi.fn(),
      status: 'authenticated',
      token: 'token',
    })
    vi.mocked(fetchUserProfile).mockResolvedValue({
      college: '计算机学院',
      grade: '2023级',
      userId: '101',
    })
    vi.mocked(fetchPreferenceTags).mockResolvedValue([
      {
        categoryId: '1',
        categoryName: '学术讲座',
        id: '11',
        name: '人工智能',
        sortNo: 1,
      },
    ])
    vi.mocked(fetchMyRegistrations).mockResolvedValue({
      items: [
        {
          activityId: '201',
          activityTitle: '人工智能公开课',
          checkInEnabled: true,
          checkInStatus: 0,
          id: '301',
          status: 1,
          statusText: '报名成功',
        },
      ],
      total: 4,
    })
    vi.mocked(fetchMyFavorites).mockResolvedValue({
      items: [
        {
          canManage: false,
          creatorId: '102',
          favorited: true,
          id: '202',
          maxParticipants: 100,
          registered: false,
          registeredCount: 10,
          registrationOpen: true,
          tags: [],
          title: '校园歌手大赛',
        },
      ],
      total: 2,
    })
    vi.mocked(fetchMyPosts).mockResolvedValue({
      items: [
        {
          activityId: '201',
          commentCount: 2,
          content: '今天的活动很精彩',
          id: '401',
          imageUrls: [],
          likeCount: 3,
          userId: '101',
        },
      ],
      total: 1,
    })
  })

  it('renders the legacy-aligned user summary and opens my posts', async () => {
    const user = userEvent.setup()
    renderProfile()

    expect(await screen.findByText('小明')).toBeInTheDocument()
    expect(screen.getByText('2023级 · 计算机学院')).toBeInTheDocument()
    expect(screen.getByText('人工智能')).toBeInTheDocument()
    expect(screen.getByText('人工智能公开课')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: '我的收藏' }))
    expect(await screen.findByText('校园歌手大赛')).toBeInTheDocument()

    await user.click(screen.getByText('我的动态'))
    expect(await screen.findByText('今天的活动很精彩')).toBeInTheDocument()
    expect(screen.getByText('3 次点赞 · 2 条评论')).toBeInTheDocument()
  })

  it('passes the profile page as returnTo from the publish tab', async () => {
    const user = userEvent.setup()
    renderProfile()

    await screen.findByText('小明')
    await user.click(screen.getByText('发布'))

    expect(screen.getByLabelText('current URL')).toHaveTextContent(
      '/discover/create?returnTo=%2Fme',
    )
  })

  it('renders legacy-aligned management content in organizer tabs', async () => {
    const user = userEvent.setup()
    vi.mocked(useAuth).mockReturnValue({
      currentUser: {
        id: '101',
        nickName: '校园主办方',
        permissions: ['activity:create'],
        roleCodes: ['ACTIVITY_ADMIN'],
      },
      establishSession: vi.fn(),
      logout: vi.fn(),
      restoreSession: vi.fn(),
      status: 'authenticated',
      token: 'token',
    })
    vi.mocked(fetchManagedActivities).mockResolvedValue({
      items: [{
        canManage: true,
        creatorId: '101',
        favorited: false,
        id: '501',
        location: '大学生活动中心',
        maxParticipants: 100,
        registered: false,
        registeredCount: 20,
        registrationOpen: true,
        status: 2,
        tags: [],
        title: '主办方发起的活动',
      }],
      total: 1,
    })
    vi.mocked(fetchRegistrationReviews).mockResolvedValue({
      items: [{
        activityId: '501',
        activityTitle: '主办方发起的活动',
        id: '601',
        status: 0,
        userId: '701',
        userNickName: '申请同学',
      }],
      total: 1,
    })
    vi.mocked(fetchReviewHistory).mockResolvedValue({
      items: [{
        action: 'APPROVED',
        bizId: '601',
        bizTitle: '主办方发起的活动',
        bizType: 'REGISTRATION',
        id: '801',
        targetName: '申请同学',
      }],
      total: 1,
    })

    renderProfile()

    expect(await screen.findByText('校园主办方')).toBeInTheDocument()
    expect(screen.getByText('发起活动').closest('button')).toBeDisabled()
    expect(screen.getByRole('tab', { name: '我发起的活动' })).toBeInTheDocument()
    expect(screen.getByText('主办方发起的活动')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /待审核请求/ }))
    expect(await screen.findByText('申请用户：申请同学')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '通过报名' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '驳回报名' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看活动' })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: '审核历史' }))
    expect(await screen.findByText('审核结果：通过')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '删除' })).toBeInTheDocument()
  })

  it('does not render a pending-review badge when the total is zero', async () => {
    vi.mocked(useAuth).mockReturnValue({
      currentUser: {
        id: '101',
        nickName: '校园主办方',
        permissions: ['activity:create'],
        roleCodes: ['ACTIVITY_ADMIN'],
      },
      establishSession: vi.fn(),
      logout: vi.fn(),
      restoreSession: vi.fn(),
      status: 'authenticated',
      token: 'token',
    })
    vi.mocked(fetchManagedActivities).mockResolvedValue({
      items: [],
      total: 0,
    })
    vi.mocked(fetchRegistrationReviews).mockResolvedValue({
      items: [],
      total: 0,
    })
    vi.mocked(fetchReviewHistory).mockResolvedValue({
      items: [],
      total: 0,
    })

    renderProfile()

    expect(
      await screen.findByRole('tab', { name: '待审核请求' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: '待审核请求' }).querySelector('b'),
    ).toBeNull()
  })
})
