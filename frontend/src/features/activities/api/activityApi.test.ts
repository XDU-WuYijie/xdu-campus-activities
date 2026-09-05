import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../../../test/server'
import {
  fetchActivities,
  fetchActivityCategories,
  fetchActivityDetail,
} from './activityApi'

const activityPayload = {
  canManage: false,
  creatorId: '9007199254740994',
  id: '9007199254740993',
  maxParticipants: 100,
  registered: false,
  registeredCount: 12,
  registrationOpen: true,
  tags: [
    {
      categoryId: '9007199254740995',
      categoryName: '学术讲座',
      id: '9007199254740996',
      name: '人工智能',
      sortNo: 1,
    },
  ],
  title: '人工智能公开课',
}

describe('activityApi', () => {
  it('loads and normalizes the category tree identifiers', async () => {
    server.use(
      http.get('*/api/activity/public/categories', () =>
        HttpResponse.json({
          data: [
            {
              id: '9007199254740995',
              name: '学术讲座',
              sortNo: 1,
              tags: activityPayload.tags,
            },
          ],
          errorMsg: null,
          success: true,
          total: null,
        }),
      ),
    )

    await expect(fetchActivityCategories()).resolves.toEqual([
      {
        id: '9007199254740995',
        name: '学术讲座',
        sortNo: 1,
        tags: activityPayload.tags,
      },
    ])
  })

  it('passes list filters and preserves the top-level total', async () => {
    server.use(
      http.get('*/api/activity/public/list', ({ request }) => {
        const params = new URL(request.url).searchParams
        expect(params.get('category')).toBe('学术讲座')
        expect(params.get('stageFilter')).toBe('REGISTRATION_OPEN')
        expect(params.get('sortBy')).toBe('startTimeAsc')
        expect(params.get('current')).toBe('2')

        return HttpResponse.json({
          data: [activityPayload],
          errorMsg: null,
          success: true,
          total: 7,
        })
      }),
    )

    await expect(
      fetchActivities({
        category: '学术讲座',
        current: 2,
        pageSize: 6,
        sortBy: 'startTimeAsc',
        stageFilter: 'REGISTRATION_OPEN',
      }),
    ).resolves.toMatchObject({
      items: [
        {
          creatorId: '9007199254740994',
          id: '9007199254740993',
          tags: [{ id: '9007199254740996' }],
        },
      ],
      total: 7,
    })
  })

  it('loads a detail record with string identifiers and boolean defaults', async () => {
    server.use(
      http.get('*/api/activity/public/9007199254740993', () =>
        HttpResponse.json({
          data: {
            ...activityPayload,
            canManage: undefined,
            favorited: undefined,
          },
          errorMsg: null,
          success: true,
          total: null,
        }),
      ),
    )

    await expect(
      fetchActivityDetail('9007199254740993'),
    ).resolves.toMatchObject({
      canManage: false,
      creatorId: '9007199254740994',
      favorited: false,
      id: '9007199254740993',
    })
  })
})
