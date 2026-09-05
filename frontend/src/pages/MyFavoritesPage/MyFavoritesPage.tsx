import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import { InfiniteScroll, SearchBar } from 'antd-mobile'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { queryKeys } from '../../api/queryKeys'
import type { PageResult } from '../../api/types'
import { AppPage, AppShell, PageHeader } from '../../components/layout'
import {
  ActivityCard,
  CampusButton,
  EmptyState,
  ErrorState,
  LoadingState,
  showToast,
} from '../../components/ui'
import {
  formatActivityTimeRange,
  getActivityCategory,
  type Activity,
} from '../../features/activities'
import {
  fetchMyFavorites,
  unfavoriteActivity,
} from '../../features/favorites'
import { safeReturnTo } from '../../router/returnTo'
import './MyFavoritesPage.css'

const PAGE_SIZE = 10

export function MyFavoritesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [keywordDraft, setKeywordDraft] = useState('')
  const [keyword, setKeyword] = useState('')
  const returnTo = safeReturnTo(
    new URLSearchParams(location.search).get('returnTo'),
    '/me',
  )
  const queryParams = useMemo(
    () => ({ keyword: keyword || undefined, pageSize: PAGE_SIZE }),
    [keyword],
  )

  const favoritesQuery = useInfiniteQuery<
    PageResult<Activity>,
    Error,
    InfiniteData<PageResult<Activity>>,
    readonly unknown[],
    number
  >({
    getNextPageParam: (lastPage, pages) =>
      pages.reduce((count, page) => count + page.items.length, 0) <
      lastPage.total
        ? pages.length + 1
        : undefined,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      fetchMyFavorites({ ...queryParams, current: pageParam }),
    queryKey: queryKeys.favorites.mine(queryParams),
  })

  const activities =
    favoritesQuery.data?.pages.flatMap((page) => page.items) ?? []
  const total = favoritesQuery.data?.pages[0]?.total ?? 0

  const unfavoriteMutation = useMutation({
    mutationFn: unfavoriteActivity,
    onSuccess: async (_, activityId) => {
      showToast('已取消收藏', 'success')
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.favorites.all,
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.activities.detail(activityId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.activities.lists(),
        }),
      ])
    },
  })

  const openDetail = (activityId: string) => {
    navigate({
      pathname: `/activities/${activityId}`,
      search: new URLSearchParams({
        returnTo: `${location.pathname}${location.search}`,
      }).toString(),
    })
  }

  return (
    <AppShell>
      <AppPage className="my-favorites-page">
        <PageHeader
          onBack={() => navigate(returnTo, { replace: true })}
          title="我的收藏"
        />
        <div className="my-favorites-page__search">
          <SearchBar
            onChange={setKeywordDraft}
            onClear={() => setKeyword('')}
            onSearch={(value) => setKeyword(value.trim())}
            placeholder="搜索收藏的活动"
            value={keywordDraft}
          />
        </div>

        {favoritesQuery.isPending ? (
          <LoadingState description="正在加载收藏活动" />
        ) : favoritesQuery.isError ? (
          <ErrorState
            description={favoritesQuery.error.message}
            onRetry={() => favoritesQuery.refetch()}
            title="收藏列表加载失败"
          />
        ) : activities.length === 0 ? (
          <EmptyState
            description={
              keyword ? '没有匹配的收藏活动' : '还没有收藏任何活动'
            }
          />
        ) : (
          <section aria-label="收藏活动" className="my-favorites-page__list">
            <p className="my-favorites-page__count">
              共 {total} 条收藏记录，当前显示 {activities.length} 条
            </p>
            {activities.map((activity) => (
              <ActivityCard
                key={activity.id}
                action={
                  <div className="my-favorites-page__actions">
                    <CampusButton
                      fill="none"
                      onClick={() => openDetail(activity.id)}
                    >
                      查看详情
                    </CampusButton>
                    <CampusButton
                      color="warning"
                      fill="outline"
                      loading={
                        unfavoriteMutation.isPending &&
                        unfavoriteMutation.variables === activity.id
                      }
                      onClick={async () => {
                        try {
                          await unfavoriteMutation.mutateAsync(activity.id)
                        } catch (error) {
                          showToast((error as Error).message, 'error')
                        }
                      }}
                    >
                      取消收藏
                    </CampusButton>
                  </div>
                }
                category={getActivityCategory(activity)}
                coverUrl={activity.coverImage}
                id={activity.id}
                location={activity.location || '待定'}
                maxParticipants={activity.maxParticipants}
                registeredCount={activity.registeredCount}
                status={{ label: '已收藏', tone: 'success' }}
                tags={activity.tags.map((tag) => tag.name)}
                timeText={formatActivityTimeRange(
                  activity.eventStartTime,
                  activity.eventEndTime,
                )}
                title={activity.title}
              />
            ))}
            <InfiniteScroll
              hasMore={favoritesQuery.hasNextPage}
              loadMore={async () => {
                await favoritesQuery.fetchNextPage()
              }}
            />
          </section>
        )}
      </AppPage>
    </AppShell>
  )
}
