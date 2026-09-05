import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../../../test/server'
import {
  fetchAiReview,
  fetchOrganizerApplications,
  reviewActivity,
} from './adminApi'

describe('adminApi', () => {
  it('normalizes organizer application ids', async () => {
    server.use(
      http.get('/api/user/admin/organizer-applications', () =>
        HttpResponse.json({
          data: [{ id: '9007199254740992', orgName: '社团', userId: '9007199254740994' }],
          success: true,
        }),
      ),
    )
    const result = await fetchOrganizerApplications()
    expect(result[0].id).toBe('9007199254740992')
    expect(result[0].userId).toBe('9007199254740994')
  })

  it('normalizes empty AI report lists', async () => {
    server.use(
      http.get('/api/activity/admin/12/ai-review', () =>
        HttpResponse.json({
          data: { activityId: 12, suggestion: 'MANUAL_REVIEW' },
          success: true,
        }),
      ),
    )
    const report = await fetchAiReview('12')
    expect(report.activityId).toBe('12')
    expect(report.problems).toEqual([])
  })

  it('posts the rejection reason', async () => {
    let body: unknown
    server.use(
      http.post('/api/activity/admin/12/review', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ success: true })
      }),
    )
    await reviewActivity('12', false, '信息不完整')
    expect(body).toEqual({ approved: false, reviewRemark: '信息不完整' })
  })
})
