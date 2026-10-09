import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import themePlugin from '@fullcalendar/react/themes/classic'
import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/classic/theme.css'
import '@fullcalendar/react/themes/classic/palette.css'
import interactionPlugin from '@fullcalendar/react/interaction'
import type { EventApi } from '@fullcalendar/react'
import { ChevronLeft, ChevronRight, Globe2, Plus, Settings } from 'lucide-react'
import { loadTimetable, changeSession } from './api'
import type { SessionChange } from './api'
import { SessionEditor } from './SessionEditor'
import type { SessionDraft } from './SessionEditor'
import {
  addDays,
  defaultPreferences,
  localDateTime,
  visibleDates,
} from '../../domain/scheduling'
import type { ScheduledSession } from '../../domain/scheduling'
import {
  conflictingSessionIds,
  deadlineCards,
  filterCalendarCards,
  sessionTimeLabel,
} from '../../domain/calendarExperience'
import type { CalendarFilters as Filters } from '../../domain/calendarExperience'
import { CalendarAgenda } from './CalendarAgenda'
import { CalendarFilters } from './CalendarFilters'
import { CalendarPreferences } from '../scheduling/CalendarPreferences'
import { executeSchedulingCommand } from '../scheduling/api'
import type { Card } from '../../domain/kanban'
import { useBoard } from '../kanban/useBoard'
import { Editor } from '../kanban/Editor'

function TaskEditor({
  ownerId,
  card,
  onClose,
}: {
  ownerId: string
  card: Card
  onClose: () => void
}) {
  const { query, mutation } = useBoard(ownerId, card.board_id)
  const [placement, setPlacement] = useState(false)
  const [version, setVersion] = useState<number | null>(
    query.data?.board.version ?? null,
  )
  useEffect(() => {
    if (version === null && query.data) setVersion(query.data.board.version)
  }, [query.data, version])
  if (!query.data || version === null)
    return (
      <p role={query.isError ? 'alert' : 'status'}>
        {query.isError ? 'Unable to load task.' : 'Loading task…'}{' '}
        <button onClick={onClose}>Close</button>
      </p>
    )
  const current = query.data.cards.find((item) => item.id === card.id)
  if (!current)
    return (
      <p role="alert">
        Task unavailable. <button onClick={onClose}>Close</button>
      </p>
    )
  return (
    <Editor
      key={placement ? 'placement' : 'task'}
      snapshot={query.data}
      editor={
        placement
          ? { kind: 'move', version, card: current }
          : {
              kind: 'card',
              version,
              columnId: current.column_id,
              card: current,
            }
      }
      pending={mutation.isPending}
      error={mutation.error}
      onReview={mutation.isError ? onClose : null}
      onClose={onClose}
      onPlacement={() => setPlacement(true)}
      onSubmit={async (command, version) => {
        await mutation.mutateAsync({ command, version })
      }}
    />
  )
}

