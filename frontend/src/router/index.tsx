import { createBrowserRouter, Outlet } from 'react-router-dom'
import {
  ForbiddenPage,
  NotFoundPage,
  RoutePlaceholder,
} from '../pages/RoutePlaceholder'
import { AuthenticatedRoute, RoleRoute } from './guards'

const ACTIVITY_ADMIN_ROLE = 'ACTIVITY_ADMIN'
const PLATFORM_ADMIN_ROLE = 'PLATFORM_ADMIN'
const ACTIVITY_CREATE_PERMISSION = 'activity:create'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <RoutePlaceholder
        description="登录页面将在 M3 迁移。"
        title="登录"
      />
    ),
  },
  {
    element: <AuthenticatedRoute />,
    children: [
      {
        path: '/',
        element: (
          <RoutePlaceholder
            description="活动门户将在 M4 迁移。"
            title="校园活动"
          />
        ),
      },
      {
        path: '/activities/:activityId',
        element: (
          <RoutePlaceholder
            description="活动详情将在 M4 迁移。"
            showBack
            title="活动详情"
          />
        ),
      },
      {
        path: '/discover',
        element: (
          <RoutePlaceholder
            description="校园圈将在 M7 迁移。"
            title="校园圈"
          />
        ),
      },
      {
        path: '/discover/create',
        element: (
          <RoutePlaceholder
            description="动态发布将在 M7 迁移。"
            showBack
            title="发布动态"
          />
        ),
      },
      {
        path: '/notifications',
        element: (
          <RoutePlaceholder
            description="通知中心将在 M8 迁移。"
            title="消息"
          />
        ),
      },
      {
        path: '/me/profile',
        element: (
          <RoutePlaceholder
            description="个人资料将在 M6 迁移。"
            showBack
            title="个人资料"
          />
        ),
      },
      {
        path: '/me/preferences',
        element: (
          <RoutePlaceholder
            description="活动偏好将在 M6 迁移。"
            showBack
            title="活动偏好"
          />
        ),
      },
      {
        path: '/me/registrations',
        element: (
          <RoutePlaceholder
            description="报名记录将在 M6 迁移。"
            title="我的报名"
          />
        ),
      },
      {
        path: '/me/favorites',
        element: (
          <RoutePlaceholder
            description="收藏列表将在 M6 迁移。"
            title="我的收藏"
          />
        ),
      },
      {
        path: '/organizer',
        element: (
          <RoleRoute
            requiredPermission={ACTIVITY_CREATE_PERMISSION}
            requiredRole={ACTIVITY_ADMIN_ROLE}
          >
            <Outlet />
          </RoleRoute>
        ),
        children: [
          {
            path: 'activities',
            element: (
              <RoutePlaceholder
                description="主办方活动列表将在 M9 迁移。"
                title="我发起的活动"
              />
            ),
          },
          {
            path: 'activities/new',
            element: (
              <RoutePlaceholder
                description="活动创建将在 M9 迁移。"
                showBack
                title="发起活动"
              />
            ),
          },
          {
            path: 'activities/:activityId/edit',
            element: (
              <RoutePlaceholder
                description="活动编辑将在 M9 迁移。"
                showBack
                title="编辑活动"
              />
            ),
          },
          {
            path: 'activities/:activityId/check-in',
            element: (
              <RoutePlaceholder
                description="签到管理将在 M9 迁移。"
                showBack
                title="签到管理"
              />
            ),
          },
          {
            path: 'reviews',
            element: (
              <RoutePlaceholder
                description="审核历史将在 M9 迁移。"
                title="审核历史"
              />
            ),
          },
          {
            path: 'dashboard',
            element: (
              <RoutePlaceholder
                description="主办方数据看板将在 M9 迁移。"
                title="数据看板"
              />
            ),
          },
        ],
      },
      {
        path: '/admin',
        element: (
          <RoleRoute requiredRole={PLATFORM_ADMIN_ROLE}>
            <Outlet />
          </RoleRoute>
        ),
        children: [
          {
            index: true,
            element: (
              <RoutePlaceholder
                description="平台管理后台将在 M10 迁移。"
                title="平台管理"
              />
            ),
          },
          {
            path: '*',
            element: (
              <RoutePlaceholder
                description="平台管理子页面将在 M10 迁移。"
                title="平台管理"
              />
            ),
          },
        ],
      },
      {
        path: '/403',
        element: <ForbiddenPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
])
