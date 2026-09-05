import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Input } from 'antd-mobile'
import * as echarts from 'echarts'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { queryKeys } from '../../api/queryKeys'
import { AppPage, AppShell, PageHeader } from '../../components/layout'
import { EmptyState, ErrorState, LoadingState, showToast } from '../../components/ui'
import { formatActivityTime } from '../../features/activities'
import {
  fetchCheckInDashboard,
  verifyCheckIn,
  type CheckInRecord,
  type TrendPoint,
} from '../../features/organizer'
import { safeReturnTo, withReturnTo } from '../../router/returnTo'
import './CheckInPage.css'

function Chart({
  color,
  data,
  kind,
  name,
}: {
  color: string
  data: TrendPoint[]
  kind: 'line' | 'pie'
  name: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const chart = echarts.init(ref.current)
    chart.setOption(
      kind === 'pie'
        ? {
            color: ['#087a52', '#b45309'],
            legend: { bottom: 0, icon: 'circle' },
            series: [{ data, label: { formatter: '{b}\n{c}人' }, radius: ['48%', '72%'], type: 'pie' }],
            tooltip: { trigger: 'item' },
          }
        : {
            grid: { bottom: 34, left: 36, right: 12, top: 20 },
            series: [{ areaStyle: { opacity: 0.12 }, data: data.map((item) => item.value), name, smooth: true, type: 'line' }],
            tooltip: { trigger: 'axis' },
            xAxis: { data: data.map((item) => item.label), type: 'category' },
            yAxis: { minInterval: 1, type: 'value' },
            color: [color],
          },
    )
    const resize = () => chart.resize()
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      chart.dispose()
    }
  }, [color, data, kind, name])
  return <div className="check-in-page__chart" ref={ref} />
}

function recordText(record: CheckInRecord) {
  try {
    const detail = JSON.parse(record.responseBody ?? '{}') as {
      displayCode?: string
      operatorName?: string
      userNickName?: string
    }
    return {
      meta: [detail.displayCode && `凭证：${detail.displayCode}`, detail.operatorName && `操作人：${detail.operatorName}`].filter(Boolean).join(' · '),
      title: `${detail.userNickName || '未知用户'} 已签到`,
    }
  } catch {
    return { meta: '', title: '核销记录' }
  }
}

