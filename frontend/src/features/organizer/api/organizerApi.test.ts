import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../../../test/server'
import {
  fetchCheckInDashboard,
  fetchManagedActivities,
  reviewRegistration,
  verifyCheckIn,
} from './organizerApi'

describe('organizerApi', () => {
  it('normalizes managed activity and dashboard ids', async () => {
    server.use(
      http.get('/api/activity/manage/mine', () =>
        HttpResponse.json({
          data: [{ creatorId: 9007199254740992, id: 9007199254740994, maxParticipants: 20, title: '活动' }],
          success: true,
          total: 1,
        }),
      ),
      http.get('/api/activity/manage/9007199254740994/check-in/dashboard', () =>
        HttpResponse.json({
          data: {
            activitySummary: { activityId: 9007199254740994, maxParticipants: 20, title: '活动' },
            recentRecords: [{ id: 9007199254740996 }],
          },
          success: true,
        }),
      ),
    )
    const activities = await fetchManagedActivities({ current: 1, pageSize: 10 })
    const dashboard = await fetchCheckInDashboard(activities.items[0].id)
    expect(activities.items[0].id).toBe('9007199254740994')
    expect(dashboard.activitySummary?.activityId).toBe('9007199254740994')
    expect(dashboard.recentRecords[0].id).toBe('9007199254740996')
  })

  it('uses the cancel review endpoint for exit requests', async () => {
    let requestedPath = ''
    server.use(
      http.post('/api/activity/manage/12/registrations/34/cancel-review', ({ request }) => {
        requestedPath = new URL(request.url).pathname
        return HttpResponse.json({ success: true })
      }),
    )
    await reviewRegistration({ activityId: '12', id: '34', status: 4, userId: '56' }, true)
    expect(requestedPath).toContain('/cancel-review')
  })

  it('sends an idempotency key when verifying check-in', async () => {
    let key = ''
    server.use(
      http.post('/api/activity/manage/12/check-in/verify', ({ request }) => {
        key = request.headers.get('Idempotency-Key') ?? ''
        return HttpResponse.json({ data: { message: '核销成功' }, success: true })
      }),
    )
    const result = await verifyCheckIn('12', 'A8F3K2M7')
    expect(key).toMatch(/^checkin-/)
    expect(result.message).toBe('核销成功')
  })
})
