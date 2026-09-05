import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Picker, SearchBar, Tabs } from 'antd-mobile'
import {
  AddOutline,
  DeleteOutline,
  DownOutline,
} from 'antd-mobile-icons'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { queryKeys } from '../../../../api/queryKeys'
import type { PageResult } from '../../../../api/types'
import {
  CampusImage,
  confirmAction,
  EmptyState,
  promptText,
  showToast,
  StatusTag,
} from '../../../../components/ui'
import { formatActivityTime } from '../../../activities'
import type {
  ManagedActivity,
  RegistrationReview,
  ReviewRecord,
} from '../../model'
import {
  clearReviewHistory,
  deleteReviewRecord,
  reviewRegistration,
} from '../../api'
import { withReturnTo } from '../../../../router/returnTo'
import './OrganizerProfileTabs.css'

const statusOptions = [
  { label: '全部状态', value: 'ALL' },
  { label: '审核通过', value: '2' },
  { label: '审核中', value: '1' },
  { label: '已驳回', value: '3' },
  { label: '已下架', value: '4' },
  { label: '下架审核', value: '5' },
]

const sortOptions = [
  { label: '按创建时间排序', value: 'createTimeDesc' },
  { label: '按活动时间排序', value: 'eventStartAsc' },
  { label: '按报名人数排序', value: 'signupCountDesc' },
  { label: '按更新时间排序', value: 'updateTimeDesc' },
]

function activityStatus(status?: number) {
  if (status === 2) return { label: '审核通过', tone: 'success' as const }
  if (status === 3) return { label: '已驳回', tone: 'danger' as const }
  if (status === 4) return { label: '已下架', tone: 'default' as const }
  if (status === 5) return { label: '下架审核', tone: 'warning' as const }
  return { label: '审核中', tone: 'primary' as const }
}

function reviewType(type: string) {
  const labels: Record<string, string> = {
    REGISTRATION: '报名审核',
    REGISTRATION_CANCEL: '退出审核',
  }
  return labels[type] ?? type ?? '审核'
}

interface OrganizerProfileTabsProps {
  activities: PageResult<ManagedActivity>
  history: PageResult<ReviewRecord>
  loadingMore?: boolean
  onLoadMore: () => void
  reviews: PageResult<RegistrationReview>
}

