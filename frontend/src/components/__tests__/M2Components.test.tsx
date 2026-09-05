import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dialog, Toast } from 'antd-mobile'
import { AppOutline, CompassOutline } from 'antd-mobile-icons'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppPage, AppShell, BottomNav, PageHeader } from '../layout'
import {
  ActivityCard,
  CampusDialog,
  CampusImage,
  CampusImageUploader,
  CampusPopup,
  SearchFilters,
  confirmAction,
  showToast,
} from '../ui'

describe('M2 layout components', () => {
  it('applies the mobile page and bottom navigation layout contract', () => {
    render(
      <AppShell data-testid="shell">
        <AppPage data-testid="page" hasBottomNav padded>
          content
        </AppPage>
      </AppShell>,
    )

    expect(screen.getByTestId('shell')).toHaveClass('app-shell')
    expect(screen.getByTestId('page')).toHaveClass(
      'app-page',
      'app-page--padded',
      'app-page--with-bottom-nav',
    )
  })

  it('uses NavBar and delegates the back action', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()

    render(
      <MemoryRouter>
        <PageHeader onBack={onBack} title="活动详情" />
      </MemoryRouter>,
    )

    await user.click(screen.getByText('返回'))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('uses TabBar and reports navigation changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <BottomNav
        activeKey="home"
        items={[
          { icon: <AppOutline />, key: 'home', label: '首页' },
          { icon: <CompassOutline />, key: 'discover', label: '发现' },
        ]}
        onChange={onChange}
      />,
    )

    await user.click(screen.getByText('发现'))
    expect(onChange).toHaveBeenCalledWith('discover')
  })
})

describe('M2 business controls', () => {
  it('renders an activity card and preserves a 64-bit string ID', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    const id = '9007199254740993'

    render(
      <ActivityCard
        category="学术讲座"
        id={id}
        location="大学生活动中心"
        maxParticipants={300}
        onOpen={onOpen}
        registeredCount={186}
        status={{ label: '报名中', tone: 'success' }}
        tags={['人工智能']}
        timeText="9月12日 19:00"
        title="人工智能与未来校园创新论坛"
      />,
    )

    expect(screen.getByText('186 / 300 人')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '查看详情' }))
    expect(onOpen).toHaveBeenCalledWith(id)
  })

  it('delegates search and filter changes to Ant Design Mobile controls', async () => {
    const user = userEvent.setup()
    const onFilterChange = vi.fn()
    const onSearchChange = vi.fn()

    render(
      <SearchFilters
        filterOptions={[
          { label: '全部', value: 'all' },
          { label: '讲座', value: 'lecture' },
        ]}
        filterValues={['all']}
        onFilterChange={onFilterChange}
        onSearchChange={onSearchChange}
        searchValue=""
      />,
    )

    await user.type(
      screen.getByPlaceholderText('搜索活动名称、地点或标签'),
      '人工智能',
    )
    await user.click(screen.getByText('讲座'))

    expect(onSearchChange).toHaveBeenCalled()
    expect(onFilterChange).toHaveBeenCalledWith(
      ['lecture'],
      expect.anything(),
    )
  })

  it('shows a consistent fallback when an image fails', () => {
    const { container } = render(
      <CampusImage alt="活动封面" src="/broken.jpg" />,
    )

    fireEvent.error(container.querySelector('img')!)
    expect(screen.getByRole('img', { name: '图片加载失败' })).toBeInTheDocument()
  })

  it('configures image upload for image files and renders the upload action', () => {
    const { container } = render(
      <CampusImageUploader
        onChange={() => undefined}
        upload={vi.fn()}
        value={[]}
      />,
    )

    expect(screen.getByText('上传图片')).toBeInTheDocument()
    expect(container.querySelector('input[type="file"]')).toHaveAttribute(
      'accept',
      'image/*',
    )
  })
})

describe('M2 feedback controls', () => {
  it('renders the unified dialog and popup content', () => {
    render(
      <>
        <CampusDialog content="报名信息" title="确认报名" visible />
        <CampusPopup title="活动筛选" visible>
          筛选内容
        </CampusPopup>
      </>,
    )

    expect(screen.getByText('确认报名')).toBeInTheDocument()
    expect(screen.getByText('报名信息')).toBeInTheDocument()
    expect(screen.getByText('活动筛选')).toBeInTheDocument()
    expect(screen.getByText('筛选内容')).toBeInTheDocument()
  })

  it('applies shared defaults to imperative confirm and toast interactions', async () => {
    const confirmSpy = vi.spyOn(Dialog, 'confirm').mockResolvedValue(true)
    const toastSpy = vi.spyOn(Toast, 'show').mockReturnValue({ close: vi.fn() })

    await confirmAction({ content: '确认提交吗？' })
    showToast('提交成功', 'success')

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cancelText: '取消',
        className: 'campus-dialog',
        confirmText: '确认',
      }),
    )
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '提交成功',
        icon: 'success',
        position: 'top',
      }),
    )

    confirmSpy.mockRestore()
    toastSpy.mockRestore()
  })
})
