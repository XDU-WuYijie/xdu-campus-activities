import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth'
import { fetchMyFavorites } from '../../features/favorites'
import {
  fetchMyPosts,
  fetchPreferenceTags,
  fetchUserProfile,
} from '../../features/profile'
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
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

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
})
