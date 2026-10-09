import { useState } from 'react'
import { Dialog } from '../../app/Dialog'
import type { BoardSnapshot, Command, Label } from '../../domain/kanban'
import { ConflictError } from './api'

export function Labels({
  snapshot,
  pending,
  error,
  onSubmit,
  onClose,
  onReset,
}: {
  snapshot: BoardSnapshot
  pending: boolean
  error: Error | null
  onSubmit: (command: Command, version: number) => Promise<void>
  onClose: () => void
  onReset: () => void
}) {
  const [draft, setDraft] = useState<{
    label: Label | null
    version: number
  } | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#244e3c')
  function edit(label: Label | null) {
    onReset()
    setDraft({ label, version: snapshot.board.version })
    setName(label?.name ?? '')
    setColor(label?.color ?? '#244e3c')
  }
  async function submit(command: Command, version: number) {
    try {
      await onSubmit(command, version)
      setDraft(null)
    } catch {
      // Keep the draft for failed writes and conflicts.
    }
  }
  return (
    <Dialog title="Manage labels" busy={pending} onClose={onClose}>
      {error && (
        <div className="error" role="alert">
          <p>{error.message}</p>
          {error instanceof ConflictError && draft && (
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setDraft(null)
                onReset()
              }}
            >
              Discard draft and review labels
            </button>
          )}
        </div>
      )}
      {draft ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void submit(
              draft.label
                ? {
                    kind: 'saveLabel',
                    id: draft.label.id,
                    name: name.trim(),
                    color,
                  }
                : {
                    kind: 'createLabel',
                    id: crypto.randomUUID(),
                    name: name.trim(),
                    color,
                  },
              draft.version,
            )
          }}
        >
          <fieldset disabled={pending}>
            <label>
              Label name
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                required
              />
            </label>
            <label>
              Label colour
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
              />
            </label>
            <div className="form-actions">
              <button disabled={!name.trim()}>Save label</button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  setDraft(null)
                  onReset()
                }}
              >
                Cancel
              </button>
              {draft.label && (
                <button
                  type="button"
                  className="button-secondary danger-action"
                  onClick={() => {
                    if (
                      window.confirm(
                        'Delete this label and remove it from all tasks on this board?',
                      )
                    )
                      void submit(
                        { kind: 'deleteLabel', id: draft.label!.id },
                        draft.version,
                      )
                  }}
                >
                  Delete label
                </button>
              )}
            </div>
          </fieldset>
        </form>
      ) : (
        <>
          <ul className="label-list">
            {snapshot.labels.map((label) => (
              <li key={label.id}>
                <span className="task-label">
                  <span
                    className="label-dot"
                    style={{ backgroundColor: label.color }}
                    aria-hidden="true"
                  />
                  {label.name}
                </span>
                <button
                  className="text-button"
                  disabled={pending}
                  onClick={() => edit(label)}
                  aria-label={`Edit label ${label.name}`}
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>
          {!snapshot.labels.length && (
            <p className="muted">
              No labels yet. Create a label to organise tasks on this board.
            </p>
          )}
          <div className="form-actions">
            <button disabled={pending} onClick={() => edit(null)}>
              New label
            </button>
            <button className="button-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </>
      )}
    </Dialog>
  )
}
