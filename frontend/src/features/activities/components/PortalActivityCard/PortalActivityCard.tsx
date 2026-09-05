import { CampusImage, StatusTag } from '../../../../components/ui'
import type { Activity } from '../../model'
import {
  formatActivityTimeRange,
  getActivityCategory,
} from '../../utils'
import './PortalActivityCard.css'

interface PortalActivityCardProps {
  activity: Activity
  onOpen: (activityId: string) => void
}

export function PortalActivityCard({
  activity,
  onOpen,
}: PortalActivityCardProps) {
  return (
    <button
      aria-label={`查看活动：${activity.title}`}
      className="portal-activity-card"
      onClick={() => onOpen(activity.id)}
      type="button"
    >
      <div className="portal-activity-card__cover">
        <CampusImage
          alt={`${activity.title}活动封面`}
          fit="cover"
          height="100%"
          src={activity.coverImage}
          width="100%"
        />
      </div>
      <div className="portal-activity-card__body">
        <div className="portal-activity-card__tags">
          <StatusTag>{getActivityCategory(activity)}</StatusTag>
          <StatusTag tone={activity.registrationOpen ? 'success' : 'default'}>
            {activity.registrationOpen ? '报名中' : '未开放'}
          </StatusTag>
          {activity.registered ? (
            <StatusTag tone="success">已报名</StatusTag>
          ) : null}
        </div>
        <h2>{activity.title}</h2>
        <p>{activity.summary || '暂未填写活动简介'}</p>
        <dl>
          <div>
            <dt>主办方</dt>
            <dd>{activity.organizerName || '待补充'}</dd>
          </div>
          <div>
            <dt>地点</dt>
            <dd>{activity.location || '待定'}</dd>
          </div>
          <div>
            <dt>活动时间</dt>
            <dd>
              {formatActivityTimeRange(
                activity.eventStartTime,
                activity.eventEndTime,
              )}
            </dd>
          </div>
          <div>
            <dt>报名情况</dt>
            <dd>
              {activity.registeredCount} / {activity.maxParticipants}
            </dd>
          </div>
        </dl>
      </div>
    </button>
  )
}
