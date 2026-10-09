import { useId, useRef, useState } from 'react'
import { Clock, ChevronDown } from 'lucide-react'

export function DueTime({
  value,
  disabled,
  onChange,
}: {
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const hour = Number(value.slice(0, 2) || '09')
  const minute = Number(value.slice(3) || '00')
  const pad = (part: number) => String(part).padStart(2, '0')
  return (
    <div className="due-time-field">
      <label htmlFor={id}>
        Due time <span className="muted">Optional</span>
      </label>
      <div className="due-time-input">
        <Clock aria-hidden="true" />
        <input
          id={id}
          aria-label="Due time"
          type="time"
          step={60}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          ref={toggle}
          type="button"
          className="icon-button"
          aria-label="Adjust due time"
          aria-expanded={open && !disabled}
          aria-controls={`${id}-sliders`}
          disabled={disabled}
          onClick={() => setOpen(!open)}
        >
          <ChevronDown aria-hidden="true" />
        </button>
      </div>
      {disabled && <p className="muted">Choose a due date to add a time.</p>}
      {open && !disabled && (
        <div
          id={`${id}-sliders`}
          className="due-time-sliders"
          role="group"
          aria-label="Due time controls"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              setOpen(false)
              toggle.current?.focus()
            }
          }}
        >
          <div className="time-slider-heading">
            <span className="muted">24-hour time</span>
            <button
              className="text-button"
              type="button"
              disabled={!value}
              onClick={() => onChange('')}
            >
              Clear due time
            </button>
          </div>
          <div className="time-slider-row">
            <label htmlFor={`${id}-hour`}>
              Hour <output>{pad(hour)}</output>
            </label>
            <input
              id={`${id}-hour`}
              aria-label="Hour"
              type="range"
              min={0}
              max={23}
              step={1}
              value={hour}
              onChange={(event) =>
                onChange(`${pad(Number(event.target.value))}:${pad(minute)}`)
              }
            />
            <div className="time-slider-scale" aria-hidden="true">
              <span>00</span>
              <span>12</span>
              <span>23</span>
            </div>
          </div>
          <div className="time-slider-row">
            <label htmlFor={`${id}-minute`}>
              Minute <output>{pad(minute)}</output>
            </label>
            <input
              id={`${id}-minute`}
              aria-label="Minute"
              type="range"
              min={0}
              max={59}
              step={1}
              value={minute}
              onChange={(event) =>
                onChange(`${pad(hour)}:${pad(Number(event.target.value))}`)
              }
            />
            <div className="time-slider-scale" aria-hidden="true">
              <span>00</span>
              <span>30</span>
              <span>59</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
