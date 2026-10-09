import { useEffect, useRef } from 'react'
import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Check,
  GripVertical,
  Plus,
  CalendarDays,
  MoreHorizontal,
} from 'lucide-react'
import { Rename } from '../../app/Rename'
import type { Card, Column, Label } from '../../domain/kanban'

type Props = {
  column: Column
  cards: Card[]
  labelsForCard: (card: Card) => Label[]
  disabled: boolean
  onEdit: () => void
  onAdd: () => void
  onEditCard: (card: Card) => void
  onRename: (title: string) => Promise<void>
  dropTarget: string | null
  dragging: boolean
}

export function CardContent({
  card,
  labels = [],
}: {
  card: Card
  labels?: Label[]
}) {
  return (
    <>
      <div className="task-heading">
        <h4>{card.title}</h4>
        {(card.priority !== 'none' || labels.length > 0) && (
          <div className="task-markers">
            {card.priority !== 'none' && (
              <span className={`priority priority-${card.priority}`}>
                <span aria-hidden="true" className="priority-dot" />
                {card.priority.charAt(0).toUpperCase() + card.priority.slice(1)}
              </span>
            )}
            {labels.map((label) => (
              <span
                className="card-label-tab"
                key={label.id}
                role="img"
                aria-label={`Label: ${label.name}`}
                title={label.name}
                style={{ backgroundColor: label.color }}
              />
            ))}
          </div>
        )}
      </div>
      {card.description && (
        <p className="task-description">{card.description}</p>
      )}
      <div className="task-meta">
        {card.completed_at && (
          <span className="quiet-badge completion-badge">
            <Check aria-hidden="true" />
            Completed
          </span>
        )}
        {card.due_date && (
          <span className="deadline">
            <CalendarDays aria-hidden="true" />
            <time
              dateTime={
                card.due_time
                  ? `${card.due_date}T${card.due_time}`
                  : card.due_date
              }
            >
              Due {card.due_date}
              {card.due_time ? ` at ${card.due_time}` : ''}
            </time>
          </span>
        )}
      </div>
    </>
  )
}

function TaskCard({
  card,
  labels,
  disabled,
  onEdit,
  dropTarget,
}: {
  dropTarget: boolean
  card: Card
  labels: Label[]
  disabled: boolean
  onEdit: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: 'card:' + card.id,
    disabled,
    transition: { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    data: {
      kind: 'card',
      cardId: card.id,
      columnId: card.column_id,
      label: card.title,
    },
  })
  const dragged = useRef(false)
  useEffect(() => {
    if (isDragging) dragged.current = true
  }, [isDragging])
  return (
    <li
      ref={setNodeRef}
      {...listeners}
      onMouseDown={(event) => {
        dragged.current = false
        listeners?.onMouseDown?.(event)
      }}
      onTouchStart={(event) => {
        dragged.current = false
        listeners?.onTouchStart?.(event)
      }}
      onClick={() => {
        if (!disabled && !dragged.current) onEdit()
      }}
      style={{
        transform: isDragging ? undefined : CSS.Transform.toString(transform),
        transition,
      }}
      className={`task-card ${isDragging ? 'drag-source' : ''} ${dropTarget ? 'card-drop-target' : ''}`}
    >
      <div
        ref={setActivatorNodeRef}
        {...attributes}
        className="card-content"
        aria-label={`Open task ${card.title}`}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !disabled && !isDragging) {
            event.preventDefault()
            onEdit()
          }
        }}
      >
        <CardContent card={card} labels={labels} />
      </div>
    </li>
  )
}

export function KanbanColumn({
  column,
  cards,
  labelsForCard,
  disabled,
  onEdit,
  onAdd,
  onEditCard,
  onRename,
  dropTarget,
  dragging,
}: Props) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    attributes,
    listeners,
  } = useSortable({
    id: 'column:' + column.id,
    disabled,
    transition: { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    data: { kind: 'column', columnId: column.id, label: column.title },
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: 'drop:' + column.id,
    disabled,
    data: { kind: 'drop', columnId: column.id, label: column.title },
  })
  return (
    <section
      ref={setNodeRef}
      style={{
        transform: isDragging ? undefined : CSS.Translate.toString(transform),
        transition,
      }}
      className={`kanban-column ${isDragging ? 'column-drag-source' : ''}`}
      aria-label={column.title}
    >
      <header className="column-header">
        <button
          ref={setActivatorNodeRef}
          className="icon-button drag-handle"
          disabled={disabled}
          {...attributes}
          {...listeners}
          aria-label={`Drag column ${column.title}`}
        >
          <GripVertical aria-hidden="true" />
        </button>
        <h3>
          <Rename
            value={column.title}
            label="Column name"
            disabled={disabled}
            onSave={onRename}
          />
        </h3>
        <span className="count" aria-label={`${cards.length} tasks`}>
          {cards.length}
        </span>
        <details className="column-options">
          <summary aria-label={`Options for ${column.title}`}>
            <MoreHorizontal aria-hidden="true" />
          </summary>
          <button
            className="text-button"
            disabled={disabled}
            onClick={(event) => {
              event.currentTarget.closest('details')?.removeAttribute('open')
              onEdit()
            }}
          >
            Column settings
          </button>
        </details>
      </header>
      <div
        ref={setDropRef}
        className={`column-dropzone ${dragging && (isOver || dropTarget === 'drop:' + column.id) ? 'drop-target' : ''}`}
      >
        <SortableContext
          items={cards.map((card) => 'card:' + card.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="task-list">
            {cards.map((card) => (
              <TaskCard
                key={card.id}
                card={card}
                labels={labelsForCard(card)}
                disabled={disabled}
                dropTarget={dropTarget === 'card:' + card.id}
                onEdit={() => onEditCard(card)}
              />
            ))}
          </ul>
        </SortableContext>
        {!cards.length && <p className="column-empty">No tasks</p>}
      </div>
      <button className="add-task" disabled={disabled} onClick={onAdd}>
        <Plus aria-hidden="true" />
        Add task<span className="sr-only"> to {column.title}</span>
      </button>
    </section>
  )
}
