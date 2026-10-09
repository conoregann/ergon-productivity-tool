import { beforeEach, expect, it, vi } from 'vitest'
import { defaultPreferences } from '../../domain/scheduling'
import {
  executeSchedulingCommand,
  getSchedulingSnapshot,
  SchedulingConflictError,
} from './api'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: { rpc } }))
beforeEach(() => {
  rpc.mockReset()
  rpc.mockResolvedValue({ data: null, error: null })
})

it('routes session operations through revision-checked RPCs without updating a task', async () => {
  const times = {
    starts_at: '2026-10-09T08:00:00Z',
    ends_at: '2026-10-09T09:00:00Z',
  }
  await executeSchedulingCommand({
    kind: 'create',
    id: 'stable-id',
    cardId: 'card',
    ...times,
  })
  expect(rpc).toHaveBeenLastCalledWith('create_session', {
    p_id: 'stable-id',
    p_card_id: 'card',
    p_starts_at: times.starts_at,
    p_ends_at: times.ends_at,
  })
  await executeSchedulingCommand({
    kind: 'save',
    id: 'stable-id',
    version: 2,
    ...times,
  })
  expect(rpc).toHaveBeenLastCalledWith('save_session', {
    p_id: 'stable-id',
    p_version: 2,
    p_starts_at: times.starts_at,
    p_ends_at: times.ends_at,
  })
  await executeSchedulingCommand({
    kind: 'delete',
    id: 'stable-id',
    version: 3,
  })
  expect(rpc).toHaveBeenLastCalledWith('delete_session', {
    p_id: 'stable-id',
    p_version: 3,
  })
  expect(rpc.mock.calls.map(([name]) => name)).toEqual([
    'create_session',
    'save_session',
    'delete_session',
  ])
})
it('fetches an atomic schedule and saves preferences with the captured revision', async () => {
  const snapshot = {
    sessions: [],
    cards: [],
    boards: [],
    labels: [],
    card_labels: [],
    preferences: null,
  }
  rpc.mockResolvedValueOnce({ data: snapshot, error: null })
  expect(await getSchedulingSnapshot()).toEqual(snapshot)
  expect(rpc).toHaveBeenLastCalledWith('get_scheduling_snapshot', {})
  await executeSchedulingCommand({
    kind: 'preferences',
    preferences: defaultPreferences,
  })
  expect(rpc).toHaveBeenLastCalledWith('save_calendar_preferences', {
    p_version: 0,
    p_timezone: 'UTC',
    p_week_starts_on: 1,
    p_calendar_view: 'week',
  })
})
it.each(['PT409', '40001'])(
  'identifies %s as a recoverable stale-write conflict',
  async (code) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: 'Changed' } })
    await expect(
      executeSchedulingCommand({ kind: 'delete', id: 'session', version: 1 }),
    ).rejects.toBeInstanceOf(SchedulingConflictError)
  },
)
it('preserves actionable server errors for failed-write recovery', async () => {
  rpc.mockResolvedValue({
    data: null,
    error: { code: 'PT404', message: 'Session unavailable' },
  })
  await expect(
    executeSchedulingCommand({ kind: 'delete', id: 'session', version: 1 }),
  ).rejects.toThrow('Session unavailable')
})
