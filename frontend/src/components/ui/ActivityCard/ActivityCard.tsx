import type { ReactNode } from 'react'
import { Card } from 'antd-mobile'
import {
  CalendarOutline,
  EnvironmentOutline,
  TeamOutline,
} from 'antd-mobile-icons'
import type { EntityId } from '../../../api/types'
import { CampusButton } from '../CampusButton'
import { CampusImage } from '../CampusImage'
import { StatusTag, type StatusTone } from '../StatusTag'
import './ActivityCard.css'

export interface ActivityCardProps {
  action?: ReactNode
  category: string
  coverAlt?: string
  coverUrl?: string
  id: EntityId
  location: string
  maxParticipants?: number
  onOpen?: (id: EntityId) => void
  registeredCount?: number
  status?: {
    label: string
    tone?: StatusTone
  }
  tags?: string[]
  timeText: string
  title: string
}

export function ActivityCard({
  action,
  category,
  coverAlt,
  coverUrl,
  id,
  location,
  maxParticipants,
  onOpen,
  registeredCount,
  status,
  tags = [],
  timeText,
  title,
}: ActivityCardProps) {
  const registrationText =
    maxParticipants === undefined
      ? null
      : `${registeredCount ?? 0} / ${maxParticipants} 人`

  return (
    <article aria-labelledby={`activity-${id}-title`}>
      <Card className="activity-card">
        <div className="activity-card__layout">
          <div className="activity-card__cover">
            <CampusImage
              alt={coverAlt ?? `${title}活动封面`}
              fit="cover"
              height="100%"
              preview={Boolean(coverUrl)}
              src={coverUrl}
              width="100%"
            />
          </div>
          <div className="activity-card__content">
            <div className="activity-card__eyebrow">
              <span>{category}</span>
              {status ? (
                <StatusTag tone={status.tone}>{status.label}</StatusTag>
              ) : null}
            </div>
            <h3 id={`activity-${id}-title`}>{title}</h3>
            <dl className="activity-card__meta">
              <div>
                <CalendarOutline aria-hidden />
                <dt>时间</dt>
                <dd>{timeText}</dd>
              </div>
              <div>
                <EnvironmentOutline aria-hidden />
                <dt>地点</dt>
                <dd>{location}</dd>
              </div>
              {registrationText ? (
                <div>
                  <TeamOutline aria-hidden />
                  <dt>报名</dt>
                  <dd>{registrationText}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>
        {tags.length > 0 ? (
          <div aria-label="活动标签" className="activity-card__tags">
            {tags.slice(0, 3).map((tag) => (
              <StatusTag key={tag}>{tag}</StatusTag>
            ))}
          </div>
        ) : null}
        {action ?? (onOpen ? (
          <CampusButton
            block
            className="activity-card__action"
            fill="none"
            onClick={() => onOpen(id)}
          >
            查看详情
          </CampusButton>
        ) : null)}
      </Card>
    </article>
  )
}
