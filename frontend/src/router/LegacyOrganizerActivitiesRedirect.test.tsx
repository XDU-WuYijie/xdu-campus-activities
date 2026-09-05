import { render, screen } from '@testing-library/react'
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LegacyOrganizerActivitiesRedirect } from './LegacyOrganizerActivitiesRedirect'

function LocationProbe() {
  const location = useLocation()
  return <output aria-label="current URL">{location.pathname}{location.search}</output>
}

describe('LegacyOrganizerActivitiesRedirect', () => {
  it.each([
    ['/organizer/activities', 'created'],
    ['/organizer/activities?tab=reviews', 'reviews'],
    ['/organizer/activities?tab=history', 'history'],
  ])('redirects %s to the matching profile tab', (entry, expectedTab) => {
    render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route
            path="/organizer/activities"
            element={
              <LegacyOrganizerActivitiesRedirect fallbackTab="created" />
            }
          />
          <Route path="/me" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByLabelText('current URL')).toHaveTextContent(
      `/me?tab=${expectedTab}`,
    )
  })
})
