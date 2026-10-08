import { CalendarDays, SignalHigh, SignalLow, SignalMedium } from 'lucide-react'

const columns = [
  {
    title: 'To do',
    cards: [
      {
        title: 'Outline the proposal',
        priority: 'High',
        detail: 'Define the scope and key deliverables.',
        deadline: 'Friday',
      },
      {
        title: 'Gather reference material',
        priority: 'Low',
        detail: 'Keep useful notes in one place.',
        deadline: null,
      },
    ],
  },
  {
    title: 'In progress',
    cards: [
      {
        title: 'Review the first draft',
        priority: 'High',
        detail: 'Check the details before sharing.',
        deadline: 'Thursday',
      },
      {
        title: 'Plan next week',
        priority: 'Medium',
        detail: 'Make space for the important work.',
        deadline: null,
      },
    ],
  },
  {
    title: 'Done',
    cards: [
      {
        title: 'Set the project direction',
        priority: 'Medium',
        detail: 'A shared starting point for the work.',
        deadline: null,
      },
      {
        title: 'Organise project notes',
        priority: 'Low',
        detail: 'Everything in its place.',
        deadline: null,
      },
    ],
  },
] as const

const importanceIcons = {
  High: SignalHigh,
  Medium: SignalMedium,
  Low: SignalLow,
}

export function WorkspacePreview() {
  return (
    <section className="board-preview" aria-labelledby="example-heading">
      <header className="section-header">
        <div>
          <p className="section-label">A look inside</p>
          <h2 id="example-heading">Example board</h2>
        </div>
        <span className="quiet-badge">Sample tasks · Read-only</span>
      </header>
      <div className="kanban-grid">
        {columns.map((column) => (
          <section
            className="kanban-column"
            key={column.title}
            aria-label={column.title}
          >
            <header className="column-header">
              <h3>{column.title}</h3>
              <span
                className="count"
                aria-label={`${column.cards.length} tasks`}
              >
                {column.cards.length}
              </span>
            </header>
            <ul className="task-list">
              {column.cards.map((card) => {
                const Importance = importanceIcons[card.priority]
                return (
                  <li className="task-card" key={card.title}>
                    <h4>{card.title}</h4>
                    <p>{card.detail}</p>
                    <div className="task-meta">
                      <span
                        className={`importance importance-${card.priority.toLowerCase()}`}
                      >
                        <Importance aria-hidden="true" />
                        {card.priority}
                      </span>
                      {card.deadline && (
                        <span className="deadline">
                          <CalendarDays aria-hidden="true" />
                          Due {card.deadline}
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
      <p className="preview-note">
        An example of how your tasks can take shape. Your own boards stay
        private.
      </p>
    </section>
  )
}
