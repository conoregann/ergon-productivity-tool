import { useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { SlidersHorizontal } from 'lucide-react'

export function FilterPanel({
  count,
  children,
}: {
  count: number
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const button = useRef<HTMLButtonElement>(null)
  return (
    <div className="filter-panel">
      <button
        ref={button}
        type="button"
        className="button-secondary filter-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <SlidersHorizontal aria-hidden="true" />
        Filters
        {count > 0 && <span className="count">{count}</span>}
      </button>
      <div
        id={id}
        hidden={!open}
        className="filter-fields"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            setOpen(false)
            button.current?.focus()
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}
