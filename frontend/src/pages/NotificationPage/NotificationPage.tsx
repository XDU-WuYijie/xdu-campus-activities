import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import {
  Button,
  CapsuleTabs,
  InfiniteScroll,
} from 'antd-mobile'
import {
  BellOutline,
  CheckOutline,
  DeleteOutline,
} from 'antd-mobile-icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { queryKeys } from '../../api/queryKeys'
import type { PageResult } from '../../api/types'
import { AppPage, AppShell, PageHeader } from '../../components/layout'
import {
  CampusButton,
  confirmAction,
  EmptyState,
  ErrorState,
  LoadingState,
  showToast,
} from '../../components/ui'
import {
  clearNotifications,
  fetchNotifications,
  getNotificationTypeLabel,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationTarget,
  type NotificationItem,
  useNotification,
} from '../../features/notification'
import { safeReturnTo } from '../../router/returnTo'
import './NotificationPage.css'

const PAGE_SIZE = 10

const FILTERS = [
  { label: '全部', value: '' },
  { label: '报名动态', value: 'REGISTRATION_SUCCESS' },
  { label: '审核通知', value: 'ACTIVITY_REVIEW_PENDING' },
  { label: '系统消息', value: 'ACTIVITY_LOCATION_CHANGED' },
]

function formatNotificationTime(value: string): string {
  return value ? value.replace('T', ' ') : ''
}

export function NotificationPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { refreshUnreadCount, setUnreadCount, unreadCount } =
    useNotification()
  const type = searchParams.get('type') ?? ''
  const listParams = { pageSize: PAGE_SIZE, type }

  const notificationsQuery = useInfiniteQuery<
    PageResult<NotificationItem>,
    Error,
    InfiniteData<PageResult<NotificationItem>>,
    readonly unknown[],
    number
  >({
    getNextPageParam: (lastPage, pages) =>
      pages.flatMap((page) => page.items).length < lastPage.total
        ? pages.length + 1
        : undefined,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      fetchNotifications({ ...listParams, current: pageParam }),
    queryKey: queryKeys.notifications.list(listParams),
  })

  const refreshNotifications = async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.notifications.all,
    })
  }

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: async () => {
      setUnreadCount(Math.max(0, unreadCount - 1))
      await refreshNotifications()
      await refreshUnreadCount()
    },
  })
  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: async () => {
      setUnreadCount(0)
      await refreshNotifications()
      showToast('已全部标为已读', 'success')
    },
  })
  const clearMutation = useMutation({
    mutationFn: clearNotifications,
    onSuccess: async () => {
      setUnreadCount(0)
      await refreshNotifications()
      showToast('信箱已清空', 'success')
    },
  })

  const notifications =
    notificationsQuery.data?.pages.flatMap((page) => page.items) ?? []
  const total = notificationsQuery.data?.pages[0]?.total ?? 0
  const backTarget = safeReturnTo(
    searchParams.get('returnTo'),
    '/',
  )

  const markRead = async (
    notification: NotificationItem,
    showMessage = true,
  ) => {
    if (notification.isRead) {
      return
    }
    try {
      await markReadMutation.mutateAsync(notification.id)
      if (showMessage) {
        showToast('已标为已读', 'success')
      }
    } catch (error) {
      showToast((error as Error).message, 'error')
      throw error
    }
  }

  const openNotification = async (notification: NotificationItem) => {
    try {
      await markRead(notification, false)
    } catch {
      return
    }
    const target = resolveNotificationTarget(notification)
    if (target) {
      navigate(target)
    }
  }

  return (
    <AppShell>
      <AppPage className="notification-page">
        <PageHeader
          onBack={() => navigate(backTarget)}
          right={
            <Button
              className="notification-page__read-all"
              disabled={unreadCount === 0}
              fill="none"
              loading={markAllReadMutation.isPending}
              onClick={async () => {
                try {
                  await markAllReadMutation.mutateAsync()
                } catch (error) {
                  showToast((error as Error).message, 'error')
                }
              }}
              size="mini"
            >
              全部已读
            </Button>
          }
          title="通知中心"
        />

        <CapsuleTabs
          activeKey={type}
          className="notification-page__filters"
          onChange={(value) => {
            const next = new URLSearchParams(searchParams)
            if (value) {
              next.set('type', value)
            } else {
              next.delete('type')
            }
            setSearchParams(next, { replace: true })
          }}
        >
          {FILTERS.map((filter) => (
            <CapsuleTabs.Tab
              key={filter.value}
              title={filter.label}
            />
          ))}
        </CapsuleTabs>

        <div className="notification-page__count">
          共 {total} 条通知，当前显示 {notifications.length} 条
        </div>

        {notificationsQuery.isPending ? (
          <LoadingState description="正在加载通知" />
        ) : notificationsQuery.isError ? (
          <ErrorState
            description={notificationsQuery.error.message}
            onRetry={() => notificationsQuery.refetch()}
            title="通知加载失败"
          />
        ) : notifications.length === 0 ? (
          <EmptyState description="新的通知会显示在这里" title="暂无通知" />
        ) : (
          <section
            aria-label="通知列表"
            className="notification-page__list"
          >
            {notifications.map((notification, index) => (
              <article
                className={`notification-page__item notification-page__item--tone-${index % 3}${notification.isRead ? '' : ' is-unread'}`}
                key={notification.id}
                onClick={() => void openNotification(notification)}
              >
                <span className="notification-page__icon">
                  {notification.isRead ? (
                    <CheckOutline aria-hidden />
                  ) : (
                    <BellOutline aria-hidden />
                  )}
                </span>
                <div className="notification-page__body">
                  <header>
                    <strong>{notification.title}</strong>
                    <time>
                      {formatNotificationTime(notification.createdAt)}
                    </time>
                  </header>
                  <p>{notification.content}</p>
                  <footer>
                    <span>
                      {getNotificationTypeLabel(notification.type)}
                    </span>
                    {!notification.isRead ? (
                      <Button
                        fill="outline"
                        onClick={(event) => {
                          event.stopPropagation()
                          void markRead(notification).catch(() => undefined)
                        }}
                        size="mini"
                      >
                        标为已读
                      </Button>
                    ) : null}
                  </footer>
                </div>
              </article>
            ))}
            {notificationsQuery.hasNextPage ? (
              <CampusButton
                block
                fill="outline"
                loading={notificationsQuery.isFetchingNextPage}
                onClick={async () => {
                  await notificationsQuery.fetchNextPage()
                }}
              >
                加载更多
              </CampusButton>
            ) : null}
            <InfiniteScroll
              hasMore={Boolean(notificationsQuery.hasNextPage)}
              loadMore={async () => {
                await notificationsQuery.fetchNextPage()
              }}
            >
              {notificationsQuery.hasNextPage ? '继续上滑加载' : null}
            </InfiniteScroll>
          </section>
        )}

        <div className="notification-page__clear">
          <Button
            aria-label="清空信箱"
            disabled={total === 0}
            loading={clearMutation.isPending}
            onClick={async () => {
              if (
                !(await confirmAction({
                  confirmText: '确认清空',
                  content: '清空后当前信箱内的通知记录将被删除。',
                  title: '清空信箱？',
                }))
              ) {
                return
              }
              try {
                await clearMutation.mutateAsync()
              } catch (error) {
                showToast((error as Error).message, 'error')
              }
            }}
            shape="rounded"
          >
            <DeleteOutline aria-hidden />
          </Button>
        </div>
      </AppPage>
    </AppShell>
  )
}
