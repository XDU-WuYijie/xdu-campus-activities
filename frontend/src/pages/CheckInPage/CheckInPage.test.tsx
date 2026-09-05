import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchCheckInDashboard,
  verifyCheckIn,
} from '../../features/organizer'
import { CheckInPage } from './CheckInPage'

vi.mock('echarts', () => ({
  init: () => ({
    dispose: vi.fn(),
    resize: vi.fn(),
    setOption: vi.fn(),
  }),
}))

vi.mock('../../features/organizer', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../features/organizer')>()
  return {
    ...original,
    fetchCheckInDashboard: vi.fn(),
    verifyCheckIn: vi.fn(),
  }
})

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/organizer/activities/12/check-in']}>
        <Routes>
          <Route
            path="/organizer/activities/:activityId/check-in"
            element={<CheckInPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CheckInPage', () => {
  it('normalizes the display code and shows a verification failure', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchCheckInDashboard).mockResolvedValue({
      activitySummary: {
        activityId: '12',
        maxParticipants: 100,
        title: '校园活动',
      },
      checkInTrendChart: [],
      recentRecords: [],
      registrationTrendChart: [],
      stats: {
        checkedInCount: 0,
        checkInRate: 0,
        registeredCount: 1,
        uncheckedCount: 1,
      },
      statusChart: [],
    })
    vi.mocked(verifyCheckIn).mockRejectedValue(new Error('未到签到时间窗口'))

    renderPage()

    const input = await screen.findByPlaceholderText(
      '请输入签到展示码，例如 A8F3K2M7',
    )
    await user.type(input, ' xdu-123 456 ')
    await user.click(screen.getByRole('button', { name: '核销签到' }))

    expect(verifyCheckIn).toHaveBeenCalledWith('12', 'XDU-123456')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '核销失败：未到签到时间窗口',
    )
  })
})