export function CheckInPage() {
  const { activityId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [displayCode, setDisplayCode] = useState('')
  const returnTo = safeReturnTo(new URLSearchParams(location.search).get('returnTo'), '/me?tab=created')
  const dashboardQuery = useQuery({
    enabled: Boolean(activityId),
    queryFn: () => fetchCheckInDashboard(activityId),
    queryKey: [...queryKeys.organizer.dashboard(), activityId],
  })
  const verifyMutation = useMutation({
    mutationFn: () => verifyCheckIn(activityId, displayCode.trim()),
    onError: (error) => {
      showToast(error.message, 'error')
    },
    onSuccess: async (result) => {
      setDisplayCode('')
      showToast(result.message || '核销已处理', 'success')
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.organizer.dashboard(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.activities.detail(activityId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.registration.status(activityId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.registration.all,
        }),
      ])
    },
  })
  const submitCheckIn = () => {
    if (!displayCode.trim() || verifyMutation.isPending) return
    verifyMutation.mutate()
  }

  if (dashboardQuery.isPending) return <LoadingState description="签到管理数据加载中" fullPage />
  if (dashboardQuery.error) return <ErrorState description={dashboardQuery.error.message} fullPage onRetry={() => void dashboardQuery.refetch()} title="签到数据加载失败" />
  const dashboard = dashboardQuery.data
  if (!dashboard.activitySummary) return <EmptyState description="暂无签到管理数据" fullPage title="暂无数据" />
  const { activitySummary, stats } = dashboard

  return (
    <AppShell>
      <AppPage className="check-in-page">
        <PageHeader
          onBack={() => navigate(returnTo)}
          right={<Button fill="none" onClick={() => navigate(withReturnTo(`/activities/${activityId}`, `${location.pathname}${location.search}`))} size="small">详情</Button>}
          title="签到管理"
        />
        <section className="check-in-page__panel check-in-page__summary">
          <h1>{activitySummary.title}</h1>
          <p>活动时间：{formatActivityTime(activitySummary.eventStartTime)} - {formatActivityTime(activitySummary.eventEndTime)}</p>
          <p>活动地点：{activitySummary.location || '待定'}　报名人数：{stats.registeredCount} / {activitySummary.maxParticipants}</p>
          <p>报名时间：{formatActivityTime(activitySummary.registrationStartTime)} - {formatActivityTime(activitySummary.registrationEndTime)}</p>
          <Button color="primary" fill="outline" onClick={() => void dashboardQuery.refetch()} size="small">刷新数据</Button>
        </section>
        <section className="check-in-page__panel">
          <h2>签到情况 <small>文字统计 + 图表概览</small></h2>
          <div className="check-in-page__metrics">
            <div><span>报名人数</span><strong>{stats.registeredCount}</strong><small>成功报名总人数</small></div>
            <div><span>已签到人数</span><strong>{stats.checkedInCount}</strong><small>已完成现场核销</small></div>
            <div><span>未签到人数</span><strong>{stats.uncheckedCount}</strong><small>尚未完成签到</small></div>
            <div><span>签到率</span><strong>{Number(stats.checkInRate || 0).toFixed(1)}%</strong><small>签到完成度</small></div>
          </div>
        </section>
        <section className="check-in-page__panel"><h2>签到占比 <small>已签到 / 未签到</small></h2><Chart color="#087a52" data={dashboard.statusChart} kind="pie" name="签到人数" /></section>
        <section className="check-in-page__panel"><h2>报名趋势 <small>按天统计成功报名</small></h2><Chart color="#1769e0" data={dashboard.registrationTrendChart} kind="line" name="报名人数" /></section>
        <section className="check-in-page__panel"><h2>签到趋势 <small>按小时统计成功签到</small></h2><Chart color="#087a52" data={dashboard.checkInTrendChart} kind="line" name="签到人数" /></section>
        <section className="check-in-page__panel">
          <h2>签到核销 <small>输入展示码完成现场核销</small></h2>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              submitCheckIn()
            }}
          >
            <Input
              clearable
              onChange={(value) => {
                verifyMutation.reset()
                setDisplayCode(value.replace(/\s/g, '').toUpperCase())
              }}
              onEnterPress={(event) => {
                event.preventDefault()
                submitCheckIn()
              }}
              placeholder="请输入签到展示码，例如 A8F3K2M7"
              value={displayCode}
            />
            <Button
              block
              color="primary"
              disabled={!displayCode.trim()}
              loading={verifyMutation.isPending}
              onClick={submitCheckIn}
            >
              核销签到
            </Button>
          </form>
          {verifyMutation.error ? (
            <div className="check-in-page__result is-error" role="alert">
              <p>核销失败：{verifyMutation.error.message}</p>
            </div>
          ) : null}
          {verifyMutation.data ? <div className="check-in-page__result">
            <p>核销结果：{verifyMutation.data.message || verifyMutation.data.resultStatus || '已处理'}</p>
            {verifyMutation.data.displayCode ? <p>凭证号：{verifyMutation.data.displayCode}</p> : null}
            {verifyMutation.data.userNickName ? <p>签到用户：{verifyMutation.data.userNickName}</p> : null}
            {verifyMutation.data.checkedInTime ? <p>签到时间：{formatActivityTime(verifyMutation.data.checkedInTime)}</p> : null}
          </div> : null}
        </section>
        <section className="check-in-page__panel">
          <h2>最近核销记录 <small>最近 10 条成功核销</small></h2>
          {dashboard.recentRecords.length ? dashboard.recentRecords.map((record) => {
            const text = recordText(record)
            return <article className="check-in-page__record" key={record.id}><strong>{text.title}</strong><p>{formatActivityTime(record.createTime)}{text.meta ? ` · ${text.meta}` : ''}</p></article>
          }) : <EmptyState description="完成核销后会在这里显示" title="暂无签到记录" />}
        </section>
      </AppPage>
    </AppShell>
  )
}
