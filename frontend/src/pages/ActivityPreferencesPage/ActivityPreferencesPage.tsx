import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Selector } from 'antd-mobile'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { queryKeys } from '../../api/queryKeys'
import { AppPage, AppShell, PageHeader } from '../../components/layout'
import {
  CampusButton,
  EmptyState,
  ErrorState,
  LoadingState,
  showToast,
} from '../../components/ui'
import { fetchActivityCategories } from '../../features/activities'
import {
  fetchPreferenceTags,
  updatePreferenceTags,
} from '../../features/profile'
import './ActivityPreferencesPage.css'

const MAX_TAGS = 5

export function ActivityPreferencesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [draftIds, setDraftIds] = useState<string[] | null>(null)
  const categoriesQuery = useQuery({
    queryFn: fetchActivityCategories,
    queryKey: queryKeys.activities.categories(),
    staleTime: 5 * 60_000,
  })
  const preferencesQuery = useQuery({
    queryFn: fetchPreferenceTags,
    queryKey: queryKeys.profile.preferences(),
  })
  const saveMutation = useMutation({
    mutationFn: updatePreferenceTags,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.profile.preferences(),
      })
      showToast('偏好标签已保存', 'success')
      navigate('/me')
    },
  })

  const loading = categoriesQuery.isPending || preferencesQuery.isPending
  const error = categoriesQuery.error || preferencesQuery.error
  const selectedIds =
    draftIds ?? preferencesQuery.data?.map((tag) => tag.id) ?? []

  return (
    <AppShell>
      <AppPage className="activity-preferences-page">
        <PageHeader onBack={() => navigate('/me')} title="活动偏好" />
        <header className="activity-preferences-page__intro">
          <h1>活动偏好标签</h1>
          <p>选择 1-5 个偏好标签，后续推荐会优先参考这里。</p>
        </header>

        {loading ? (
          <LoadingState description="正在加载活动标签" />
        ) : error ? (
          <ErrorState
            description={error.message}
            onRetry={() => {
              void Promise.all([
                categoriesQuery.refetch(),
                preferencesQuery.refetch(),
              ])
            }}
          />
        ) : !categoriesQuery.data?.length ? (
          <EmptyState description="暂无可选活动标签" />
        ) : (
          <div className="activity-preferences-page__categories">
            {categoriesQuery.data.map((category) => (
              <section key={category.id}>
                <h2>{category.name}</h2>
                <Selector
                  multiple
                  onChange={(values) => {
                    if (values.length > MAX_TAGS) {
                      showToast(`偏好标签最多选择 ${MAX_TAGS} 个`, 'error')
                      return
                    }
                    setDraftIds(values.map(String))
                  }}
                  options={category.tags.map((tag) => ({
                    label: tag.name,
                    value: tag.id,
                  }))}
                  showCheckMark={false}
                  value={selectedIds.filter((id) =>
                    category.tags.some((tag) => tag.id === id),
                  )}
                />
              </section>
            ))}
          </div>
        )}

        <footer className="activity-preferences-page__actions">
          <span>已选择 {selectedIds.length} / {MAX_TAGS}</span>
          <div>
            <Button
              disabled={saveMutation.isPending}
              fill="none"
              onClick={() => setDraftIds([])}
            >
              清空
            </Button>
            <CampusButton
              disabled={loading || Boolean(error)}
              loading={saveMutation.isPending}
              onClick={async () => {
                if (!selectedIds.length) {
                  showToast('请至少选择 1 个偏好标签', 'error')
                  return
                }
                try {
                  await saveMutation.mutateAsync(selectedIds)
                } catch (saveError) {
                  showToast((saveError as Error).message, 'error')
                }
              }}
              size="small"
            >
              保存偏好
            </CampusButton>
          </div>
        </footer>
      </AppPage>
    </AppShell>
  )
}
