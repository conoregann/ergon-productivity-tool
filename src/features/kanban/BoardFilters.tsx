import { useId, useRef, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import type { Label } from '../../domain/kanban'
import { emptyTaskFilters } from '../../domain/task-filters'
import type { TaskFilters } from '../../domain/task-filters'

export function BoardFilters({
  value,
  labels,
  visibleCount,
  totalCount,
  onChange,
}: {
  value: TaskFilters
  labels: Label[]
  visibleCount: number
  totalCount: number
  onChange: (value: TaskFilters) => void
}) {
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const count = [
    value.search.trim(),
    value.labelId,
    value.priority,
    value.completion,
  ].filter(Boolean).length
  return (
    <div className="board-filters">
      <button
        type="button"
        className="button-secondary board-tool filter-toggle"
        aria-label={`Filters${count ? ` (${count} active)` : ''}`}
        title="Filters"
        aria-expanded={open}
        aria-controls={id}
        popoverTarget={id}
      >
        <SlidersHorizontal aria-hidden="true" />
        {count > 0 && <span className="count">{count}</span>}
      </button>
      <div
        ref={panel}
        id={id}
        popover="auto"
        role="dialog"
        aria-label="Task filters"
        className="board-filter-panel"
        onToggle={(event) => {
          setOpen(event.newState === 'open')
          if (event.newState === 'open') search.current?.focus()
        }}
      >
        <header className="board-filter-heading">
          <div>
            <h2>Filter tasks</h2>
            <p className="muted">Find the work you want to focus on.</p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close filters"
            onClick={() => panel.current?.hidePopover()}
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="board-filter-body">
          <label className="board-filter-search">
            <span>Search tasks</span>
            <div>
              <Search aria-hidden="true" />
              <input
                ref={search}
                type="search"
                placeholder="Title or description"
                value={value.search}
                onChange={(event) =>
                  onChange({ ...value, search: event.target.value })
                }
              />
            </div>
          </label>
          <fieldset
            className="board-filter-group"
            aria-label="Completion filter"
          >
            <legend>Completion</legend>
            <div className="filter-choices completion-choices">
              {(
                [
                  ['', 'All tasks'],
                  ['incomplete', 'Incomplete'],
                  ['completed', 'Completed'],
                ] as const
              ).map(([key, name]) => (
                <label key={key}>
                  <input
                    type="radio"
                    name={`${id}-completion`}
                    value={key}
                    checked={value.completion === key}
                    onChange={() => onChange({ ...value, completion: key })}
                  />
                  <span>{name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="board-filter-group" aria-label="Priority filter">
            <legend>Priority</legend>
            <div className="filter-choices">
              {(
                [
                  ['', 'All priorities'],
                  ['none', 'No priority'],
                  ['low', 'Low'],
                  ['medium', 'Medium'],
                  ['high', 'High'],
                  ['urgent', 'Urgent'],
                ] as const
              ).map(([key, name]) => (
                <label key={key}>
                  <input
                    type="radio"
                    name={`${id}-priority`}
                    value={key}
                    checked={value.priority === key}
                    onChange={() => onChange({ ...value, priority: key })}
                  />
                  <span>{name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="board-filter-group" aria-label="Label filter">
            <legend>
              Labels <span className="muted">{labels.length}</span>
            </legend>
            <div className="filter-choices label-choices">
              <label>
                <input
                  type="radio"
                  name={`${id}-label`}
                  checked={!value.labelId}
                  onChange={() => onChange({ ...value, labelId: '' })}
                />
                <span>All labels</span>
              </label>
              {labels.map((label) => (
                <label key={label.id}>
                  <input
                    type="radio"
                    name={`${id}-label`}
                    checked={value.labelId === label.id}
                    onChange={() => onChange({ ...value, labelId: label.id })}
                  />
                  <span
                    className="label-dot"
                    style={{ background: label.color }}
                  />
                  <span>{label.name}</span>
                </label>
              ))}
            </div>
            {!labels.length && (
              <p className="muted">
                Create labels using Manage labels to filter by them.
              </p>
            )}
          </fieldset>
        </div>
        <footer className="board-filter-footer">
          <span aria-live="polite">
            <strong>{visibleCount}</strong> of {totalCount} tasks
          </span>
          <button
            type="button"
            className="text-button"
            disabled={!count}
            onClick={() => onChange(emptyTaskFilters)}
          >
            Clear filters
          </button>
        </footer>
      </div>
    </div>
  )
}
