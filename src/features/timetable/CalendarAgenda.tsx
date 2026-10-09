import type { Board, Card } from '../../domain/kanban'
import type { ScheduledSession } from '../../domain/scheduling'
import { localDateTime, sessionsOnDate } from '../../domain/scheduling'
import { sessionTimeLabel } from '../../domain/calendarExperience'
import './calendarExperience.css'

export function CalendarAgenda({
  dates,
  timezone,
  cards,
  boards,
  sessions,
  conflicts,
  onSession,
  onTask,
}: {
  dates: string[]
  timezone: string
  cards: Card[]
  boards: Board[]
  sessions: ScheduledSession[]
  conflicts: Set<string>
  onSession: (session: ScheduledSession) => void
  onTask: (card: Card) => void
}) {
  const time = (instant: string, date: string) => {
    const local = localDateTime(instant, timezone)
    return local.slice(0, 10) === date
      ? local.slice(11)
      : local.replace('T', ' ')
  }
  return (
    <div className="calendar-agenda" aria-label="Calendar agenda">
      {dates.map((date) => {
        const daySessions = sessionsOnDate(sessions, date, timezone).sort(
          (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at),
        )
        const deadlines = cards.filter((card) => card.due_date === date)
        return (
          <section
            className="agenda-day"
            key={date}
            aria-labelledby={`agenda-${date}`}
          >
            <h2 id={`agenda-${date}`}>
              <time dateTime={date}>
                {new Intl.DateTimeFormat('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'short',
                  timeZone: 'UTC',
                }).format(new Date(`${date}T12:00:00Z`))}
              </time>
            </h2>
            {deadlines.map((card) => (
              <button
                key={card.id}
                type="button"
                className="agenda-entry deadline-entry"
                aria-label={`Deadline ${card.title}${card.completed_at ? ' Completed' : ''}`}
                onClick={() => onTask(card)}
              >
                <span>Deadline</span>
                <strong>{card.title}</strong>
                {card.completed_at && (
                  <span className="calendar-completed">Completed</span>
                )}
              </button>
            ))}
            {daySessions.map((session) => {
              const card = cards.find((card) => card.id === session.card_id)
              if (!card) return null
              const board = boards.find((board) => board.id === card.board_id)
              return (
                <button
                  key={session.id}
                  type="button"
                  className={`agenda-entry ${card.completed_at ? 'session-completed' : ''}`}
                  onClick={() => onSession(session)}
                  aria-label={`Edit session ${card.title}, ${sessionTimeLabel(session.starts_at, timezone)} to ${sessionTimeLabel(session.ends_at, timezone)}${card.completed_at ? ', completed' : ''}${conflicts.has(session.id) ? ', overlap' : ''}`}
                >
                  <span>
                    {time(session.starts_at, date)} –{' '}
                    {time(session.ends_at, date)}
                  </span>
                  <strong>{card.title}</strong>
                  <span className="muted">{board?.title}</span>
                  {card.completed_at && (
                    <span className="calendar-completed">Completed</span>
                  )}
                  {(card.archived_at || board?.archived_at) && (
                    <span className="muted">Archived task or board</span>
                  )}
                  {conflicts.has(session.id) && (
                    <span className="calendar-overlap">
                      Overlaps another session
                    </span>
                  )}
                </button>
              )
            })}
            {!daySessions.length && !deadlines.length && (
              <p className="muted">No sessions or deadlines.</p>
            )}
          </section>
        )
      })}
    </div>
  )
}
