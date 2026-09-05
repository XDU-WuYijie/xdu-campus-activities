import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import {
  Avatar,
  Button,
  InfiniteScroll,
  Popup,
  Tabs,
} from 'antd-mobile'
import {
  AddCircleOutline,
  AppOutline,
  CompassOutline,
  MessageOutline,
  RightOutline,
  UserOutline,
} from 'antd-mobile-icons'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { queryKeys } from '../../api/queryKeys'
import type { PageResult } from '../../api/types'
import { AppPage, AppShell, BottomNav, PageHeader } from '../../components/layout'
import {
  CampusImage,
  confirmAction,
  EmptyState,
  ErrorState,
  LoadingState,
  showToast,
} from '../../components/ui'
import { formatActivityTime } from '../../features/activities'
import { useAuth } from '../../features/auth'
import { fetchMyFavorites } from '../../features/favorites'
import { useNotification } from '../../features/notification'
import {
  deleteMyPost,
  fetchMyPosts,
  fetchPreferenceTags,
  fetchUserProfile,
  type ProfilePost,
} from '../../features/profile'
import {
  fetchManagedActivities,
  fetchRegistrationReviews,
  fetchReviewHistory,
  OrganizerProfileTabs,
} from '../../features/organizer'
import {
  fetchMyRegistrations,
  type RegistrationRecord,
} from '../../features/registration'
import { withReturnTo } from '../../router/returnTo'
import './ProfilePage.css'

const ACTIVITY_CREATE_PERMISSION = 'activity:create'
const PLATFORM_ADMIN_ROLE = 'PLATFORM_ADMIN'

function registrationTone(record: RegistrationRecord) {
  if (record.status === 1 && record.checkInStatus) return 'is-success'
  if (record.status === 1) return 'is-primary'
  if (record.status === 2 || record.status === 3) return 'is-danger'
  return 'is-warning'
}

function PostCard({
  onDelete,
  onOpenActivity,
  post,
}: {
  onDelete: () => void
  onOpenActivity: () => void
  post: ProfilePost
}) {
  return (
    <article className="profile-page__post">
      <div className="profile-page__post-head">
        <div>
          <strong>{post.nickName || '校园同学'}</strong>
          <time>{formatActivityTime(post.createdAt)}</time>
        </div>
        <Button color="danger" fill="none" onClick={onDelete} size="mini">
          删除
        </Button>
      </div>
      <p>{post.content}</p>
      {post.imageUrls.length ? (
        <div className="profile-page__post-images">
          {post.imageUrls.map((url) => (
            <CampusImage alt="动态图片" key={url} preview src={url} />
          ))}
        </div>
      ) : null}
      <button
        className="profile-page__post-activity"
        onClick={onOpenActivity}
        type="button"
      >
        <CampusImage alt="" src={post.activityCoverImage} />
        <span>
          <strong>{post.activityTitle || '活动已不可见'}</strong>
          <small>{post.activityCategory || '校园活动'}</small>
        </span>
        <small>{post.activityStatusText || '查看活动'}</small>
      </button>
      <div className="profile-page__post-counts">
        {post.likeCount} 次点赞 · {post.commentCount} 条评论
      </div>
    </article>
  )
}

