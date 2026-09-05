import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
} from '@tanstack/react-query'
import {
  Avatar,
  Button,
  InfiniteScroll,
  Input,
  Popup,
  SearchBar,
} from 'antd-mobile'
import {
  AddCircleOutline,
  AppOutline,
  AppstoreOutline,
  CompassOutline,
  ContentOutline,
  FilterOutline,
  FlagOutline,
  GiftOutline,
  GlobalOutline,
  MessageOutline,
  StarOutline,
  TeamOutline,
  TravelOutline,
  UserOutline,
} from 'antd-mobile-icons'
import type { ComponentType, SVGProps } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { queryKeys } from '../../api/queryKeys'
import type { PageResult } from '../../api/types'
import { AppPage, AppShell, BottomNav } from '../../components/layout'
import {
  CampusButton,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/ui'
import {
  fetchActivities,
  fetchActivityCategories,
  getCategoryPathSegment,
  PortalActivityCard,
  resolveCategoryName,
} from '../../features/activities'
import type {
  Activity,
  ActivityListParams,
  ActivitySort,
  ActivityStage,
} from '../../features/activities'
import { useAuth } from '../../features/auth'
import { useNotification } from '../../features/notification'
import { withReturnTo } from '../../router/returnTo'
import './ActivityPortalPage.css'

const PAGE_SIZE = 6
const PLATFORM_ADMIN_ROLE = 'PLATFORM_ADMIN'
const ACTIVITY_CREATE_PERMISSION = 'activity:create'

const stageOptions = [
  { label: '全部状态', value: '' },
  { label: '开放报名', value: 'REGISTRATION_OPEN' },
  { label: '未开放报名', value: 'REGISTRATION_NOT_OPEN' },
  { label: '已开始', value: 'IN_PROGRESS' },
  { label: '已结束', value: 'FINISHED' },
]

const sortOptions = [
  { label: '综合排序', value: 'composite' },
  { label: '即将开始', value: 'startTimeAsc' },
  { label: '最新发布', value: 'publishTimeDesc' },
  { label: '报名人数最多', value: 'signupCountDesc' },
  { label: '热门优先', value: 'heatScoreDesc' },
]

const categoryDescriptions: Record<string, string> = {
  学术讲座: '拓展视野，启发思考',
  就业指导: '规划未来，提升竞争力',
  竞赛训练: '提升能力，挑战自我',
  创新实践: '探索创新，实践成长',
  文艺活动: '文艺舞台，绽放青春',
  体育活动: '强健体魄，活力校园',
  志愿公益: '奉献爱心，服务社会',
  社团活动: '社团联动，持续发生',
}

const categoryIcons: Array<ComponentType<SVGProps<SVGSVGElement>>> = [
  ContentOutline,
  TravelOutline,
  StarOutline,
  FlagOutline,
  GiftOutline,
  GlobalOutline,
  TeamOutline,
  AppstoreOutline,
]

interface AdvancedFilters {
  location: string
  organizerName: string
  startTimeFrom: string
  startTimeTo: string
}

function readAdvancedFilters(searchParams: URLSearchParams): AdvancedFilters {
  return {
    location: searchParams.get('location') ?? '',
    organizerName: searchParams.get('organizerName') ?? '',
    startTimeFrom: searchParams.get('startTimeFrom') ?? '',
    startTimeTo: searchParams.get('startTimeTo') ?? '',
  }
}

function toApiDateTime(value: string): string | undefined {
  return value ? `${value.replace('T', ' ')}:00` : undefined
}

interface ActivitySearchBarProps {
  onCommit: (value: string) => void
  value: string
}

function ActivitySearchBar({
  onCommit,
  value,
}: ActivitySearchBarProps) {
  const [draft, setDraft] = useState(value)

  return (
    <SearchBar
      onChange={setDraft}
      onClear={() => onCommit('')}
      onSearch={(nextValue) => onCommit(nextValue.trim())}
      placeholder="搜索标题、地点或标签"
      value={draft}
    />
  )
}

export function ActivityPortalPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { categoryId = '' } = useParams()
  const { currentUser } = useAuth()
  const { unreadCount } = useNotification()
  const [searchParams, setSearchParams] = useSearchParams()
  const legacyCategory = searchParams.get('category') ?? ''
  const keyword = searchParams.get('keyword') ?? ''
  const stageFilter =
    (searchParams.get('stageFilter') as ActivityStage | null) ?? ''
  const sortBy =
    (searchParams.get('sortBy') as ActivitySort | null) ?? 'composite'
  const advancedFilters = readAdvancedFilters(searchParams)
  const [filterVisible, setFilterVisible] = useState(false)
  const [advancedDraft, setAdvancedDraft] =
    useState<AdvancedFilters>(advancedFilters)

  const updateSearchParams = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        next.set(key, value)
      } else {
        next.delete(key)
      }
    })
    setSearchParams(next, { replace: true })
  }

  const categoriesQuery = useQuery({
    queryFn: fetchActivityCategories,
    queryKey: queryKeys.activities.categories(),
    staleTime: 5 * 60_000,
  })
  const selectedCategory =
    legacyCategory ||
    resolveCategoryName(categoryId, categoriesQuery.data) ||
    ''
  const categoryRouteRequested = Boolean(categoryId || legacyCategory)
  const categoryNotFound =
    Boolean(categoryId) &&
    categoriesQuery.isSuccess &&
    !selectedCategory

  useEffect(() => {
    if (!legacyCategory) {
      return
    }

    const category = categoriesQuery.data?.find(
      (item) => item.name === legacyCategory,
    )
    if (!category) {
      return
    }

    const nextSearch = new URLSearchParams(searchParams)
    nextSearch.delete('category')
    navigate(
      {
        pathname: `/activities/categories/${getCategoryPathSegment(category)}`,
        search: nextSearch.toString(),
      },
      { replace: true },
    )
  }, [
    categoriesQuery.data,
    legacyCategory,
    navigate,
    searchParams,
  ])

  const listQueryParams = useMemo<Omit<ActivityListParams, 'current'>>(
    () => ({
      category: selectedCategory,
      keyword: keyword || undefined,
      location: advancedFilters.location || undefined,
      organizerName: advancedFilters.organizerName || undefined,
      pageSize: PAGE_SIZE,
      sortBy,
      stageFilter: stageFilter || undefined,
      startTimeFrom: toApiDateTime(advancedFilters.startTimeFrom),
      startTimeTo: toApiDateTime(advancedFilters.startTimeTo),
    }),
    [
      advancedFilters.location,
      advancedFilters.organizerName,
      advancedFilters.startTimeFrom,
      advancedFilters.startTimeTo,
      keyword,
      selectedCategory,
      sortBy,
      stageFilter,
    ],
  )

  const activitiesQuery = useInfiniteQuery<
    PageResult<Activity>,
    Error,
    InfiniteData<PageResult<Activity>>,
    readonly unknown[],
    number
  >({
    enabled: Boolean(selectedCategory),
    getNextPageParam: (lastPage, pages) =>
      pages.reduce((count, page) => count + page.items.length, 0) <
      lastPage.total
        ? pages.length + 1
        : undefined,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      fetchActivities({ ...listQueryParams, current: pageParam }),
    queryKey: queryKeys.activities.list(listQueryParams),
  })

  const activities =
    activitiesQuery.data?.pages.flatMap((page) => page.items) ?? []
  const total = activitiesQuery.data?.pages[0]?.total ?? 0
  const canManageActivities =
    currentUser?.permissions.includes(ACTIVITY_CREATE_PERMISSION) &&
    !currentUser.roleCodes.includes(PLATFORM_ADMIN_ROLE)

  const openDetail = (activityId: string) => {
    const returnTo = `${location.pathname}${location.search}`
    navigate({
      pathname: `/activities/${activityId}`,
      search: new URLSearchParams({ returnTo }).toString(),
    })
  }

  const handleBottomNav = (key: string) => {
    const routes: Record<string, string> = {
      discover: canManageActivities ? '/organizer/dashboard' : '/discover',
      home: '/',
      messages: withReturnTo(
        '/notifications',
        `${location.pathname}${location.search}`,
      ),
      me: currentUser?.roleCodes.includes(PLATFORM_ADMIN_ROLE)
        ? '/admin'
        : '/me',
      publish: canManageActivities
        ? '/organizer/activities/new'
        : withReturnTo(
            '/discover/create',
            `${location.pathname}${location.search}`,
          ),
    }
    navigate(routes[key] ?? '/')
  }

  const applyAdvancedFilters = () => {
    updateSearchParams({ ...advancedDraft })
    setFilterVisible(false)
  }

  const resetToCategories = () => {
    navigate('/')
  }

  return (
    <AppShell>
      <AppPage className="activity-portal" hasBottomNav>
        {!categoryRouteRequested ? (
          <>
            <header className="activity-portal__header">
              <div>
                <h1>校园活动</h1>
                <p>发现热爱 · 连接校园</p>
              </div>
              <button
                aria-label="进入个人中心"
                className="activity-portal__avatar"
                onClick={() => handleBottomNav('me')}
                type="button"
              >
                <Avatar
                  fallback={<UserOutline aria-hidden />}
                  src={currentUser?.icon ?? ''}
                />
              </button>
            </header>
            <section
              aria-label="春日校园活动"
              className="activity-portal__hero"
            />
            {categoriesQuery.isPending ? (
              <LoadingState description="正在加载活动分类" />
            ) : categoriesQuery.isError ? (
              <ErrorState
                description={categoriesQuery.error.message}
                onRetry={() => categoriesQuery.refetch()}
                title="分类加载失败"
              />
            ) : categoriesQuery.data.length === 0 ? (
              <EmptyState
                description="分类维护完成后即可浏览活动"
                title="暂无活动分类"
              />
            ) : (
              <section
                aria-label="活动分类"
                className="activity-portal__categories"
              >
                {categoriesQuery.data.map((category, index) => {
                  const CategoryIcon =
                    categoryIcons[index % categoryIcons.length]
                  return (
                    <button
                      className="activity-portal__category"
                      key={category.id}
                      onClick={() =>
                        navigate(
                          `/activities/categories/${getCategoryPathSegment(category)}`,
                        )
                      }
                      type="button"
                    >
                      <span className="activity-portal__category-icon">
                        <CategoryIcon aria-hidden />
                      </span>
                      <span>
                        <strong>{category.name}</strong>
                        <small>
                          {categoryDescriptions[category.name] ||
                            category.tags.map((tag) => tag.name).join(' · ') ||
                            '查看分类活动'}
                        </small>
                      </span>
                    </button>
                  )
                })}
              </section>
            )}
          </>
        ) : (
          <>
            <header className="activity-portal__list-header">
              <button
                aria-label="返回活动分类"
                className="activity-portal__back"
                onClick={resetToCategories}
                type="button"
              >
                ‹
              </button>
              <h1>
                {selectedCategory
                  ? `${selectedCategory}活动`
                  : '活动分类'}
              </h1>
            </header>
            {categoryNotFound ? (
              <ErrorState
                description="该活动分类不存在或已停用"
                onRetry={resetToCategories}
                title="分类不可用"
              />
            ) : (
              <>
            <section
              aria-label="活动搜索与筛选"
              className="activity-portal__filters"
            >
              <ActivitySearchBar
                key={keyword}
                onCommit={(value) =>
                  updateSearchParams({ keyword: value })
                }
                value={keyword}
              />
              <div className="activity-portal__selectors">
                <label>
                  <span>状态</span>
                  <select
                    aria-label="活动状态"
                    onChange={(event) =>
                      updateSearchParams({
                        stageFilter: event.target.value,
                      })
                    }
                    value={stageFilter}
                  >
                    {stageOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>排序</span>
                  <select
                    aria-label="排序方式"
                    onChange={(event) =>
                      updateSearchParams({ sortBy: event.target.value })
                    }
                    value={sortBy}
                  >
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  aria-label="更多筛选"
                  className="activity-portal__filter-button"
                  onClick={() => {
                    setAdvancedDraft(advancedFilters)
                    setFilterVisible(true)
                  }}
                >
                  <FilterOutline aria-hidden />
                </Button>
              </div>
            </section>
            <div className="activity-portal__result-head">
              <strong>活动列表</strong>
              <span>共 {total} 条，已显示 {activities.length} 条</span>
            </div>
            {activitiesQuery.isPending ? (
              <LoadingState description="正在加载活动" />
            ) : activitiesQuery.isError ? (
              <ErrorState
                description={activitiesQuery.error.message}
                onRetry={() => activitiesQuery.refetch()}
                title="活动加载失败"
              />
            ) : activities.length === 0 ? (
              <EmptyState
                description="可以调整搜索词或筛选条件"
                title="暂无匹配活动"
              />
            ) : (
              <section
                aria-label="活动列表"
                className="activity-portal__list"
              >
                {activities.map((activity) => (
                  <PortalActivityCard
                    activity={activity}
                    key={activity.id}
                    onOpen={openDetail}
                  />
                ))}
                {activitiesQuery.hasNextPage ? (
                  <CampusButton
                    block
                    fill="outline"
                    loading={activitiesQuery.isFetchingNextPage}
                    onClick={async () => {
                      await activitiesQuery.fetchNextPage()
                    }}
                  >
                    加载更多
                  </CampusButton>
                ) : null}
                <InfiniteScroll
                  hasMore={Boolean(activitiesQuery.hasNextPage)}
                  loadMore={async () => {
                    await activitiesQuery.fetchNextPage()
                  }}
                >
                  {activitiesQuery.hasNextPage ? '继续上滑加载' : null}
                </InfiniteScroll>
              </section>
            )}
              </>
            )}
          </>
        )}
        <BottomNav
          activeKey="home"
          items={[
            { icon: <AppOutline />, key: 'home', label: '首页' },
            {
              icon: <CompassOutline />,
              key: 'discover',
              label: canManageActivities ? '数据' : '发现',
            },
            {
              icon: <AddCircleOutline />,
              key: 'publish',
              label: '发布',
            },
            {
              badge: unreadCount || undefined,
              icon: <MessageOutline />,
              key: 'messages',
              label: '消息',
            },
            { icon: <UserOutline />, key: 'me', label: '我的' },
          ]}
          onChange={handleBottomNav}
        />
      </AppPage>
      <Popup
        bodyClassName="activity-portal__filter-popup"
        onMaskClick={() => setFilterVisible(false)}
        position="bottom"
        visible={filterVisible}
      >
        <div className="activity-portal__popup-head">
          <strong>更多筛选</strong>
          <Button
            fill="none"
            onClick={() =>
              setAdvancedDraft({
                location: '',
                organizerName: '',
                startTimeFrom: '',
                startTimeTo: '',
              })
            }
          >
            重置
          </Button>
        </div>
        <label className="activity-portal__field">
          <span>活动地点</span>
          <Input
            clearable
            onChange={(location) =>
              setAdvancedDraft((value) => ({ ...value, location }))
            }
            placeholder="输入地点"
            value={advancedDraft.location}
          />
        </label>
        <label className="activity-portal__field">
          <span>主办方</span>
          <Input
            clearable
            onChange={(organizerName) =>
              setAdvancedDraft((value) => ({ ...value, organizerName }))
            }
            placeholder="输入主办方名称"
            value={advancedDraft.organizerName}
          />
        </label>
        <label className="activity-portal__field">
          <span>开始时间从</span>
          <input
            onChange={(event) =>
              setAdvancedDraft((value) => ({
                ...value,
                startTimeFrom: event.target.value,
              }))
            }
            type="datetime-local"
            value={advancedDraft.startTimeFrom}
          />
        </label>
        <label className="activity-portal__field">
          <span>开始时间至</span>
          <input
            onChange={(event) =>
              setAdvancedDraft((value) => ({
                ...value,
                startTimeTo: event.target.value,
              }))
            }
            type="datetime-local"
            value={advancedDraft.startTimeTo}
          />
        </label>
        <CampusButton block color="primary" onClick={applyAdvancedFilters}>
          查看筛选结果
        </CampusButton>
      </Popup>
    </AppShell>
  )
}
