import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../../../test/server'
import {
  createDiscoverComment,
  createDiscoverPost,
  deleteDiscoverComment,
  fetchDiscoverComments,
  fetchDiscoverPosts,
  fetchEligibleActivities,
  fetchRecommendations,
  likeDiscoverPost,
  unlikeDiscoverPost,
  uploadDiscoverImage,
} from './discoverApi'

const success = (data: unknown = null, total: number | null = null) =>
  HttpResponse.json({ data, errorMsg: null, success: true, total })

describe('discoverApi', () => {
  it('normalizes post, comment, activity, and recommendation IDs', async () => {
    server.use(
      http.get('*/api/discover/posts', () =>
        success(
          [
            {
              activityId: 101,
              content: '活动很精彩',
              id: '9007199254740993',
              userId: 202,
            },
          ],
          1,
        ),
      ),
      http.get('*/api/discover/posts/9007199254740993/comments', () =>
        success(
          [{ content: '赞', id: 301, postId: 302, userId: 303 }],
          1,
        ),
      ),
      http.get('*/api/discover/eligible-activities', () =>
        success([{ activityId: 401, activityTitle: '校园开放日' }]),
      ),
      http.get('*/api/discover/recommendations', () =>
        success({
          fallback: true,
          message: '暂按热度推荐',
          records: [{ activityId: 501, title: '人工智能讲座' }],
          total: 1,
        }),
      ),
    )

    await expect(fetchDiscoverPosts()).resolves.toMatchObject({
      items: [
        {
          activityId: '101',
          commentCount: 0,
          id: '9007199254740993',
          imageUrls: [],
          liked: false,
          likeCount: 0,
          userId: '202',
        },
      ],
      total: 1,
    })
    await expect(
      fetchDiscoverComments('9007199254740993'),
    ).resolves.toMatchObject({
      items: [{ id: '301', postId: '302', userId: '303' }],
    })
    await expect(fetchEligibleActivities()).resolves.toMatchObject([
      { activityId: '401' },
    ])
    await expect(fetchRecommendations()).resolves.toMatchObject({
      fallback: true,
      items: [{ activityId: '501', tags: [] }],
      message: '暂按热度推荐',
      total: 1,
    })
  })

  it('uses the expected endpoints for post interactions', async () => {
    const requests: string[] = []
    server.use(
      http.post('*/api/discover/posts/10/like', ({ request }) => {
        requests.push(`${request.method} like`)
        return success()
      }),
      http.delete('*/api/discover/posts/10/like', ({ request }) => {
        requests.push(`${request.method} like`)
        return success()
      }),
      http.post(
        '*/api/discover/posts/10/comments',
        async ({ request }) => {
          requests.push(
            `${request.method} ${JSON.stringify(await request.json())}`,
          )
          return success()
        },
      ),
      http.delete('*/api/discover/comments/20', ({ request }) => {
        requests.push(`${request.method} comment`)
        return success()
      }),
    )

    await likeDiscoverPost('10')
    await unlikeDiscoverPost('10')
    await createDiscoverComment('10', '现场氛围很好')
    await deleteDiscoverComment('20')

    expect(requests).toEqual([
      'POST like',
      'DELETE like',
      'POST {"content":"现场氛围很好"}',
      'DELETE comment',
    ])
  })

  it('submits post content and uploads discover images', async () => {
    let postBody: unknown
    let uploadCalled = false
    server.use(
      http.post('*/api/discover/posts', async ({ request }) => {
        postBody = await request.json()
        return success({
          activityId: 10,
          content: '活动记录',
          id: 20,
          userId: 30,
        })
      }),
      http.post('*/api/upload/discover-image', () => {
        uploadCalled = true
        return success('https://cdn.example.com/discover.png')
      }),
    )

    await expect(
      createDiscoverPost({
        activityId: '10',
        content: '活动记录',
        imageUrls: ['https://cdn.example.com/discover.png'],
      }),
    ).resolves.toMatchObject({
      activityId: '10',
      id: '20',
      userId: '30',
    })
    await expect(
      uploadDiscoverImage(
        new File(['image'], 'discover.png', { type: 'image/png' }),
      ),
    ).resolves.toBe('https://cdn.example.com/discover.png')
    expect(postBody).toEqual({
      activityId: '10',
      content: '活动记录',
      imageUrls: ['https://cdn.example.com/discover.png'],
    })
    expect(uploadCalled).toBe(true)
  })
})
