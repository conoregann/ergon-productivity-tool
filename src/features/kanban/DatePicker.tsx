import { useEffect, useId, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const parse = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year!, month! - 1, day!, 12)
}
const shift = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12)
const label = (date: Date) =>
  date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

export function DatePicker({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const id = useId()
  const toggle = useRef<HTMLButtonElement>(null)
  const calendar = useRef<HTMLDivElement>(null)
  const [today] = useState(() => iso(new Date()))
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(value || today)
  const [month, setMonth] = useState(() => parse(value || today))
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12)
  const start = shift(first, -((first.getDay() + 6) % 7))
  const days = Array.from({ length: 42 }, (_, index) => shift(start, index))
  useEffect(() => {
    const panel = calendar.current!
    if (!open) {
      if (panel.matches(':popover-open')) panel.hidePopover()
      return
    }
    panel.showPopover()
    const button = toggle.current!.getBoundingClientRect()
    const width = document.documentElement.clientWidth
    const height = window.visualViewport?.height ?? window.innerHeight
    panel.style.left = `${Math.max(16, Math.min(button.right - panel.offsetWidth, width - panel.offsetWidth - 16))}px`
    panel.style.top = `${Math.max(16, button.bottom + panel.offsetHeight + 8 <= height - 16 ? button.bottom + 8 : button.top - panel.offsetHeight - 8)}px`
  }, [open])
  function close() {
    setOpen(false)
    toggle.current?.focus()
  }
  function select(date: Date) {
    onChange(iso(date))
    close()
  }
  function focusDate(date: Date) {
    const next = iso(date)
    setFocused(next)
    setMonth(date)
    requestAnimationFrame(() =>
      calendar.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)
        ?.focus(),
    )
  }
  return (
    <div className="date-picker">
      <label htmlFor={id}>Due date</label>
      <div className="date-input-row">
        <input
          id={id}
          name="due_date"
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          ref={toggle}
          type="button"
          className="button-secondary"
          aria-label="Choose due date"
          aria-expanded={open}
          aria-controls={`${id}-calendar`}
          onClick={() => {
            if (open) close()
            else {
              setOpen(true)
              focusDate(parse(value || today))
            }
          }}
        >
          <CalendarDays aria-hidden="true" />
        </button>
      </div>
      <div
        id={`${id}-calendar`}
        popover="auto"
        onToggle={(event) => {
          if (event.newState === 'closed') setOpen(false)
        }}
        ref={calendar}
        className="date-calendar"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            close()
          }
        }}
      >
        <header>
          <button
            type="button"
            className="icon-button"
            aria-label="Previous month"
            onClick={() => {
              const next = new Date(
                month.getFullYear(),
                month.getMonth() - 1,
                1,
                12,
              )
              setMonth(next)
              setFocused(iso(next))
            }}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <strong aria-live="polite">
            {month.toLocaleDateString(undefined, {
              month: 'long',
              year: 'numeric',
            })}
          </strong>
          <button
            type="button"
            className="icon-button"
            aria-label="Next month"
            onClick={() => {
              const next = new Date(
                month.getFullYear(),
                month.getMonth() + 1,
                1,
                12,
              )
              setMonth(next)
              setFocused(iso(next))
            }}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </header>
        <div className="date-weekdays" aria-hidden="true">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
            <span key={i}>{day}</span>
          ))}
        </div>
        <div
          className="date-days"
          role="group"
          aria-label="Choose a date; use arrow keys to navigate"
        >
          {days.map((date) => (
            <button
              key={iso(date)}
              type="button"
              data-date={iso(date)}
              tabIndex={iso(date) === focused ? 0 : -1}
              aria-label={label(date)}
              aria-pressed={iso(date) === value}
              aria-current={iso(date) === today ? 'date' : undefined}
              className={
                date.getMonth() !== month.getMonth() ? 'outside-month' : ''
              }
              onFocus={() => setFocused(iso(date))}
              onClick={() => select(date)}
              onKeyDown={(event) => {
                const offsets: Record<string, number> = {
                  ArrowLeft: -1,
                  ArrowRight: 1,
                  ArrowUp: -7,
                  ArrowDown: 7,
                }
                if (event.key in offsets) {
                  event.preventDefault()
                  focusDate(shift(date, offsets[event.key]!))
                }
                if (event.key === 'Home' || event.key === 'End') {
                  event.preventDefault()
                  const weekday = (date.getDay() + 6) % 7
                  focusDate(
                    shift(date, event.key === 'Home' ? -weekday : 6 - weekday),
                  )
                }
                if (event.key === 'PageUp' || event.key === 'PageDown') {
                  event.preventDefault()
                  const nextMonth = new Date(
                    date.getFullYear(),
                    date.getMonth() + (event.key === 'PageUp' ? -1 : 1),
                    1,
                    12,
                  )
                  const last = new Date(
                    nextMonth.getFullYear(),
                    nextMonth.getMonth() + 1,
                    0,
                  ).getDate()
                  nextMonth.setDate(Math.min(date.getDate(), last))
                  focusDate(nextMonth)
                }
              }}
            >
              {date.getDate()}
            </button>
          ))}
        </div>
        <footer>
          <button
            type="button"
            className="text-button"
            onClick={() => select(new Date())}
          >
            Today
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => select(shift(new Date(), 1))}
          >
            Tomorrow
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              onChange('')
              close()
            }}
          >
            Clear date
          </button>
        </footer>
      </div>
    </div>
  )
}
