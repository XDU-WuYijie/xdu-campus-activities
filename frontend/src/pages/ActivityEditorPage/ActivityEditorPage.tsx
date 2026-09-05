import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  CheckList,
  DatePicker,
  Form,
  Input,
  Picker,
  Radio,
  TextArea,
} from 'antd-mobile'
import type { ImageUploadItem } from 'antd-mobile'
import { DownOutline, RightOutline, UpOutline } from 'antd-mobile-icons'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { queryKeys } from '../../api/queryKeys'
import { AppPage, AppShell, PageHeader } from '../../components/layout'
import {
  CampusImageUploader,
  CampusPopup,
  ErrorState,
  LoadingState,
  promptText,
  showToast,
} from '../../components/ui'
import {
  fetchActivityCategories,
  fetchActivityDetail,
  type RegistrationMode,
} from '../../features/activities'
import { useAuth } from '../../features/auth'
import {
  requestActivityOffline,
  saveActivity,
  uploadActivityImage,
  type ActivityDraft,
} from '../../features/organizer'
import { safeReturnTo } from '../../router/returnTo'
import './ActivityEditorPage.css'

const emptyDraft: ActivityDraft = {
  activityFlow: '',
  category: '',
  contactInfo: '',
  content: '',
  coverImage: '',
  eventEndTime: '',
  eventStartTime: '',
  faq: '',
  images: '',
  location: '',
  maxParticipants: 50,
  organizerName: '',
  registrationEndTime: '',
  registrationMode: 'AUDIT_REQUIRED',
  registrationStartTime: '',
  summary: '',
  tagIds: [],
  title: '',
}

function parseDate(value: string) {
  return value ? new Date(value.replace(' ', 'T')) : new Date()
}

