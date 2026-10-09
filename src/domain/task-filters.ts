import type { BoardSnapshot, Card } from './kanban'

export type TaskFilters = {
  search: string
  labelId: string
  priority: string
  completion: string
}
export const emptyTaskFilters: TaskFilters = {
  search: '',
  labelId: '',
  priority: '',
  completion: '',
}

export function filterTasks(
  snapshot: BoardSnapshot,
  filters: TaskFilters,
): Card[] {
  const search = filters.search.trim().toLocaleLowerCase()
  const labelled = new Set(
    snapshot.cardLabels
      .filter((link) => link.label_id === filters.labelId)
      .map((link) => link.card_id),
  )
  return snapshot.cards.filter(
    (card) =>
      (!search ||
        `${card.title}\n${card.description}`
          .toLocaleLowerCase()
          .includes(search)) &&
      (!filters.labelId || labelled.has(card.id)) &&
      (!filters.priority || card.priority === filters.priority) &&
      (!filters.completion ||
        Boolean(card.completed_at) === (filters.completion === 'completed')),
  )
}
