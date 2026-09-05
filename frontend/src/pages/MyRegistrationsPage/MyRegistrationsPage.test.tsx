import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { fetchMyRegistrations } from '../../features/registration'
import { MyRegistrationsPage } from './MyRegistrationsPage'

vi.mock('../../features/registration', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../features/registration')>()
  return { ...original, fetchMyRegistrations: vi.fn() }
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

describe('MyRegistrationsPage', () => {
  it('returns to the complete source URL passed by activity detail', async () => {
    vi.mocked(fetchMyRegistrations).mockResolvedValue({
      items: [],
      total: 0,
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[
            '/me/registrations?returnTo=%2Factivities%2F1%3FreturnTo%3D%252Factivities%252Fcategories%252F4',
          ]}
        >
          <Routes>
            <Route
              path="/me/registrations"
              element={<MyRegistrationsPage />}
            />
            <Route path="/activities/:activityId" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await screen.findByText('还没有报名任何活动')
    await user.click(screen.getByText('返回'))

    expect(screen.getByLabelText('current URL')).toHaveTextContent(
      '/activities/1?returnTo=%2Factivities%2Fcategories%2F4',
    )
  })
})
