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
import {
  fetchDiscoverComments,
  fetchDiscoverPosts,
  fetchRecommendations,
} from '../../features/discover'
import { DiscoverPage } from './DiscoverPage'

vi.mock('../../features/auth', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../features/auth')>()
  return { ...original, useAuth: vi.fn() }
})

vi.mock('../../features/discover', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../features/discover')>()
  return {
    ...original,
    fetchDiscoverComments: vi.fn(),
    fetchDiscoverPosts: vi.fn(),
    fetchRecommendations: vi.fn(),
  }
})

function LocationProbe() {
  const location = useLocation()
  return <output aria-label="current URL">{location.pathname}{location.search}</output>
}

function renderPage(initialEntry = '/discover') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/discover/create" element={<LocationProbe />} />
          <Route path="/activities/:activityId" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('DiscoverPage', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      currentUser: {
        icon: '/avatar.png',
        id: '1',
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
    vi.mocked(fetchDiscoverPosts).mockResolvedValue({
      items: [
        {
          activityCategory: '文体活动',
          activityId: '20',
          activityStatusText: '报名中',
          activityTitle: '校园音乐节',
          commentCount: 2,
          content: '现场气氛很好',
          id: '10',
          imageUrls: [],
          liked: false,
          likeCount: 3,
          nickName: '小明',
          userId: '1',
        },
      ],
      total: 1,
    })
    vi.mocked(fetchDiscoverComments).mockResolvedValue({
      items: [],
      total: 0,
    })
    vi.mocked(fetchRecommendations).mockResolvedValue({
      fallback: true,
      items: [
        {
          activityId: '30',
          reason: '匹配你的兴趣',
          tags: ['人工智能'],
          title: '人工智能公开课',
        },
      ],
      message: '个性化服务暂不可用，已按热度推荐',
      total: 1,
    })
  })

  it('renders posts and preserves the active tab when opening an activity', async () => {
    const user = userEvent.setup()
    renderPage('/discover?tab=recommend')

    expect(await screen.findByText('人工智能公开课')).toBeInTheDocument()
    expect(
      screen.getByText('个性化服务暂不可用，已按热度推荐'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '查看活动详情' }))
    expect(screen.getByLabelText('current URL')).toHaveTextContent(
      '/activities/30?returnTo=%2Fdiscover%3Ftab%3Drecommend',
    )
  })

  it('shows the legacy-aligned post actions on the circle tab', async () => {
    renderPage()

    expect(await screen.findByText('现场气氛很好')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '点赞 · 3' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '评论 · 2' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('写评论...')).toBeInTheDocument()
  })

  it('passes the current page as returnTo from the publish tab', async () => {
    const user = userEvent.setup()
    renderPage('/discover?tab=recommend')

    await screen.findByText('人工智能公开课')
    await user.click(screen.getByText('发布'))

    expect(screen.getByLabelText('current URL')).toHaveTextContent(
      '/discover/create?returnTo=%2Fdiscover%3Ftab%3Drecommend',
    )
  })
})
