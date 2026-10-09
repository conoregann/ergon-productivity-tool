import type { Database } from '../lib/database.types.js'

type Tables = Database['public']['Tables']
export type Board = Tables['boards']['Row']
export type Column = Tables['columns']['Row']
export type Card = Tables['cards']['Row']
export type Label = Tables['labels']['Row']
export type CardLabel = Tables['card_labels']['Row']
export type BoardSnapshot = {
  board: Board
  columns: Column[]
  cards: Card[]
  labels: Label[]
  cardLabels: CardLabel[]
}
export type CardFields = Pick<
  Card,
  | 'title'
  | 'description'
  | 'due_date'
  | 'completed_at'
  | 'archived_at'
  | 'priority'
>
export type Command =
  | { kind: 'saveBoard'; title: string; archived: boolean; background?: string }
  | { kind: 'deleteBoard' }
  | { kind: 'createLabel'; id: string; name: string; color: string }
  | { kind: 'saveLabel'; id: string; name: string; color: string }
  | { kind: 'deleteLabel'; id: string }
  | { kind: 'createColumn'; id: string; title: string }
  | { kind: 'saveColumn'; id: string; title: string }
  | { kind: 'deleteColumn'; id: string }
  | { kind: 'moveColumn'; id: string; beforeId: string | null }
  | {
      kind: 'createCard'
      id: string
      columnId: string
      fields: CardFields
      labelIds?: string[]
    }
  | { kind: 'saveCard'; id: string; fields: CardFields; labelIds?: string[] }
  | { kind: 'deleteCard'; id: string }
  | { kind: 'moveCard'; id: string; columnId: string; beforeId: string | null }

function insertBefore<T extends { id: string }>(
  items: T[],
  item: T,
  beforeId: string | null,
): T[] {
  const index = beforeId
    ? items.findIndex((candidate) => candidate.id === beforeId)
    : items.length
  if (index < 0) throw new Error('Destination unavailable')
  return [...items.slice(0, index), item, ...items.slice(index)]
}
const ordered = <T extends { position: number }>(items: T[]) =>
  [...items].sort((a, b) => a.position - b.position)
const positioned = <T extends { position: number }>(items: T[]) =>
  items.map((item, position) => ({ ...item, position }))

export function applyCommand(
  snapshot: BoardSnapshot,
  command: Command,
): BoardSnapshot {
  const { board, columns, cards } = snapshot
  const base = {
    owner_id: board.owner_id,
    board_id: board.id,
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  switch (command.kind) {
    case 'saveBoard':
      return {
        ...snapshot,
        board: {
          ...board,
          title: command.title,
          background: command.background ?? board.background,
          archived_at: command.archived ? new Date().toISOString() : null,
        },
      }
    case 'createLabel':
      return {
        ...snapshot,
        labels: [
          ...snapshot.labels,
          { ...base, id: command.id, name: command.name, color: command.color },
        ],
      }
    case 'saveLabel':
      return {
        ...snapshot,
        labels: snapshot.labels.map((label) =>
          label.id === command.id
            ? { ...label, name: command.name, color: command.color }
            : label,
        ),
      }
    case 'deleteLabel':
      return {
        ...snapshot,
        labels: snapshot.labels.filter((label) => label.id !== command.id),
        cardLabels: snapshot.cardLabels.filter(
          (link) => link.label_id !== command.id,
        ),
      }
    case 'deleteBoard':
      return snapshot
    case 'createColumn':
      return {
        ...snapshot,
        columns: [
          ...columns,
          {
            ...base,
            id: command.id,
            title: command.title,
            position: columns.length,
          },
        ],
      }
    case 'saveColumn':
      return {
        ...snapshot,
        columns: columns.map((column) =>
          column.id === command.id
            ? { ...column, title: command.title }
            : column,
        ),
      }
    case 'deleteColumn':
      return {
        ...snapshot,
        columns: positioned(
          ordered(columns).filter((column) => column.id !== command.id),
        ),
      }
    case 'moveColumn': {
      const column = columns.find((column) => column.id === command.id)
      if (!column || command.beforeId === command.id) return snapshot
      return {
        ...snapshot,
        columns: positioned(
          insertBefore(
            ordered(columns).filter((column) => column.id !== command.id),
            column,
            command.beforeId,
          ),
        ),
      }
    }
    case 'createCard':
      return {
        ...snapshot,
        cardLabels: assignedLabels(snapshot, command.id, command.labelIds),
        cards: [
          ...cards,
          {
            ...base,
            id: command.id,
            column_id: command.columnId,
            position: cards.filter(
              (card) => card.column_id === command.columnId,
            ).length,
            ...command.fields,
          },
        ],
      }
    case 'saveCard':
      return {
        ...snapshot,
        cardLabels: assignedLabels(snapshot, command.id, command.labelIds),
        cards: cards.map((card) =>
          card.id === command.id ? { ...card, ...command.fields } : card,
        ),
      }
    case 'deleteCard':
      return {
        ...snapshot,
        cardLabels: snapshot.cardLabels.filter(
          (link) => link.card_id !== command.id,
        ),
        cards: columns.flatMap((column) =>
          positioned(
            ordered(
              cards.filter(
                (card) =>
                  card.column_id === column.id && card.id !== command.id,
              ),
            ),
          ),
        ),
      }
    case 'moveCard': {
      const card = cards.find((card) => card.id === command.id)
      if (!card || command.beforeId === command.id) return snapshot
      return {
        ...snapshot,
        cards: columns.flatMap((column) => {
          const remaining = ordered(
            cards.filter(
              (item) => item.column_id === column.id && item.id !== command.id,
            ),
          )
          return positioned(
            column.id === command.columnId
              ? insertBefore(
                  remaining,
                  { ...card, column_id: command.columnId },
                  command.beforeId,
                )
              : remaining,
          )
        }),
      }
    }
  }
}

function assignedLabels(
  snapshot: BoardSnapshot,
  cardId: string,
  labelIds?: string[],
): CardLabel[] {
  if (!labelIds) return snapshot.cardLabels
  return [
    ...snapshot.cardLabels.filter((link) => link.card_id !== cardId),
    ...labelIds.map((label_id) => ({
      card_id: cardId,
      label_id,
      board_id: snapshot.board.id,
      owner_id: snapshot.board.owner_id,
    })),
  ]
}
