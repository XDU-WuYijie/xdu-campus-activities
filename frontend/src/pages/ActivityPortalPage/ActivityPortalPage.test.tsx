import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchActivities,
  fetchActivityCategories,
} from '../../features/activities'
import { useAuth } from '../../features/auth'
import { ActivityPortalPage } from './ActivityPortalPage'

vi.mock('../../features/activities', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../features/activities')>()
  return {
    ...original,
    fetchActivities: vi.fn(),
    fetchActivityCategories: vi.fn(),
  }
})

vi.mock('../../features/auth', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../features/auth')>()
  return { ...original, useAuth: vi.fn() }
})

const mockFetchActivities = vi.mocked(fetchActivities)
const mockFetchCategories = vi.mocked(fetchActivityCategories)
const mockUseAuth = vi.mocked(useAuth)

function LocationProbe() {
  const location = useLocation()
  return (
    <output aria-label="current URL">
      {location.pathname}
      {location.search}
    </output>
  )
}

function renderPortal(initialEntry = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <ActivityPortalPage />
                <LocationProbe />
              </>
            }
          />
          <Route
            path="/activities/categories/:categoryId"
            element={
              <>
                <ActivityPortalPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ActivityPortalPage', () => {
  beforeEach(() => {
    mockFetchActivities.mockReset()
    mockFetchCategories.mockReset()
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
    mockFetchCategories.mockResolvedValue([
      {
        id: '10',
        name: '学术讲座',
        sortNo: 1,
        tags: [
          {
            categoryId: '10',
            categoryName: '学术讲座',
            id: '11',
            name: '人工智能',
            sortNo: 1,
          },
        ],
      },
    ])
    mockFetchActivities.mockResolvedValue({
      items: [
        {
          canManage: false,
          creatorId: '20',
          favorited: false,
          id: '30',
          location: '南校区',
          maxParticipants: 100,
          registered: false,
          registeredCount: 20,
          registrationOpen: true,
          tags: [],
          title: '人工智能公开课',
        },
      ],
      total: 1,
    })
  })

  it('loads categories and enters the selected activity stream', async () => {
    const user = userEvent.setup()
    renderPortal()

    await user.click(
      await screen.findByRole('button', { name: /学术讲座/ }),
    )

    expect(await screen.findByText('人工智能公开课')).toBeInTheDocument()
    expect(screen.getByLabelText('current URL')).toHaveTextContent(
      '/activities/categories/10',
    )
    expect(screen.getByLabelText('current URL')).not.toHaveTextContent(
      '%E5%AD%A6%E6%9C%AF%E8%AE%B2%E5%BA%A7',
    )
    expect(mockFetchActivities).toHaveBeenCalledWith(
      expect.objectContaining({
        category: '学术讲座',
        current: 1,
        sortBy: 'composite',
      }),
    )
  })

  it('restores URL filters and updates search state', async () => {
    const user = userEvent.setup()
    renderPortal(
      '/activities/categories/10?stageFilter=REGISTRATION_OPEN&sortBy=startTimeAsc',
    )

    await screen.findByText('人工智能公开课')
    expect(screen.getByLabelText('活动状态')).toHaveValue(
      'REGISTRATION_OPEN',
    )
    expect(screen.getByLabelText('排序方式')).toHaveValue('startTimeAsc')

    await user.type(
      screen.getByPlaceholderText('搜索标题、地点或标签'),
      '大模型{enter}',
    )

    await waitFor(() => {
      expect(screen.getByLabelText('current URL')).toHaveTextContent(
        'keyword=%E5%A4%A7%E6%A8%A1%E5%9E%8B',
      )
    })
  })

  it('redirects a legacy Chinese category query to the canonical slug', async () => {
    renderPortal(
      '/?category=%E5%AD%A6%E6%9C%AF%E8%AE%B2%E5%BA%A7&stageFilter=REGISTRATION_OPEN',
    )

    await waitFor(() => {
      expect(screen.getByLabelText('current URL')).toHaveTextContent(
        '/activities/categories/10?stageFilter=REGISTRATION_OPEN',
      )
    })
  })
})
