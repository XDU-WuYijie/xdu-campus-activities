import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../../../test/server'
import {
  favoriteActivity,
  fetchMyFavorites,
  unfavoriteActivity,
} from './favoriteApi'

const success = (data: unknown = null, total: number | null = null) =>
  HttpResponse.json({ data, errorMsg: null, success: true, total })

describe('favoriteApi', () => {
  it('loads favorites with pagination and normalized IDs', async () => {
    server.use(
      http.get('*/api/activity/favorite/mine', ({ request }) => {
        const params = new URL(request.url).searchParams
        expect(params.get('keyword')).toBe('讲座')
        expect(params.get('current')).toBe('2')
        return success(
          [
            {
              creatorId: '9007199254740994',
              id: '9007199254740993',
              title: '人工智能讲座',
            },
          ],
          12,
        )
      }),
    )

    await expect(
      fetchMyFavorites({
        current: 2,
        keyword: '讲座',
        pageSize: 10,
      }),
    ).resolves.toMatchObject({
      items: [
        {
          creatorId: '9007199254740994',
          id: '9007199254740993',
        },
      ],
      total: 12,
    })
  })

  it('uses POST to favorite and DELETE to unfavorite', async () => {
    const methods: string[] = []
    server.use(
      http.post('*/api/activity/30/favorite', ({ request }) => {
        methods.push(request.method)
        return success()
      }),
      http.delete('*/api/activity/30/favorite', ({ request }) => {
        methods.push(request.method)
        return success()
      }),
    )

    await favoriteActivity('30')
    await unfavoriteActivity('30')
    expect(methods).toEqual(['POST', 'DELETE'])
  })
})
