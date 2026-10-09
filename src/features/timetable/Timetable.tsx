import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import themePlugin from '@fullcalendar/react/themes/classic'
import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/classic/theme.css'
import '@fullcalendar/react/themes/classic/palette.css'
import interactionPlugin, { Draggable } from '@fullcalendar/react/interaction'
import type { EventApi } from '@fullcalendar/react'
import { CalendarDays, Plus } from 'lucide-react'
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
  const cache = useQueryClient()
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
        try {
          await mutation.mutateAsync({ command, version })
        } finally {
          await Promise.all([
            cache.invalidateQueries({ queryKey: ['timetable', ownerId] }),
            cache.invalidateQueries({ queryKey: ['scheduling', ownerId] }),
          ])
        }
      }}
    />
  )
}

export function Timetable({
  ownerId,
  sidebarControl,
}: {
  ownerId: string
  sidebarControl: ReactNode
}) {
  const cache = useQueryClient()
  const queryKey = ['timetable', ownerId]
  const query = useQuery({ queryKey, queryFn: () => loadTimetable() })
  const panel = useRef<HTMLDivElement>(null)
  const [mobile, setMobile] = useState(window.innerWidth < 760)
  const [view, setView] = useState('week')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [filters, setFilters] = useState<Filters>({
    boardId: '',
    labelId: '',
    completion: 'all',
  })
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [allTasks, setAllTasks] = useState(false)
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
  useEffect(() => {
    if (!panel.current) return
    const draggable = new Draggable(panel.current, {
      itemSelector: '[data-task-id]',
      eventData: (element) => ({
        title: element.textContent ?? '',
        duration: '01:00',
        create: false,
      }),
    })
    return () => draggable.destroy()
  }, [])
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
  const shownTasks = activeCards.filter(
    (card) =>
      allTasks ||
      !data?.sessions.some((session) => session.card_id === card.id),
  )
  const markers = deadlineCards(cards, dates[0]!, addDays(dates.at(-1)!, 1))
  const heading =
    dates.length === 1 ? dates[0] : `${dates[0]} – ${dates.at(-1)}`
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
        <h1>
          <CalendarDays aria-hidden="true" /> Timetable
        </h1>
        <button
          disabled={!activeCards.length || mutation.isPending}
          onClick={() => openDraft()}
        >
          <Plus aria-hidden="true" /> Schedule task
        </button>
      </header>
      <div className="timetable-layout">
        <aside className="unscheduled-panel" aria-label="Task scheduling panel">
          <h2>
            Unscheduled tasks{' '}
            <span className="muted">
              {
                activeCards.filter(
                  (card) =>
                    !data?.sessions.some(
                      (session) => session.card_id === card.id,
                    ),
                ).length
              }
            </span>
          </h2>
          <p className="muted">
            Drag a task into a time slot, or select it to schedule.
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={allTasks}
              onChange={(event) => setAllTasks(event.target.checked)}
            />{' '}
            Include scheduled tasks
          </label>
          <div ref={panel} className="scheduling-tasks">
            {shownTasks.map((card) => (
              <button
                key={card.id}
                type="button"
                data-task-id={card.id}
                className="scheduling-task"
                disabled={mutation.isPending}
                onClick={() => openDraft(card.id)}
              >
                <strong>{card.title}</strong>
                <span>
                  {
                    data?.boards.find((board) => board.id === card.board_id)
                      ?.title
                  }
                </span>
                {card.priority !== 'none' && (
                  <span
                    className="priority-badge"
                    data-priority={card.priority}
                  >
                    {card.priority}
                  </span>
                )}
              </button>
            ))}
          </div>
          {query.isPending && <p role="status">Loading tasks…</p>}
          {data && !shownTasks.length && (
            <p className="muted">
              {allTasks
                ? 'Create a task on a board to begin.'
                : 'No unscheduled tasks. Include scheduled tasks to plan another session.'}
            </p>
          )}
        </aside>
        <section className="timetable-calendar" aria-label="Scheduled work">
          <div className="timetable-toolbar">
            <div className="timetable-navigation">
              <button
                className="button-secondary"
                aria-label="Previous period"
                onClick={() =>
                  setDate(addDays(date, effectiveView === 'day' ? -1 : -7))
                }
              >
                ‹
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
                ›
              </button>
            </div>
            <h2>{heading}</h2>
            <label>
              View
              <select
                value={effectiveView}
                onChange={(event) => setView(event.target.value)}
              >
                {!mobile && <option value="day">Daily</option>}
                {!mobile && <option value="week">Weekly</option>}
                <option value="agenda">Agenda</option>
              </select>
            </label>
          </div>
          <p className="timetable-timezone muted">
            {preferences.timezone} · Select a session to edit its times or task.
          </p>
          <button
            className="text-button calendar-preferences-button"
            type="button"
            onClick={() => setPreferencesOpen(true)}
          >
            Calendar preferences
          </button>
          <CalendarFilters
            boards={data?.boards ?? []}
            labels={data?.labels ?? []}
            value={filters}
            onChange={setFilters}
          />
          <p className="calendar-help">
            Deadlines are date markers. Sessions reserve time. Use Schedule task
            or open a session to move or resize it with the form.
          </p>
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
          <p role="status" className="timetable-notice">
            {notice}
          </p>
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
                nowIndicator
                scrollTime="08:00:00"
                slotDuration="00:30:00"
                snapDuration="00:15:00"
                editable={!mutation.isPending}
                droppable={!mutation.isPending}
                eventResizableFromStart
                eventInteractive
                eventMinHeight={30}
                events={[
                  ...markers.map((card) => ({
                    id: `deadline-${card.id}`,
                    title: `Deadline${card.due_time ? ` ${card.due_time}` : ''}: ${card.title}${card.completed_at ? ' · Completed' : ''}`,
                    start: card.due_date!,
                    allDay: true,
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
                drop={(info) => {
                  const cardId = info.draggedEl.dataset.taskId
                  if (cardId && !info.allDay && !mutation.isPending)
                    mutation.mutate({
                      kind: 'save',
                      id: crypto.randomUUID(),
                      cardId,
                      start: info.date.toISOString(),
                      end: new Date(+info.date + 3600000).toISOString(),
                    })
                }}
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
          cards={data?.cards ?? []}
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
