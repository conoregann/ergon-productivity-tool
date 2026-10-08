import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GripVertical,
  Pencil,
  Plus,
  CalendarDays,
} from 'lucide-react'
import type { Card, Column } from '../../domain/kanban'

type Props = {
  column: Column
  cards: Card[]
  disabled: boolean
  first: boolean
  last: boolean
  onEdit: () => void
  onAdd: () => void
  onEarlier: () => void
  onLater: () => void
  onEditCard: (card: Card) => void
  onMoveCard: (card: Card) => void
}

function TaskCard({
  card,
  disabled,
  onEdit,
  onMove,
}: {
  card: Card
  disabled: boolean
  onEdit: () => void
  onMove: () => void
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
    data: {
      kind: 'card',
      cardId: card.id,
      columnId: card.column_id,
      label: card.title,
    },
  })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`task-card live-task ${isDragging ? 'is-dragging' : ''}`}
    >
      <div className="task-heading">
        <h4>{card.title}</h4>
        <button
          ref={setActivatorNodeRef}
          className="icon-button drag-handle"
          disabled={disabled}
          {...attributes}
          {...listeners}
          aria-label={`Drag task ${card.title}`}
        >
          <GripVertical aria-hidden="true" />
        </button>
      </div>
      {card.description && (
        <p className="task-description">{card.description}</p>
      )}
      <div className="task-meta">
        {card.completed_at && (
          <span className="quiet-badge">
            <Check aria-hidden="true" />
            Completed
          </span>
        )}
        {card.due_date && (
          <span className="deadline">
            <CalendarDays aria-hidden="true" />
            <time dateTime={card.due_date}>Due {card.due_date}</time>
          </span>
        )}
      </div>
      <div className="task-actions">
        <button className="text-button" disabled={disabled} onClick={onEdit}>
          Edit<span className="sr-only"> {card.title}</span>
        </button>
        <button className="text-button" disabled={disabled} onClick={onMove}>
          Move<span className="sr-only"> {card.title}</span>
        </button>
      </div>
    </li>
  )
}

export function KanbanColumn({
  column,
  cards,
  disabled,
  first,
  last,
  onEdit,
  onAdd,
  onEarlier,
  onLater,
  onEditCard,
  onMoveCard,
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
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
      className={`kanban-column ${isDragging ? 'is-dragging' : ''}`}
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
        <h3>{column.title}</h3>
        <span className="count" aria-label={`${cards.length} tasks`}>
          {cards.length}
        </span>
      </header>
      <div className="column-actions">
        <button
          className="icon-button"
          disabled={disabled || first}
          onClick={onEarlier}
          aria-label={`Move ${column.title} earlier`}
        >
          <ArrowLeft aria-hidden="true" />
        </button>
        <button
          className="icon-button"
          disabled={disabled || last}
          onClick={onLater}
          aria-label={`Move ${column.title} later`}
        >
          <ArrowRight aria-hidden="true" />
        </button>
        <button
          className="icon-button"
          disabled={disabled}
          onClick={onEdit}
          aria-label={`Edit column ${column.title}`}
        >
          <Pencil aria-hidden="true" />
        </button>
      </div>
      <div
        ref={setDropRef}
        className={`column-dropzone ${isOver ? 'drop-target' : ''}`}
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
                disabled={disabled}
                onEdit={() => onEditCard(card)}
                onMove={() => onMoveCard(card)}
              />
            ))}
          </ul>
        </SortableContext>
        {!cards.length && <p className="column-empty">No tasks</p>}
      </div>
      <button
        className="button-secondary add-task"
        disabled={disabled}
        onClick={onAdd}
      >
        <Plus aria-hidden="true" />
        Add task<span className="sr-only"> to {column.title}</span>
      </button>
    </section>
  )
}
