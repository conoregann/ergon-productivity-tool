import { useState } from 'react'
import { Dialog } from '../../app/Dialog'
import { sessionTimeLabel } from '../../domain/calendarExperience'
import { localInput, interval, overlaps } from '../../domain/scheduling'
import type { Session } from '../../domain/scheduling'
import type { Board, Card } from '../../domain/kanban'
import { SchedulingConflictError } from '../scheduling/api'
import type { SessionChange } from './api'

export type SessionDraft = {
  id: string
  cardId: string
  start: string
  end: string
  session?: Session
}
export function SessionEditor({
  draft,
  cards,
  boards = [],
  sessions,
  timezone = 'UTC',
  pending,
  error,
  onClose,
  onSubmit,
  onEditTask,
}: {
  draft: SessionDraft
  cards: Card[]
  boards?: Board[]
  sessions: Session[]
  timezone?: string
  pending: boolean
  error: Error | null
  onClose: () => void
  onSubmit: (change: SessionChange) => Promise<unknown>
  onEditTask: (card: Card) => void
}) {
  const [cardId, setCardId] = useState(draft.cardId)
  const initialStart = localInput(draft.start, timezone)
  const initialEnd = localInput(draft.end, timezone)
  const [start, setStart] = useState(initialStart)
  const [end, setEnd] = useState(initialEnd)
  const [validation, setValidation] = useState('')
  const card = cards.find((card) => card.id === cardId)
  const archived = Boolean(
    card?.archived_at ||
    boards.find((board) => board.id === card?.board_id)?.archived_at,
  )
  const conflict = error instanceof SchedulingConflictError
  function times() {
    return interval(
      start === initialStart ? draft.start : start,
      end === initialEnd ? draft.end : end,
      timezone,
    )
  }
  let warning = false
  try {
    const proposed = times()
    warning = sessions.some(
      (session) =>
        session.id !== draft.session?.id && overlaps(proposed, session),
    )
  } catch {
    /* Invalid local input is explained on submit. */
  }
  async function submit(change: SessionChange) {
    try {
      setValidation('')
      await onSubmit(change)
      onClose()
    } catch (error) {
      setValidation(
        error instanceof Error ? error.message : 'Unable to save session.',
      )
    }
  }
  return (
    <Dialog
      title={draft.session ? 'Edit session' : 'Schedule task'}
      busy={pending}
      onClose={onClose}
    >
      {(validation || error) && (
        <p role="alert" className="error">
          {validation || error?.message}
        </p>
      )}
      {conflict && (
        <button type="button" className="button-secondary" onClick={onClose}>
          Close draft and review latest session
        </button>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          try {
            const proposed = times()
            void submit({
              kind: 'save',
              id: draft.id,
              cardId,
              start: proposed.starts_at,
              end: proposed.ends_at,
              session: draft.session,
            })
          } catch (error) {
            setValidation(
              error instanceof Error ? error.message : 'Enter valid times.',
            )
          }
        }}
      >
        <fieldset disabled={pending || conflict}>
          <label>
            Task
            <select
              autoFocus
              value={cardId}
              disabled={Boolean(draft.session)}
              required
              onChange={(event) => setCardId(event.target.value)}
            >
              <option value="">Choose a task</option>
              {cards
                .filter(
                  (card) =>
                    card.id === draft.session?.card_id ||
                    (!card.archived_at &&
                      !boards.find((board) => board.id === card.board_id)
                        ?.archived_at),
                )
                .map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.title}
                  </option>
                ))}
            </select>
          </label>
          <p className="muted">
            Times in {timezone}. Scheduling does not change task status.
          </p>
          {draft.session && (
            <p className="muted">
              Saved: {sessionTimeLabel(draft.start, timezone)} –{' '}
              {sessionTimeLabel(draft.end, timezone)}
            </p>
          )}
          {archived && (
            <p className="muted">
              This task or board is archived. Its session history is retained.
            </p>
          )}
          <label>
            Start time
            <input
              type="datetime-local"
              required
              value={start}
              disabled={archived}
              onChange={(event) => setStart(event.target.value)}
            />
          </label>
          <label>
            End time
            <input
              type="datetime-local"
              required
              value={end}
              disabled={archived}
              onChange={(event) => setEnd(event.target.value)}
            />
          </label>
          {warning && (
            <p role="status">Overlaps another session. You can still save.</p>
          )}
          <div className="form-actions">
            <button type="submit" disabled={!cardId || archived}>
              {pending ? 'Saving…' : 'Save session'}
            </button>
            {card &&
              !boards.find((board) => board.id === card.board_id)
                ?.archived_at && (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => onEditTask(card)}
                >
                  Edit task
                </button>
              )}
            {draft.session && (
              <button
                type="button"
                className="button-secondary"
                onClick={() =>
                  void submit({ kind: 'remove', session: draft.session! })
                }
              >
                Remove session
              </button>
            )}
            <button
              type="button"
              className="button-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
          {draft.session && (
            <p className="muted">
              Removing this session keeps the task and its other sessions.
            </p>
          )}
        </fieldset>
      </form>
    </Dialog>
  )
}
