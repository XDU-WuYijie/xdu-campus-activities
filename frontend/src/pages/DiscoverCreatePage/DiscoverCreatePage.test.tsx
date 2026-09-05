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
  createDiscoverPost,
  fetchEligibleActivities,
} from '../../features/discover'
import { DiscoverCreatePage } from './DiscoverCreatePage'

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
    createDiscoverPost: vi.fn(),
    fetchEligibleActivities: vi.fn(),
  }
})

function LocationProbe() {
  const location = useLocation()
  return <output aria-label="returned URL">{location.pathname}{location.search}</output>
}

describe('DiscoverCreatePage', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      currentUser: {
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
    vi.mocked(fetchEligibleActivities).mockResolvedValue([
      {
        activityCategory: '文体活动',
        activityId: '20',
        activityTitle: '校园音乐节',
      },
    ])
    vi.mocked(createDiscoverPost).mockResolvedValue({
      activityId: '20',
      commentCount: 0,
      content: '现场气氛很好',
      id: '30',
      imageUrls: [],
      liked: false,
      likeCount: 0,
      userId: '1',
    })
  })

  it('submits the preselected activity and returns to the source tab', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[
            '/discover/create?activityId=20&returnTo=%2Fdiscover%3Ftab%3Drecommend',
          ]}
        >
          <Routes>
            <Route path="/discover/create" element={<DiscoverCreatePage />} />
            <Route path="/discover" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('校园音乐节')).toBeInTheDocument()
    const imageHeading = screen.getByRole('heading', {
      name: '动态图片',
    })
    const contentHeading = screen.getByRole('heading', {
      name: '动态内容 *',
    })
    expect(
      imageHeading.compareDocumentPosition(contentHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    await user.type(
      screen.getByPlaceholderText('写下这场活动里值得分享的内容'),
      '现场气氛很好',
    )
    await user.click(screen.getByRole('button', { name: '发布动态' }))

    expect(vi.mocked(createDiscoverPost).mock.calls[0]?.[0]).toEqual({
      activityId: '20',
      content: '现场气氛很好',
      imageUrls: [],
    })
    expect(await screen.findByLabelText('returned URL')).toHaveTextContent(
      '/discover?tab=recommend',
    )
  })
})
