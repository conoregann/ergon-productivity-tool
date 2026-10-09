import { useState } from 'react'
import { Dialog } from '../../app/Dialog'
import type { Preferences } from '../../domain/scheduling'
import { SchedulingConflictError } from './api'

export function CalendarPreferences({
  preferences,
  pending,
  onSubmit,
  onClose,
}: {
  preferences: Preferences
  pending: boolean
  onSubmit: (preferences: Preferences) => Promise<unknown>
  onClose: () => void
}) {
  const [draft, setDraft] = useState(preferences)
  const [error, setError] = useState<Error | null>(null)
  const conflict = error instanceof SchedulingConflictError
  async function save() {
    setError(null)
    try {
      // Validate before the request; the database independently checks IANA zones.
      new Intl.DateTimeFormat(undefined, { timeZone: draft.timezone }).format()
      await onSubmit(draft)
      onClose()
    } catch (cause) {
      setError(
        cause instanceof RangeError
          ? new Error('Enter a valid timezone, such as Europe/Dublin or UTC.')
          : cause instanceof Error
            ? cause
            : new Error('Unable to save preferences. Try again.'),
      )
    }
  }
  return (
    <Dialog title="Calendar preferences" busy={pending} onClose={onClose}>
      {error && (
        <div className="error" role="alert">
          <p>{error.message}</p>
          {conflict && (
            <button type="button" onClick={onClose}>
              Close draft and review latest preferences
            </button>
          )}
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <fieldset disabled={pending || conflict}>
          <label>
            Timezone
            <input
              autoFocus
              required
              value={draft.timezone}
              onChange={(event) =>
                setDraft({ ...draft, timezone: event.target.value })
              }
              list="calendar-timezones"
            />
          </label>
          <datalist id="calendar-timezones">
            {[
              ...new Set([
                'UTC',
                preferences.timezone,
                ...Intl.supportedValuesOf('timeZone'),
              ]),
            ].map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>
          <label>
            Week starts on
            <select
              value={draft.week_starts_on}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  week_starts_on: Number(event.target.value),
                })
              }
            >
              {[
                'Sunday',
                'Monday',
                'Tuesday',
                'Wednesday',
                'Thursday',
                'Friday',
                'Saturday',
              ].map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </select>
          </label>
          <label>
            Calendar view
            <select
              value={draft.calendar_view}
              onChange={(event) =>
                setDraft({ ...draft, calendar_view: event.target.value })
              }
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="agenda">Agenda</option>
            </select>
          </label>
          <div className="form-actions">
            <button type="submit">
              {pending ? 'Saving…' : 'Save preferences'}
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </fieldset>
      </form>
    </Dialog>
  )
}
