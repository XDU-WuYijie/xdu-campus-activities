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
  Collapse,
  InfiniteScroll,
  SearchBar,
  Tabs,
} from 'antd-mobile'
import {
  CheckOutline,
  CheckShieldOutline,
  CloseOutline,
  DeleteOutline,
  EyeOutline,
  SearchOutline,
  UserOutline,
} from 'antd-mobile-icons'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { queryKeys } from '../../api/queryKeys'
import type { PageResult } from '../../api/types'
import { AppPage, AppShell, PageHeader } from '../../components/layout'
import {
  CampusImage,
  CampusPopup,
  confirmAction,
  EmptyState,
  ErrorState,
  LoadingState,
  promptText,
  showToast,
  StatusTag,
} from '../../components/ui'
import { formatActivityTime } from '../../features/activities'
import {
  fetchAiReview,
  fetchOrganizerApplications,
  fetchPendingActivities,
  fetchPublishedActivities,
  offlineActivity,
  reviewActivity,
  reviewOrganizerApplication,
  type AdminActivity,
  type AiReviewReport,
} from '../../features/admin'
import { useAuth } from '../../features/auth'
import {
  clearReviewHistory,
  deleteReviewRecord,
  fetchReviewHistory,
} from '../../features/organizer'
import { withReturnTo } from '../../router/returnTo'
import './AdminPage.css'

const PAGE_SIZE = 10

function aiTaskStatusLabel(status?: string) {
  if (status === 'PENDING' || status === 'RUNNING') return '报告生成中'
  if (status === 'SUCCESS') return '报告已生成'
  if (status === 'FAILED') return '生成失败'
  if (status === 'TIMEOUT') return '生成超时'
  return '暂无报告'
}

function reviewBizTypeLabel(type: string) {
  const labels: Record<string, string> = {
    ACTIVITY: '活动发布审核',
    ACTIVITY_OFFLINE: '活动强制下架',
    ACTIVITY_OFFLINE_APPLY: '活动下架申请',
    ORGANIZER_APPLICATION: '主办方申请审核',
  }
  return labels[type] ?? '平台审核'
}

function AiReport({ report }: { report: AiReviewReport }) {
  const suggestion = report.suggestion === 'PASS' ? '建议通过' : report.suggestion === 'REJECT' ? '建议驳回' : '建议人工复核'
  const risk = report.riskLevel === 'LOW' ? '低' : report.riskLevel === 'MEDIUM' ? '中' : report.riskLevel === 'HIGH' ? '高' : '未知'
  const suggestionTone =
    report.suggestion === 'PASS'
      ? 'success'
      : report.suggestion === 'REJECT'
        ? 'danger'
        : 'warning'
  const similar = report.similarActivities.map((item) =>
    [item.title || '未命名活动', item.displayCategory || item.category || '未分类', item.organizerName || '待补充', item.location || '待补充'].join(' ｜ '),
  )
  return (
    <div className="admin-page__ai-report">
      <div className={`admin-page__ai-status admin-page__ai-status--${report.taskStatus?.toLowerCase() ?? 'unknown'}`}>
        <span />
        {aiTaskStatusLabel(report.taskStatus)}
      </div>
      <div className="admin-page__ai-summary">
        <div>
          <small>AI 审核结论</small>
          <StatusTag tone={suggestionTone}>{suggestion}</StatusTag>
        </div>
        <div>
          <small>风险等级</small>
          <strong>{risk}</strong>
        </div>
        <div>
          <small>综合评分</small>
          <strong>{report.score ?? '--'}</strong>
        </div>
      </div>
      <Collapse defaultActiveKey={['problems', 'missing', 'similar']}>
        <Collapse.Panel key="problems" title="问题列表">{report.problems.length ? <ul>{report.problems.map((item) => <li key={item}>{item}</li>)}</ul> : '暂无'}</Collapse.Panel>
        <Collapse.Panel key="missing" title="缺失字段">{report.missingFields.length ? <ul>{report.missingFields.map((item) => <li key={item}>{item}</li>)}</ul> : '暂无'}</Collapse.Panel>
        <Collapse.Panel key="similar" title="相似活动">{similar.length ? <ul>{similar.map((item) => <li key={item}>{item}</li>)}</ul> : '暂无'}</Collapse.Panel>
        <Collapse.Panel key="analysis" title="相似分析">{report.similarityAnalysis || '暂无'}</Collapse.Panel>
        <Collapse.Panel key="comment" title="审核意见">{report.reviewComment || '暂无'}</Collapse.Panel>
        <Collapse.Panel key="meta" title="系统信息">模型：{report.modelName || '未返回'}<br />Prompt 版本：{report.promptVersion || '未返回'}{report.errorMessage ? <p className="is-danger">异常信息：{report.errorMessage}</p> : null}</Collapse.Panel>
      </Collapse>
    </div>
  )
}