export function OrganizerProfileTabs({
  activities,
  history,
  loadingMore = false,
  onLoadMore,
  reviews,
}: OrganizerProfileTabsProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [keyword, setKeyword] = useState('')
  const [sort, setSort] = useState('createTimeDesc')
  const [status, setStatus] = useState('ALL')
  const returnTo = `${location.pathname}${location.search}`
  const requestedTab = new URLSearchParams(location.search).get('tab')
  const activeTab = ['created', 'reviews', 'history'].includes(
    requestedTab ?? '',
  )
    ? requestedTab!
    : 'created'
  const setActiveTab = (nextTab: string) => {
    const search = new URLSearchParams(location.search)
    search.set('tab', nextTab)
    navigate({ pathname: '/me', search: search.toString() }, { replace: true })
  }

  const displayedActivities = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase()
    const filtered = activities.items.filter(
      (item) =>
        (status === 'ALL' || String(item.status) === status) &&
        (!normalizedKeyword ||
          item.title.toLocaleLowerCase().includes(normalizedKeyword)),
    )
    return [...filtered].sort((left, right) => {
      if (sort === 'eventStartAsc') {
        return String(left.eventStartTime).localeCompare(
          String(right.eventStartTime),
        )
      }
      if (sort === 'signupCountDesc') {
        return right.registeredCount - left.registeredCount
      }
      if (sort === 'updateTimeDesc') {
        return String(right.updateTime).localeCompare(String(left.updateTime))
      }
      return String(right.createTime).localeCompare(String(left.createTime))
    })
  }, [activities.items, keyword, sort, status])

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.organizer.all })
    await queryClient.invalidateQueries({ queryKey: queryKeys.profile.all })
  }
  const reviewMutation = useMutation({
    mutationFn: ({
      approved,
      item,
      reason,
    }: {
      approved: boolean
      item: RegistrationReview
      reason?: string
    }) => reviewRegistration(item, approved, reason),
    onSuccess: async () => {
      await refresh()
      showToast('审核已处理', 'success')
    },
  })
  const deleteHistoryMutation = useMutation({
    mutationFn: deleteReviewRecord,
    onSuccess: async () => {
      await refresh()
      showToast('记录已删除', 'success')
    },
  })
  const clearHistoryMutation = useMutation({
    mutationFn: () => clearReviewHistory('ACTIVITY_ADMIN'),
    onSuccess: async () => {
      await refresh()
      showToast('审核历史已清空', 'success')
    },
  })

  const handleReview = async (
    item: RegistrationReview,
    approved: boolean,
  ) => {
    const reason = approved
      ? undefined
      : await promptText('驳回申请', '请输入驳回原因')
    if (!approved && !reason) return
    reviewMutation.mutate({ approved, item, reason: reason ?? undefined })
  }

  return (
    <Tabs
      activeKey={activeTab}
      className="profile-page__activity-tabs profile-page__organizer-tabs"
      onChange={setActiveTab}
    >
      <Tabs.Tab key="created" title="我发起的活动">
        <section className="organizer-profile-tabs__created">
          <div className="organizer-profile-tabs__search">
            <SearchBar
              onChange={setKeyword}
              placeholder="搜索我发起的活动"
              value={keyword}
            />
            <Button
              color="primary"
              onClick={() =>
                navigate(
                  withReturnTo('/organizer/activities/new', returnTo),
                )
              }
              size="small"
            >
              <AddOutline />
              发布
            </Button>
          </div>
          <div className="organizer-profile-tabs__filters">
            <Picker
              columns={[sortOptions]}
              onConfirm={(values) => setSort(String(values[0]))}
              popupClassName="organizer-profile-tabs__compact-picker"
              value={[sort]}
            >
              {(items, actions) => (
                <button onClick={actions.open} type="button">
                  {items[0]?.label ?? '按创建时间排序'}
                  <DownOutline />
                </button>
              )}
            </Picker>
            <Picker
              columns={[statusOptions]}
              onConfirm={(values) => setStatus(String(values[0]))}
              popupClassName="organizer-profile-tabs__compact-picker"
              value={[status]}
            >
              {(items, actions) => (
                <button onClick={actions.open} type="button">
                  {items[0]?.label ?? '全部状态'}
                  <DownOutline />
                </button>
              )}
            </Picker>
          </div>
          <p className="organizer-profile-tabs__count">
            共 {activities.total} 条活动，当前显示 {displayedActivities.length} 条
          </p>
          {displayedActivities.length ? (
            displayedActivities.map((item) => {
              const state = activityStatus(item.status)
              return (
                <article
                  className="organizer-profile-tabs__activity"
                  key={item.id}
                >
                  <div>
                    <CampusImage alt="" src={item.coverImage} />
                    <div>
                      <header>
                        <strong>{item.title}</strong>
                        <StatusTag tone={state.tone}>{state.label}</StatusTag>
                      </header>
                      <p><b>分类：</b>{item.displayCategory || item.category || '未分类'}　<b>地点：</b>{item.location || '待定'}</p>
                      <p><b>活动时间：</b>{formatActivityTime(item.eventStartTime)} - {formatActivityTime(item.eventEndTime)}</p>
                      <p><b>报名人数：</b>{item.registeredCount} / {item.maxParticipants}</p>
                      <p><b>{item.status === 3 ? '驳回原因：' : '报名时间：'}</b>{item.status === 3 ? item.reviewRemark || '平台暂未填写驳回原因' : `${formatActivityTime(item.registrationStartTime)} - ${formatActivityTime(item.registrationEndTime)}`}</p>
                    </div>
                  </div>
                  <footer>
                    <Button onClick={() => navigate(withReturnTo(`/organizer/activities/${item.id}/check-in`, returnTo))} size="mini">签到管理</Button>
                    <Button onClick={() => navigate(withReturnTo(`/organizer/activities/${item.id}/edit`, returnTo))} size="mini">编辑</Button>
                    <Button onClick={() => navigate(withReturnTo(`/activities/${item.id}`, returnTo))} size="mini">详情</Button>
                  </footer>
                </article>
              )
            })
          ) : (
            <EmptyState
              description={
                activities.items.length
                  ? '当前状态下暂无活动'
                  : '你还没有发起任何活动'
              }
            />
          )}
          {activities.items.length < activities.total ? (
            <Button
              block
              fill="outline"
              loading={loadingMore}
              onClick={onLoadMore}
              size="small"
            >
              加载更多
            </Button>
          ) : null}
        </section>
      </Tabs.Tab>
      <Tabs.Tab
        key="reviews"
        title={
          <span className="profile-page__organizer-tab-title">
            待审核请求
            {Number(reviews.total) > 0 ? (
              <b>{Number(reviews.total) > 99 ? '99+' : reviews.total}</b>
            ) : null}
          </span>
        }
      >
        <section className="organizer-profile-tabs__list">
          <p className="organizer-profile-tabs__count">
            共 {reviews.total} 条待审核请求，当前显示 {reviews.items.length} 条
          </p>
          {reviews.items.length ? reviews.items.map((item) => {
            const isCancel = Number(item.status) === 4
            return (
              <article className="organizer-profile-tabs__review" key={item.id}>
                <h2>{item.activityTitle || '活动报名请求'}</h2>
                <p>申请用户：{item.userNickName || `用户${item.userId}`}</p>
                <p>请求类型：{isCancel ? '退出活动' : '报名活动'}</p>
                <p>提交时间：{formatActivityTime(item.createTime)}</p>
                <footer>
                  <Button color="success" onClick={() => void handleReview(item, true)} size="mini">{isCancel ? '同意退出' : '通过报名'}</Button>
                  <Button color="danger" fill="outline" onClick={() => void handleReview(item, false)} size="mini">{isCancel ? '拒绝退出' : '驳回报名'}</Button>
                  <Button fill="outline" onClick={() => navigate(withReturnTo(`/activities/${item.activityId}`, returnTo))} size="mini">查看活动</Button>
                </footer>
              </article>
            )
          }) : <EmptyState description="暂无待审核请求" />}
        </section>
      </Tabs.Tab>
      <Tabs.Tab key="history" title="审核历史">
        <section className="organizer-profile-tabs__list">
          <header className="organizer-profile-tabs__history-head">
            <h2>审核历史</h2>
            <Button
              aria-label="清空审核历史"
              color="danger"
              fill="outline"
              onClick={async () => {
                if (
                  await confirmAction({
                    content: '删除全部审核历史不会影响业务结果。',
                    title: '清空审核历史',
                  })
                ) {
                  clearHistoryMutation.mutate()
                }
              }}
            >
              <DeleteOutline />
            </Button>
          </header>
          <p className="organizer-profile-tabs__count">
            共 {history.total} 条审核历史，当前显示 {history.items.length} 条
          </p>
          {history.items.length ? history.items.map((item) => (
            <article className="organizer-profile-tabs__review" key={item.id}>
              <h2>{item.bizTitle}</h2>
              <p>审核对象：{item.targetName || `用户${item.targetUserId ?? ''}`}</p>
              <p>审核类型：{reviewType(item.bizType)}</p>
              <p>审核结果：{item.action === 'APPROVED' ? '通过' : '驳回'}</p>
              {item.remark ? <p>备注：{item.remark}</p> : null}
              <p>审核时间：{formatActivityTime(item.createdAt)}</p>
              <footer>
                <Button color="danger" fill="outline" onClick={() => deleteHistoryMutation.mutate(item.id)} size="mini">删除</Button>
              </footer>
            </article>
          )) : <EmptyState description="暂无审核历史" />}
        </section>
      </Tabs.Tab>
    </Tabs>
  )
}
