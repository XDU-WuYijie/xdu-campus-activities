import { Navigate, useLocation } from 'react-router-dom'

export function LegacyOrganizerActivitiesRedirect({
  fallbackTab,
}: {
  fallbackTab: 'created' | 'reviews'
}) {
  const location = useLocation()
  const requestedTab = new URLSearchParams(location.search).get('tab')
  const tab = ['created', 'reviews', 'history'].includes(requestedTab ?? '')
    ? requestedTab
    : fallbackTab
  return <Navigate replace to={`/me?tab=${tab}`} />
}
