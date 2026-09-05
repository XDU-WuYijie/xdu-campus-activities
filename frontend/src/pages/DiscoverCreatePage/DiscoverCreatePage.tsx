import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ImageUploadItem } from 'antd-mobile'
import { Avatar, Button, Radio, TextArea } from 'antd-mobile'
import { RightOutline } from 'antd-mobile-icons'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { queryKeys } from '../../api/queryKeys'
import { AppPage, AppShell, PageHeader } from '../../components/layout'
import {
  CampusButton,
  CampusImage,
  CampusImageUploader,
  CampusPopup,
  EmptyState,
  ErrorState,
  LoadingState,
  showToast,
} from '../../components/ui'
import { formatActivityTime } from '../../features/activities'
import { useAuth } from '../../features/auth'
import {
  createDiscoverPost,
  fetchEligibleActivities,
  uploadDiscoverImage,
  type EligibleActivity,
} from '../../features/discover'
import { safeReturnTo } from '../../router/returnTo'
import './DiscoverCreatePage.css'

function ActivityBrief({
  activity,
}: {
  activity: EligibleActivity
}) {
  return (
    <>
      <CampusImage alt="" fit="cover" src={activity.activityCoverImage} />
      <span>
        <strong>{activity.activityTitle}</strong>
        <small>{activity.activityCategory || '校园活动'}</small>
        <small>
          {formatActivityTime(activity.eventStartTime)}
          {activity.eventEndTime
            ? ` - ${formatActivityTime(activity.eventEndTime)}`
            : ''}
        </small>
      </span>
    </>
  )
}

export function DiscoverCreatePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { currentUser } = useAuth()
  const [searchParams] = useSearchParams()
  const returnTo = safeReturnTo(searchParams.get('returnTo'), '/discover')
  const requestedActivityId = searchParams.get('activityId') ?? ''
  const [content, setContent] = useState('')
  const [images, setImages] = useState<ImageUploadItem[]>([])
  const [activityId, setActivityId] = useState('')
  const [pendingActivityId, setPendingActivityId] = useState('')
  const [selectorVisible, setSelectorVisible] = useState(false)

  const activitiesQuery = useQuery({
    queryFn: fetchEligibleActivities,
    queryKey: [...queryKeys.discover.all, 'eligible-activities'],
  })
  const createMutation = useMutation({
    mutationFn: createDiscoverPost,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.discover.all,
      })
      showToast('动态已发布', 'success')
      navigate(returnTo, { replace: true })
    },
  })
  const activities = useMemo(
    () => activitiesQuery.data ?? [],
    [activitiesQuery.data],
  )
  const requestedActivity = activities.find(
    (activity) => activity.activityId === requestedActivityId,
  )
  const effectiveActivityId =
    activityId || requestedActivity?.activityId || activities[0]?.activityId || ''
  const selectedActivity = activities.find(
    (activity) => activity.activityId === effectiveActivityId,
  )

  const submit = async () => {
    const normalizedContent = content.trim()
    if (!effectiveActivityId) {
      showToast('请选择关联活动', 'error')
      return
    }
    if (!normalizedContent) {
      showToast('请输入动态内容', 'error')
      return
    }
    try {
      await createMutation.mutateAsync({
        activityId: effectiveActivityId,
        content: normalizedContent,
        imageUrls: images.map((image) => image.url),
      })
    } catch (error) {
      showToast((error as Error).message, 'error')
    }
  }

  return (
    <AppShell>
      <AppPage className="discover-create-page">
        <PageHeader
          onBack={() => navigate(returnTo, { replace: true })}
          sticky={false}
          title="发布动态"
        />

        <header className="discover-create-page__hero">
          <h1>分享活动现场</h1>
          <p>发布与活动相关的图文动态。</p>
        </header>

        {activitiesQuery.isPending ? (
          <LoadingState description="正在加载可关联活动" />
        ) : activitiesQuery.error ? (
          <ErrorState
            description={activitiesQuery.error.message}
            onRetry={() => void activitiesQuery.refetch()}
          />
        ) : (
          <>
            <section className="discover-create-page__card">
              <div className="discover-create-page__author">
                <Avatar
                  fallback={(currentUser?.nickName || '校').slice(0, 1)}
                  src={currentUser?.icon || ''}
                />
                <span>
                  <strong>{currentUser?.nickName || '校园同学'}</strong>
                  <small>校园圈动态</small>
                </span>
              </div>

              <h2>关联活动 <em>*</em></h2>
              <label>活动信息</label>
              <button
                className="discover-create-page__chooser"
                onClick={() => {
                  setPendingActivityId(effectiveActivityId)
                  setSelectorVisible(true)
                }}
                type="button"
              >
                {selectedActivity ? (
                  <ActivityBrief activity={selectedActivity} />
                ) : (
                  <span>选择活动</span>
                )}
                <RightOutline aria-hidden />
              </button>

              <h2>动态图片</h2>
              <div className="discover-create-page__images">
                <CampusImageUploader
                  maxCount={9}
                  onChange={setImages}
                  upload={async (file) => ({
                    url: await uploadDiscoverImage(file),
                  })}
                  value={images}
                />
                <span>{images.length}/9</span>
              </div>

              <h2>动态内容 <em>*</em></h2>
              <TextArea
                maxLength={1000}
                onChange={setContent}
                placeholder="写下这场活动里值得分享的内容"
                rows={6}
                showCount
                value={content}
              />
            </section>

            {!activities.length ? (
              <EmptyState description="当前暂无可关联活动" />
            ) : null}
          </>
        )}

        <footer className="discover-create-page__actions">
          <Button
            disabled={createMutation.isPending}
            onClick={() => navigate(returnTo, { replace: true })}
            shape="rounded"
          >
            取消
          </Button>
          <CampusButton
            color="primary"
            disabled={activitiesQuery.isPending || !activities.length}
            loading={createMutation.isPending}
            onClick={() => void submit()}
            shape="rounded"
          >
            发布动态
          </CampusButton>
        </footer>
      </AppPage>

      <CampusPopup
        bodyClassName="discover-create-page__selector"
        onMaskClick={() => setSelectorVisible(false)}
        onClose={() => setSelectorVisible(false)}
        title="选择活动"
        visible={selectorVisible}
      >
        {activities.length ? (
          <>
            <Radio.Group
              onChange={(value) => setPendingActivityId(String(value))}
              value={pendingActivityId || effectiveActivityId}
            >
              {activities.map((activity) => (
                <Radio
                  className="discover-create-page__activity-option"
                  key={activity.activityId}
                  value={activity.activityId}
                >
                  <ActivityBrief activity={activity} />
                </Radio>
              ))}
            </Radio.Group>
            <div className="discover-create-page__selector-actions">
              <Button onClick={() => setSelectorVisible(false)}>取消</Button>
              <CampusButton
                color="primary"
                onClick={() => {
                  const selectedId = pendingActivityId || effectiveActivityId
                  if (!selectedId) {
                    showToast('请选择活动', 'error')
                    return
                  }
                  setActivityId(selectedId)
                  setSelectorVisible(false)
                }}
              >
                选择活动
              </CampusButton>
            </div>
          </>
        ) : (
          <EmptyState description="暂无可选择活动" />
        )}
      </CampusPopup>
    </AppShell>
  )
}
