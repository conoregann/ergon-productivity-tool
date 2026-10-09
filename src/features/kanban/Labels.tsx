import { useState } from 'react'
import { ArrowLeft, Check, Pencil, Plus, Tags } from 'lucide-react'
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
    <Dialog
      title="Manage labels"
      busy={pending}
      onClose={onClose}
      className="labels-dialog"
    >
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
            <button
              type="button"
              className="text-button label-back"
              onClick={() => {
                setDraft(null)
                onReset()
              }}
            >
              <ArrowLeft aria-hidden="true" /> All labels
            </button>
            <h3>{draft.label ? 'Edit label' : 'New label'}</h3>
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
            <div className="label-colour-picker">
              <span>Colour</span>
              <div
                className="label-palette"
                role="radiogroup"
                aria-label="Preset colours"
              >
                {(
                  [
                    ['Forest', '#244e3c'],
                    ['Blue', '#345da5'],
                    ['Purple', '#7655a3'],
                    ['Rose', '#ae3443'],
                    ['Orange', '#a65b20'],
                    ['Gold', '#8b710a'],
                    ['Teal', '#267b80'],
                    ['Grey', '#667085'],
                  ] as const
                ).map(([title, value]) => (
                  <label
                    key={value}
                    style={{ backgroundColor: value }}
                    title={title}
                  >
                    <input
                      type="radio"
                      name="label-colour"
                      aria-label={title}
                      checked={color === value}
                      onChange={() => setColor(value)}
                    />
                    {color === value && <Check aria-hidden="true" />}
                  </label>
                ))}
              </div>
              <label className="label-custom-colour">
                <input
                  type="color"
                  aria-label="Label colour"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                />
                <span>Custom colour</span>
                <span className="muted">{color.toUpperCase()}</span>
              </label>
            </div>
            <div className="label-preview">
              <span className="muted">Preview</span>
              <span className="task-label">
                <span
                  className="label-dot"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                {name.trim() || 'Label name'}
              </span>
            </div>
            <div className="form-actions">
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
              <button disabled={!name.trim()}>
                {pending ? 'Saving…' : 'Save label'}
              </button>
            </div>
          </fieldset>
        </form>
      ) : (
        <>
          <div className="label-manager-intro">
            <span className="muted">
              {snapshot.labels.length}{' '}
              {snapshot.labels.length === 1 ? 'label' : 'labels'} on this board
            </span>
            <button
              className="button-secondary"
              disabled={pending}
              onClick={() => edit(null)}
            >
              <Plus aria-hidden="true" /> New label
            </button>
          </div>
          <ul className="label-list">
            {snapshot.labels.map((label) => {
              const count = snapshot.cardLabels.filter(
                (link) => link.label_id === label.id,
              ).length
              return (
                <li key={label.id}>
                  <button
                    className="label-manager-row"
                    disabled={pending}
                    onClick={() => edit(label)}
                    aria-label={`Edit label ${label.name}`}
                  >
                    <span className="label-row-icon">
                      <Tags aria-hidden="true" style={{ color: label.color }} />
                    </span>
                    <span className="label-row-copy">
                      <strong>{label.name}</strong>
                      <span className="muted">
                        {count} {count === 1 ? 'task' : 'tasks'}
                      </span>
                    </span>
                    <Pencil aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ul>
          {!snapshot.labels.length && (
            <div className="labels-empty">
              <Tags aria-hidden="true" />
              <h3>No labels yet</h3>
              <p className="muted">
                Create labels to group related tasks on this board.
              </p>
            </div>
          )}
          <div className="form-actions">
            <button className="button-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </>
      )}
    </Dialog>
  )
}
