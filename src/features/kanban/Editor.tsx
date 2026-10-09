import { useEffect, useRef, useState } from 'react'
import {
  Archive,
  Check,
  CircleCheck,
  MoveRight,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { Dialog } from '../../app/Dialog'
import { DatePicker } from './DatePicker'
import { DueTime } from './DueTime'
import { boardBackgrounds } from './appearance'
import type { BoardSnapshot, Card, Column, Command } from '../../domain/kanban'

export type EditorState =
  | { kind: 'board'; version: number }
  | { kind: 'column'; version: number; column: Column | null }
  | { kind: 'card'; version: number; columnId: string; card: Card | null }
  | { kind: 'move'; version: number; card: Card }

type Props = {
  editor: EditorState
  snapshot: BoardSnapshot
  pending: boolean
  onSubmit: (command: Command, version: number) => Promise<void>
  onClose: () => void
  error: Error | null
  onReview: (() => void) | null
  onPlacement: () => void
}

export function Editor({
  editor,
  snapshot,
  pending,
  onSubmit,
  onClose,
  error,
  onReview,
  onPlacement,
}: Props) {
  const firstField = useRef<HTMLInputElement>(null)
  const subject =
    editor.kind === 'card'
      ? editor.card
      : editor.kind === 'column'
        ? editor.column
        : editor.kind === 'board'
          ? snapshot.board
          : editor.card
  const [background, setBackground] = useState(
    snapshot.board.background ?? 'neutral',
  )
  const [title, setTitle] = useState(subject?.title ?? '')
  const [description, setDescription] = useState(
    editor.kind === 'card' ? (editor.card?.description ?? '') : '',
  )
  const [priority, setPriority] = useState(
    editor.kind === 'card' ? (editor.card?.priority ?? 'none') : 'none',
  )
  const [deadline, setDeadline] = useState(
    editor.kind === 'card' ? (editor.card?.due_date ?? '') : '',
  )
  const [dueTime, setDueTime] = useState(
    editor.kind === 'card' ? (editor.card?.due_time ?? '') : '',
  )
  const [completed, setCompleted] = useState(
    editor.kind === 'card' && Boolean(editor.card?.completed_at),
  )
  const [archived, setArchived] = useState(
    Boolean(subject && 'archived_at' in subject && subject.archived_at),
  )
  const [columnId, setColumnId] = useState(
    editor.kind === 'move' ? editor.card.column_id : '',
  )
  const [beforeId, setBeforeId] = useState('')
  const [labelIds, setLabelIds] = useState<string[]>(() =>
    editor.kind === 'card'
      ? snapshot.cardLabels
          .filter((link) => link.card_id === editor.card?.id)
          .map((link) => link.label_id)
      : [],
  )
  useEffect(() => {
    firstField.current?.focus()
  }, [])
  const heading =
    editor.kind === 'move'
      ? 'Move task'
      : editor.kind === 'board'
        ? 'Edit board'
        : editor.kind === 'column'
          ? editor.column
            ? 'Edit column'
            : 'New column'
          : editor.card
            ? 'Edit task'
            : 'New task'

  async function submit(command: Command) {
    try {
      await onSubmit(command, editor.version)
      onClose()
    } catch {
      /* The workspace shows the error; keep the draft intact. */
    }
  }
  function save() {
    if (editor.kind === 'board')
      return submit({
        kind: 'saveBoard',
        title: title.trim(),
        archived,
        background,
      })
    if (editor.kind === 'column')
      return submit(
        editor.column
          ? { kind: 'saveColumn', id: editor.column.id, title: title.trim() }
          : {
              kind: 'createColumn',
              id: crypto.randomUUID(),
              title: title.trim(),
            },
      )
    if (editor.kind === 'move')
      return submit({
        kind: 'moveCard',
        id: editor.card.id,
        columnId,
        beforeId: beforeId || null,
      })
    const fields = {
      title: title.trim(),
      description,
      priority,
      due_date: deadline || null,
      due_time: deadline && dueTime ? dueTime : null,
      completed_at: completed
        ? (editor.card?.completed_at ?? new Date().toISOString())
        : null,
      archived_at: archived
        ? (editor.card?.archived_at ?? new Date().toISOString())
        : null,
    }
    return submit(
      editor.card
        ? { kind: 'saveCard', id: editor.card.id, fields, labelIds }
        : {
            kind: 'createCard',
            id: crypto.randomUUID(),
            columnId: editor.columnId,
            fields,
            labelIds,
          },
    )
  }
  function remove() {
    if (
      editor.kind === 'board' &&
      window.confirm(
        'Delete this board and all its tasks and scheduled sessions? This cannot be undone.',
      )
    )
      void submit({ kind: 'deleteBoard' })
    if (
      editor.kind === 'card' &&
      editor.card &&
      window.confirm(
        'Delete this task and its scheduled sessions? This cannot be undone.',
      )
    )
      void submit({ kind: 'deleteCard', id: editor.card.id })
    if (
      editor.kind === 'column' &&
      editor.column &&
      window.confirm('Delete this empty column?')
    )
      void submit({ kind: 'deleteColumn', id: editor.column.id })
  }
  const canDelete =
    editor.kind === 'board' ||
    (editor.kind === 'card' && editor.card) ||
    (editor.kind === 'column' &&
      editor.column &&
      !snapshot.cards.some((card) => card.column_id === editor.column!.id))
  return (
    <Dialog
      title={heading}
      busy={pending}
      onClose={onClose}
      className={editor.kind === 'card' ? 'task-editor' : ''}
    >
      {error && (
        <div role="alert" className="error">
          <p>{error.message}</p>
          {onReview && (
            <button
              type="button"
              className="button-secondary"
              onClick={onReview}
            >
              Close draft and review latest board
            </button>
          )}
        </div>
      )}
      {editor.kind === 'card' && editor.card && (
        <button
          className="text-button placement-link"
          type="button"
          disabled={pending}
          onClick={() => {
            const dirty =
              title !== editor.card!.title ||
              description !== editor.card!.description ||
              priority !== editor.card!.priority ||
              deadline !== (editor.card!.due_date ?? '') ||
              dueTime !== (editor.card!.due_time ?? '') ||
              completed !== Boolean(editor.card!.completed_at) ||
              archived !== Boolean(editor.card!.archived_at) ||
              labelIds.slice().sort().join(',') !==
                snapshot.cardLabels
                  .filter((link) => link.card_id === editor.card!.id)
                  .map((link) => link.label_id)
                  .sort()
                  .join(',')
            if (
              !dirty ||
              window.confirm(
                'Discard unsaved task changes to change placement?',
              )
            )
              onPlacement()
          }}
        >
          <MoveRight aria-hidden="true" />
          Placement
        </button>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <fieldset disabled={pending}>
          {editor.kind !== 'move' && (
            <label>
              Title
              <input
                ref={firstField}
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                maxLength={editor.kind === 'card' ? 500 : 200}
              />
            </label>
          )}
          {editor.kind === 'board' && (
            <div
              className="background-picker"
              role="group"
              aria-label="Board background"
            >
              <span>Background</span>
              <div className="background-swatches">
                {boardBackgrounds.map(({ value, label }) => (
                  <button
                    type="button"
                    key={value}
                    className="background-swatch"
                    data-background={value}
                    aria-label={`${label} background`}
                    aria-pressed={background === value}
                    onClick={() => setBackground(value)}
                  >
                    <span aria-hidden="true">
                      {background === value ? '✓' : ''}
                    </span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <div
                className="background-preview"
                data-background={background}
                aria-hidden="true"
              >
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
          {editor.kind === 'card' && (
            <>
              <label>
                Description
                <textarea
                  name="description"
                  rows={3}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <div className="task-details-row">
                <div className="form-field">
                  <label htmlFor="card-priority">Priority</label>
                  <select
                    id="card-priority"
                    value={priority}
                    onChange={(event) => setPriority(event.target.value)}
                  >
                    <option value="none">No priority</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <DatePicker
                  value={deadline}
                  onChange={(value) => {
                    setDeadline(value)
                    if (!value) setDueTime('')
                  }}
                />
                <DueTime
                  value={dueTime}
                  disabled={!deadline}
                  onChange={setDueTime}
                />
              </div>
              <div
                className="label-assignment"
                role="group"
                aria-label="Task labels"
              >
                <span className="label-assignment-heading">
                  Labels{' '}
                  <span className="muted">{labelIds.length} selected</span>
                </span>
                {snapshot.labels.length ? (
                  <div className="task-label-choices">
                    {snapshot.labels.map((label) => (
                      <label className="task-label-choice" key={label.id}>
                        <input
                          type="checkbox"
                          checked={labelIds.includes(label.id)}
                          onChange={(event) =>
                            setLabelIds(
                              event.target.checked
                                ? [...labelIds, label.id]
                                : labelIds.filter((id) => id !== label.id),
                            )
                          }
                        />
                        <span
                          className="label-dot"
                          style={{ backgroundColor: label.color }}
                          aria-hidden="true"
                        />
                        <span>{label.name}</span>
                        <Check
                          className="label-choice-check"
                          aria-hidden="true"
                        />
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="muted">
                    Create labels using Manage labels on the board.
                  </p>
                )}
              </div>
              {editor.card && (
                <label className="checkbox-label task-status completion-control">
                  <CircleCheck aria-hidden="true" className="status-icon" />
                  <span>Completed</span>
                  <span className="status-checkbox">
                    <input
                      type="checkbox"
                      checked={completed}
                      onChange={(event) => setCompleted(event.target.checked)}
                    />
                    <Check aria-hidden="true" />
                  </span>
                </label>
              )}
            </>
          )}
          {(editor.kind === 'board' ||
            (editor.kind === 'card' && editor.card)) && (
            <label
              className={`checkbox-label ${editor.kind === 'card' ? 'task-status' : ''}`}
            >
              {editor.kind === 'card' && (
                <Archive aria-hidden="true" className="status-icon" />
              )}
              <span>Archived</span>
              <span className={editor.kind === 'card' ? 'status-checkbox' : ''}>
                <input
                  type="checkbox"
                  checked={archived}
                  onChange={(event) => setArchived(event.target.checked)}
                />
                {editor.kind === 'card' && <Check aria-hidden="true" />}
              </span>
            </label>
          )}
          {editor.kind === 'move' && (
            <>
              <div className="form-field">
                <label htmlFor="move-column">Column</label>
                <select
                  id="move-column"
                  autoFocus
                  value={columnId}
                  onChange={(event) => {
                    setColumnId(event.target.value)
                    setBeforeId('')
                  }}
                >
                  {snapshot.columns.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="move-position">Position</label>
                <select
                  id="move-position"
                  value={beforeId}
                  onChange={(event) => setBeforeId(event.target.value)}
                >
                  <option value="">At the end</option>
                  {snapshot.cards
                    .filter(
                      (card) =>
                        card.column_id === columnId &&
                        card.id !== editor.card.id &&
                        !card.archived_at,
                    )
                    .sort((a, b) => a.position - b.position)
                    .map((card) => (
                      <option key={card.id} value={card.id}>
                        Before {card.title}
                      </option>
                    ))}
                </select>
              </div>
            </>
          )}
          <div className="form-actions">
            {canDelete && (
              <button
                className="button-secondary danger-action"
                type="button"
                onClick={remove}
              >
                <Trash2 aria-hidden="true" />
                Delete {editor.kind === 'card' ? 'task' : editor.kind}
              </button>
            )}
            <button
              className="button-secondary"
              type="button"
              onClick={onClose}
            >
              <X aria-hidden="true" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={editor.kind !== 'move' && !title.trim()}
            >
              <Save aria-hidden="true" />
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </fieldset>
      </form>
    </Dialog>
  )
}
