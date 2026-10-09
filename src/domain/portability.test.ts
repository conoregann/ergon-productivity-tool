import { expect, it } from 'vitest'
import { workspaceFixture } from '../../tests/fixtures/workspace.js'
import { parseWorkspaceExport, validateWorkspaceExport } from './portability'

it('round trips every collection through JSON without changing deadlines or instants', () => {
  expect(parseWorkspaceExport(JSON.stringify(workspaceFixture))).toEqual(
    workspaceFixture,
  )
})
it('accepts an empty workspace', () => {
  const empty = {
    format: 'ergon',
    version: 1,
    boards: [],
    columns: [],
    cards: [],
    labels: [],
    card_labels: [],
    scheduled_sessions: [],
  }
  expect(validateWorkspaceExport(empty)).toEqual(empty)
})
it.each([
  [
    'unsupported version',
    (d: typeof workspaceFixture) => {
      d.version = 2 as 1
    },
  ],
  [
    'duplicate IDs',
    (d: typeof workspaceFixture) => {
      d.boards.push(d.boards[0]!)
    },
  ],
  [
    'missing board',
    (d: typeof workspaceFixture) => {
      d.boards = []
    },
  ],
  [
    'wrong column',
    (d: typeof workspaceFixture) => {
      d.cards[0]!.column_id = d.boards[0]!.id
    },
  ],
  [
    'wrong label board',
    (d: typeof workspaceFixture) => {
      d.labels[0]!.board_id = d.columns[0]!.id
    },
  ],
  [
    'missing label',
    (d: typeof workspaceFixture) => {
      d.labels = []
    },
  ],
  [
    'duplicate link',
    (d: typeof workspaceFixture) => {
      d.card_labels.push(d.card_labels[0]!)
    },
  ],
  [
    'duplicate position',
    (d: typeof workspaceFixture) => {
      d.columns.push({
        ...d.columns[0]!,
        id: '20000000-0000-0000-0000-000000000002',
      })
    },
  ],
  [
    'invalid date',
    (d: typeof workspaceFixture) => {
      d.cards[0]!.due_date = '2026-02-30'
    },
  ],
  [
    'timezone missing',
    (d: typeof workspaceFixture) => {
      d.scheduled_sessions[0]!.starts_at = '2026-10-09T08:00:00'
    },
  ],
  [
    'backwards interval',
    (d: typeof workspaceFixture) => {
      d.scheduled_sessions[0]!.ends_at = d.scheduled_sessions[0]!.starts_at
    },
  ],
  [
    'missing card',
    (d: typeof workspaceFixture) => {
      d.scheduled_sessions[0]!.card_id = d.boards[0]!.id
    },
  ],
  [
    'negative position',
    (d: typeof workspaceFixture) => {
      d.cards[0]!.position = -1
    },
  ],
  [
    'fractional position',
    (d: typeof workspaceFixture) => {
      d.cards[0]!.position = 1.5
    },
  ],
  [
    'blank title',
    (d: typeof workspaceFixture) => {
      d.cards[0]!.title = ' '
    },
  ],
  [
    'invalid priority',
    (d: typeof workspaceFixture) => {
      d.cards[0]!.priority = 'critical'
    },
  ],
  [
    'invalid color',
    (d: typeof workspaceFixture) => {
      d.labels[0]!.color = 'red'
    },
  ],
])('rejects %s', (_, mutate) => {
  const data = structuredClone(workspaceFixture)
  mutate(data)
  expect(() => validateWorkspaceExport(data)).toThrow(/Invalid import/)
})
it.each(['{', 'null', '[]', '{"format":"ergon","version":1}'])(
  'rejects malformed file %s',
  (json) => {
    expect(() => parseWorkspaceExport(json)).toThrow(/Invalid import/)
  },
)