export function Timetable({
  ownerId,
  sidebarControl,
  boardId = '',
}: {
  ownerId: string
  sidebarControl: ReactNode
  boardId?: string
}) {
  const cache = useQueryClient()
  const queryKey = ['timetable', ownerId]
  const query = useQuery({ queryKey, queryFn: () => loadTimetable() })
  const [mobile, setMobile] = useState(window.innerWidth < 760)
  const [view, setView] = useState('week')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [filters, setFilters] = useState<Filters>({
    boardId,
    labelId: '',
    completion: 'all',
  })
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [draft, setDraft] = useState<SessionDraft | null>(null)
  const [editing, setEditing] = useState<Card | null>(null)
  const [notice, setNotice] = useState('')
  const mutation = useMutation({
    mutationFn: (change: SessionChange) => changeSession(change),
    onSuccess: (_result, change) =>
      setNotice(
        change.kind === 'remove'
          ? 'Session removed. Task retained.'
          : 'Session saved.',
      ),
    onSettled: () => cache.invalidateQueries({ queryKey }),
  })
  const preferenceMutation = useMutation({
    mutationFn: executeSchedulingCommand,
    onSettled: () =>
      Promise.all([
        cache.invalidateQueries({ queryKey }),
        cache.invalidateQueries({ queryKey: ['scheduling', ownerId] }),
      ]),
  })
  useEffect(() => {
    const media = window.matchMedia('(max-width: 759px)')
    const update = () => setMobile(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (query.data?.preferences) setView(query.data.preferences.calendar_view)
  }, [query.data?.preferences])
  const data = query.data
  const preferences = data?.preferences ?? defaultPreferences
  const effectiveView = mobile ? 'agenda' : view
  const dates = visibleDates(date, {
    ...preferences,
    calendar_view: effectiveView,
  })
  const cards = filterCalendarCards(
    data?.cards ?? [],
    data?.card_labels ?? [],
    filters,
  )
  const sessions = (data?.sessions ?? []).filter((session) =>
    cards.some((card) => card.id === session.card_id),
  )
  const conflicts = conflictingSessionIds(data?.sessions ?? [])
  const activeCards = cards.filter(
    (card) =>
      !card.archived_at &&
      !card.completed_at &&
      !data?.boards.find((board) => board.id === card.board_id)?.archived_at,
  )
  const markers = deadlineCards(cards, dates[0]!, addDays(dates.at(-1)!, 1))
  const heading = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatRange(
    new Date(`${dates[0]!}T12:00:00Z`),
    new Date(`${dates.at(-1)!}T12:00:00Z`),
  )
  function openSession(session: ScheduledSession) {
    if (mutation.isPending) return
    mutation.reset()
    setDraft({
      id: session.id,
      cardId: session.card_id,
      start: session.starts_at,
      end: session.ends_at,
      session,
    })
  }
  function openDraft(cardId = '', start = new Date()) {
    mutation.reset()
    setDraft({
      id: crypto.randomUUID(),
      cardId,
      start: start.toISOString(),
      end: new Date(+start + 3600000).toISOString(),
    })
  }
  function changeEvent(event: EventApi, revert: () => void) {
    const session = sessions.find((session) => session.id === event.id)
    const start = event.start?.toISOString()
    const end = event.end?.toISOString()
    revert()
    if (session && start && end && !mutation.isPending)
      mutation.mutate({
        kind: 'save',
        id: session.id,
        cardId: session.card_id,
        start,
        end,
        session,
      })
  }
  return (
    <>
      <header className="workspace-header">
        <>{sidebarControl}</>
        <h1>Timetable</h1>
        {filters.boardId && (
          <span className="muted timetable-board-name">
            {data?.boards.find((board) => board.id === filters.boardId)?.title}
          </span>
        )}
        <button
          className="timetable-schedule"
          aria-label="Schedule task"
          title="Schedule task"
          disabled={!activeCards.length || mutation.isPending}
          onClick={() => openDraft()}
        >
          <Plus aria-hidden="true" /> <span>Schedule task</span>
        </button>
      </header>
      <div className="timetable-layout">
        <section className="timetable-calendar" aria-label="Scheduled work">
          <div className="timetable-toolbar">
            <div className="timetable-period">
              <h2>{heading}</h2>
              <span className="timetable-timezone">
                <Globe2 aria-hidden="true" />
                {preferences.timezone.replaceAll('_', ' ')}
              </span>
            </div>
            <div className="timetable-navigation">
              <button
                className="button-secondary"
                aria-label="Previous period"
                onClick={() =>
                  setDate(addDays(date, effectiveView === 'day' ? -1 : -7))
                }
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <button
                className="button-secondary"
                onClick={() =>
                  setDate(
                    localDateTime(
                      new Date().toISOString(),
                      preferences.timezone,
                    ).slice(0, 10),
                  )
                }
              >
                Today
              </button>
              <button
                className="button-secondary"
                aria-label="Next period"
                onClick={() =>
                  setDate(addDays(date, effectiveView === 'day' ? 1 : 7))
                }
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
            <div className="timetable-tools">
              <label className="timetable-view">
                <span className="sr-only">View</span>
                <select
                  value={effectiveView}
                  onChange={(event) => setView(event.target.value)}
                >
                  {!mobile && <option value="day">Daily</option>}
                  {!mobile && <option value="week">Weekly</option>}
                  <option value="agenda">Agenda</option>
                </select>
              </label>
              <CalendarFilters
                boards={data?.boards ?? []}
                labels={data?.labels ?? []}
                value={filters}
                onChange={setFilters}
              />
              <button
                className="icon-button"
                type="button"
                aria-label="Calendar preferences"
                title={`Calendar preferences · ${preferences.timezone}`}
                onClick={() => setPreferencesOpen(true)}
              >
                <Settings aria-hidden="true" />
              </button>
            </div>
          </div>
          {query.isPending && <p role="status">Loading timetable…</p>}
          {query.isError && (
            <p role="alert" className="error">
              Unable to load timetable.{' '}
              <button onClick={() => void query.refetch()}>Try again</button>
            </p>
          )}
          {mutation.isError && !draft && (
            <p role="alert" className="error">
              {mutation.error.message}
            </p>
          )}
          {notice && (
            <p role="status" className="timetable-notice">
              {notice}
            </p>
          )}
          {effectiveView === 'agenda' ? (
            <CalendarAgenda
              dates={dates}
              timezone={preferences.timezone}
              cards={cards}
              boards={data?.boards ?? []}
              sessions={sessions}
              conflicts={conflicts}
              onSession={openSession}
              onTask={setEditing}
            />
          ) : (
            <div className="calendar-grid">
              <FullCalendar
                key={`${effectiveView}-${date}-${preferences.timezone}-${preferences.week_starts_on}`}
                plugins={[themePlugin, timeGridPlugin, interactionPlugin]}
                initialView={
                  effectiveView === 'day' ? 'timeGridDay' : 'timeGridWeek'
                }
                initialDate={date}
                headerToolbar={false}
                height="100%"
                firstDay={preferences.week_starts_on}
                timeZone={preferences.timezone}
                allDaySlot
                allDayText="Deadlines"
                dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
                dayHeaderContent={(info) => (
                  <div
                    className={`calendar-day-heading${info.isToday ? ' is-today' : ''}`}
                  >
                    <span>{info.weekdayText}</span>
                    <strong>{info.dayNumberText}</strong>
                  </div>
                )}
                dayHeaderClass="calendar-day-cell"
                slotHeaderInnerClass="calendar-time-label"
                allDayHeaderInnerClass="calendar-all-day-label"
                slotLaneClass="calendar-time-lane"
                slotMinHeight={26}
                slotHeaderFormat={{
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                }}
                eventTimeFormat={{
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                }}
                eventInnerClass="calendar-event-inner"
                eventContent={(info) => (
                  <div
                    className={`calendar-event-content${info.isShort ? ' is-short' : ''}`}
                  >
                    <span className="calendar-event-time">
                      {info.event.extendedProps.deadline
                        ? 'Deadline'
                        : info.timeText}
                      {info.event.extendedProps.deadline && info.timeText
                        ? ` · ${info.timeText}`
                        : ''}
                    </span>
                    <strong>{info.event.title}</strong>
                  </div>
                )}
                nowIndicator
                scrollTime="08:00:00"
                slotDuration="00:30:00"
                snapDuration="00:15:00"
                editable={!mutation.isPending}
                eventResizableFromStart
                eventInteractive
                eventMinHeight={30}
                events={[
                  ...markers.map((card) => ({
                    id: `deadline-${card.id}`,
                    title: `${card.title}${card.completed_at ? ' · Completed' : ''}`,
                    start: card.due_time
                      ? `${card.due_date}T${card.due_time}:00`
                      : card.due_date!,
                    allDay: !card.due_time,
                    editable: false,
                    className: 'calendar-deadline',
                    extendedProps: { cardId: card.id, deadline: true },
                  })),
                  ...sessions.map((session) => {
                    const card = cards.find(
                      (card) => card.id === session.card_id,
                    )!
                    const archived = Boolean(
                      card.archived_at ||
                      data?.boards.find((board) => board.id === card.board_id)
                        ?.archived_at,
                    )
                    return {
                      id: session.id,
                      title: `${card.title}${card.completed_at ? ' · Completed' : ''}${archived ? ' · Archived' : ''}${conflicts.has(session.id) ? ' · Overlap' : ''}`,
                      start: session.starts_at,
                      end: session.ends_at,
                      editable: !archived,
                      className: [
                        'calendar-session',
                        card.completed_at ? 'session-completed' : '',
                        conflicts.has(session.id) ? 'session-overlap' : '',
                      ]
                        .filter(Boolean)
                        .join(' '),
                    }
                  }),
                ]}
                eventDidMount={(info) => {
                  const session = sessions.find(
                    (session) => session.id === info.event.id,
                  )
                  const label = session
                    ? `Edit session ${info.event.title}, ${sessionTimeLabel(session.starts_at, preferences.timezone)} to ${sessionTimeLabel(session.ends_at, preferences.timezone)}`
                    : info.event.title
                  if (session) info.el.dataset.sessionId = session.id
                  info.el.setAttribute('aria-label', label)
                  info.el.setAttribute('title', label)
                }}
                eventAllow={(info) => !info.allDay}
                eventDrop={(info) => changeEvent(info.event, info.revert)}
                eventResize={(info) => changeEvent(info.event, info.revert)}
                eventClick={(info) => {
                  if (info.event.extendedProps.deadline) {
                    const card = cards.find(
                      (card) => card.id === info.event.extendedProps.cardId,
                    )
                    if (card) setEditing(card)
                  } else {
                    const session = sessions.find(
                      (session) => session.id === info.event.id,
                    )
                    if (session) openSession(session)
                  }
                }}
                dateClick={(info) => {
                  if (!info.allDay) openDraft('', info.date)
                }}
              />
            </div>
          )}
        </section>
      </div>
      {draft && (
        <SessionEditor
          draft={draft}
          cards={cards}
          boards={data?.boards ?? []}
          timezone={preferences.timezone}
          sessions={data?.sessions ?? []}
          pending={mutation.isPending}
          error={mutation.error}
          onClose={() => setDraft(null)}
          onSubmit={(change) => mutation.mutateAsync(change)}
          onEditTask={(card) => {
            setDraft(null)
            setEditing(card)
          }}
        />
      )}
      {preferencesOpen && (
        <CalendarPreferences
          preferences={preferences}
          pending={preferenceMutation.isPending}
          onClose={() => setPreferencesOpen(false)}
          onSubmit={(preferences) =>
            preferenceMutation.mutateAsync({ kind: 'preferences', preferences })
          }
        />
      )}
      {editing && (
        <TaskEditor
          ownerId={ownerId}
          card={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
