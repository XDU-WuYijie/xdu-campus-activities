import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  DatePicker,
  Form,
  ImageUploader,
  Input,
  Popup,
  Selector,
  TextArea,
  type ImageUploadItem,
  type ImageUploaderRef,
} from 'antd-mobile'
import { UserOutline } from 'antd-mobile-icons'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { queryKeys } from '../../api/queryKeys'
import { AppPage, AppShell, PageHeader } from '../../components/layout'
import {
  CampusButton,
  ErrorState,
  LoadingState,
  showToast,
} from '../../components/ui'
import { useAuth } from '../../features/auth'
import {
  applyForOrganizer,
  fetchOrganizerApplication,
  fetchUserProfile,
  updateUserProfile,
  uploadAvatar,
  type OrganizerApplicationInput,
  type UserProfileUpdate,
} from '../../features/profile'
import './ProfileEditPage.css'

const ACTIVITY_CREATE_PERMISSION = 'activity:create'
const PLATFORM_ADMIN_ROLE = 'PLATFORM_ADMIN'

function formatDate(value: Date | null) {
  if (!value) return null
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDate(value?: string) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function applicationStatus(status?: string) {
  if (status === 'PENDING') return '待审核'
  if (status === 'APPROVED') return '已通过'
  if (status === 'REJECTED') return '已驳回'
  return status || '未申请'
}

export function ProfileEditPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { currentUser, logout } = useAuth()
  const [form] = Form.useForm<UserProfileUpdate>()
  const [applyForm] = Form.useForm<OrganizerApplicationInput>()
  const [applyVisible, setApplyVisible] = useState(false)
  const avatarUploaderRef = useRef<ImageUploaderRef>(null)
  const userId = currentUser?.id ?? ''
  const canManageActivities = Boolean(
    currentUser?.permissions.includes(ACTIVITY_CREATE_PERMISSION),
  )
  const showOrganizerApply =
    !currentUser?.roleCodes.includes(PLATFORM_ADMIN_ROLE)

  const profileQuery = useQuery({
    enabled: Boolean(userId),
    queryFn: () => fetchUserProfile(userId),
    queryKey: queryKeys.profile.detail(userId),
  })
  const applicationQuery = useQuery({
    enabled: showOrganizerApply,
    queryFn: fetchOrganizerApplication,
    queryKey: queryKeys.profile.application(),
  })

  useEffect(() => {
    if (!profileQuery.data) return
    form.setFieldsValue({
      birthday: profileQuery.data.birthday ?? null,
      city: profileQuery.data.city ?? '',
      college: profileQuery.data.college ?? '',
      gender: profileQuery.data.gender ?? null,
      grade: profileQuery.data.grade ?? '',
      introduce: profileQuery.data.introduce ?? '',
      mentor: profileQuery.data.mentor ?? '',
      nickName: currentUser?.nickName ?? '',
    })
  }, [currentUser?.nickName, form, profileQuery.data])

  const saveMutation = useMutation({
    mutationFn: updateUserProfile,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.auth.currentUser(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.profile.detail(userId),
        }),
      ])
      showToast('资料已保存', 'success')
      navigate('/me')
    },
  })
  const avatarMutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.auth.currentUser(),
      })
      showToast('头像已更新', 'success')
    },
  })
  const applyMutation = useMutation({
    mutationFn: applyForOrganizer,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.profile.application(),
      })
      setApplyVisible(false)
      applyForm.resetFields()
      showToast('申请已提交', 'success')
    },
  })

  const avatarItems: ImageUploadItem[] = currentUser?.icon
    ? [{ url: currentUser.icon }]
    : []

  if (profileQuery.isPending) {
    return (
      <AppShell>
        <AppPage className="profile-edit-page">
          <PageHeader onBack={() => navigate('/me')} title="编辑资料" />
          <LoadingState description="正在加载个人资料" />
        </AppPage>
      </AppShell>
    )
  }

  if (profileQuery.isError) {
    return (
      <AppShell>
        <AppPage className="profile-edit-page">
          <PageHeader onBack={() => navigate('/me')} title="编辑资料" />
          <ErrorState
            description={profileQuery.error.message}
            onRetry={() => profileQuery.refetch()}
          />
        </AppPage>
      </AppShell>
    )
  }

  const application = applicationQuery.data

  return (
    <AppShell>
      <AppPage className="profile-edit-page">
        <PageHeader onBack={() => navigate('/me')} title="编辑资料" />
        <section className="profile-edit-page__avatar">
          <ImageUploader
            accept="image/*"
            deletable={false}
            maxCount={2}
            onChange={() => undefined}
            ref={avatarUploaderRef}
            upload={async (file) => ({ url: await avatarMutation.mutateAsync(file) })}
            value={avatarItems}
          >
            <span className="profile-edit-page__avatar-fallback">
              <UserOutline />
            </span>
          </ImageUploader>
          <Button
            fill="outline"
            loading={avatarMutation.isPending}
            onClick={() => avatarUploaderRef.current?.nativeElement?.click()}
            size="mini"
          >
            更换头像
          </Button>
        </section>

        {showOrganizerApply ? (
          <section className="profile-edit-page__application">
            <h2>活动主办方申请</h2>
            {canManageActivities ? (
              <p>当前账号已具备活动主办方权限，可以发起活动并管理报名审核。</p>
            ) : application ? (
              <>
                <p>当前申请状态：{applicationStatus(application.applyStatus)}</p>
                <p>申请组织：{application.orgName}</p>
                {application.reviewRemark ? (
                  <p>审核备注：{application.reviewRemark}</p>
                ) : null}
              </>
            ) : (
              <p>成为主办方后可发起活动、审核报名请求并执行签到核销。</p>
            )}
            {!canManageActivities && application?.applyStatus !== 'PENDING' ? (
              <CampusButton
                fill="outline"
                onClick={() => setApplyVisible(true)}
                size="small"
              >
                申请成为主办方
              </CampusButton>
            ) : null}
          </section>
        ) : null}

        <section className="profile-edit-page__form">
          <h2>基本信息</h2>
          <Form
            form={form}
            layout="horizontal"
            onFinish={async (values) => {
              try {
                await saveMutation.mutateAsync({
                  ...values,
                  birthday: values.birthday || null,
                  city: values.city?.trim() ?? '',
                  college: values.college?.trim() ?? '',
                  grade: values.grade?.trim() ?? '',
                  introduce: values.introduce?.trim() ?? '',
                  mentor: values.mentor?.trim() ?? '',
                  nickName: values.nickName.trim(),
                })
              } catch (error) {
                showToast((error as Error).message, 'error')
              }
            }}
          >
            <Form.Item
              label="昵称"
              name="nickName"
              rules={[
                { message: '请输入昵称', required: true },
                { max: 32, message: '昵称不能超过 32 个字符' },
              ]}
            >
              <Input clearable placeholder="请输入昵称" />
            </Form.Item>
            <Form.Item label="所属学院" name="college">
              <Input clearable maxLength={64} placeholder="例如：计算机学院" />
            </Form.Item>
            <Form.Item label="所属年级" name="grade">
              <Input clearable maxLength={32} placeholder="例如：2023级" />
            </Form.Item>
            <Form.Item label="导师" name="mentor">
              <Input clearable maxLength={64} placeholder="例如：张老师" />
            </Form.Item>
            <Form.Item
              getValueProps={(value: boolean | null) => ({
                value:
                  value === null || value === undefined
                    ? []
                    : [value ? 'female' : 'male'],
              })}
              label="性别"
              name="gender"
              normalize={(value: string[]) =>
                value[0] === undefined ? null : value[0] === 'female'
              }
            >
              <Selector
                columns={2}
                options={[
                  { label: '男', value: 'male' },
                  { label: '女', value: 'female' },
                ]}
                showCheckMark={false}
              />
            </Form.Item>
            <Form.Item label="城市" name="city">
              <Input clearable maxLength={64} placeholder="例如：西安" />
            </Form.Item>
            <Form.Item
              getValueProps={(value?: string) => ({
                value: parseDate(value),
              })}
              label="生日"
              name="birthday"
              normalize={(value: Date | null) => formatDate(value)}
              trigger="onConfirm"
            >
              <DatePicker precision="day">
                {(value) => (
                  <button
                    className="profile-edit-page__picker"
                    type="button"
                  >
                    {formatDate(value) || '选择日期'}
                  </button>
                )}
              </DatePicker>
            </Form.Item>
            <Form.Item label="个人介绍" name="introduce">
              <TextArea
                autoSize={{ minRows: 3, maxRows: 5 }}
                maxLength={128}
                placeholder="介绍一下自己"
                showCount
              />
            </Form.Item>
            <div className="profile-edit-page__save">
              <CampusButton
                block
                loading={saveMutation.isPending}
                type="submit"
              >
                保存资料
              </CampusButton>
            </div>
          </Form>
        </section>

        <Button
          block
          color="danger"
          fill="outline"
          onClick={async () => {
            await logout()
            navigate('/login', { replace: true })
          }}
        >
          退出登录
        </Button>
      </AppPage>

      <Popup
        bodyClassName="profile-edit-page__apply-popup"
        closeOnMaskClick
        onClose={() => setApplyVisible(false)}
        position="bottom"
        visible={applyVisible}
      >
        <header>
          <h2>申请成为主办方</h2>
          <p>请填写组织名称与申请理由。</p>
        </header>
        <Form
          form={applyForm}
          layout="vertical"
          onFinish={async (values) => {
            try {
              await applyMutation.mutateAsync({
                orgName: values.orgName.trim(),
                reason: values.reason.trim(),
              })
            } catch (error) {
              showToast((error as Error).message, 'error')
            }
          }}
        >
          <Form.Item
            label="组织或社团名称"
            name="orgName"
            rules={[{ message: '请填写组织或社团名称', required: true }]}
          >
            <Input maxLength={64} placeholder="例如：校学生会" />
          </Form.Item>
          <Form.Item
            label="申请理由"
            name="reason"
            rules={[{ message: '请填写申请理由', required: true }]}
          >
            <TextArea
              autoSize={{ minRows: 3, maxRows: 5 }}
              maxLength={256}
              placeholder="说明组织情况和活动计划"
            />
          </Form.Item>
          <CampusButton
            block
            loading={applyMutation.isPending}
            type="submit"
          >
            提交申请
          </CampusButton>
        </Form>
      </Popup>
    </AppShell>
  )
}
