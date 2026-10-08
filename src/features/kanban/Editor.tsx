import { useEffect, useRef, useState } from 'react'
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
}

export function Editor({
  editor,
  snapshot,
  pending,
  onSubmit,
  onClose,
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
  const [title, setTitle] = useState(subject?.title ?? '')
  const [description, setDescription] = useState(
    editor.kind === 'card' ? (editor.card?.description ?? '') : '',
  )
  const [deadline, setDeadline] = useState(
    editor.kind === 'card' ? (editor.card?.due_date ?? '') : '',
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
      return submit({ kind: 'saveBoard', title: title.trim(), archived })
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
      due_date: deadline || null,
      completed_at: completed
        ? (editor.card?.completed_at ?? new Date().toISOString())
        : null,
      archived_at: archived
        ? (editor.card?.archived_at ?? new Date().toISOString())
        : null,
    }
    return submit(
      editor.card
        ? { kind: 'saveCard', id: editor.card.id, fields }
        : {
            kind: 'createCard',
            id: crypto.randomUUID(),
            columnId: editor.columnId,
            fields,
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
    <section className="editor-panel" aria-labelledby="editor-heading">
      <h3 id="editor-heading">{heading}</h3>
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
              <label>
                Due date
                <input
                  name="due_date"
                  type="date"
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                />
              </label>
              {editor.card && (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={completed}
                    onChange={(event) => setCompleted(event.target.checked)}
                  />
                  Completed
                </label>
              )}
            </>
          )}
          {(editor.kind === 'board' ||
            (editor.kind === 'card' && editor.card)) && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={archived}
                onChange={(event) => setArchived(event.target.checked)}
              />
              Archived
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
            <button
              type="submit"
              disabled={editor.kind !== 'move' && !title.trim()}
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button
              className="button-secondary"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            {canDelete && (
              <button
                className="button-secondary danger-action"
                type="button"
                onClick={remove}
              >
                Delete {editor.kind === 'card' ? 'task' : editor.kind}
              </button>
            )}
          </div>
        </fieldset>
      </form>
    </section>
  )
}
