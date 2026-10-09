import { expect, it, vi } from 'vitest'
import { getBoardSnapshot } from './api'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: { rpc } }))

it('normalizes snapshots from before the labels migration so boards remain readable', async () => {
  const snapshot = { board: { id: 'board' }, columns: [], cards: [] }
  rpc.mockResolvedValueOnce({ data: snapshot, error: null })
  expect(await getBoardSnapshot('board')).toEqual({
    ...snapshot,
    labels: [],
    cardLabels: [],
  })
})

it('preserves labels and assignments from the migrated database', async () => {
  const snapshot = {
    board: { id: 'board' },
    columns: [],
    cards: [],
    labels: [{ id: 'label' }],
    cardLabels: [{ card_id: 'card', label_id: 'label' }],
  }
  rpc.mockResolvedValueOnce({ data: snapshot, error: null })
  expect(await getBoardSnapshot('board')).toEqual(snapshot)
})
