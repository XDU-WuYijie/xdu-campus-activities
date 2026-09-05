import { normalizeRegistrationStatus } from '../api'
import type { RegistrationPushMessage } from '../model'

export function buildRegistrationSocketUrl(
  token: string,
  location: Pick<Location, 'host' | 'protocol'> = window.location,
) {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${location.host}/api/ws/activity-registration?token=${encodeURIComponent(token)}`
}

export function parseRegistrationPush(
  value: string,
): RegistrationPushMessage | null {
  if (value === 'pong') {
    return null
  }

  try {
    const message = JSON.parse(value) as Partial<RegistrationPushMessage>
    if (
      message.event !== 'activity_register_result' ||
      !message.payload?.activityId
    ) {
      return null
    }
    return {
      event: message.event,
      payload: normalizeRegistrationStatus(
        message.payload as Parameters<
          typeof normalizeRegistrationStatus
        >[0],
      ),
    }
  } catch {
    return null
  }
}
