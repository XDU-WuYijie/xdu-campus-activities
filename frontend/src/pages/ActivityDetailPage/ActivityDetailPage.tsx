import { useQuery } from '@tanstack/react-query'
import { Card, Swiper, Tabs } from 'antd-mobile'
import {
  CalendarOutline,
  EnvironmentOutline,
  LeftOutline,
  PhonebookOutline,
  TeamOutline,
  UserOutline,
} from 'antd-mobile-icons'
import { useState } from 'react'
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { queryKeys } from '../../api/queryKeys'
import { AppPage, AppShell, PageHeader } from '../../components/layout'
import {
  CampusButton,
  CampusImage,
  ErrorState,
  LoadingState,
  StatusTag,
} from '../../components/ui'
import {
  fetchActivityDetail,
  formatActivityTime,
  formatActivityTimeRange,
  getActivityCategory,
  getActivityImages,
  getActivityStatus,
} from '../../features/activities'
import { useAuth } from '../../features/auth'
import './ActivityDetailPage.css'

const PLATFORM_ADMIN_ROLE = 'PLATFORM_ADMIN'

type DetailTab = 'detail' | 'faq' | 'flow'

function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/'
  }

  return value
}

export function ActivityDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { activityId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const { currentUser } = useAuth()
  const [activeTab, setActiveTab] = useState<DetailTab>('detail')
  const returnTo = safeReturnTo(searchParams.get('returnTo'))

  const activityQuery = useQuery({
    enabled: Boolean(activityId),
    queryFn: () => fetchActivityDetail(activityId),
    queryKey: queryKeys.activities.detail(activityId),
  })

  const activity = activityQuery.data
  const isPlatformAdmin =
    currentUser?.roleCodes.includes(PLATFORM_ADMIN_ROLE) ?? false

  const goBack = () => navigate(returnTo, { replace: true })

  if (!activityId) {
    return (
      <AppShell>
        <AppPage>
          <PageHeader onBack={() => navigate('/')} title="活动详情" />
          <ErrorState
            description="活动编号无效"
            fullPage
            onRetry={() => navigate('/')}
          />
        </AppPage>
      </AppShell>
    )
  }

  if (activityQuery.isPending) {
    return (
      <AppShell>
        <AppPage>
          <PageHeader onBack={goBack} title="活动详情" />
          <LoadingState description="正在加载活动详情" fullPage />
        </AppPage>
      </AppShell>
    )
  }

  if (activityQuery.isError || !activity) {
    return (
      <AppShell>
        <AppPage>
          <PageHeader onBack={goBack} title="活动详情" />
          <ErrorState
            description={activityQuery.error?.message}
            fullPage
            onRetry={() => activityQuery.refetch()}
            title="活动详情加载失败"
          />
        </AppPage>
      </AppShell>
    )
  }

  const images = getActivityImages(activity)
  const status = getActivityStatus(activity)
  const tabContent: Record<DetailTab, string> = {
    detail: activity.content || '主办方暂未补充详细说明。',
    faq: activity.faq || '主办方暂未补充常见问题。',
    flow: activity.activityFlow || '主办方暂未补充活动流程。',
  }
  const tabTitles: Record<DetailTab, string> = {
    detail: '活动详情',
    faq: '常见问题',
    flow: '活动流程',
  }

  return (
    <AppShell>
      <AppPage className="activity-detail">
        <div className="activity-detail__topbar">
          <button aria-label="返回" onClick={goBack} type="button">
            <LeftOutline aria-hidden />
          </button>
        </div>
        <section className="activity-detail__hero">
          <div
            aria-label="活动图片"
            className="activity-detail__gallery"
          >
            {images.length > 0 ? (
              <Swiper
                indicator={
                  images.length > 1
                    ? (total, current) => (
                        <span className="activity-detail__indicator">
                          {current + 1} / {total}
                        </span>
                      )
                    : false
                }
                loop={images.length > 1}
              >
                {images.map((image, index) => (
                  <Swiper.Item key={image}>
                    <CampusImage
                      alt={`${activity.title}活动图片 ${index + 1}`}
                      fit="cover"
                      height="100%"
                      preview
                      previewIndex={index}
                      previewSources={images}
                      src={image}
                      width="100%"
                    />
                  </Swiper.Item>
                ))}
              </Swiper>
            ) : (
              <CampusImage
                alt={`${activity.title}活动封面`}
                height="100%"
                width="100%"
              />
            )}
          </div>

          <div className="activity-detail__intro">
            <h1>{activity.title}</h1>
            <p>{activity.summary || '主办方暂未补充活动摘要。'}</p>
            <div aria-label="活动标签" className="activity-detail__tags">
              <StatusTag>{getActivityCategory(activity)}</StatusTag>
              <StatusTag tone={status.tone}>{status.label}</StatusTag>
              <StatusTag>
                {activity.registrationMode === 'FIRST_COME_FIRST_SERVED'
                  ? '先到先得'
                  : '审核制'}
              </StatusTag>
              {activity.tags.map((tag) => (
                <StatusTag key={tag.id}>{tag.name}</StatusTag>
              ))}
            </div>
            {activity.canManage ? (
              <div
                aria-label="主办方操作"
                className="activity-detail__hero-actions"
              >
                <CampusButton
                  fill="outline"
                  onClick={() =>
                    navigate(
                      `/organizer/activities/${activity.id}/check-in`,
                    )
                  }
                >
                  签到管理
                </CampusButton>
                <CampusButton
                  color="primary"
                  onClick={() =>
                    navigate(`/organizer/activities/${activity.id}/edit`, {
                      state: {
                        returnTo: location.pathname + location.search,
                      },
                    })
                  }
                >
                  编辑活动
                </CampusButton>
              </div>
            ) : isPlatformAdmin ? (
              <div
                aria-label="平台管理员操作"
                className="activity-detail__hero-actions"
              >
                <CampusButton
                  fill="outline"
                  onClick={() => navigate('/admin')}
                >
                  返回管理后台
                </CampusButton>
              </div>
            ) : null}
          </div>
        </section>

        <Card className="activity-detail__info">
          <dl>
            <div>
              <CalendarOutline aria-hidden />
              <dt>时间</dt>
              <dd>
                {formatActivityTimeRange(
                  activity.eventStartTime,
                  activity.eventEndTime,
                )}
              </dd>
            </div>
            <div>
              <EnvironmentOutline aria-hidden />
              <dt>地点</dt>
              <dd>{activity.location || '待定'}</dd>
            </div>
            <div>
              <UserOutline aria-hidden />
              <dt>主办方</dt>
              <dd>{activity.organizerName || '待补充'}</dd>
            </div>
            <div>
              <PhonebookOutline aria-hidden />
              <dt>联系方式</dt>
              <dd>{activity.contactInfo || '待补充'}</dd>
            </div>
            <div>
              <TeamOutline aria-hidden />
              <dt>报名人数</dt>
              <dd>
                {activity.registeredCount} / {activity.maxParticipants}
                <small>
                  截止 {formatActivityTime(activity.registrationEndTime)}
                </small>
              </dd>
            </div>
          </dl>
        </Card>

        <section className="activity-detail__content">
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as DetailTab)}
          >
            <Tabs.Tab key="detail" title="活动详情" />
            <Tabs.Tab key="flow" title="活动流程" />
            <Tabs.Tab key="faq" title="常见问题" />
          </Tabs>
          <Card className="activity-detail__tab-panel">
            <h2 id="activity-detail-panel-title">
              {tabTitles[activeTab]}
            </h2>
            <article
              aria-labelledby="activity-detail-panel-title"
              aria-live="polite"
            >
              {tabContent[activeTab]}
            </article>
          </Card>
        </section>

      </AppPage>
    </AppShell>
  )
}
