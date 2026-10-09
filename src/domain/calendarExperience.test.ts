import { expect, it } from 'vitest'
import type { Card, CardLabel } from './kanban'
import type { ScheduledSession as Session } from './scheduling'
import {
  conflictingSessionIds,
  deadlineCards,
  filterCalendarCards,
  sessionTimeLabel,
} from './calendarExperience'

it('distinguishes repeated wall times by their UTC offsets', () => {
  expect(sessionTimeLabel('2026-10-25T00:30:00Z', 'Europe/Dublin')).toBe(
    '2026-10-25 01:30 GMT+1',
  )
  expect(sessionTimeLabel('2026-10-25T01:30:00Z', 'Europe/Dublin')).toBe(
    '2026-10-25 01:30 GMT+0',
  )
})

const cards = [
  {
    id: 'a',
    board_id: 'work',
    title: 'Proposal',
    due_date: '2026-10-09',
    due_time: null,
    completed_at: null,
  },
  {
    id: 'b',
    board_id: 'home',
    title: 'History',
    due_date: '2026-10-10',
    due_time: null,
    completed_at: '2026-10-08T12:00:00Z',
    archived_at: '2026-10-08T12:00:00Z',
  },
  {
    id: 'c',
    board_id: 'work',
    title: 'No deadline',
    due_date: null,
    due_time: null,
    completed_at: null,
  },
] as Card[]
const links = [
  { card_id: 'a', label_id: 'focus' },
  { card_id: 'b', label_id: 'focus' },
] as CardLabel[]

it('combines board, label, and task completion filters while retaining history by default', () => {
  expect(
    filterCalendarCards(cards, links, {
      boardId: '',
      labelId: '',
      completion: 'all',
    }),
  ).toEqual(cards)
  expect(
    filterCalendarCards(cards, links, {
      boardId: 'work',
      labelId: 'focus',
      completion: 'incomplete',
    }).map((card) => card.id),
  ).toEqual(['a'])
  expect(
    filterCalendarCards(cards, links, {
      boardId: '',
      labelId: 'focus',
      completion: 'completed',
    }).map((card) => card.id),
  ).toEqual(['b'])
  expect(
    filterCalendarCards(cards, links, {
      boardId: '',
      labelId: 'missing',
      completion: 'all',
    }),
  ).toEqual([])
})

it('uses deadline dates directly with an exclusive range end', () => {
  expect(
    deadlineCards(cards, '2026-10-09', '2026-10-10').map((card) => card.id),
  ).toEqual(['a'])
  expect(
    deadlineCards(cards, '2026-10-09', '2026-10-11').map((card) => card.id),
  ).toEqual(['a', 'b'])
})

it('flags nested and cross-midnight overlaps in UTC, including completed history, but allows adjacent sessions', () => {
  const sessions = [
    {
      id: 'long',
      starts_at: '2026-10-09T23:00:00Z',
      ends_at: '2026-10-10T03:00:00Z',
    },
    {
      id: 'nested',
      starts_at: '2026-10-10T00:00:00Z',
      ends_at: '2026-10-10T00:30:00Z',
    },
    {
      id: 'later',
      starts_at: '2026-10-10T02:00:00Z',
      ends_at: '2026-10-10T03:00:00Z',
    },
    {
      id: 'adjacent',
      starts_at: '2026-10-10T03:00:00Z',
      ends_at: '2026-10-10T04:00:00Z',
    },
    {
      id: 'offset',
      starts_at: '2026-10-10T05:00:00+01:00',
      ends_at: '2026-10-10T06:00:00+01:00',
    },
  ] as Session[]
  expect([...conflictingSessionIds(sessions)].sort()).toEqual([
    'later',
    'long',
    'nested',
  ])
  expect(sessions[0]!.starts_at).toBe('2026-10-09T23:00:00Z')
})
