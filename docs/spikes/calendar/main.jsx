// Research fixture only: synthetic data, no application imports or persistence.
import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import listPlugin from '@fullcalendar/react/list'
import interactionPlugin, { Draggable } from '@fullcalendar/react/interaction'
import themePlugin from '@fullcalendar/react/themes/classic'
import { Temporal } from 'temporal-polyfill'
import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/classic/theme.css'
import '@fullcalendar/react/themes/classic/palette.css'
import './style.css'

const plugins = [themePlugin, timeGridPlugin, listPlugin, interactionPlugin]
const fixtures = [
  {
    id: 'session-1',
    title: 'Proposal',
    start: '2026-10-19T08:00:00Z',
    end: '2026-10-19T09:00:00Z',
    extendedProps: { cardId: 'card-1' },
  },
  {
    id: 'spring-before',
    title: 'Spring before',
    start: '2026-03-29T00:30:00Z',
    end: '2026-03-29T00:45:00Z',
  },
  {
    id: 'spring-after',
    title: 'Spring after',
    start: '2026-03-29T01:30:00Z',
    end: '2026-03-29T01:45:00Z',
  },
  {
    id: 'fall-first',
    title: 'Fall first',
    start: '2026-10-25T00:30:00Z',
    end: '2026-10-25T00:45:00Z',
  },
  {
    id: 'fall-second',
    title: 'Fall second',
    start: '2026-10-25T01:30:00Z',
    end: '2026-10-25T01:45:00Z',
  },
  {
    id: 'deadline',
    title: 'Deadline',
    start: '2026-10-23',
    allDay: true,
    editable: false,
  },
]

function App() {
  const calendar = useRef(null)
  const external = useRef(null)
  const [zone, setZone] = useState('Europe/Dublin')
  const [events, setEvents] = useState(fixtures)
  const [selected, setSelected] = useState('')
  const [start, setStart] = useState('2026-10-19T10:00')
  const [minutes, setMinutes] = useState(60)
  const [message, setMessage] = useState('Ready')
  const mobile = matchMedia('(max-width: 600px)').matches

  useEffect(() => {
    const draggable = new Draggable(external.current, {
      eventData: {
        title: 'Research',
        duration: '01:00',
        extendedProps: { cardId: 'card-2' },
      },
    })
    return () => draggable.destroy()
  }, [])

  function capture(event, action) {
    const value = event.toPlainObject()
    value.start = event.start.toISOString()
    value.end = event.end.toISOString()
    value.id ||= crypto.randomUUID()
    event.remove()
    setEvents((current) => [
      ...current.filter((item) => item.id !== value.id),
      value,
    ])
    setMessage(action)
  }

  function save(event) {
    event.preventDefault()
    try {
      // Reject both missing and ambiguous wall times; never silently normalize them.
      const instant = Temporal.PlainDateTime.from(start)
        .toZonedDateTime(zone, { disambiguation: 'reject' })
        .toInstant()
      const existing = events.find((item) => item.id === selected)
      const value = {
        id: selected || crypto.randomUUID(),
        title: existing?.title || 'Research',
        start: instant.toString(),
        end: instant.add({ minutes: Number(minutes) }).toString(),
        extendedProps: existing?.extendedProps || { cardId: 'card-2' },
      }
      setEvents((current) => [
        ...current.filter((item) => item.id !== value.id),
        value,
      ])
      setMessage(selected ? 'Updated through form' : 'Scheduled through form')
    } catch {
      setMessage('Invalid, missing or ambiguous local time')
    }
  }

  return (
    <main>
      <h1>Calendar spike</h1>
      <p>Synthetic tasks only. Workflow: Todo. Deadline: 2026-10-23.</p>
      <label>
        Timezone{' '}
        <select value={zone} onChange={(event) => setZone(event.target.value)}>
          {['Europe/Dublin', 'America/New_York', 'UTC'].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <nav aria-label="Spike views">
        <button
          onClick={() => calendar.current.getApi().changeView('timeGridDay')}
        >
          Day
        </button>
        <button
          onClick={() => calendar.current.getApi().changeView('timeGridWeek')}
        >
          Week
        </button>
        <button
          onClick={() => calendar.current.getApi().changeView('listWeek')}
        >
          Agenda
        </button>
        <button
          onClick={() => calendar.current.getApi().gotoDate('2026-03-29')}
        >
          Spring DST
        </button>
        <button
          onClick={() => calendar.current.getApi().gotoDate('2026-10-25')}
        >
          Fall DST
        </button>
      </nav>
      <div ref={external} className="external">
        Research — drag to schedule
      </div>
      <form onSubmit={save}>
        <label>
          Session{' '}
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            <option value="">New session</option>
            {events
              .filter((event) => !event.allDay)
              .map((event) => (
                <option key={event.id} value={event.id}>
                  {event.id}
                </option>
              ))}
          </select>
        </label>
        <label>
          Local start{' '}
          <input
            type="datetime-local"
            required
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <label>
          Minutes{' '}
          <input
            type="number"
            min="15"
            max="480"
            step="15"
            required
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
        </label>
        <button type="submit">Save session</button>
        <button
          type="button"
          disabled={!selected}
          onClick={() => {
            setEvents((current) =>
              current.filter((event) => event.id !== selected),
            )
            setSelected('')
            setMessage('Session removed; card retained')
          }}
        >
          Remove session
        </button>
      </form>
      <p role="status">{message}</p>
      <FullCalendar
        ref={calendar}
        plugins={plugins}
        initialView={mobile ? 'listWeek' : 'timeGridWeek'}
        initialDate="2026-10-19"
        timeZone={zone}
        events={events}
        editable
        droppable
        eventInteractive
        eventResizableFromStart
        height={600}
        firstDay={1}
        scrollTime="08:00"
        slotDuration="00:30"
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        eventReceive={({ event }) => capture(event, 'Received external task')}
        eventDrop={({ event }) => capture(event, 'Moved session')}
        eventResize={({ event }) => capture(event, 'Resized session')}
        eventClick={({ event }) => {
          if (event.allDay) return
          setSelected(event.id)
          setMessage(`Selected ${event.id}; use form to edit`)
        }}
      />
      <h2>UTC observations</h2>
      <pre id="observations">{JSON.stringify(events, null, 2)}</pre>
    </main>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
