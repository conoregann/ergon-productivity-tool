import { useRef, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { CollisionDetection, DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import type { Command } from '../../domain/kanban'
import { ConflictError } from './api'
import { Editor } from './Editor'
import type { EditorState } from './Editor'
import { KanbanColumn } from './KanbanColumn'
import { useBoard } from './useBoard'

const collisionDetection: CollisionDetection = (args) => {
  const columnDrag = args.active.data.current?.kind === 'column'
  const filtered = {
    ...args,
    droppableContainers: args.droppableContainers.filter((container) =>
      columnDrag
        ? container.data.current?.kind === 'column'
        : container.data.current?.kind !== 'column',
    ),
  }
  if (columnDrag) return closestCenter(filtered)
  const hits = pointerWithin(filtered)
  const cardHit = hits.find(
    (hit) => String(hit.id).startsWith('card:') && hit.id !== args.active.id,
  )
  return cardHit ? [cardHit] : hits.length ? hits : closestCorners(filtered)
}

export function Kanban({
  ownerId,
  boardId,
  onBack,
}: {
  ownerId: string
  boardId: string
  onBack: () => void
}) {
  const { query, mutation } = useBoard(ownerId, boardId)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const returnFocus = useRef<HTMLElement | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )
  function openEditor(next: EditorState) {
    returnFocus.current = document.activeElement as HTMLElement
    mutation.reset()
    setEditor(next)
  }
  function closeEditor() {
    setEditor(null)
    requestAnimationFrame(() => {
      const target = returnFocus.current
      if (target?.isConnected) target.focus()
      else heading.current?.focus()
    })
  }
  async function send(command: Command, version: number) {
    await mutation.mutateAsync({ command, version })
    if (command.kind === 'deleteBoard') onBack()
  }
  function act(command: Command) {
    if (query.data) void send(command, query.data.board.version).catch(() => {})
  }
  if (!query.data)
    return (
      <section className="panel">
        <button className="button-secondary" onClick={onBack}>
          Back to boards
        </button>
        {query.isError ? (
          <>
            <p role="alert">{query.error.message}</p>
            <button onClick={() => void query.refetch()}>Try again</button>
          </>
        ) : (
          <p role="status">Loading board…</p>
        )}
      </section>
    )
  const snapshot = query.data
  const { board, columns, cards } = snapshot
  const disabled =
    mutation.isPending || Boolean(board.archived_at) || Boolean(editor)
  const visibleCards = cards.filter((card) => !card.archived_at)
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id || disabled) return
    const source = active.data.current
    const target = over.data.current
    if (source?.kind === 'column') {
      const from = columns.findIndex((column) => column.id === source.columnId)
      const to = columns.findIndex((column) => column.id === target?.columnId)
      if (to < 0 || from === to) return
      act({
        kind: 'moveColumn',
        id: source.columnId,
        beforeId: from < to ? (columns[to + 1]?.id ?? null) : columns[to]!.id,
      })
    } else if (source?.kind === 'card' && target?.columnId) {
      let beforeId = target.kind === 'card' ? target.cardId : null
      const list = visibleCards
        .filter((card) => card.column_id === target.columnId)
        .sort((a, b) => a.position - b.position)
      const from = list.findIndex((card) => card.id === source.cardId)
      const to = list.findIndex((card) => card.id === beforeId)
      if (from >= 0 && to > from) beforeId = list[to + 1]?.id ?? null
      act({
        kind: 'moveCard',
        id: source.cardId,
        columnId: target.columnId,
        beforeId,
      })
    }
  }
  return (
    <section className="live-board" aria-labelledby="live-board-heading">
      <button
        className="text-button back-link"
        onClick={onBack}
        disabled={mutation.isPending}
      >
        ← All boards
      </button>
      <header className="section-header">
        <div>
          <p className="section-label">
            {board.archived_at ? 'Archived board' : 'Your workspace'}
          </p>
          <h2 id="live-board-heading" ref={heading} tabIndex={-1}>
            {board.title}
          </h2>
        </div>
        <div className="board-toolbar">
          <button
            className="button-secondary"
            disabled={mutation.isPending}
            onClick={() =>
              openEditor({ kind: 'board', version: board.version })
            }
          >
            Edit board
          </button>
          <button
            disabled={disabled}
            onClick={() =>
              openEditor({
                kind: 'column',
                version: board.version,
                column: null,
              })
            }
          >
            Add column
          </button>
        </div>
      </header>
      {mutation.error && (
        <div role="alert" className="error">
          <p>{mutation.error.message}</p>
          {mutation.error instanceof ConflictError && editor && (
            <button
              className="button-secondary"
              onClick={() => {
                closeEditor()
                mutation.reset()
              }}
            >
              Close draft and review latest board
            </button>
          )}
        </div>
      )}
      {query.isError && (
        <p role="alert" className="error">
          Could not refresh the board.{' '}
          <button className="text-button" onClick={() => void query.refetch()}>
            Try again
          </button>
        </p>
      )}
      {mutation.isPending && (
        <p role="status" className="save-status">
          Saving changes…
        </p>
      )}
      {editor && (
        <Editor
          key={`${editor.kind}-${editor.version}`}
          editor={editor}
          snapshot={snapshot}
          pending={mutation.isPending}
          onSubmit={send}
          onClose={closeEditor}
        />
      )}
      {board.archived_at && (
        <p className="preview-note">
          This board is archived. Restore it through Edit board to make changes.
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragEnd={onDragEnd}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) =>
              `Picked up ${active.data.current?.label}.`,
            onDragOver: ({ active, over }) =>
              over
                ? `${active.data.current?.label} moved over ${over.data.current?.label}.`
                : `${active.data.current?.label} is outside a drop target.`,
            onDragEnd: ({ active, over }) =>
              over
                ? `Dropped ${active.data.current?.label} at ${over.data.current?.label}.`
                : `Movement of ${active.data.current?.label} cancelled.`,
            onDragCancel: ({ active }) =>
              `Movement of ${active.data.current?.label} cancelled.`,
          },
          screenReaderInstructions: {
            draggable:
              'Focus a card and press Space to pick it up, arrow keys to move, Space to drop, or Escape to cancel. You can also use the Move task form or column order buttons.',
          },
        }}
      >
        <SortableContext
          items={columns.map((column) => 'column:' + column.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="kanban-grid live-grid">
            {columns.map((column, index) => (
              <KanbanColumn
                key={column.id}
                column={column}
                cards={visibleCards
                  .filter((card) => card.column_id === column.id)
                  .sort((a, b) => a.position - b.position)}
                disabled={disabled}
                first={index === 0}
                last={index === columns.length - 1}
                onEdit={() =>
                  openEditor({ kind: 'column', version: board.version, column })
                }
                onAdd={() =>
                  openEditor({
                    kind: 'card',
                    version: board.version,
                    columnId: column.id,
                    card: null,
                  })
                }
                onEarlier={() =>
                  act({
                    kind: 'moveColumn',
                    id: column.id,
                    beforeId: columns[index - 1]!.id,
                  })
                }
                onLater={() =>
                  act({
                    kind: 'moveColumn',
                    id: column.id,
                    beforeId: columns[index + 2]?.id ?? null,
                  })
                }
                onEditCard={(card) =>
                  openEditor({
                    kind: 'card',
                    version: board.version,
                    columnId: column.id,
                    card,
                  })
                }
                onMoveCard={(card) =>
                  openEditor({ kind: 'move', version: board.version, card })
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {!columns.length && (
        <p className="preview-note">Add a column to start organising tasks.</p>
      )}
      <section className="archived-tasks">
        <button
          className="text-button"
          aria-expanded={showArchived}
          onClick={() => setShowArchived(!showArchived)}
        >
          Archived tasks ({cards.filter((card) => card.archived_at).length})
        </button>
        {showArchived && (
          <ul className="board-list">
            {cards
              .filter((card) => card.archived_at)
              .map((card) => (
                <li key={card.id}>
                  <span>{card.title}</span>
                  <button
                    className="button-secondary"
                    disabled={disabled}
                    onClick={() =>
                      openEditor({
                        kind: 'card',
                        version: board.version,
                        columnId: card.column_id,
                        card,
                      })
                    }
                  >
                    Edit archived task
                    <span className="sr-only"> {card.title}</span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </section>
    </section>
  )
}
