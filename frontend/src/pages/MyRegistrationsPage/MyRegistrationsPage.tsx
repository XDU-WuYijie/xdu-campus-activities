import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import {
  Card,
  Dropdown,
  InfiniteScroll,
  SearchBar,
  Selector,
} from 'antd-mobile'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { queryKeys } from '../../api/queryKeys'
import type { PageResult } from '../../api/types'
import { AppPage, AppShell, PageHeader } from '../../components/layout'
import {
  CampusButton,
  CampusDialog,
  CampusImage,
  confirmAction,
  EmptyState,
  ErrorState,
  LoadingState,
  showToast,
  StatusTag,
} from '../../components/ui'
import {
  cancelRegistration,
  deleteRegistrationRecord,
  fetchMyRegistrations,
  getRegistrationRecordDescription,
  type RegistrationFilter,
  type RegistrationRecord,
} from '../../features/registration'
import { formatActivityTime } from '../../features/activities'
import { safeReturnTo } from '../../router/returnTo'
import './MyRegistrationsPage.css'

const PAGE_SIZE = 10
type RegistrationSort =
  | 'eventStartAsc'
  | 'eventStartDesc'
  | 'registrationTimeDesc'
  | 'signupCountDesc'

const filterOptions = [
  { label: '全部', value: 'ALL' },
  { label: '待签到', value: 'PENDING_CHECK_IN' },
  { label: '已签到', value: 'CHECKED_IN' },
  { label: '已结束', value: 'FINISHED' },
  { label: '已取消', value: 'CANCELED' },
]

const sortOptions = [
  { label: '按报名时间排序', value: 'registrationTimeDesc' },
  { label: '按活动时间排序', value: 'eventStartAsc' },
  { label: '按报名人数排序', value: 'signupCountDesc' },
  { label: '按活动时间倒序', value: 'eventStartDesc' },
]

function timestamp(value?: string) {
  return value ? new Date(value.replace(/-/g, '/')).getTime() : 0
}

function sortRecords(
  records: RegistrationRecord[],
  sort: RegistrationSort,
) {
  return [...records].sort((left, right) => {
    if (sort === 'eventStartAsc') {
      return timestamp(left.eventStartTime) - timestamp(right.eventStartTime)
    }
    if (sort === 'eventStartDesc') {
      return timestamp(right.eventStartTime) - timestamp(left.eventStartTime)
    }
    if (sort === 'signupCountDesc') {
      return (right.registeredCount ?? 0) - (left.registeredCount ?? 0)
    }
    return timestamp(right.createTime) - timestamp(left.createTime)
  })
}

function filterRecords(
  records: RegistrationRecord[],
  filter: RegistrationFilter,
  now: number,
) {
  if (filter === 'ALL') return records
  return records.filter((record) => {
    const ended = Boolean(
      record.eventEndTime && timestamp(record.eventEndTime) < now,
    )
    if (filter === 'CANCELED') {
      return record.status === 2 || record.status === 3
    }
    if (filter === 'CHECKED_IN') {
      return record.status === 1 && Boolean(record.checkInStatus)
    }
    if (filter === 'FINISHED') {
      return ended
    }
    return record.status === 1 && !record.checkInStatus && !ended
  })
}

function isEnded(record: RegistrationRecord) {
  return Boolean(
    record.eventEndTime &&
      new Date(record.eventEndTime.replace(/-/g, '/')).getTime() <=
        Date.now(),
  )
}

function canCancel(record: RegistrationRecord) {
  return (
    record.status === 1 &&
    !record.checkInStatus &&
    (!record.eventStartTime ||
      new Date(record.eventStartTime.replace(/-/g, '/')).getTime() >
        Date.now())
  )
}

function statusTone(record: RegistrationRecord) {
  if (record.status === 1 && record.checkInStatus) return 'success' as const
  if (record.status === 1) return 'primary' as const
  if (record.status === 2 || record.status === 3) return 'danger' as const
  return 'warning' as const
}

