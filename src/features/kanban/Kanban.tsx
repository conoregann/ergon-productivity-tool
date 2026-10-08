import { useEffect, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  defaultDropAnimationSideEffects,
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
import type { ReactNode } from 'react'
import { Plus, MoreHorizontal } from 'lucide-react'
import { Rename } from '../../app/Rename'
import type { Card, Command } from '../../domain/kanban'
import { ConflictError } from './api'
import { Editor } from './Editor'
import type { EditorState } from './Editor'
import { CardContent, KanbanColumn } from './KanbanColumn'
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
  sidebarControl,
}: {
  ownerId: string
  boardId: string
  onBack: () => void
  sidebarControl: ReactNode
}) {
  const { query, mutation } = useBoard(ownerId, boardId)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [dragCard, setDragCard] = useState<Card | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [reducedMotion, setReducedMotion] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
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
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
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
    setDragCard(null)
    setDropTarget(null)
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
      <header className="workspace-header board-header">
        {sidebarControl}
        <h1 id="live-board-heading" ref={heading} tabIndex={-1}>
          <Rename
            value={board.title}
            label="Board name"
            disabled={mutation.isPending || Boolean(editor)}
            onSave={(title) =>
              send(
                {
                  kind: 'saveBoard',
                  title,
                  archived: Boolean(board.archived_at),
                },
                board.version,
              )
            }
          />
        </h1>
        <details className="board-options">
          <summary aria-label="Board options">
            <MoreHorizontal aria-hidden="true" />
          </summary>
          <button
            className="text-button"
            disabled={mutation.isPending}
            onClick={(event) => {
              event.currentTarget.closest('details')?.removeAttribute('open')
              openEditor({ kind: 'board', version: board.version })
            }}
          >
            Board settings
          </button>
        </details>
        {board.archived_at && <span className="quiet-badge">Archived</span>}
      </header>
      <div className="board-canvas" data-background={board.background}>
        {mutation.error && !editor && (
          <div role="alert" className="error">
            {mutation.error.message}
          </div>
        )}
        {query.isError && (
          <p role="alert" className="error">
            Could not refresh the board.{' '}
            <button
              className="text-button"
              onClick={() => void query.refetch()}
            >
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
            error={mutation.error}
            onReview={
              mutation.error instanceof ConflictError
                ? () => {
                    closeEditor()
                    mutation.reset()
                  }
                : null
            }
            onPlacement={() => {
              if (editor.kind === 'card' && editor.card)
                setEditor({
                  kind: 'move',
                  version: editor.version,
                  card: editor.card,
                })
            }}
          />
        )}
        {board.archived_at && (
          <p className="preview-note">
            Restore this board through Board settings to make changes.
          </p>
        )}
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={({ active }) => {
            const card = cards.find((card) => active.id === 'card:' + card.id)
            setDragCard(card ?? null)
          }}
          onDragOver={({ over }) =>
            setDropTarget(over ? String(over.id) : null)
          }
          onDragCancel={() => {
            setDragCard(null)
            setDropTarget(null)
          }}
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
                'Focus a card and press Space to pick it up, arrow keys to move, Space to drop, or Escape to cancel. Press Enter to edit a card, then choose Placement for the movement form. Column names can be clicked to rename.',
            },
          }}
        >
          <SortableContext
            items={columns.map((column) => 'column:' + column.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div
              className={`kanban-grid live-grid ${dragCard ? 'is-sorting' : ''}`}
              role="group"
              aria-label="Board columns"
              tabIndex={0}
            >
              {columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  dragging={Boolean(dragCard)}
                  dropTarget={dropTarget}
                  cards={visibleCards
                    .filter((card) => card.column_id === column.id)
                    .sort((a, b) => a.position - b.position)}
                  disabled={disabled}
                  onEdit={() =>
                    openEditor({
                      kind: 'column',
                      version: board.version,
                      column,
                    })
                  }
                  onAdd={() =>
                    openEditor({
                      kind: 'card',
                      version: board.version,
                      columnId: column.id,
                      card: null,
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
                  onRename={(title) =>
                    send(
                      { kind: 'saveColumn', id: column.id, title },
                      board.version,
                    )
                  }
                />
              ))}
              <button
                className="add-column-tile"
                disabled={disabled}
                onClick={() =>
                  openEditor({
                    kind: 'column',
                    version: board.version,
                    column: null,
                  })
                }
              >
                <Plus aria-hidden="true" />
                Add column
              </button>
            </div>
          </SortableContext>
          <DragOverlay
            dropAnimation={
              reducedMotion
                ? null
                : {
                    duration: 220,
                    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
                    sideEffects: defaultDropAnimationSideEffects({
                      styles: { active: { opacity: '0' } },
                    }),
                  }
            }
          >
            {dragCard && (
              <div className="task-card drag-preview" aria-hidden="true">
                <CardContent card={dragCard} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
        {!columns.length && (
          <p className="preview-note">
            Add a column to start organising tasks.
          </p>
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
                    <button
                      className="text-button"
                      aria-label={`Open archived task ${card.title}`}
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
                      {card.title}
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  )
}