function ActivityAdminCard({
  item,
  onAi,
  onNegative,
  onPositive,
  onView,
  published,
}: {
  item: AdminActivity
  onAi?: () => void
  onNegative: () => void
  onPositive?: () => void
  onView: () => void
  published?: boolean
}) {
  const isOfflineReview = item.status === 5
  return (
    <article className="admin-page__activity">
      <div className="admin-page__activity-main">
        <CampusImage alt={`${item.title}封面`} src={item.coverImage} />
        <div className="admin-page__activity-content">
          <h2>{item.title}</h2>
          {!published ? <p>审核类型：{isOfflineReview ? '下架申请审核' : '发布审核'}</p> : null}
          <p>主办方：{item.organizerName || '未填写'}</p>
          <p>分类：{item.displayCategory || item.category || '未分类'}</p>
          <p>地点：{item.location || '待定'}</p>
          {published ? <p>报名人数：{item.registeredCount} / {item.maxParticipants}</p> : null}
          <p>活动时间：{formatActivityTime(item.eventStartTime)} - {formatActivityTime(item.eventEndTime)}</p>
          {!published ? <p>报名时间：{formatActivityTime(item.registrationStartTime)} - {formatActivityTime(item.registrationEndTime)}</p> : null}
          <footer>
            {onPositive ? <Button className="admin-page__action admin-page__action--approve" fill="outline" onClick={onPositive} size="mini"><CheckOutline />{isOfflineReview ? '同意下架' : '通过'}</Button> : null}
            <Button className="admin-page__action admin-page__action--reject" fill="outline" onClick={onNegative} size="mini"><CloseOutline />{published ? '强制下架' : isOfflineReview ? '拒绝下架' : '驳回'}</Button>
            {onAi ? <Button className="admin-page__action admin-page__action--ai" fill="outline" onClick={onAi} size="mini"><CheckShieldOutline />AI审核建议</Button> : null}
            <Button className="admin-page__action admin-page__action--view" fill="outline" onClick={onView} size="mini"><EyeOutline />查看详情</Button>
          </footer>
        </div>
      </div>
    </article>
  )
}

