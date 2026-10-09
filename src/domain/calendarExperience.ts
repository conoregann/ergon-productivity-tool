import type { Card, CardLabel } from './kanban'
import type { ScheduledSession as Session } from './scheduling'
import { localDateTime } from './scheduling'

export type CalendarFilters = {
  boardId: string
  labelId: string
  completion: 'all' | 'incomplete' | 'completed'
}

export function sessionTimeLabel(instant: string, timezone: string) {
  const offset = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    timeZoneName: 'shortOffset',
  })
    .formatToParts(new Date(instant))
    .find((part) => part.type === 'timeZoneName')!.value
  return `${localDateTime(instant, timezone).replace('T', ' ')} ${offset === 'GMT' ? 'GMT+0' : offset}`
}

export function filterCalendarCards(
  cards: Card[],
  links: CardLabel[],
  filters: CalendarFilters,
) {
  const labelled = new Set(
    links
      .filter((link) => link.label_id === filters.labelId)
      .map((link) => link.card_id),
  )
  return cards.filter(
    (card) =>
      (!filters.boardId || card.board_id === filters.boardId) &&
      (!filters.labelId || labelled.has(card.id)) &&
      (filters.completion === 'all' ||
        Boolean(card.completed_at) === (filters.completion === 'completed')),
  )
}

// Compare UTC instants; adjacent sessions do not overlap. Include hidden
// sessions so filtering never makes a scheduling conflict disappear.
export function conflictingSessionIds(sessions: Session[]): Set<string> {
  const conflicts = new Set<string>()
  const ordered = [...sessions].sort(
    (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at),
  )
  for (let i = 0; i < ordered.length; i++) {
    const current = ordered[i]!
    for (let j = i + 1; j < ordered.length; j++) {
      const next = ordered[j]!
      if (Date.parse(next.starts_at) >= Date.parse(current.ends_at)) break
      conflicts.add(current.id)
      conflicts.add(next.id)
    }
  }
  return conflicts
}

export function deadlineCards(
  cards: Card[],
  startDate: string,
  endDate: string,
) {
  // ISO date-only strings sort chronologically, without a timezone conversion.
  return cards
    .filter(
      (card) =>
        card.due_date && card.due_date >= startDate && card.due_date < endDate,
    )
    .sort(
      (a, b) =>
        a.due_date!.localeCompare(b.due_date!) ||
        a.title.localeCompare(b.title),
    )
}
