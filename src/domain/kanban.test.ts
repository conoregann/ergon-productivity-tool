import { expect, it } from 'vitest'
import { applyCommand } from './kanban'
import type { BoardSnapshot, Card } from './kanban'

const base = {
  owner_id: 'alice',
  version: 1,
  created_at: '2026-10-08T09:00:00Z',
  updated_at: '2026-10-08T09:00:00Z',
}
const board = {
  ...base,
  id: 'board',
  title: 'Work',
  archived_at: null,
  background: 'neutral',
}
const columns = ['todo', 'doing', 'done'].map((id, position) => ({
  ...base,
  id,
  title: id,
  board_id: board.id,
  position,
}))
const card = (
  id: string,
  columnId: string,
  position: number,
  archived = false,
): Card => ({
  ...base,
  id,
  title: id,
  board_id: board.id,
  column_id: columnId,
  position,
  description: '',
  priority: 'none',
  due_date: null,
  completed_at: null,
  archived_at: archived ? '2026-10-08T09:00:00Z' : null,
})
const snapshot: BoardSnapshot = {
  board,
  columns,
  cards: [
    card('a', 'todo', 0),
    card('hidden', 'todo', 1, true),
    card('b', 'todo', 2),
    card('c', 'doing', 0),
  ],
}

it('moves across columns without mutating the previous snapshot or losing archived cards', () => {
  const next = applyCommand(snapshot, {
    kind: 'moveCard',
    id: 'b',
    columnId: 'doing',
    beforeId: 'c',
  })
  expect(
    next.cards
      .filter((card) => card.column_id === 'doing')
      .map((card) => [card.id, card.position]),
  ).toEqual([
    ['b', 0],
    ['c', 1],
  ])
  expect(
    next.cards
      .filter((card) => card.column_id === 'todo')
      .map((card) => [card.id, card.position]),
  ).toEqual([
    ['a', 0],
    ['hidden', 1],
  ])
  expect(snapshot.cards.find((card) => card.id === 'b')?.column_id).toBe('todo')
})
it('moves within the same column and preserves completion when changing workflow', () => {
  const completed = {
    ...snapshot,
    cards: snapshot.cards.map((card) =>
      card.id === 'b'
        ? { ...card, completed_at: '2026-10-08T09:00:00Z' }
        : card,
    ),
  }
  const next = applyCommand(completed, {
    kind: 'moveCard',
    id: 'b',
    columnId: 'todo',
    beforeId: 'a',
  })
  expect(
    next.cards
      .filter((card) => card.column_id === 'todo')
      .map((card) => card.id),
  ).toEqual(['b', 'a', 'hidden'])
  expect(next.cards.find((card) => card.id === 'b')?.completed_at).toBe(
    '2026-10-08T09:00:00Z',
  )
})
it('reorders columns without changing card relationships', () => {
  const next = applyCommand(snapshot, {
    kind: 'moveColumn',
    id: 'done',
    beforeId: 'todo',
  })
  expect(next.columns.map((column) => [column.id, column.position])).toEqual([
    ['done', 0],
    ['todo', 1],
    ['doing', 2],
  ])
  expect(next.cards).toBe(snapshot.cards)
})
it('rejects a missing destination instead of silently moving to a wrong position', () => {
  expect(() =>
    applyCommand(snapshot, {
      kind: 'moveCard',
      id: 'a',
      columnId: 'doing',
      beforeId: 'missing',
    }),
  ).toThrow('Destination unavailable')
})
