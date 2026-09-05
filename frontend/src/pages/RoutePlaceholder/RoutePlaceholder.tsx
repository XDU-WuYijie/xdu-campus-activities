import { useNavigate } from 'react-router-dom'
import { CampusButton } from '../../components/ui'
import './RoutePlaceholder.css'

interface RoutePlaceholderProps {
  title: string
  description: string
  showBack?: boolean
}

export function RoutePlaceholder({
  title,
  description,
  showBack = false,
}: RoutePlaceholderProps) {
  const navigate = useNavigate()

  return (
    <main className="route-page">
      <section className="route-panel">
        <span className="route-status">React Migration</span>
        <h1>{title}</h1>
        <p>{description}</p>
        {showBack ? (
          <CampusButton
            color="primary"
            fill="outline"
            onClick={() => navigate(-1)}
          >
            返回
          </CampusButton>
        ) : null}
      </section>
    </main>
  )
}

export function ForbiddenPage() {
  const navigate = useNavigate()

  return (
    <main className="route-page">
      <section className="route-panel">
        <span className="route-status route-status--warning">403</span>
        <h1>无权访问</h1>
        <p>当前账号没有访问该页面所需的角色或权限。</p>
        <CampusButton color="primary" onClick={() => navigate('/', { replace: true })}>
          返回首页
        </CampusButton>
      </section>
    </main>
  )
}

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <main className="route-page">
      <section className="route-panel">
        <span className="route-status route-status--warning">404</span>
        <h1>页面不存在</h1>
        <p>请检查访问地址，或返回首页继续浏览。</p>
        <CampusButton color="primary" onClick={() => navigate('/', { replace: true })}>
          返回首页
        </CampusButton>
      </section>
    </main>
  )
}
