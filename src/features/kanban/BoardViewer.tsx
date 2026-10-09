import type { ReactNode } from 'react'
import type { BoardSnapshot } from '../../domain/kanban'
import { CardContent } from './KanbanColumn'

export function BoardViewer({
  snapshot,
  sidebarControl,
}: {
  snapshot: BoardSnapshot
  sidebarControl: ReactNode
}) {
  return (
    <section className="live-board" aria-labelledby="live-board-heading">
      <header className="workspace-header board-header">
        {sidebarControl}
        <h1 id="live-board-heading">{snapshot.board.title}</h1>
        <span className="quiet-badge">View only</span>
      </header>
      <div className="board-canvas" data-background={snapshot.board.background}>
        <div
          className="kanban-grid live-grid"
          role="group"
          aria-label="Board columns"
          tabIndex={0}
        >
          {snapshot.columns.map((column) => (
            <section className="kanban-column" key={column.id}>
              <header className="column-header">
                <h3>{column.title}</h3>
              </header>
              <div className="column-dropzone">
                <ul className="task-list">
                  {snapshot.cards
                    .filter(
                      (card) =>
                        card.column_id === column.id && !card.archived_at,
                    )
                    .map((card) => (
                      <li className="task-card" key={card.id}>
                        <CardContent
                          card={card}
                          labels={snapshot.labels.filter((label) =>
                            snapshot.cardLabels.some(
                              (link) =>
                                link.card_id === card.id &&
                                link.label_id === label.id,
                            ),
                          )}
                        />
                      </li>
                    ))}
                </ul>
              </div>
            </section>
          ))}
        </div>
        <details className="archived-tasks">
          <summary>Archived tasks</summary>
          <ul className="task-list">
            {snapshot.cards
              .filter((card) => card.archived_at)
              .map((card) => (
                <li className="task-card" key={card.id}>
                  <CardContent card={card} />
                </li>
              ))}
          </ul>
        </details>
      </div>
    </section>
  )
}