export function AdminPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { currentUser, logout } = useAuth()
  const initialTab = new URLSearchParams(location.search).get('tab')
  const [tab, setTab] = useState(['activities', 'published', 'organizers', 'history'].includes(initialTab ?? '') ? initialTab! : 'activities')
  const [pendingInput, setPendingInput] = useState('')
  const [pendingKeyword, setPendingKeyword] = useState('')
  const [publishedInput, setPublishedInput] = useState('')
  const [publishedKeyword, setPublishedKeyword] = useState('')
  const [aiActivity, setAiActivity] = useState<AdminActivity | null>(null)

  const pendingQuery = useQuery({
    queryFn: () => fetchPendingActivities(pendingKeyword),
    queryKey: queryKeys.admin.activityReviewQueue({ keyword: pendingKeyword }),
  })
  const publishedQuery = useInfiniteQuery<
    PageResult<AdminActivity>,
    Error,
    InfiniteData<PageResult<AdminActivity>>,
    readonly unknown[],
    number
  >({
    getNextPageParam: (lastPage, pages) =>
      pages.flatMap((page) => page.items).length < lastPage.total ? pages.length + 1 : undefined,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchPublishedActivities({ current: pageParam, keyword: publishedKeyword, pageSize: PAGE_SIZE }),
    queryKey: queryKeys.admin.publishedActivities({ keyword: publishedKeyword }),
  })
  const applicationsQuery = useQuery({
    queryFn: fetchOrganizerApplications,
    queryKey: queryKeys.admin.organizerApplications({ status: 'PENDING' }),
  })
  const historyQuery = useQuery({
    queryFn: () => fetchReviewHistory('PLATFORM_ADMIN', 1, 50),
    queryKey: queryKeys.admin.reviewHistory(),
  })
  const aiQuery = useQuery({
    enabled: Boolean(aiActivity),
    queryFn: () => fetchAiReview(aiActivity!.id),
    queryKey: queryKeys.admin.activityAiReview(aiActivity?.id ?? ''),
  })

  const refreshAdmin = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.admin.all })
  }
  const activityReviewMutation = useMutation({
    mutationFn: ({ approved, id, reason }: { approved: boolean; id: string; reason?: string }) => reviewActivity(id, approved, reason),
    onSuccess: async () => { await refreshAdmin(); showToast('活动审核已处理', 'success') },
  })
  const organizerReviewMutation = useMutation({
    mutationFn: ({ approved, id, reason }: { approved: boolean; id: string; reason?: string }) => reviewOrganizerApplication(id, approved, reason),
    onSuccess: async () => { await refreshAdmin(); showToast('主办方申请已处理', 'success') },
  })
  const offlineMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => offlineActivity(id, reason),
    onSuccess: async () => { await refreshAdmin(); showToast('活动已下架', 'success') },
  })
  const deleteHistoryMutation = useMutation({
    mutationFn: deleteReviewRecord,
    onSuccess: refreshAdmin,
  })
  const clearHistoryMutation = useMutation({
    mutationFn: () => clearReviewHistory('PLATFORM_ADMIN'),
    onSuccess: async () => { await refreshAdmin(); showToast('审核历史已清空', 'success') },
  })

  const setCurrentTab = (next: string) => {
    setTab(next)
    const search = new URLSearchParams(location.search)
    search.set('tab', next)
    navigate({ search: search.toString() }, { replace: true })
  }
  const returnTo = `${location.pathname}${location.search}`
  const view = (id: string) => navigate(withReturnTo(`/activities/${id}`, returnTo))
  const rejectActivity = async (item: AdminActivity) => {
    const reason = await promptText(item.status === 5 ? '拒绝下架申请' : '驳回活动申请', '请输入具体原因')
    if (reason) activityReviewMutation.mutate({ approved: false, id: item.id, reason })
  }
  const published = publishedQuery.data?.pages.flatMap((page) => page.items) ?? []
  const publishedTotal = publishedQuery.data?.pages[0]?.total ?? 0

  return (
    <AppShell>
      <AppPage className="admin-page">
        <PageHeader onBack={() => navigate('/')} right={<Button className="admin-page__logout" color="danger" fill="outline" onClick={() => void logout()} size="mini">退出登录</Button>} title="平台管理后台" />
        <section className="admin-page__identity">
          <div className="admin-page__identity-main">
            <Avatar fallback={<UserOutline />} src={currentUser?.icon ?? ''} />
            <div>
              <h1>{currentUser?.nickName || '平台管理员'} <small><CheckShieldOutline />管理员认证</small></h1>
              <p>审核活动发布，审核普通用户成为活动主办方。</p>
            </div>
          </div>
        </section>
        <Tabs activeKey={tab} className="admin-page__tabs" onChange={setCurrentTab}>
          <Tabs.Tab key="activities" title={<span>活动审核{pendingQuery.data?.length ? <b>{pendingQuery.data.length}</b> : null}</span>} />
          <Tabs.Tab key="published" title="已发布活动" />
          <Tabs.Tab key="organizers" title={<span>主办方申请{applicationsQuery.data?.length ? <b>{applicationsQuery.data.length}</b> : null}</span>} />
          <Tabs.Tab key="history" title="审核历史" />
        </Tabs>

        {tab === 'activities' ? <div className="admin-page__content">
          <div className="admin-page__search"><SearchBar onChange={setPendingInput} onSearch={() => setPendingKeyword(pendingInput.trim())} placeholder="搜索待审核活动" value={pendingInput} /><Button aria-label="搜索待审核活动" color="primary" fill="outline" onClick={() => setPendingKeyword(pendingInput.trim())} size="small"><SearchOutline />搜索</Button></div>
          <p className="admin-page__count">共 {pendingQuery.data?.length ?? 0} 条待审核活动</p>
          {pendingQuery.isPending ? <LoadingState description="正在加载待审核活动" /> : pendingQuery.error ? <ErrorState description={pendingQuery.error.message} onRetry={() => void pendingQuery.refetch()} title="加载失败" /> : pendingQuery.data?.length ? pendingQuery.data.map((item) => <ActivityAdminCard item={item} key={item.id} onAi={() => setAiActivity(item)} onNegative={() => void rejectActivity(item)} onPositive={() => activityReviewMutation.mutate({ approved: true, id: item.id })} onView={() => view(item.id)} />) : <EmptyState description="当前没有活动需要处理" title="暂无待审核活动" />}
        </div> : null}

        {tab === 'published' ? <div className="admin-page__content">
          <div className="admin-page__search"><SearchBar onChange={setPublishedInput} onSearch={() => setPublishedKeyword(publishedInput.trim())} placeholder="搜索已发布活动" value={publishedInput} /><Button aria-label="搜索已发布活动" color="primary" fill="outline" onClick={() => setPublishedKeyword(publishedInput.trim())} size="small"><SearchOutline />搜索</Button></div>
          <p className="admin-page__count">共 {publishedTotal} 条已发布活动，当前显示 {published.length} 条</p>
          {publishedQuery.isPending ? <LoadingState description="正在加载已发布活动" /> : publishedQuery.error ? <ErrorState description={publishedQuery.error.message} onRetry={() => void publishedQuery.refetch()} title="加载失败" /> : published.length ? published.map((item) => <ActivityAdminCard item={item} key={item.id} onNegative={async () => {
            const reason = await promptText('强制下架活动', '请输入强制下架原因')
            if (reason) offlineMutation.mutate({ id: item.id, reason })
          }} onView={() => view(item.id)} published />) : <EmptyState description="暂无符合条件的已发布活动" title="暂无活动" />}
          <InfiniteScroll hasMore={Boolean(publishedQuery.hasNextPage)} loadMore={async () => { await publishedQuery.fetchNextPage() }} />
        </div> : null}

        {tab === 'organizers' ? <div className="admin-page__content">
          <p className="admin-page__count">共 {applicationsQuery.data?.length ?? 0} 条主办方申请</p>
          {applicationsQuery.isPending ? <LoadingState description="正在加载主办方申请" /> : applicationsQuery.error ? <ErrorState description={applicationsQuery.error.message} onRetry={() => void applicationsQuery.refetch()} title="加载失败" /> : applicationsQuery.data?.length ? applicationsQuery.data.map((item) => <article className="admin-page__review" key={item.id}>
            <h2>{item.applicantName || item.applicantUsername || `用户 ${item.userId}`}</h2>
            <p>登录账号：{item.applicantUsername || '未设置'}</p><p>申请组织：{item.orgName}</p><p>申请理由：{item.reason || '未填写'}</p><p>申请时间：{formatActivityTime(item.createTime)}</p>
            <footer><Button className="admin-page__action admin-page__action--approve" fill="outline" onClick={() => organizerReviewMutation.mutate({ approved: true, id: item.id })} size="mini"><CheckOutline />通过</Button><Button className="admin-page__action admin-page__action--reject" fill="outline" onClick={async () => {
              const reason = await promptText('驳回主办方申请', '请输入驳回原因', false)
              if (reason !== null) organizerReviewMutation.mutate({ approved: false, id: item.id, reason })
            }} size="mini"><CloseOutline />驳回</Button></footer>
          </article>) : <EmptyState description="当前没有待处理申请" title="暂无主办方申请" />}
        </div> : null}

        {tab === 'history' ? <div className="admin-page__content">
          <div className="admin-page__history-head"><h2>审核历史</h2><Button aria-label="清空审核历史" className="admin-page__clear" color="danger" fill="outline" onClick={async () => {
            if (await confirmAction({ content: '删除全部审核历史不会影响业务结果。', title: '清空审核历史' })) clearHistoryMutation.mutate()
          }}><DeleteOutline /></Button></div>
          <p className="admin-page__count">共 {historyQuery.data?.total ?? 0} 条审核历史</p>
          {historyQuery.isPending ? <LoadingState description="正在加载审核历史" /> : historyQuery.error ? <ErrorState description={historyQuery.error.message} onRetry={() => void historyQuery.refetch()} title="加载失败" /> : historyQuery.data?.items.length ? historyQuery.data.items.map((item) => <article className="admin-page__review" key={item.id}>
            <h2>{item.bizTitle}</h2><p>审核对象：{item.targetName || `用户 ${item.targetUserId ?? ''}`}</p><p>审核类型：{reviewBizTypeLabel(item.bizType)}</p><p>审核结果：{item.action === 'APPROVED' ? '通过' : item.action === 'OFFLINE' ? '下架' : '驳回'}</p>{item.remark ? <p>备注：{item.remark}</p> : null}<p>审核时间：{formatActivityTime(item.createdAt)}</p>
            <footer><Button className="admin-page__action admin-page__action--reject" fill="outline" onClick={() => deleteHistoryMutation.mutate(item.id)} size="mini"><DeleteOutline />删除</Button></footer>
          </article>) : <EmptyState description="处理审核后会在这里留下记录" title="暂无审核历史" />}
        </div> : null}

        <CampusPopup onMaskClick={() => setAiActivity(null)} onClose={() => setAiActivity(null)} title={`AI 审核建议 · ${aiActivity?.title ?? ''}`} visible={Boolean(aiActivity)}>
          {aiQuery.isPending ? <LoadingState description="正在读取 AI 审核报告" /> : aiQuery.error ? <ErrorState description={aiQuery.error.message} onRetry={() => void aiQuery.refetch()} title="报告加载失败" /> : aiQuery.data ? <AiReport report={aiQuery.data} /> : null}
        </CampusPopup>
      </AppPage>
    </AppShell>
  )
}
