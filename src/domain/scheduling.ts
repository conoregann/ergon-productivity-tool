import type { Database } from '../lib/database.types.js'

type Tables = Database['public']['Tables']
export type ScheduledSession = Tables['scheduled_sessions']['Row']
export type Preferences = Pick<
  Tables['user_preferences']['Row'],
  'timezone' | 'week_starts_on' | 'calendar_view' | 'version'
>
export type SchedulingSnapshot = {
  sessions: ScheduledSession[]
  cards: Tables['cards']['Row'][]
  boards: Tables['boards']['Row'][]
  labels: Tables['labels']['Row'][]
  card_labels: Tables['card_labels']['Row'][]
  preferences: Preferences | null
}
export const defaultPreferences: Preferences = {
  timezone: 'UTC',
  week_starts_on: 1,
  calendar_view: 'week',
  version: 0,
}

export function localDateTime(instant: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant))
  const part = (name: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === name)!.value
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}

// Match candidate offsets around the date rather than silently normalizing DST gaps.
export function toInstant(local: string, timezone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw new Error('Enter a date and time.')
  const wall = Date.parse(`${local}Z`)
  if (!Number.isFinite(wall)) throw new Error('Enter a valid date and time.')
  const offsets = new Set<number>()
  for (const hours of [-36, 0, 36]) {
    const sample = wall + hours * 3600000
    offsets.add(
      Date.parse(
        `${localDateTime(new Date(sample).toISOString(), timezone)}Z`,
      ) - sample,
    )
  }
  const matches = [...offsets]
    .map((offset) => new Date(wall - offset).toISOString())
    .filter((instant) => localDateTime(instant, timezone) === local)
  if (matches.length !== 1)
    throw new Error(
      matches.length
        ? 'This time occurs twice when clocks change. Use UTC in calendar preferences to choose the exact instant.'
        : 'This time does not exist when clocks change. Choose another time.',
    )
  return matches[0]!
}

export function overlaps(
  a: Pick<ScheduledSession, 'starts_at' | 'ends_at'>,
  b: Pick<ScheduledSession, 'starts_at' | 'ends_at'>,
) {
  return (
    Date.parse(a.starts_at) < Date.parse(b.ends_at) &&
    Date.parse(b.starts_at) < Date.parse(a.ends_at)
  )
}
export function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
export function visibleDates(date: string, preferences: Preferences) {
  if (preferences.calendar_view === 'day') return [date]
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
  const start = addDays(date, -((weekday - preferences.week_starts_on + 7) % 7))
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}
export function sessionsOnDate(
  sessions: ScheduledSession[],
  date: string,
  timezone: string,
) {
  // Compare local dates so midnight and DST boundaries remain timezone-aware.
  return sessions.filter(
    (session) =>
      localDateTime(session.starts_at, timezone).slice(0, 10) <= date &&
      localDateTime(
        new Date(Date.parse(session.ends_at) - 1).toISOString(),
        timezone,
      ).slice(0, 10) >= date,
  )
}

// Shared timetable API: explicit-offset timestamps are already instants;
// datetime-local input is interpreted in the saved calendar timezone.
export type Session = ScheduledSession
export function interval(start: string, end: string, timezone = 'UTC') {
  const instant = (value: string) =>
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value)
      ? new Date(value).toISOString()
      : toInstant(value, timezone)
  const starts_at = instant(start)
  const ends_at = instant(end)
  if (ends_at <= starts_at)
    throw new Error('End time must be after start time.')
  return { starts_at, ends_at }
}
export function localInput(instant: string, timezone = 'UTC') {
  return localDateTime(instant, timezone)
}
