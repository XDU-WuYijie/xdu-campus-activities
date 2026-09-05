import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../../../test/server'
import {
  applyForOrganizer,
  fetchMyPosts,
  fetchOrganizerApplication,
  fetchPreferenceTags,
  fetchUserProfile,
  updatePreferenceTags,
  updateUserProfile,
} from './profileApi'

const success = (data: unknown = null, total: number | null = null) =>
  HttpResponse.json({ data, errorMsg: null, success: true, total })

describe('profileApi', () => {
  it('loads profile resources and normalizes every entity ID', async () => {
    server.use(
      http.get('*/api/user/info/9007199254740993', () =>
        success({ college: '计算机学院', userId: 101 }),
      ),
      http.get('*/api/user/preferences/activity-tags', () =>
        success([
          {
            categoryId: '9007199254740994',
            categoryName: '学术讲座',
            id: '9007199254740995',
            name: '人工智能',
            sortNo: 1,
          },
        ]),
      ),
      http.get('*/api/user/organizer/apply/me', () =>
        success({
          applyStatus: 'PENDING',
          id: '9007199254740996',
          orgName: '人工智能协会',
          reason: '组织学术活动',
          userId: 101,
        }),
      ),
      http.get('*/api/discover/posts', ({ request }) => {
        const params = new URL(request.url).searchParams
        expect(params.get('userId')).toBe('9007199254740993')
        return success(
          [
            {
              activityId: '9007199254740997',
              content: '活动很精彩',
              id: '9007199254740998',
              userId: 101,
            },
          ],
          1,
        )
      }),
    )

    await expect(fetchUserProfile('9007199254740993')).resolves.toMatchObject({
      userId: '101',
    })
    await expect(fetchPreferenceTags()).resolves.toMatchObject([
      { categoryId: '9007199254740994', id: '9007199254740995' },
    ])
    await expect(fetchOrganizerApplication()).resolves.toMatchObject({
      id: '9007199254740996',
      userId: '101',
    })
    await expect(fetchMyPosts('9007199254740993')).resolves.toMatchObject({
      items: [
        {
          activityId: '9007199254740997',
          id: '9007199254740998',
          imageUrls: [],
          userId: '101',
        },
      ],
      total: 1,
    })
  })

  it('submits profile, preference, and organizer application writes', async () => {
    const requests: Array<{ body: unknown; path: string }> = []
    server.use(
      http.put('*/api/user/profile', async ({ request }) => {
        requests.push({
          body: await request.json(),
          path: new URL(request.url).pathname,
        })
        return success()
      }),
      http.put(
        '*/api/user/preferences/activity-tags',
        async ({ request }) => {
          requests.push({
            body: await request.json(),
            path: new URL(request.url).pathname,
          })
          return success([])
        },
      ),
      http.post('*/api/user/organizer/apply', async ({ request }) => {
        requests.push({
          body: await request.json(),
          path: new URL(request.url).pathname,
        })
        return success()
      }),
    )

    await updateUserProfile({
      birthday: null,
      city: '',
      college: '计算机学院',
      gender: null,
      grade: '2023级',
      introduce: '',
      mentor: '',
      nickName: '测试用户',
    })
    await updatePreferenceTags(['11', '12'])
    await applyForOrganizer({
      orgName: '人工智能协会',
      reason: '组织学术活动',
    })

    expect(requests).toHaveLength(3)
    expect(requests[1]).toMatchObject({
      body: { tagIds: ['11', '12'] },
      path: '/api/user/preferences/activity-tags',
    })
  })
})