export function MyRegistrationsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [keywordDraft, setKeywordDraft] = useState('')
  const [keyword, setKeyword] = useState('')
  const [filter, setFilter] = useState<RegistrationFilter>('ALL')
  const [sort, setSort] =
    useState<RegistrationSort>('registrationTimeDesc')
  const [renderedAt] = useState(Date.now)
  const [voucherRecord, setVoucherRecord] =
    useState<RegistrationRecord | null>(null)
  const returnTo = safeReturnTo(
    new URLSearchParams(location.search).get('returnTo'),
    '/me',
  )
  const queryParams = useMemo(
    () => ({ filter, keyword: keyword || undefined, pageSize: PAGE_SIZE }),
    [filter, keyword],
  )

  const registrationsQuery = useInfiniteQuery<
    PageResult<RegistrationRecord>,
    Error,
    InfiniteData<PageResult<RegistrationRecord>>,
    readonly unknown[],
    number
  >({
    getNextPageParam: (lastPage, pages) =>
      pages.reduce((count, page) => count + page.items.length, 0) <
      lastPage.total
        ? pages.length + 1
        : undefined,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      fetchMyRegistrations({
        ...queryParams,
        current: pageParam,
        filter: 'ALL',
      }),
    queryKey: queryKeys.registration.mine(queryParams),
  })

  const records = useMemo(
    () =>
      sortRecords(
        filterRecords(
          registrationsQuery.data?.pages.flatMap((page) => page.items) ?? [],
          filter,
          renderedAt,
        ),
        sort,
      ),
    [filter, registrationsQuery.data?.pages, renderedAt, sort],
  )
  const total = registrationsQuery.data?.pages[0]?.total ?? 0

  const invalidateRegistrationData = async (activityId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.registration.all,
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.activities.lists(),
      }),
      ...(activityId
        ? [
            queryClient.invalidateQueries({
              queryKey: queryKeys.activities.detail(activityId),
            }),
          ]
        : []),
    ])
  }

  const cancelMutation = useMutation({
    mutationFn: cancelRegistration,
    onSuccess: async (_, activityId) => {
      showToast('退出请求已提交', 'success')
      await invalidateRegistrationData(activityId)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteRegistrationRecord,
    onSuccess: async () => {
      setVoucherRecord(null)
      showToast('报名记录已删除', 'success')
      await invalidateRegistrationData()
    },
  })

  const openDetail = (activityId: string) => {
    navigate({
      pathname: `/activities/${activityId}`,
      search: new URLSearchParams({
        returnTo: `${location.pathname}${location.search}`,
      }).toString(),
    })
  }

  return (
    <AppShell>
      <AppPage className="my-registration-page">
        <PageHeader
          onBack={() => navigate(returnTo, { replace: true })}
          title="我的报名"
        />
        <section
          aria-label="报名记录搜索与筛选"
          className="my-registration-page__filters"
        >
          <div className="my-registration-page__search-row">
            <SearchBar
              onChange={setKeywordDraft}
              onClear={() => setKeyword('')}
              onSearch={(value) => setKeyword(value.trim())}
              placeholder="搜索已报名活动"
              value={keywordDraft}
            />
            <CampusButton
              color="primary"
              onClick={() => setKeyword(keywordDraft.trim())}
            >
              搜索
            </CampusButton>
          </div>
          <Dropdown>
            <Dropdown.Item
              key="sort"
              title={
                sortOptions.find((option) => option.value === sort)?.label
              }
            >
              <Selector
                columns={1}
                onChange={(values) =>
                  setSort(
                    (values[0] as RegistrationSort | undefined) ??
                      'registrationTimeDesc',
                  )
                }
                options={sortOptions}
                showCheckMark={false}
                value={[sort]}
              />
            </Dropdown.Item>
            <Dropdown.Item
              key="filter"
              title={
                filterOptions.find((option) => option.value === filter)?.label
              }
            >
              <Selector
                columns={2}
                onChange={(values) =>
                  setFilter(
                    (values[0] as RegistrationFilter | undefined) ?? 'ALL',
                  )
                }
                options={filterOptions}
                showCheckMark={false}
                value={[filter]}
              />
            </Dropdown.Item>
          </Dropdown>
        </section>

        {registrationsQuery.isPending ? (
          <LoadingState description="正在加载报名记录" />
        ) : registrationsQuery.isError ? (
          <ErrorState
            description={registrationsQuery.error.message}
            onRetry={() => registrationsQuery.refetch()}
            title="报名记录加载失败"
          />
        ) : records.length === 0 ? (
          <EmptyState
            description={
              keyword || filter !== 'ALL'
                ? '当前条件下没有报名记录'
                : '还没有报名任何活动'
            }
          />
        ) : (
          <section
            aria-label="报名记录"
            className="my-registration-page__list"
          >
            <p className="my-registration-page__count">
              共 {total} 条报名记录，当前显示 {records.length} 条
            </p>
            {records.map((record) => {
              const ended = isEnded(record)
              const showVoucher =
                record.status === 1 && !ended
              const canDelete =
                ended ||
                record.status === 2 ||
                record.status === 3 ||
                record.status === 4

              return (
                <article
                  aria-labelledby={`registration-${record.id}-title`}
                  key={record.id}
                >
                  <Card className="registration-record-card">
                    <div className="registration-record-card__main">
                      <CampusImage
                        alt={`${record.activityTitle}活动封面`}
                        className="registration-record-card__cover"
                        fit="cover"
                        height="68px"
                        src={
                          record.activityCoverImage || record.coverImage
                        }
                        width="76px"
                      />
                      <div className="registration-record-card__content">
                        <div className="registration-record-card__title-row">
                          <h2 id={`registration-${record.id}-title`}>
                            {record.activityTitle}
                          </h2>
                          <StatusTag tone={statusTone(record)}>
                            {record.statusText || '未知状态'}
                          </StatusTag>
                        </div>
                        <p>
                          <strong>时间：</strong>
                          {formatActivityTime(record.eventStartTime)}
                        </p>
                        <p>
                          <strong>分类：</strong>
                          {record.category || '未分类'}　
                          <strong>地点：</strong>
                          {record.location || '待定'}
                        </p>
                        <p>
                          <strong>状态：</strong>
                          {record.statusText || '未知状态'}
                        </p>
                        <p>
                          <strong>说明：</strong>
                          {getRegistrationRecordDescription(record)}
                        </p>
                        {record.status !== 3 ? (
                          <>
                            <p>
                              <strong>签到凭证：</strong>
                              {record.voucherDisplayCode ||
                                (record.status === 0
                                  ? '生成中'
                                  : '待生成')}
                            </p>
                            <p>
                              <strong>签到状态：</strong>
                              {record.status === 1
                                ? record.checkInStatus
                                  ? '已签到'
                                  : '未签到'
                                : '待报名确认'}
                            </p>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="registration-record-card__actions">
                      <CampusButton
                        fill="outline"
                        onClick={() => openDetail(record.activityId)}
                      >
                        查看
                      </CampusButton>
                      {showVoucher ? (
                        <CampusButton
                          color="primary"
                          disabled={!record.voucherDisplayCode}
                          fill="outline"
                          onClick={() => setVoucherRecord(record)}
                        >
                          查看签到码
                        </CampusButton>
                      ) : canDelete ? (
                        <CampusButton
                          color="danger"
                          fill="outline"
                          loading={
                            deleteMutation.isPending &&
                            deleteMutation.variables === record.id
                          }
                          onClick={async () => {
                            const confirmed = await confirmAction({
                              content: '删除后不可恢复。',
                              confirmText: '确认删除',
                              title: '删除报名记录',
                            })
                            if (confirmed) {
                              try {
                                await deleteMutation.mutateAsync(record.id)
                              } catch (error) {
                                showToast((error as Error).message, 'error')
                              }
                            }
                          }}
                        >
                          删除
                        </CampusButton>
                      ) : (
                        <CampusButton
                          fill="outline"
                          onClick={() => openDetail(record.activityId)}
                        >
                          详情
                        </CampusButton>
                      )}
                      {canCancel(record) ? (
                        <CampusButton
                          color="danger"
                          fill="outline"
                          loading={
                            cancelMutation.isPending &&
                            cancelMutation.variables === record.activityId
                          }
                          onClick={async () => {
                            const direct =
                              record.registrationMode ===
                              'FIRST_COME_FIRST_SERVED'
                            const confirmed = await confirmAction({
                              content: direct
                                ? '退出后将立即释放名额并使签到凭证失效。'
                                : '退出申请需要主办方审核。',
                              confirmText: direct ? '确认退出' : '提交申请',
                              title: '退出活动',
                            })
                            if (confirmed) {
                              try {
                                await cancelMutation.mutateAsync(
                                  record.activityId,
                                )
                              } catch (error) {
                                showToast((error as Error).message, 'error')
                              }
                            }
                          }}
                        >
                          退出
                        </CampusButton>
                      ) : null}
                    </div>
                  </Card>
                </article>
              )
            })}
            <InfiniteScroll
              hasMore={registrationsQuery.hasNextPage}
              loadMore={async () => {
                await registrationsQuery.fetchNextPage()
              }}
            />
          </section>
        )}

        <CampusDialog
          actions={[
            {
              key: 'close',
              onClick: () => setVoucherRecord(null),
              text: '关闭',
            },
          ]}
          content={
            voucherRecord ? (
              <div className="my-registration-page__voucher">
                <strong>{voucherRecord.voucherDisplayCode}</strong>
                <p>{voucherRecord.activityTitle}</p>
                <small>
                  {voucherRecord.checkInStatus ? '已签到' : '等待现场核销'}
                </small>
              </div>
            ) : null
          }
          destroyOnClose
          onClose={() => setVoucherRecord(null)}
          title="签到凭证"
          visible={Boolean(voucherRecord)}
        />
      </AppPage>
    </AppShell>
  )
}
