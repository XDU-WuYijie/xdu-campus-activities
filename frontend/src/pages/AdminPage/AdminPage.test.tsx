import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchOrganizerApplications,
  fetchPendingActivities,
  fetchPublishedActivities,
} from '../../features/admin'
import { useAuth } from '../../features/auth'
import { fetchReviewHistory } from '../../features/organizer'
import { AdminPage } from './AdminPage'

vi.mock('../../features/admin', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../features/admin')>()
  return {
    ...original,
    fetchOrganizerApplications: vi.fn(),
    fetchPendingActivities: vi.fn(),
    fetchPublishedActivities: vi.fn(),
  }
})
vi.mock('../../features/auth', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../features/auth')>()
  return { ...original, useAuth: vi.fn() }
})
vi.mock('../../features/organizer', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../features/organizer')>()
  return { ...original, fetchReviewHistory: vi.fn() }
})

describe('AdminPage', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      currentUser: { id: '1', nickName: '平台管理员', permissions: [], roleCodes: ['PLATFORM_ADMIN'] },
      establishSession: vi.fn(),
      logout: vi.fn(),
      restoreSession: vi.fn(),
      status: 'authenticated',
      token: 'token',
    })
    vi.mocked(fetchPendingActivities).mockResolvedValue([{
      canManage: false,
      creatorId: '2',
      favorited: false,
      id: '9007199254740993',
      location: '大学生活动中心',
      maxParticipants: 100,
      organizerName: '学生会',
      registered: false,
      registeredCount: 0,
      registrationOpen: false,
      status: 1,
      tags: [],
      title: '待审核活动',
    }])
    vi.mocked(fetchPublishedActivities).mockResolvedValue({ items: [], total: 0 })
    vi.mocked(fetchOrganizerApplications).mockResolvedValue([])
    vi.mocked(fetchReviewHistory).mockResolvedValue({ items: [], total: 0 })
  })

  it('renders the pending activity review queue', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/admin']}>
          <AdminPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByText('待审核活动')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '通过' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'AI审核建议' })).toBeInTheDocument()
  })
})
