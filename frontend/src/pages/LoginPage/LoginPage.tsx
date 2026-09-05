import { zodResolver } from '@hookform/resolvers/zod'
import {
  Checkbox,
  Form,
  Input,
  SafeArea,
  Tabs,
} from 'antd-mobile'
import {
  EyeInvisibleOutline,
  EyeOutline,
  LockOutline,
  UserOutline,
} from 'antd-mobile-icons'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import {
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'
import { z } from 'zod'
import { ApiError } from '../../api/ApiError'
import { AppPage, AppShell } from '../../components/layout'
import { CampusButton, showToast } from '../../components/ui'
import { requestLogin, sendLoginCode } from '../../features/auth/api'
import { useAuth } from '../../features/auth/model'
import './LoginPage.css'

const PLATFORM_ADMIN_ROLE = 'PLATFORM_ADMIN'
const PHONE_PATTERN = /^1[3-9]\d{9}$/

const loginSchema = z
  .object({
    account: z.string(),
    agreed: z.boolean(),
    code: z.string(),
    mode: z.enum(['code', 'password']),
    password: z.string(),
    phone: z.string(),
  })
  .superRefine((values, context) => {
    if (!values.agreed) {
      context.addIssue({
        code: 'custom',
        message: '请先阅读并同意用户服务协议和隐私政策',
        path: ['agreed'],
      })
    }

    if (values.mode === 'code') {
      if (!PHONE_PATTERN.test(values.phone.trim())) {
        context.addIssue({
          code: 'custom',
          message: '请输入正确的 11 位手机号',
          path: ['phone'],
        })
      }
      if (!/^[A-Za-z0-9]{6}$/.test(values.code.trim())) {
        context.addIssue({
          code: 'custom',
          message: '请输入 6 位验证码',
          path: ['code'],
        })
      }
      return
    }

    if (!values.account.trim()) {
      context.addIssue({
        code: 'custom',
        message: '请输入手机号或账号',
        path: ['account'],
      })
    }
    if (!values.password) {
      context.addIssue({
        code: 'custom',
        message: '请输入密码',
        path: ['password'],
      })
    }
  })

type LoginFormValues = z.infer<typeof loginSchema>
type LoginMode = LoginFormValues['mode']

function safeReturnTo(value: unknown): string | null {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.startsWith('/login')
  ) {
    return null
  }
  return value
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  return '登录失败，请稍后重试'
}