export function ProfilePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { currentUser } = useAuth()
  const { unreadCount } = useNotification()
  const userId = currentUser?.id ?? ''
  const canManageActivities =
    currentUser?.permissions.includes(ACTIVITY_CREATE_PERMISSION) &&
    !currentUser.roleCodes.includes(PLATFORM_ADMIN_ROLE)
  const [postsVisible, setPostsVisible] = useState(false)
  const [organizerPageSize, setOrganizerPageSize] = useState(20)
  const [activityTab, setActivityTab] = useState(
    canManageActivities ? 'created' : 'registrations',
  )

  const profileQuery = useQuery({
    enabled: Boolean(userId),
    queryFn: () => fetchUserProfile(userId),
    queryKey: queryKeys.profile.detail(userId),
  })
  const preferencesQuery = useQuery({
    enabled: !canManageActivities,
    queryFn: fetchPreferenceTags,
    queryKey: queryKeys.profile.preferences(),
  })
  const registrationsQuery = useQuery({
    enabled: !canManageActivities,
    queryFn: () =>
      fetchMyRegistrations({
        current: 1,
        filter: 'ALL',
        pageSize: 3,
      }),
    queryKey: queryKeys.registration.mine({ current: 1, pageSize: 3 }),
  })
  const favoritesQuery = useQuery({
    enabled: !canManageActivities,
    queryFn: () => fetchMyFavorites({ current: 1, pageSize: 3 }),
    queryKey: queryKeys.favorites.mine({ current: 1, pageSize: 3 }),
  })
  const organizerSummaryQuery = useQuery({
    enabled: Boolean(canManageActivities),
    queryFn: async () => {
      const [activities, reviews, history] = await Promise.all([
        fetchManagedActivities({ current: 1, pageSize: organizerPageSize }),
        fetchRegistrationReviews(1, 20),
        fetchReviewHistory('ACTIVITY_ADMIN', 1, 20),
      ])
      return {
        activities,
        createdActivityTotal: activities.total,
        history,
        pendingReviewTotal: reviews.total,
        reviewHistoryTotal: history.total,
        reviews,
      }
    },
    queryKey: [...queryKeys.profile.summary(), organizerPageSize],
  })
  const postsQuery = useInfiniteQuery<
    PageResult<ProfilePost>,
    Error,
    InfiniteData<PageResult<ProfilePost>>,
    readonly unknown[],
    number
  >({
    enabled: Boolean(userId),
    getNextPageParam: (lastPage, pages) =>
      pages.flatMap((page) => page.items).length < lastPage.total
        ? pages.length + 1
        : undefined,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchMyPosts(userId, pageParam),
    queryKey: queryKeys.profile.posts(userId),
  })
  const deletePostMutation = useMutation({
    mutationFn: deleteMyPost,
    onSuccess: async () => {
      showToast('动态已删除', 'success')
      await queryClient.invalidateQueries({
        queryKey: queryKeys.profile.posts(userId),
      })
    },
  })

  const posts = postsQuery.data?.pages.flatMap((page) => page.items) ?? []
  const postTotal = postsQuery.data?.pages[0]?.total ?? 0
  const registrations = registrationsQuery.data?.items ?? []
  const favorites = favoritesQuery.data?.items ?? []
  const summary = organizerSummaryQuery.data
  const profileMeta = [
    profileQuery.data?.grade,
    profileQuery.data?.college,
  ]
    .filter(Boolean)
    .join(' · ')

  const handleBottomNav = (key: string) => {
    const routes: Record<string, string> = {
      discover: canManageActivities ? '/organizer/dashboard' : '/discover',
      home: '/',
      messages: withReturnTo(
        '/notifications',
        `${location.pathname}${location.search}`,
      ),
      me: '/me',
      publish: canManageActivities
        ? '/organizer/activities/new'
        : withReturnTo(
            '/discover/create',
            `${location.pathname}${location.search}`,
          ),
    }
    navigate(routes[key] ?? '/')
  }

  const openActivity = (activityId: string) => {
    navigate({
      pathname: `/activities/${activityId}`,
      search: new URLSearchParams({
        returnTo: `${location.pathname}${location.search}`,
      }).toString(),
    })
  }

  const loading =
    profileQuery.isPending ||
    (canManageActivities
      ? organizerSummaryQuery.isPending
      : registrationsQuery.isPending || favoritesQuery.isPending)
  const error =
    profileQuery.error ||
    organizerSummaryQuery.error ||
    registrationsQuery.error ||
    favoritesQuery.error

  return (
    <AppShell>
      <AppPage className="profile-page" hasBottomNav>
        <PageHeader onBack={() => navigate('/')} title="个人主页" />
        {loading ? (
          <LoadingState description="正在加载个人主页" />
        ) : error ? (
          <ErrorState
            description={error.message}
            onRetry={() => {
              void queryClient.invalidateQueries({
                queryKey: queryKeys.profile.all,
              })
            }}
            title="个人主页加载失败"
          />
        ) : (
          <>
            <button
              className="profile-page__identity"
              onClick={() => navigate('/me/profile')}
              type="button"
            >
              <Avatar
                fallback={<UserOutline aria-hidden />}
                src={currentUser?.icon ?? ''}
              />
              <span>
                <span className="profile-page__name-row">
                  <strong>{currentUser?.nickName || '校园同学'}</strong>
                  <small>
                    {canManageActivities ? '主办方认证' : '学生认证'}
                  </small>
                </span>
                <span className="profile-page__meta">
                  {profileMeta || '点击完善年级与学院信息'}
                </span>
              </span>
              <RightOutline aria-hidden />
            </button>

            <section aria-label="个人统计" className="profile-page__stats">
              {canManageActivities ? (
                <button disabled type="button">
                  <strong>{summary?.createdActivityTotal ?? 0}</strong>
                  <span>发起活动</span>
                </button>
              ) : (
                <button
                  onClick={() => navigate('/me/registrations')}
                  type="button"
                >
                  <strong>{registrationsQuery.data?.total ?? 0}</strong>
                  <span>我报名的</span>
                </button>
              )}
              <button
                onClick={() =>
                  navigate(
                    canManageActivities
                      ? '/me?tab=reviews'
                      : '/me/registrations',
                  )
                }
                type="button"
              >
                <strong>
                  {canManageActivities
                    ? (summary?.pendingReviewTotal ?? 0)
                    : registrations.length}
                </strong>
                <span>{canManageActivities ? '待审核' : '我参与的'}</span>
              </button>
              <button
                onClick={() =>
                  navigate(
                    canManageActivities
                      ? '/me?tab=history'
                      : '/me/favorites',
                  )
                }
                type="button"
              >
                <strong>
                  {canManageActivities
                    ? (summary?.reviewHistoryTotal ?? 0)
                    : (favoritesQuery.data?.total ?? 0)}
                </strong>
                <span>{canManageActivities ? '审核历史' : '收藏活动'}</span>
              </button>
              <button onClick={() => setPostsVisible(true)} type="button">
                <strong>{postTotal}</strong>
                <span>我的动态</span>
              </button>
            </section>

            {canManageActivities ? (
              <OrganizerProfileTabs
                activities={summary?.activities ?? { items: [], total: 0 }}
                history={summary?.history ?? { items: [], total: 0 }}
                loadingMore={organizerSummaryQuery.isFetching}
                onLoadMore={() =>
                  setOrganizerPageSize((current) => current + 20)
                }
                reviews={summary?.reviews ?? { items: [], total: 0 }}
              />
            ) : (
              <>
                <section className="profile-page__preferences">
                  <div>
                    {(preferencesQuery.data ?? []).map((tag) => (
                      <span key={tag.id}>{tag.name}</span>
                    ))}
                  </div>
                  <Button
                    fill="outline"
                    onClick={() => navigate('/me/preferences')}
                    size="mini"
                  >
                    偏好设置
                  </Button>
                </section>
                <Tabs
                  activeKey={activityTab}
                  className="profile-page__activity-tabs"
                  onChange={setActivityTab}
                >
                  <Tabs.Tab key="registrations" title="我的报名">
                    <PreviewSection
                      empty="还没有报名任何活动。"
                      items={registrations.map((item) => ({
                        cover: item.activityCoverImage || item.coverImage,
                        id: item.activityId,
                        meta: `${formatActivityTime(item.eventStartTime)} · ${item.location || '待定'}`,
                        status: item.statusText || '未知状态',
                        statusClass: registrationTone(item),
                        title: item.activityTitle,
                      }))}
                      onAll={() => navigate('/me/registrations')}
                      onOpen={openActivity}
                    />
                  </Tabs.Tab>
                  <Tabs.Tab key="favorites" title="我的收藏">
                    <PreviewSection
                      empty="还没有收藏任何活动。"
                      items={favorites.map((item) => ({
                        cover: item.coverImage,
                        id: item.id,
                        meta: `${formatActivityTime(item.eventStartTime)} · ${item.location || '待定'}`,
                        status: '已收藏',
                        statusClass: 'is-success',
                        title: item.title,
                      }))}
                      onAll={() => navigate('/me/favorites')}
                      onOpen={openActivity}
                    />
                  </Tabs.Tab>
                </Tabs>
              </>
            )}
          </>
        )}
        <BottomNav
          activeKey="me"
          items={[
            { icon: <AppOutline />, key: 'home', label: '首页' },
            {
              icon: <CompassOutline />,
              key: 'discover',
              label: canManageActivities ? '数据' : '发现',
            },
            { icon: <AddCircleOutline />, key: 'publish', label: '发布' },
            {
              badge: unreadCount || undefined,
              icon: <MessageOutline />,
              key: 'messages',
              label: '消息',
            },
            { icon: <UserOutline />, key: 'me', label: '我的' },
          ]}
          onChange={handleBottomNav}
        />
      </AppPage>
      <Popup
        bodyClassName="profile-page__posts-popup"
        closeOnMaskClick
        onClose={() => setPostsVisible(false)}
        position="bottom"
        visible={postsVisible}
      >
        <header>
          <strong>我的动态</strong>
          <span>共 {postTotal} 条</span>
        </header>
        <div className="profile-page__posts-scroll">
          {postsQuery.isPending ? (
            <LoadingState description="正在加载动态" />
          ) : postsQuery.isError ? (
            <ErrorState
              description={postsQuery.error.message}
              onRetry={() => postsQuery.refetch()}
            />
          ) : posts.length ? (
            <>
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  onDelete={async () => {
                    if (
                      await confirmAction({
                        confirmText: '删除',
                        content: '删除后无法恢复。',
                        title: '删除这条动态？',
                      })
                    ) {
                      await deletePostMutation.mutateAsync(post.id)
                    }
                  }}
                  onOpenActivity={() => openActivity(post.activityId)}
                  post={post}
                />
              ))}
              <InfiniteScroll
                hasMore={Boolean(postsQuery.hasNextPage)}
                loadMore={async () => {
                  await postsQuery.fetchNextPage()
                }}
              />
            </>
          ) : (
            <EmptyState description="你还没有发布任何动态" />
          )}
        </div>
      </Popup>
    </AppShell>
  )
}

interface PreviewItem {
  cover?: string
  id: string
  meta: string
  status: string
  statusClass: string
  title: string
}

function PreviewSection({
  allLabel = '全部活动',
  empty,
  items,
  onAll,
  onOpen,
}: {
  allLabel?: string
  empty: string
  items: PreviewItem[]
  onAll: () => void
  onOpen: (id: string) => void
}) {
  return (
    <section className="profile-page__preview">
      <header>
        <span>最近记录</span>
        <button onClick={onAll} type="button">
          {allLabel} <RightOutline aria-hidden />
        </button>
      </header>
      {items.length ? (
        items.map((item) => (
          <button
            className="profile-page__preview-card"
            key={item.id}
            onClick={() => onOpen(item.id)}
            type="button"
          >
            <CampusImage alt="" src={item.cover} />
            <span>
              <strong>{item.title}</strong>
              <small>{item.meta}</small>
            </span>
            <small className={item.statusClass}>{item.status}</small>
          </button>
        ))
      ) : (
        <p className="profile-page__empty">{empty}</p>
      )}
    </section>
  )
}