function formatDate(value: Date) {
  const pad = (number: number) => String(number).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:00`
}

function addHours(value: Date, hours: number) {
  return new Date(value.getTime() + hours * 60 * 60 * 1000)
}

function addDays(value: Date, days: number) {
  return addHours(value, days * 24)
}

function DateField({
  label,
  onChange,
  value,
}: {
  label: string
  onChange: (value: string) => void
  value: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="activity-editor__date">
      <span>{label}</span>
      <Button fill="outline" onClick={() => setVisible(true)}>
        {value ? value.slice(0, 16) : '请选择'}
      </Button>
      <DatePicker
        className="activity-editor__compact-picker"
        precision="minute"
        value={parseDate(value)}
        visible={visible}
        onClose={() => setVisible(false)}
        onConfirm={(date) => onChange(formatDate(date))}
      />
    </div>
  )
}

export function ActivityEditorPage() {
  const { activityId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { currentUser } = useAuth()
  const returnTo = safeReturnTo(
    new URLSearchParams(location.search).get('returnTo'),
    '/me?tab=created',
  )
  const [draft, setDraft] = useState<ActivityDraft>({
    ...emptyDraft,
    organizerName: currentUser?.nickName ?? '',
  })
  const [images, setImages] = useState<ImageUploadItem[]>([])
  const [tagPickerVisible, setTagPickerVisible] = useState(false)
  const categoriesQuery = useQuery({
    queryFn: fetchActivityCategories,
    queryKey: queryKeys.activities.categories(),
  })
  const detailQuery = useQuery({
    enabled: Boolean(activityId),
    queryFn: () => fetchActivityDetail(activityId!),
    queryKey: queryKeys.activities.detail(activityId ?? ''),
  })

  useEffect(() => {
    const activity = detailQuery.data
    if (!activity) return
    const urls = activity.images
      ? activity.images.split(',').filter(Boolean)
      : activity.coverImage
        ? [activity.coverImage]
        : []
    // Hydrate the editable local draft once the server detail is available.
    // oxlint-disable-next-line react/set-state-in-effect
    setImages(urls.map((url) => ({ url })))
    setDraft({
      activityFlow: activity.activityFlow ?? '',
      category: activity.category ?? '',
      contactInfo: activity.contactInfo ?? '',
      content: activity.content ?? '',
      coverImage: urls[0] ?? '',
      eventEndTime: activity.eventEndTime ?? '',
      eventStartTime: activity.eventStartTime ?? '',
      faq: activity.faq ?? '',
      id: activity.id,
      images: urls.join(','),
      location: activity.location ?? '',
      maxParticipants: activity.maxParticipants || 50,
      organizerName: activity.organizerName ?? '',
      registrationEndTime: activity.registrationEndTime ?? '',
      registrationMode: activity.registrationMode ?? 'AUDIT_REQUIRED',
      registrationStartTime: activity.registrationStartTime ?? '',
      summary: activity.summary ?? '',
      tagIds: activity.tags.map((tag) => tag.id),
      title: activity.title,
    })
  }, [detailQuery.data])

  const currentCategory = useMemo(
    () =>
      categoriesQuery.data?.find((category) => category.name === draft.category),
    [categoriesQuery.data, draft.category],
  )
  const selectedTagNames = useMemo(
    () =>
      (currentCategory?.tags ?? [])
        .filter((tag) => draft.tagIds.includes(tag.id))
        .map((tag) => tag.name),
    [currentCategory, draft.tagIds],
  )

  const saveMutation = useMutation({
    mutationFn: saveActivity,
    onSuccess: async (createdId) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.organizer.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.activities.all })
      showToast(activityId ? '活动已保存，等待平台审核' : '活动已提交，等待平台审核', 'success')
      navigate(activityId ? `/activities/${activityId}` : returnTo, {
        replace: true,
        state: createdId ? { createdActivityId: createdId } : undefined,
      })
    },
  })
  const offlineMutation = useMutation({
    mutationFn: (reason: string) => requestActivityOffline(activityId!, reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.organizer.all })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.activities.detail(activityId!),
      })
      showToast('下架申请已提交', 'success')
    },
  })

  const update = <K extends keyof ActivityDraft>(
    key: K,
    value: ActivityDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }))

  const submit = () => {
    if (!images.length) return showToast('请先上传至少一张活动图片', 'error')
    if (!draft.title.trim() || !draft.content.trim()) {
      return showToast('请填写活动标题和主要内容', 'error')
    }
    if (!draft.category || draft.tagIds.length < 1 || draft.tagIds.length > 5) {
      return showToast('请选择一级分类和 1-5 个二级标签', 'error')
    }
    if (
      !draft.registrationStartTime ||
      !draft.registrationEndTime ||
      !draft.eventStartTime ||
      !draft.eventEndTime
    ) {
      return showToast('请完整选择报名和活动时间', 'error')
    }
    const urls = images.map((item) => item.url)
    saveMutation.mutate({
      ...draft,
      coverImage: urls[0],
      images: urls.join(','),
    })
  }

  const moveImage = (index: number, offset: number) => {
    const target = index + offset
    if (target < 0 || target >= images.length) return
    setImages((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const applyTimePreset = (
    preset: 'competition' | 'halfday' | 'lecture' | 'volunteer',
  ) => {
    const base = draft.registrationStartTime
      ? parseDate(draft.registrationStartTime)
      : new Date(Math.ceil(Date.now() / 3_600_000) * 3_600_000)
    const settings = {
      competition: { registrationDays: 7, startDays: 10, startHour: 9, duration: 4 },
      halfday: { registrationDays: 2, startDays: 4, startHour: 9, duration: 4 },
      lecture: { registrationDays: 3, startDays: 5, startHour: 14, duration: 2 },
      volunteer: { registrationDays: 5, startDays: 8, startHour: 8, duration: 6 },
    }[preset]
    const eventStart = addDays(base, settings.startDays)
    eventStart.setHours(settings.startHour, preset === 'volunteer' ? 30 : 0, 0, 0)
    setDraft((current) => ({
      ...current,
      eventEndTime: formatDate(addHours(eventStart, settings.duration)),
      eventStartTime: formatDate(eventStart),
      registrationEndTime: formatDate(addDays(base, settings.registrationDays)),
      registrationStartTime: formatDate(base),
    }))
  }

  if (detailQuery.isPending && activityId) {
    return <LoadingState description="正在加载活动" fullPage />
  }
  if (detailQuery.error || categoriesQuery.error) {
    const error = detailQuery.error ?? categoriesQuery.error
    return <ErrorState description={error?.message} fullPage title="活动加载失败" />
  }

  return (
    <AppShell>
      <AppPage className="activity-editor">
        <PageHeader
          onBack={() => navigate(returnTo)}
          right={
            activityId && detailQuery.data?.status === 2 ? (
              <Button
                color="danger"
                fill="none"
                onClick={async () => {
                  const reason = await promptText('申请下架活动', '请输入申请下架原因')
                  if (reason) offlineMutation.mutate(reason)
                }}
                size="small"
              >
                申请下架
              </Button>
            ) : null
          }
          title="编辑活动"
        />
        <section className="activity-editor__hero">
          <h1>{activityId ? '完善活动内容' : '发起一场新活动'}</h1>
        </section>
        <section className="activity-editor__panel">
          <header className="activity-editor__author">
            <span>{(draft.organizerName || currentUser?.nickName || '主').slice(0, 1)}</span>
            <strong>{draft.organizerName || currentUser?.nickName || '主办方'}</strong>
          </header>
          <h2>活动封面 <i>*</i></h2>
          <div className="activity-editor__image-section">
            <CampusImageUploader
              maxCount={5}
              onChange={setImages}
              upload={async (file) => ({ url: await uploadActivityImage(file) })}
              value={images}
            />
            {images.length > 1 ? (
              <div className="activity-editor__image-order">
                {images.map((image, index) => (
                  <span key={`${image.url}-${index}`}>
                    {index === 0 ? '封面' : `图 ${index + 1}`}
                    <button aria-label="前移" onClick={() => moveImage(index, -1)} type="button"><UpOutline /></button>
                    <button aria-label="后移" onClick={() => moveImage(index, 1)} type="button"><DownOutline /></button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <Form className="activity-editor__composer" layout="vertical">
            <Form.Item label={<>标题信息 <i>*</i></>} className="activity-editor__title-item">
              <Input onChange={(value) => update('title', value)} placeholder="这一场活动，想让大家先看到什么标题？" value={draft.title} />
            </Form.Item>
            <Form.Item label={<>活动主要内容 <i>*</i></>}>
              <TextArea autoSize={{ minRows: 5, maxRows: 10 }} onChange={(value) => update('content', value)} placeholder="分享活动亮点、流程安排、参与提醒，像写一条动态正文一样自然展开。" value={draft.content} />
            </Form.Item>
            <Form.Item label="活动流程">
              <TextArea autoSize={{ minRows: 3, maxRows: 8 }} onChange={(value) => update('activityFlow', value)} placeholder="选填，例如：签到入场、开场致辞、主题分享、互动环节、自由交流。" value={draft.activityFlow} />
            </Form.Item>
            <Form.Item label="常见问题">
              <TextArea autoSize={{ minRows: 3, maxRows: 8 }} onChange={(value) => update('faq', value)} placeholder="选填，例如：是否需要自带设备、是否需要提前到场、是否提供证明材料。" value={draft.faq} />
            </Form.Item>
          </Form>
          <Form className="activity-editor__facts" layout="vertical">
            <Form.Item label="一句话摘要">
              <Input onChange={(value) => update('summary', value)} placeholder="例如：面向全校开放的创客成果体验日" value={draft.summary} />
            </Form.Item>
            <Form.Item label={<>一级分类 <i>*</i></>}>
              <Picker
                columns={[
                  (categoriesQuery.data ?? []).map((category) => ({
                    label: category.name,
                    value: category.name,
                  })),
                ]}
                onConfirm={(values) => {
                  update('category', String(values[0] ?? ''))
                  update('tagIds', [])
                }}
                popupClassName="activity-editor__compact-picker"
                value={draft.category ? [draft.category] : []}
              >
                {(items, actions) => (
                  <button
                    className="activity-editor__select-field"
                    onClick={actions.open}
                    type="button"
                  >
                    <span className={items[0] ? '' : 'is-placeholder'}>
                      {items[0]?.label ?? '请选择一级分类'}
                    </span>
                    <RightOutline />
                  </button>
                )}
              </Picker>
            </Form.Item>
            <Form.Item label={<>二级标签 <i>*</i></>}>
              <button
                className="activity-editor__select-field"
                disabled={!currentCategory}
                onClick={() => setTagPickerVisible(true)}
                type="button"
              >
                <span className={selectedTagNames.length ? '' : 'is-placeholder'}>
                  {selectedTagNames.length
                    ? selectedTagNames.join('、')
                    : currentCategory
                      ? '请选择 1-5 个标签'
                      : '请先选择一级分类'}
                </span>
                <RightOutline />
              </button>
            </Form.Item>
            <Form.Item label="报名模式">
              <Radio.Group onChange={(value) => update('registrationMode', value as RegistrationMode)} value={draft.registrationMode}>
                <Radio value="AUDIT_REQUIRED">审核制</Radio>
                <Radio value="FIRST_COME_FIRST_SERVED">先到先得</Radio>
              </Radio.Group>
            </Form.Item>
            <Form.Item label="主办方名称">
              <Input onChange={(value) => update('organizerName', value)} placeholder="默认使用当前昵称" value={draft.organizerName} />
            </Form.Item>
            <Form.Item label="主办方联系方式">
              <Input onChange={(value) => update('contactInfo', value)} placeholder="例如：张老师 139****1234 / 微信号 / 邮箱" value={draft.contactInfo} />
            </Form.Item>
            <Form.Item label="活动地点">
              <Input onChange={(value) => update('location', value)} placeholder="例如：大学生活动中心一楼大厅" value={draft.location} />
            </Form.Item>
          </Form>
          <section className="activity-editor__time-panel">
            <header>
              <h2>活动时间</h2>
            </header>
            <div className="activity-editor__presets">
              <Button fill="outline" onClick={() => applyTimePreset('lecture')} size="mini">讲座模板</Button>
              <Button fill="outline" onClick={() => applyTimePreset('competition')} size="mini">比赛模板</Button>
              <Button fill="outline" onClick={() => applyTimePreset('volunteer')} size="mini">公益模板</Button>
              <Button fill="outline" onClick={() => applyTimePreset('halfday')} size="mini">半天活动</Button>
            </div>
            <div className="activity-editor__dates">
              <DateField label="报名开始时间" onChange={(value) => update('registrationStartTime', value)} value={draft.registrationStartTime} />
              <DateField label="报名结束时间" onChange={(value) => update('registrationEndTime', value)} value={draft.registrationEndTime} />
              <DateField label="活动开始时间" onChange={(value) => update('eventStartTime', value)} value={draft.eventStartTime} />
              <DateField label="活动结束时间" onChange={(value) => update('eventEndTime', value)} value={draft.eventEndTime} />
            </div>
          </section>
          <div className="activity-editor__meta">
            <Form layout="vertical">
              <Form.Item label="报名人数上限">
                <Input min={1} onChange={(value) => update('maxParticipants', Number(value) || 0)} placeholder="请输入报名人数上限" type="number" value={String(draft.maxParticipants)} />
              </Form.Item>
            </Form>
          </div>
          <div className="activity-editor__actions">
            <Button onClick={() => navigate(returnTo)}>取消</Button>
            <Button color="primary" loading={saveMutation.isPending} onClick={() => { submit() }}>保存并提交</Button>
          </div>
        </section>
      </AppPage>
      <CampusPopup
        bodyClassName="activity-editor__tag-popup"
        onClose={() => setTagPickerVisible(false)}
        onMaskClick={() => setTagPickerVisible(false)}
        title="选择二级标签"
        visible={tagPickerVisible}
      >
        <CheckList
          multiple
          onChange={(values) => {
            if (values.length > 5) {
              showToast('最多选择 5 个标签', 'error')
              return
            }
            update('tagIds', values.map(String))
          }}
          value={draft.tagIds}
        >
          {(currentCategory?.tags ?? []).map((tag) => (
            <CheckList.Item key={tag.id} value={tag.id}>
              {tag.name}
            </CheckList.Item>
          ))}
        </CheckList>
        <Button
          block
          color="primary"
          onClick={() => setTagPickerVisible(false)}
        >
          完成
        </Button>
      </CampusPopup>
    </AppShell>
  )
}
