import { useQuery } from '@tanstack/react-query'
import { Button } from 'antd-mobile'
import {
  AddCircleOutline,
  AppOutline,
  HistogramOutline,
  MessageOutline,
  UserOutline,
} from 'antd-mobile-icons'
import { useLocation, useNavigate } from 'react-router-dom'
import { queryKeys } from '../../api/queryKeys'
import { AppPage, AppShell, BottomNav, PageHeader } from '../../components/layout'
import { EmptyState, ErrorState, LoadingState, StatusTag } from '../../components/ui'
import { formatActivityTime } from '../../features/activities'
import { useNotification } from '../../features/notification'
import {
  fetchCheckInDashboard,
  fetchManagedActivities,
  fetchRegistrationReviews,
} from '../../features/organizer'
import { withReturnTo } from '../../router/returnTo'
import './OrganizerDashboardPage.css'

export function OrganizerDashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { unreadCount } = useNotification()
  const dashboardQuery = useQuery({
    queryFn: async () => {
      const [activityPage, pending] = await Promise.all([
        fetchManagedActivities({ current: 1, pageSize: 6 }),
        fetchRegistrationReviews(1, 1),
      ])
      const rows = await Promise.all(
        activityPage.items.map(async (activity) => {
          try {
            return { activity, dashboard: await fetchCheckInDashboard(activity.id) }
          } catch {
            return { activity, dashboard: null }
          }
        }),
      )
      return { activityTotal: activityPage.total, pendingTotal: pending.total, rows }
    },
    queryKey: queryKeys.organizer.dashboard(),
  })

  const data = dashboardQuery.data
  const registeredCount = data?.rows.reduce(
    (sum, row) => sum + (row.dashboard?.stats.registeredCount ?? row.activity.registeredCount),
    0,
  ) ?? 0
  const checkedInCount = data?.rows.reduce(
    (sum, row) => sum + (row.dashboard?.stats.checkedInCount ?? 0),
    0,
  ) ?? 0
  const returnTo = `${location.pathname}${location.search}`
  const navItems = [
    { icon: <AppOutline />, key: 'home', label: '首页' },
    { icon: <HistogramOutline />, key: 'dashboard', label: '数据看板' },
    { icon: <AddCircleOutline />, key: 'publish', label: '发布' },
    { badge: unreadCount || undefined, icon: <MessageOutline />, key: 'messages', label: '消息' },
    { icon: <UserOutline />, key: 'me', label: '我的' },
  ]

  return (
    <AppShell>
      <AppPage className="organizer-dashboard" hasBottomNav>
        <PageHeader onBack={() => navigate('/')} title="主办方数据看板" />
        {dashboardQuery.isPending ? <LoadingState description="正在汇总活动数据" /> : dashboardQuery.error ? <ErrorState description={dashboardQuery.error.message} onRetry={() => void dashboardQuery.refetch()} title="看板加载失败" /> : (
          <>
            <section className="organizer-dashboard__hero">
              <h1>活动运营概览</h1>
              <p>集中查看近期活动报名、签到和待审核情况。</p>
              <div>
                <span><strong>{data?.activityTotal ?? 0}</strong>发起活动</span>
                <span><strong>{registeredCount}</strong>近期报名</span>
                <span><strong>{checkedInCount}</strong>近期签到</span>
                <span><strong>{data?.pendingTotal ?? 0}</strong>待审核</span>
              </div>
            </section>
            <section className="organizer-dashboard__quick">
              <Button onClick={() => navigate('/me?tab=created')}>我发起的活动</Button>
              <Button onClick={() => navigate('/me?tab=reviews')}>待审核请求</Button>
            </section>
            <section className="organizer-dashboard__section">
              <h2>最近活动数据</h2>
              {data?.rows.length ? data.rows.map(({ activity, dashboard }) => (
                <article key={activity.id}>
                  <header><strong>{activity.title}</strong><StatusTag tone={activity.status === 2 ? 'success' : 'warning'}>{activity.status === 2 ? '审核通过' : '审核中'}</StatusTag></header>
                  <p>活动时间：{formatActivityTime(activity.eventStartTime)} - {formatActivityTime(activity.eventEndTime)}</p>
                  <p>活动地点：{activity.location || '待定'} · {activity.displayCategory || activity.category || '未分类'}</p>
                  <div><span>报名人数<strong>{dashboard?.stats.registeredCount ?? activity.registeredCount}</strong></span><span>已签到人数<strong>{dashboard?.stats.checkedInCount ?? 0}</strong></span></div>
                  <footer>
                    <Button color="primary" onClick={() => navigate(withReturnTo(`/organizer/activities/${activity.id}/check-in`, returnTo))} size="small">签到管理</Button>
                    <Button onClick={() => navigate(withReturnTo(`/activities/${activity.id}`, returnTo))} size="small">活动详情</Button>
                  </footer>
                </article>
              )) : <EmptyState description="发布活动后可查看运营数据" title="暂无活动数据" />}
            </section>
          </>
        )}
        <BottomNav activeKey="dashboard" items={navItems} onChange={(key) => {
          const routes: Record<string, string> = {
            dashboard: '/organizer/dashboard',
            home: '/',
            me: '/me',
            messages: withReturnTo('/notifications', returnTo),
            publish: withReturnTo('/organizer/activities/new', returnTo),
          }
          navigate(routes[key])
        }} />
      </AppPage>
    </AppShell>
  )
}
