import {
  createBrowserRouter,
  Outlet,
} from 'react-router-dom'
import {
  ForbiddenPage,
  NotFoundPage,
} from '../pages/RoutePlaceholder'
import { ActivityDetailPage } from '../pages/ActivityDetailPage'
import { ActivityEditorPage } from '../pages/ActivityEditorPage'
import { ActivityPortalPage } from '../pages/ActivityPortalPage'
import { ActivityPreferencesPage } from '../pages/ActivityPreferencesPage'
import { DiscoverCreatePage } from '../pages/DiscoverCreatePage'
import { DiscoverPage } from '../pages/DiscoverPage'
import { LoginPage } from '../pages/LoginPage'
import { M2PreviewPage } from '../pages/M2PreviewPage'
import { MyFavoritesPage } from '../pages/MyFavoritesPage'
import { MyRegistrationsPage } from '../pages/MyRegistrationsPage'
import { NotificationPage } from '../pages/NotificationPage'
import { OrganizerDashboardPage } from '../pages/OrganizerDashboardPage'
import { CheckInPage } from '../pages/CheckInPage'
import { ProfileEditPage } from '../pages/ProfileEditPage'
import { ProfilePage } from '../pages/ProfilePage'
import { AdminPage } from '../pages/AdminPage'
import { AuthenticatedRoute, RoleRoute } from './guards'
import { LegacyOrganizerActivitiesRedirect } from './LegacyOrganizerActivitiesRedirect'

const ACTIVITY_ADMIN_ROLE = 'ACTIVITY_ADMIN'
const PLATFORM_ADMIN_ROLE = 'PLATFORM_ADMIN'
const ACTIVITY_CREATE_PERMISSION = 'activity:create'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <AuthenticatedRoute />,
    children: [
      {
        path: '/',
        element: <ActivityPortalPage />,
      },
      {
        path: '/activities/categories/:categoryId',
        element: <ActivityPortalPage />,
      },
      {
        path: '/activities/:activityId',
        element: <ActivityDetailPage />,
      },
      {
        path: '/discover',
        element: <DiscoverPage />,
      },
      {
        path: '/discover/create',
        element: <DiscoverCreatePage />,
      },
      {
        path: '/notifications',
        element: <NotificationPage />,
      },
      {
        path: '/me',
        element: <ProfilePage />,
      },
      {
        path: '/me/profile',
        element: <ProfileEditPage />,
      },
      {
        path: '/me/preferences',
        element: <ActivityPreferencesPage />,
      },
      {
        path: '/me/registrations',
        element: <MyRegistrationsPage />,
      },
      {
        path: '/me/favorites',
        element: <MyFavoritesPage />,
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
            element: <LegacyOrganizerActivitiesRedirect fallbackTab="created" />,
          },
          {
            path: 'activities/new',
            element: <ActivityEditorPage />,
          },
          {
            path: 'activities/:activityId/edit',
            element: <ActivityEditorPage />,
          },
          {
            path: 'activities/:activityId/check-in',
            element: <CheckInPage />,
          },
          {
            path: 'reviews',
            element: <LegacyOrganizerActivitiesRedirect fallbackTab="reviews" />,
          },
          {
            path: 'dashboard',
            element: <OrganizerDashboardPage />,
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
            element: <AdminPage />,
          },
          {
            path: '*',
            element: <AdminPage />,
          },
        ],
      },
      {
        path: '/403',
        element: <ForbiddenPage />,
      },
    ],
  },
  {
    path: '/ui-preview',
    element: import.meta.env.DEV ? <M2PreviewPage /> : <NotFoundPage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
])
