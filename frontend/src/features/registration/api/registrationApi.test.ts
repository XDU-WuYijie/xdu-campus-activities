import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../../../test/server'
import {
  cancelRegistration,
  deleteRegistrationRecord,
  fetchMyRegistrations,
  fetchRegistrationStatus,
  registerActivity,
} from './registrationApi'

const success = (data: unknown = null, total: number | null = null) =>
  HttpResponse.json({ data, errorMsg: null, success: true, total })

describe('registrationApi', () => {
  it('submits registration and normalizes 64-bit identifiers', async () => {
    server.use(
      http.post(
        '*/api/activity/9007199254740993/register',
        () =>
          success({
            activityId: '9007199254740993',
            message: '报名确认中',
            requestId: '9007199254740994',
            status: 'PENDING_CONFIRM',
            userId: '9007199254740995',
          }),
      ),
    )

    await expect(registerActivity('9007199254740993')).resolves.toMatchObject({
      activityId: '9007199254740993',
      requestId: '9007199254740994',
      userId: '9007199254740995',
    })
  })

  it('queries status and normalizes voucher identifiers', async () => {
    server.use(
      http.get(
        '*/api/activity/9007199254740993/register/status',
        () =>
          success({
            activityId: '9007199254740993',
            message: '报名成功',
            status: 'SUCCESS',
            voucherDisplayCode: 'XDU-123456',
            voucherId: '9007199254740996',
          }),
      ),
    )

    await expect(
      fetchRegistrationStatus('9007199254740993'),
    ).resolves.toMatchObject({
      activityId: '9007199254740993',
      voucherId: '9007199254740996',
    })
  })

  it('loads, cancels and deletes personal registration records', async () => {
    const methods: string[] = []
    server.use(
      http.get('*/api/activity/registration/mine', ({ request }) => {
        const params = new URL(request.url).searchParams
        expect(params.get('filter')).toBe('CHECKED_IN')
        expect(params.get('current')).toBe('2')
        return success(
          [
            {
              activityId: '9007199254740993',
              activityTitle: '校园开放日',
              checkInEnabled: true,
              checkInStatus: 1,
              id: '9007199254740997',
              status: 1,
              voucherId: '9007199254740996',
            },
          ],
          11,
        )
      }),
      http.delete(
        '*/api/activity/9007199254740993/register',
        ({ request }) => {
          methods.push(request.method)
          return success()
        },
      ),
      http.delete(
        '*/api/activity/registration/mine/9007199254740997',
        ({ request }) => {
          methods.push(request.method)
          return success()
        },
      ),
    )

    await expect(
      fetchMyRegistrations({
        current: 2,
        filter: 'CHECKED_IN',
        pageSize: 10,
      }),
    ).resolves.toMatchObject({
      items: [
        {
          activityId: '9007199254740993',
          id: '9007199254740997',
          voucherId: '9007199254740996',
        },
      ],
      total: 11,
    })
    await cancelRegistration('9007199254740993')
    await deleteRegistrationRecord('9007199254740997')
    expect(methods).toEqual(['DELETE', 'DELETE'])
  })
})
