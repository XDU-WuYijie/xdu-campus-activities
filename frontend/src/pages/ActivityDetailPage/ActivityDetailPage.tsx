import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, Swiper, Tabs } from 'antd-mobile'
import {
  CalendarOutline,
  EnvironmentOutline,
  LeftOutline,
  PhonebookOutline,
  StarFill,
  StarOutline,
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
  CampusDialog,
  CampusImage,
  confirmAction,
  ErrorState,
  LoadingState,
  showToast,
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
import {
  cancelRegistration,
  fetchRegistrationStatus,
  registerActivity,
  type RegistrationStatusDetail,
} from '../../features/registration'
import {
  favoriteActivity,
  unfavoriteActivity,
} from '../../features/favorites'
import './ActivityDetailPage.css'

const PLATFORM_ADMIN_ROLE = 'PLATFORM_ADMIN'
const ACTIVITY_CREATE_PERMISSION = 'activity:create'

type DetailTab = 'detail' | 'faq' | 'flow'

function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/'
  }

  return value
}

export function ActivityDetailPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const { activityId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const { currentUser } = useAuth()
  const [activeTab, setActiveTab] = useState<DetailTab>('detail')
  const [renderedAt] = useState(Date.now)
  const [voucherVisible, setVoucherVisible] = useState(false)
  const returnTo = safeReturnTo(searchParams.get('returnTo'))

  const activityQuery = useQuery({
    enabled: Boolean(activityId),
    queryFn: () => fetchActivityDetail(activityId),
    queryKey: queryKeys.activities.detail(activityId),
  })

  const activity = activityQuery.data
  const isPlatformAdmin =
    currentUser?.roleCodes.includes(PLATFORM_ADMIN_ROLE) ?? false
  const isOrganizerUser =
    currentUser?.permissions.includes(ACTIVITY_CREATE_PERMISSION) ?? false

  const registrationQuery = useQuery({
    enabled: Boolean(
      activityId &&
        activity &&
        !activity.canManage &&
        !isPlatformAdmin &&
        !isOrganizerUser,
    ),
    queryFn: () => fetchRegistrationStatus(activityId),
    queryKey: queryKeys.registration.status(activityId),
  })

  const refreshActivityState = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.activities.detail(activityId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.activities.lists(),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.registration.all,
      }),
    ])
  }

  const registerMutation = useMutation({
    mutationFn: () => registerActivity(activityId),
    onSuccess: async (status) => {
      queryClient.setQueryData(
        queryKeys.registration.status(activityId),
        status,
      )
      showToast(status.message || '报名申请已提交', 'success')
      await refreshActivityState()
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelRegistration(activityId),
    onSuccess: async () => {
      showToast(
        activity?.registrationMode === 'FIRST_COME_FIRST_SERVED'
          ? '已退出活动'
          : '退出申请已提交',
        'success',
      )
      await refreshActivityState()
    },
  })

  const favoriteMutation = useMutation({
    mutationFn: (favorited: boolean) =>
      favorited
        ? unfavoriteActivity(activityId)
        : favoriteActivity(activityId),
    onSuccess: async (_, wasFavorited) => {
      showToast(wasFavorited ? '已取消收藏' : '收藏成功', 'success')
      queryClient.setQueryData(
        queryKeys.activities.detail(activityId),
        (current: typeof activity) =>
          current ? { ...current, favorited: !wasFavorited } : current,
      )
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.favorites.all,
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.activities.lists(),
        }),
      ])
    },
  })

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
  const registration: RegistrationStatusDetail = registrationQuery.data ?? {
    activityId: activity.id,
    failReason: activity.registrationFailReason,
    message: activity.registrationMessage ?? '',
    requestId: activity.registrationRequestId,
    status: activity.registrationStatus ?? (
      activity.registered ? 'SUCCESS' : 'NOT_REGISTERED'
    ),
    voucherCheckedInTime: activity.voucherCheckedInTime,
    voucherDisplayCode: activity.voucherDisplayCode,
    voucherId: activity.voucherId,
    voucherIssuedTime: activity.voucherIssuedTime,
    voucherStatus: activity.voucherStatus,
  }
  const registrationPending =
    registration.status === 'PENDING_CONFIRM' ||
    registration.status === 'PENDING_REVIEW'
  const registered =
    registration.status === 'SUCCESS' ||
    registration.status === 'CANCEL_PENDING'
  const canCancel =
    registration.status === 'SUCCESS' &&
    registration.voucherStatus !== 'CHECKED_IN' &&
    (!activity.eventStartTime ||
      new Date(activity.eventStartTime.replace(/-/g, '/')).getTime() >
        renderedAt)
  const registerButtonText =
    registration.status === 'PENDING_CONFIRM'
      ? '报名确认中'
      : registration.status === 'PENDING_REVIEW'
        ? '报名待审核'
        : registration.status === 'FAILED'
          ? '重新报名'
          : registration.status === 'CANCELED'
            ? '再次报名'
            : '立即报名'
  const registrationStatusLabel =
    registration.status === 'SUCCESS'
      ? '报名成功'
      : registration.status === 'CANCEL_PENDING'
        ? '退出申请待审核'
        : registration.status === 'CANCELED'
          ? '已退出'
          : registerButtonText
  const registrationDescription =
    registered
      ? registration.voucherStatus === 'CHECKED_IN'
        ? '签到凭证已完成现场核销。'
        : '活动现场请向工作人员出示签到凭证号。'
      : registration.message ||
        (activity.registrationMode === 'FIRST_COME_FIRST_SERVED'
          ? '提交后系统将异步确认名额，成功后自动生成签到凭证。'
          : '提交后等待主办方审核，通过后生成签到凭证。')
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

        {!activity.canManage && !isPlatformAdmin ? (
          <Card className="activity-detail__registration">
            <div className="activity-detail__section-heading">
              <div>
                <h2>
                  {registered ? '我的签到凭证' : '报名活动'}
                </h2>
                <p>{registrationDescription}</p>
              </div>
              {registration.status !== 'NOT_REGISTERED' ? (
                <StatusTag
                  tone={
                    registration.status === 'SUCCESS'
                      ? 'success'
                      : registration.status === 'FAILED'
                        ? 'danger'
                        : 'warning'
                  }
                >
                  {registrationStatusLabel}
                </StatusTag>
              ) : null}
            </div>
            {isOrganizerUser ? (
              <p className="activity-detail__notice">
                主办方账号仅用于发起和管理活动，不能报名参加活动。
              </p>
            ) : registered ? (
              <div className="activity-detail__registration-actions">
                <CampusButton
                  color="primary"
                  disabled={!registration.voucherDisplayCode}
                  onClick={() => setVoucherVisible(true)}
                >
                  {registration.voucherStatus === 'CHECKED_IN'
                    ? '查看签到记录'
                    : '查看签到凭证'}
                </CampusButton>
                {canCancel ? (
                  <CampusButton
                    color="danger"
                    fill="outline"
                    loading={cancelMutation.isPending}
                    onClick={async () => {
                      const direct =
                        activity.registrationMode ===
                        'FIRST_COME_FIRST_SERVED'
                      const confirmed = await confirmAction({
                        content: direct
                          ? '退出后将立即释放名额，签到凭证同时失效。'
                          : '退出申请需主办方审核，通过后释放名额并使签到凭证失效。',
                        confirmText: direct ? '确认退出' : '提交申请',
                        title: '退出活动',
                      })
                      if (confirmed) {
                        try {
                          await cancelMutation.mutateAsync()
                        } catch (error) {
                          showToast((error as Error).message, 'error')
                        }
                      }
                    }}
                  >
                    退出活动
                  </CampusButton>
                ) : null}
              </div>
            ) : (
              <div className="activity-detail__registration-actions">
                <CampusButton
                  color="primary"
                  disabled={!activity.registrationOpen || registrationPending}
                  loading={registerMutation.isPending}
                  onClick={async () => {
                    const confirmed = await confirmAction({
                      content:
                        activity.registrationMode ===
                        'FIRST_COME_FIRST_SERVED'
                          ? '提交后系统将按名额顺序异步确认报名结果。'
                          : '提交后需要等待主办方审核。',
                      confirmText: '确认报名',
                      title: '报名活动',
                    })
                    if (confirmed) {
                      try {
                        await registerMutation.mutateAsync()
                      } catch (error) {
                        showToast((error as Error).message, 'error')
                      }
                    }
                  }}
                >
                  {registerButtonText}
                </CampusButton>
                <CampusButton
                  fill="outline"
                  loading={registrationQuery.isFetching}
                  onClick={() => {
                    void registrationQuery.refetch()
                  }}
                >
                  刷新状态
                </CampusButton>
              </div>
            )}
            {registration.status === 'FAILED' &&
            registration.failReason ? (
              <p className="activity-detail__failure">
                {registration.failReason}
              </p>
            ) : null}
          </Card>
        ) : null}

        {!activity.canManage && !isPlatformAdmin && !isOrganizerUser ? (
          <div className="activity-detail__bottom-actions">
            <button
              aria-label={activity.favorited ? '取消收藏' : '收藏活动'}
              className={
                activity.favorited
                  ? 'activity-detail__favorite activity-detail__favorite--active'
                  : 'activity-detail__favorite'
              }
              disabled={favoriteMutation.isPending}
              onClick={async () => {
                try {
                  await favoriteMutation.mutateAsync(activity.favorited)
                } catch (error) {
                  showToast((error as Error).message, 'error')
                }
              }}
              type="button"
            >
              {activity.favorited ? (
                <StarFill aria-hidden />
              ) : (
                <StarOutline aria-hidden />
              )}
              <span>{activity.favorited ? '已收藏' : '收藏'}</span>
            </button>
            {registered ? (
              <CampusButton
                color="primary"
                onClick={() => navigate('/me/registrations')}
              >
                查看我的报名
              </CampusButton>
            ) : (
              <CampusButton
                color="primary"
                disabled={!activity.registrationOpen || registrationPending}
                loading={registerMutation.isPending}
                onClick={async () => {
                  try {
                    await registerMutation.mutateAsync()
                  } catch (error) {
                    showToast((error as Error).message, 'error')
                  }
                }}
              >
                {registerButtonText}
              </CampusButton>
            )}
          </div>
        ) : null}

        <CampusDialog
          actions={[
            {
              key: 'close',
              onClick: () => setVoucherVisible(false),
              text: '关闭',
            },
          ]}
          content={
            <div className="activity-detail__voucher">
              <StatusTag
                tone={
                  registration.voucherStatus === 'CHECKED_IN'
                    ? 'success'
                    : 'warning'
                }
              >
                {registration.voucherStatus === 'CHECKED_IN'
                  ? '已签到'
                  : '待签到'}
              </StatusTag>
              <strong>{registration.voucherDisplayCode || '凭证生成中'}</strong>
              <p>活动现场请向工作人员出示此签到凭证号。</p>
              {registration.voucherCheckedInTime ? (
                <small>
                  签到时间：
                  {formatActivityTime(registration.voucherCheckedInTime)}
                </small>
              ) : null}
            </div>
          }
          destroyOnClose
          onClose={() => setVoucherVisible(false)}
          title="我的签到凭证"
          visible={voucherVisible}
        />
      </AppPage>
    </AppShell>
  )
}
