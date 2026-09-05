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
  Input,
  Tabs,
} from 'antd-mobile'
import {
  AddCircleOutline,
  AppOutline,
  CompassOutline,
  MessageOutline,
  UserOutline,
} from 'antd-mobile-icons'
import { useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { queryKeys } from '../../api/queryKeys'
import type { EntityId, PageResult } from '../../api/types'
import { AppPage, AppShell, BottomNav } from '../../components/layout'
import {
  CampusImage,
  CampusPopup,
  confirmAction,
  EmptyState,
  ErrorState,
  LoadingState,
  showToast,
} from '../../components/ui'
import { formatActivityTime } from '../../features/activities'
import { useAuth } from '../../features/auth'
import { useNotification } from '../../features/notification'
import {
  createDiscoverComment,
  deleteDiscoverComment,
  deleteDiscoverPost,
  fetchDiscoverComments,
  fetchDiscoverPosts,
  fetchRecommendations,
  likeDiscoverPost,
  unlikeDiscoverPost,
  type DiscoverComment,
  type DiscoverPost,
} from '../../features/discover'
import { withReturnTo } from '../../router/returnTo'
import './DiscoverPage.css'

const ACTIVITY_CREATE_PERMISSION = 'activity:create'
const PLATFORM_ADMIN_ROLE = 'PLATFORM_ADMIN'

function PostCard({
  currentUserId,
  currentUserIcon,
  onComment,
  onCommentCreated,
  onDelete,
  onLike,
  onOpenActivity,
  post,
}: {
  currentUserIcon?: string
  currentUserId?: string
  onComment: (post: DiscoverPost) => void
  onCommentCreated: () => void
  onDelete: (postId: string) => void
  onLike: (post: DiscoverPost) => void
  onOpenActivity: (activityId: string) => void
  post: DiscoverPost
}) {
  const [draft, setDraft] = useState('')
  const commentMutation = useMutation({
    mutationFn: () => createDiscoverComment(post.id, draft.trim()),
    onSuccess: () => {
      setDraft('')
      onCommentCreated()
      showToast('评论已发布', 'success')
    },
  })
  const isMine = currentUserId === post.userId
  const submitComment = async () => {
    if (!draft.trim()) return
    try {
      await commentMutation.mutateAsync()
    } catch (error) {
      showToast((error as Error).message, 'error')
    }
  }

  return (
    <article className="discover-page__post">
      <header className="discover-page__post-head">
        <div className="discover-page__author">
          <Avatar
            className="discover-page__avatar"
            src={(isMine ? currentUserIcon || post.icon : post.icon) || ''}
          />
          <div>
            <strong>{post.nickName || '校园同学'}</strong>
            <time>{formatActivityTime(post.createdAt)}</time>
          </div>
        </div>
        {isMine ? (
          <Button
            color="danger"
            fill="none"
            onClick={() => onDelete(post.id)}
            size="mini"
          >
            删除
          </Button>
        ) : null}
      </header>

      <p className="discover-page__content">{post.content}</p>
      {post.imageUrls.length ? (
        <div className="discover-page__images">
          {post.imageUrls.map((url, index) => (
            <CampusImage
              alt={`动态图片 ${index + 1}`}
              key={`${url}-${index}`}
              preview
              previewIndex={index}
              previewSources={post.imageUrls}
              fit="cover"
              src={url}
            />
          ))}
        </div>
      ) : null}

      <button
        className="discover-page__activity"
        onClick={() => onOpenActivity(post.activityId)}
        type="button"
      >
        <CampusImage alt="" fit="cover" src={post.activityCoverImage} />
        <span>
          <strong>{post.activityTitle || '活动已不可见'}</strong>
          <small>{post.activityCategory || '校园活动'}</small>
          <small>
            {post.activityStartTimeText ||
              formatActivityTime(post.activityStartTime)}
          </small>
        </span>
        <em>{post.activityStatusText || '未开放报名'}</em>
      </button>

      <div className="discover-page__actions">
        <Button
          className={post.liked ? 'is-liked' : ''}
          loading={false}
          onClick={() => onLike(post)}
        >
          {post.liked ? '已点赞' : '点赞'} · {post.likeCount}
        </Button>
        <Button onClick={() => onComment(post)}>
          评论 · {post.commentCount}
        </Button>
      </div>

      <div className="discover-page__quick-comment">
        <Avatar src={currentUserIcon || ''} />
        <Input
          maxLength={200}
          onChange={setDraft}
          onEnterPress={() => void submitComment()}
          placeholder="写评论..."
          value={draft}
        />
        <Button
          disabled={!draft.trim()}
          loading={commentMutation.isPending}
          onClick={() => void submitComment()}
          size="small"
        >
          发送
        </Button>
      </div>
    </article>
  )
}

export function DiscoverPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { currentUser } = useAuth()
  const { unreadCount } = useNotification()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'recommend' ? 'recommend' : 'circle'
  const [activePostId, setActivePostId] = useState('')
  const canManageActivities =
    currentUser?.permissions.includes(ACTIVITY_CREATE_PERMISSION) &&
    !currentUser.roleCodes.includes(PLATFORM_ADMIN_ROLE)

  const postsQuery = useInfiniteQuery<
    PageResult<DiscoverPost>,
    Error,
    InfiniteData<PageResult<DiscoverPost>>,
    readonly unknown[],
    number
  >({
    getNextPageParam: (lastPage, pages) =>
      pages.flatMap((page) => page.items).length < lastPage.total
        ? pages.length + 1
        : undefined,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchDiscoverPosts(pageParam),
    queryKey: queryKeys.discover.posts(),
  })
  const recommendationsQuery = useQuery({
    enabled: tab === 'recommend',
    queryFn: () => fetchRecommendations(1, 8),
    queryKey: queryKeys.discover.recommendations({ current: 1, pageSize: 8 }),
  })
  const commentsQuery = useInfiniteQuery<
    PageResult<DiscoverComment>,
    Error,
    InfiniteData<PageResult<DiscoverComment>>,
    readonly unknown[],
    number
  >({
    enabled: Boolean(activePostId),
    getNextPageParam: (lastPage, pages) =>
      pages.flatMap((page) => page.items).length < lastPage.total
        ? pages.length + 1
        : undefined,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      fetchDiscoverComments(activePostId, pageParam),
    queryKey: queryKeys.discover.comments(activePostId),
  })
  const likeMutation = useMutation({
    mutationFn: (post: DiscoverPost) =>
      post.liked ? unlikeDiscoverPost(post.id) : likeDiscoverPost(post.id),
    onError: (error) => showToast(error.message, 'error'),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.discover.all }),
  })
  const deletePostMutation = useMutation({
    mutationFn: deleteDiscoverPost,
    onSuccess: async () => {
      showToast('动态已删除', 'success')
      await queryClient.invalidateQueries({
        queryKey: queryKeys.discover.all,
      })
    },
  })
  const deleteCommentMutation = useMutation({
    mutationFn: deleteDiscoverComment,
    onSuccess: async () => {
      showToast('评论已删除', 'success')
      await queryClient.invalidateQueries({
        queryKey: queryKeys.discover.all,
      })
    },
  })

  const posts = postsQuery.data?.pages.flatMap((page) => page.items) ?? []
  const comments =
    commentsQuery.data?.pages.flatMap((page) => page.items) ?? []
  const commentTotal = commentsQuery.data?.pages[0]?.total ?? 0
  const returnTo = `${location.pathname}${location.search}`

  const openActivity = (activityId: EntityId) => {
    navigate({
      pathname: `/activities/${activityId}`,
      search: new URLSearchParams({ returnTo }).toString(),
    })
  }

  const bottomItems = [
    { icon: <AppOutline />, key: 'home', label: '首页' },
    {
      icon: <CompassOutline />,
      key: 'discover',
      label: canManageActivities ? '数据看板' : '发现',
    },
    { icon: <AddCircleOutline />, key: 'publish', label: '发布' },
    {
      badge: unreadCount || undefined,
      icon: <MessageOutline />,
      key: 'messages',
      label: '消息',
    },
    { icon: <UserOutline />, key: 'me', label: '我的' },
  ]

  return (
    <AppShell>
      <AppPage className="discover-page" hasBottomNav>
        <header className="discover-page__hero">
          <h1>校园圈</h1>
          <Button
            fill="none"
            onClick={() =>
              navigate({
                pathname: '/discover/create',
                search: new URLSearchParams({ returnTo }).toString(),
              })
            }
          >
            发布动态
          </Button>
        </header>

        <Tabs
          activeKey={tab}
          className="discover-page__tabs"
          onChange={(key) =>
            setSearchParams(key === 'recommend' ? { tab: key } : {}, {
              replace: true,
            })
          }
        >
          <Tabs.Tab key="circle" title="校园圈" />
          <Tabs.Tab key="recommend" title="为你推荐" />
        </Tabs>

        {tab === 'circle' ? (
          <section aria-label="校园圈动态">
            {postsQuery.isPending ? (
              <LoadingState description="正在加载校园圈动态" />
            ) : postsQuery.error ? (
              <ErrorState
                description={postsQuery.error.message}
                onRetry={() => void postsQuery.refetch()}
              />
            ) : posts.length ? (
              <>
                {posts.map((post) => (
                  <PostCard
                    currentUserIcon={currentUser?.icon}
                    currentUserId={currentUser?.id}
                    key={post.id}
                    onComment={(item) => {
                      setActivePostId(item.id)
                    }}
                    onCommentCreated={() =>
                      void queryClient.invalidateQueries({
                        queryKey: queryKeys.discover.all,
                      })
                    }
                    onDelete={async (postId) => {
                      if (
                        await confirmAction({
                          content: '删除后不可恢复。',
                          title: '确认删除这条动态吗？',
                        })
                      ) {
                        try {
                          await deletePostMutation.mutateAsync(postId)
                        } catch (error) {
                          showToast((error as Error).message, 'error')
                        }
                      }
                    }}
                    onLike={(item) => likeMutation.mutate(item)}
                    onOpenActivity={openActivity}
                    post={post}
                  />
                ))}
                <InfiniteScroll
                  hasMore={postsQuery.hasNextPage}
                  loadMore={async () => {
                    await postsQuery.fetchNextPage()
                  }}
                />
              </>
            ) : (
              <EmptyState description="当前还没有校园圈动态，去参与一个活动后来发第一条吧。" />
            )}
          </section>
        ) : recommendationsQuery.isPending ? (
          <LoadingState description="正在生成活动推荐" />
        ) : recommendationsQuery.error ? (
          <ErrorState
            description={recommendationsQuery.error.message}
            onRetry={() => void recommendationsQuery.refetch()}
          />
        ) : (
          <section aria-label="为你推荐">
            {recommendationsQuery.data?.fallback &&
            recommendationsQuery.data.message ? (
              <div className="discover-page__recommend-tip">
                {recommendationsQuery.data.message}
              </div>
            ) : null}
            {recommendationsQuery.data?.items.length ? (
              recommendationsQuery.data.items.map((item) => (
                <article
                  className="discover-page__recommendation"
                  key={item.activityId}
                >
                  <CampusImage
                    alt={item.title || '活动推荐'}
                    fit="cover"
                    src={item.coverImage}
                  />
                  <header>
                    <h2>{item.title || '活动推荐'}</h2>
                    <span>{item.reason || '为你推荐'}</span>
                  </header>
                  <p>{item.displayCategory || item.categoryName || '校园活动'}</p>
                  <p>{formatActivityTime(item.startTime)}</p>
                  <p>{item.location || '地点待定'}</p>
                  {item.tags.length ? (
                    <div className="discover-page__tags">
                      {item.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  ) : null}
                  <Button
                    block
                    color="primary"
                    onClick={() => openActivity(item.activityId)}
                    shape="rounded"
                  >
                    查看活动详情
                  </Button>
                </article>
              ))
            ) : (
              <EmptyState description="当前还没有可推荐的活动。" />
            )}
          </section>
        )}

        <BottomNav
          activeKey={canManageActivities ? '' : 'discover'}
          items={bottomItems}
          onChange={(key) => {
            const routes: Record<string, string> = {
              discover: canManageActivities ? '/organizer/dashboard' : '/discover',
              home: '/',
              messages: withReturnTo('/notifications', returnTo),
              me: '/me',
              publish: canManageActivities
                ? '/organizer/activities/new'
                : withReturnTo('/discover/create', returnTo),
            }
            navigate(routes[key] ?? '/')
          }}
        />
      </AppPage>

      <CampusPopup
        bodyClassName="discover-page__comments-popup"
        onMaskClick={() => setActivePostId('')}
        onClose={() => setActivePostId('')}
        title="评论"
        visible={Boolean(activePostId)}
      >
        <h3>共 {commentTotal} 条评论</h3>
        {commentsQuery.isPending ? (
          <LoadingState description="正在加载评论" />
        ) : commentsQuery.error ? (
          <ErrorState
            description={commentsQuery.error.message}
            onRetry={() => void commentsQuery.refetch()}
          />
        ) : comments.length ? (
          <div className="discover-page__comments">
            {comments.map((comment) => (
              <article key={comment.id}>
                <header>
                  <Avatar src={comment.icon || ''} />
                  <span>
                    <strong>{comment.nickName || '校园同学'}</strong>
                    <time>{formatActivityTime(comment.createdAt)}</time>
                  </span>
                  {comment.userId === currentUser?.id ? (
                    <Button
                      color="danger"
                      fill="none"
                      onClick={async () => {
                        if (
                          await confirmAction({
                            content: '删除后不可恢复。',
                            title: '确认删除这条评论吗？',
                          })
                        ) {
                          try {
                            await deleteCommentMutation.mutateAsync(comment.id)
                          } catch (error) {
                            showToast((error as Error).message, 'error')
                          }
                        }
                      }}
                      size="mini"
                    >
                      删除
                    </Button>
                  ) : null}
                </header>
                <p>{comment.content}</p>
              </article>
            ))}
            <InfiniteScroll
              hasMore={commentsQuery.hasNextPage}
              loadMore={async () => {
                await commentsQuery.fetchNextPage()
              }}
            />
          </div>
        ) : (
          <EmptyState description="还没有评论，来抢个前排。" />
        )}
      </CampusPopup>
    </AppShell>
  )
}