export function LoginPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { currentUser, establishSession, status } = useAuth()
  const [countdown, setCountdown] = useState(0)
  const [sendingCode, setSendingCode] = useState(false)
  const [passwordVisible, setPasswordVisible] = useState(false)

  const {
    clearErrors,
    control,
    formState: { errors, isSubmitting },
    getValues,
    handleSubmit,
    setError,
    setValue,
  } = useForm<LoginFormValues>({
    defaultValues: {
      account: '',
      agreed: false,
      code: '',
      mode: 'code',
      password: '',
      phone: '',
    },
    resolver: zodResolver(loginSchema),
  })

  const mode = useWatch({ control, name: 'mode' })
  const returnTo = useMemo(() => {
    const state = location.state as { returnTo?: unknown } | null
    return (
      safeReturnTo(state?.returnTo) ??
      safeReturnTo(searchParams.get('returnTo'))
    )
  }, [location.state, searchParams])

  useEffect(() => {
    if (countdown <= 0) {
      return
    }
    const timer = window.setTimeout(
      () => setCountdown((value) => value - 1),
      1_000,
    )
    return () => window.clearTimeout(timer)
  }, [countdown])

  useEffect(() => {
    if (status !== 'authenticated' || !currentUser) {
      return
    }
    const destination = currentUser.roleCodes.includes(PLATFORM_ADMIN_ROLE)
      ? '/admin'
      : returnTo ?? '/'
    navigate(destination, { replace: true })
  }, [currentUser, navigate, returnTo, status])

  function changeMode(key: string) {
    const nextMode = key as LoginMode
    setValue('mode', nextMode)
    clearErrors()
  }

  async function handleSendCode() {
    clearErrors('phone')
    const phone = getValues('phone').trim()
    if (!PHONE_PATTERN.test(phone)) {
      setError('phone', {
        message: '请输入正确的 11 位手机号',
        type: 'validate',
      })
      return
    }

    setSendingCode(true)
    try {
      await sendLoginCode(phone)
      setCountdown(60)
      showToast('验证码已发送', 'success')
    } catch (error) {
      showToast(errorMessage(error), 'error')
    } finally {
      setSendingCode(false)
    }
  }

  const submitLogin = handleSubmit(async (values) => {
    try {
      const token = await requestLogin(
        values.mode === 'code'
          ? {
              code: values.code.trim(),
              phone: values.phone.trim(),
            }
          : {
              password: values.password,
              phone: values.account.trim(),
            },
      )
      const user = await establishSession(token)
      const destination = user.roleCodes.includes(PLATFORM_ADMIN_ROLE)
        ? '/admin'
        : returnTo ?? '/'
      navigate(destination, { replace: true })
    } catch (error) {
      showToast(errorMessage(error), 'error')
    }
  })

  return (
    <AppShell className="login-page">
      <AppPage className="login-page__content" padded>
        <SafeArea position="top" />
        <header className="login-page__brand">
          <img
            alt="西安电子科技大学校徽"
            className="login-page__brand-mark"
            src="/xdu.png"
          />
          <h1>校园活动平台</h1>
        </header>

        <section className="login-page__panel" aria-label="登录表单">
          <Tabs activeKey={mode} onChange={changeMode}>
            <Tabs.Tab key="code" title="验证码登录" />
            <Tabs.Tab key="password" title="密码登录" />
          </Tabs>

          <Form
            className="login-page__form"
            footer={
              <CampusButton
                block
                color="primary"
                loading={isSubmitting}
                loadingText="正在登录"
                size="large"
                type="submit"
              >
                登录
              </CampusButton>
            }
            layout="horizontal"
            mode="card"
            onFinish={() => void submitLogin()}
          >
            {mode === 'code' ? (
              <>
                <Form.Item
                  help={errors.phone?.message}
                  label={<UserOutline aria-hidden="true" />}
                >
                  <Controller
                    control={control}
                    name="phone"
                    render={({ field }) => (
                      <Input
                        {...field}
                        aria-label="手机号"
                        clearable
                        inputMode="tel"
                        maxLength={11}
                        placeholder="请输入手机号"
                      />
                    )}
                  />
                </Form.Item>
                <Form.Item
                  className="login-page__code-item"
                  help={errors.code?.message}
                  label={<LockOutline aria-hidden="true" />}
                >
                  <div className="login-page__code-row">
                    <Controller
                      control={control}
                      name="code"
                      render={({ field }) => (
                        <Input
                          {...field}
                          aria-label="验证码"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="6 位验证码"
                        />
                      )}
                    />
                    <CampusButton
                      className="login-page__code-button"
                      disabled={countdown > 0}
                      loading={sendingCode}
                      onClick={() => void handleSendCode()}
                      size="small"
                      type="button"
                    >
                      {countdown > 0 ? `${countdown} 秒` : '获取验证码'}
                    </CampusButton>
                  </div>
                </Form.Item>
                <p className="login-page__hint">
                  未注册的手机号验证后将自动创建账户
                </p>
              </>
            ) : (
              <>
                <Form.Item
                  help={errors.account?.message}
                  label={<UserOutline aria-hidden="true" />}
                >
                  <Controller
                    control={control}
                    name="account"
                    render={({ field }) => (
                      <Input
                        {...field}
                        aria-label="手机号或账号"
                        clearable
                        placeholder="请输入手机号或账号"
                      />
                    )}
                  />
                </Form.Item>
                <Form.Item
                  help={errors.password?.message}
                  label={<LockOutline aria-hidden="true" />}
                >
                  <div className="login-page__password-row">
                    <Controller
                      control={control}
                      name="password"
                      render={({ field }) => (
                        <Input
                          {...field}
                          aria-label="密码"
                          placeholder="请输入密码"
                          type={passwordVisible ? 'text' : 'password'}
                        />
                      )}
                    />
                    <button
                      aria-label={passwordVisible ? '隐藏密码' : '显示密码'}
                      className="login-page__visibility"
                      onClick={() => setPasswordVisible((value) => !value)}
                      type="button"
                    >
                      {passwordVisible ? (
                        <EyeOutline />
                      ) : (
                        <EyeInvisibleOutline />
                      )}
                    </button>
                  </div>
                </Form.Item>
              </>
            )}

            <div className="login-page__agreement">
              <Controller
                control={control}
                name="agreed"
                render={({ field }) => (
                  <Checkbox
                    aria-label="同意用户协议和隐私政策"
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <span>
                我已阅读并同意
                <strong>《用户服务协议》</strong>
                和
                <strong>《隐私政策》</strong>
              </span>
            </div>
            {errors.agreed ? (
              <p className="login-page__agreement-error">
                {errors.agreed.message}
              </p>
            ) : null}
          </Form>
        </section>

        <footer className="login-page__footer">
          西安电子科技大学校园活动服务
        </footer>
      </AppPage>
    </AppShell>
  )
}
