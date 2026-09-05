import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchActivityCategories,
  fetchActivityDetail,
} from '../../features/activities'
import { useAuth } from '../../features/auth'
import { ActivityEditorPage } from './ActivityEditorPage'

vi.mock('../../features/activities', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../features/activities')>()
  return {
    ...original,
    fetchActivityCategories: vi.fn(),
    fetchActivityDetail: vi.fn(),
  }
})
vi.mock('../../features/auth', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../features/auth')>()
  return { ...original, useAuth: vi.fn() }
})

describe('ActivityEditorPage', () => {
  beforeEach(() => {
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
    vi.mocked(fetchActivityCategories).mockResolvedValue([
      {
        id: '1',
        name: '学术讲座',
        sortNo: 1,
        tags: [{
          categoryId: '1',
          categoryName: '学术讲座',
          id: '11',
          name: '人工智能',
          sortNo: 1,
        }],
      },
    ])
    vi.mocked(fetchActivityDetail).mockRejectedValue(
      new Error('detail should not load when creating'),
    )
  })

  it('renders the legacy-aligned publishing flow with Ant Design controls', async () => {
    render(
      <QueryClientProvider
        client={new QueryClient({
          defaultOptions: { queries: { retry: false } },
        })}
      >
        <MemoryRouter initialEntries={['/organizer/activities/new']}>
          <Routes>
            <Route
              path="/organizer/activities/new"
              element={<ActivityEditorPage />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('发起一场新活动')).toBeInTheDocument()
    expect(screen.queryByText('建议尺寸 750*420px，支持 JPG / PNG，最多 5 张')).not.toBeInTheDocument()
    expect(screen.queryByText('先套用模板，再按需微调。日期和时刻都可以直接点选，不用手敲一长串数字。')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '请选择一级分类' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '请先选择一级分类' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '讲座模板' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存并提交' })).toBeInTheDocument()
  })
})
