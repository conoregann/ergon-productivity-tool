import type { Board, Label } from '../../domain/kanban'
import type { CalendarFilters as Filters } from '../../domain/calendarExperience'
import './calendarExperience.css'

export function CalendarFilters({
  boards,
  labels,
  value,
  onChange,
}: {
  boards: Board[]
  labels: Label[]
  value: Filters
  onChange: (value: Filters) => void
}) {
  return (
    <div
      className="calendar-filters"
      role="group"
      aria-label="Calendar filters"
    >
      <label>
        Board
        <select
          value={value.boardId}
          onChange={(event) => {
            const boardId = event.target.value
            const label = labels.find((label) => label.id === value.labelId)
            onChange({
              ...value,
              boardId,
              labelId:
                boardId && label?.board_id !== boardId ? '' : value.labelId,
            })
          }}
        >
          <option value="">All boards</option>
          {boards.map((board) => (
            <option key={board.id} value={board.id}>
              {board.title}
              {board.archived_at ? ' (archived)' : ''}
            </option>
          ))}
        </select>
      </label>
      <label>
        Label
        <select
          value={value.labelId}
          onChange={(event) =>
            onChange({ ...value, labelId: event.target.value })
          }
        >
          <option value="">All labels</option>
          {labels
            .filter(
              (label) => !value.boardId || label.board_id === value.boardId,
            )
            .map((label) => (
              <option key={label.id} value={label.id}>
                {label.name}
                {!value.boardId
                  ? ` · ${boards.find((board) => board.id === label.board_id)?.title ?? ''}`
                  : ''}
              </option>
            ))}
        </select>
      </label>
      <label>
        Completion
        <select
          value={value.completion}
          onChange={(event) =>
            onChange({
              ...value,
              completion: event.target.value as Filters['completion'],
            })
          }
        >
          <option value="all">All tasks</option>
          <option value="incomplete">Incomplete</option>
          <option value="completed">Completed</option>
        </select>
      </label>
      {(value.boardId || value.labelId || value.completion !== 'all') && (
        <button
          type="button"
          className="button-secondary"
          onClick={() =>
            onChange({ boardId: '', labelId: '', completion: 'all' })
          }
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
