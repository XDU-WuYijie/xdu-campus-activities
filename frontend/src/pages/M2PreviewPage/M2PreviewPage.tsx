import { useState } from 'react'
import type { ImageUploadItem } from 'antd-mobile'
import {
  AddCircleOutline,
  AppOutline,
  BellOutline,
  CompassOutline,
  MessageOutline,
  UserOutline,
} from 'antd-mobile-icons'
import { AppPage, AppShell, BottomNav, PageHeader } from '../../components/layout'
import {
  ActivityCard,
  CampusButton,
  CampusImageUploader,
  CampusPopup,
  SearchFilters,
  StatusTag,
  confirmAction,
  showToast,
} from '../../components/ui'
import './M2PreviewPage.css'

const PREVIEW_IMAGE =
  'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=Realistic%20wide%20photograph%20of%20a%20modern%20Chinese%20university%20auditorium%20during%20a%20student%20technology%20lecture%2C%20bright%20natural%20lighting%2C%20students%20seated%2C%20clear%20stage%2C%20professional%20campus%20event%20photography%2C%20no%20text%2C%20no%20logos&image_size=landscape_4_3'

const FILTER_OPTIONS = [
  { label: '全部', value: 'all' },
  { label: '讲座', value: 'lecture' },
  { label: '竞赛', value: 'competition' },
]

export function M2PreviewPage() {
  const [activeNav, setActiveNav] = useState('home')
  const [filters, setFilters] = useState(['all'])
  const [images, setImages] = useState<ImageUploadItem[]>([])
  const [popupVisible, setPopupVisible] = useState(false)
  const [search, setSearch] = useState('')

  const navItems = [
    { icon: <AppOutline />, key: 'home', label: '首页' },
    { icon: <CompassOutline />, key: 'discover', label: '发现' },
    { icon: <AddCircleOutline />, key: 'publish', label: '发布' },
    { badge: '3', icon: <MessageOutline />, key: 'message', label: '消息' },
    { icon: <UserOutline />, key: 'me', label: '我的' },
  ]

  return (
    <AppShell>
      <AppPage hasBottomNav>
        <PageHeader
          back={false}
          right={
            <CampusButton
              aria-label="查看通知"
              className="m2-preview__icon-button"
              fill="none"
              onClick={() => {
                showToast('暂无新通知')
              }}
              size="mini"
            >
              <BellOutline aria-hidden />
            </CampusButton>
          }
          title="校园活动"
        />

        <div className="m2-preview">
          <section className="m2-preview__intro">
            <div>
              <span className="m2-preview__eyebrow">西电校园</span>
              <h1>发现值得参加的活动</h1>
            </div>
            <StatusTag tone="success">报名开放</StatusTag>
          </section>

          <SearchFilters
            filterOptions={FILTER_OPTIONS}
            filterValues={filters}
            onFilterChange={setFilters}
            onSearch={(value) => showToast(`正在搜索：${value || '全部活动'}`)}
            onSearchChange={setSearch}
            searchValue={search}
          />

          <section aria-labelledby="featured-title" className="m2-preview__section">
            <div className="m2-preview__section-heading">
              <h2 id="featured-title">近期活动</h2>
              <CampusButton fill="none" onClick={() => setPopupVisible(true)} size="small">
                更多筛选
              </CampusButton>
            </div>
            <ActivityCard
              category="学术讲座"
              coverUrl={PREVIEW_IMAGE}
              id="9007199254740993"
              location="南校区大学生活动中心"
              maxParticipants={300}
              onOpen={() => showToast('活动详情将在 M4 接入', 'success')}
              registeredCount={186}
              status={{ label: '报名中', tone: 'success' }}
              tags={['人工智能', '创新实践']}
              timeText="9月12日 19:00"
              title="人工智能与未来校园创新论坛"
            />
          </section>

          <section aria-labelledby="upload-title" className="m2-preview__section">
            <div className="m2-preview__section-heading">
              <h2 id="upload-title">活动图片</h2>
            </div>
            <CampusImageUploader
              onChange={setImages}
              upload={async (file) => ({
                key: `${file.name}-${file.lastModified}`,
                url: URL.createObjectURL(file),
              })}
              value={images}
            />
          </section>

          <section aria-label="反馈交互" className="m2-preview__actions">
            <CampusButton
              fill="outline"
              onClick={() => {
                showToast('设置已保存', 'success', { duration: 5000 })
              }}
            >
              保存设置
            </CampusButton>
            <CampusButton
              color="primary"
              onClick={async () => {
                const confirmed = await confirmAction({
                  content: '提交后将占用一个报名名额。',
                  title: '确认报名',
                })
                if (confirmed) showToast('报名提交成功', 'success')
              }}
            >
              确认报名
            </CampusButton>
          </section>
        </div>

        <BottomNav
          activeKey={activeNav}
          items={navItems}
          onChange={(key) => {
            setActiveNav(key)
            showToast(`已切换到${navItems.find((item) => item.key === key)?.label}`)
          }}
        />
      </AppPage>

      <CampusPopup
        closeOnMaskClick
        onClose={() => setPopupVisible(false)}
        title="更多筛选"
        visible={popupVisible}
      >
        <SearchFilters
          filterColumns={2}
          filterLabel="活动状态"
          filterOptions={[
            { label: '报名中', value: 'open' },
            { label: '即将开始', value: 'upcoming' },
          ]}
          filterValues={['open']}
          onFilterChange={() => undefined}
          onSearchChange={() => undefined}
          placeholder="搜索主办方"
          searchValue=""
        />
      </CampusPopup>
    </AppShell>
  )
}
