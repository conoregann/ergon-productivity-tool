import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'
import type { Preferences, SchedulingSnapshot } from '../../domain/scheduling'

type Functions = Database['public']['Functions']
export class SchedulingConflictError extends Error {
  constructor() {
    super(
      'Changed on another device. Review the latest saved values before retrying. Your draft has been kept.',
    )
    this.name = 'SchedulingConflictError'
  }
}
async function rpc<N extends keyof Functions>(
  name: N,
  args: Functions[N]['Args'],
) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.rpc(name, args)
  if (error) {
    if (error.code === 'PT409' || error.code === '40001')
      throw new SchedulingConflictError()
    throw new Error(error.message)
  }
  return data
}
export async function getSchedulingSnapshot(): Promise<SchedulingSnapshot> {
  return (await rpc(
    'get_scheduling_snapshot',
    {},
  )) as unknown as SchedulingSnapshot
}
export type SchedulingCommand =
  | {
      kind: 'create'
      id: string
      cardId: string
      starts_at: string
      ends_at: string
    }
  | {
      kind: 'save'
      id: string
      version: number
      starts_at: string
      ends_at: string
    }
  | { kind: 'delete'; id: string; version: number }
  | { kind: 'preferences'; preferences: Preferences }
export async function executeSchedulingCommand(command: SchedulingCommand) {
  switch (command.kind) {
    case 'create':
      return rpc('create_session', {
        p_id: command.id,
        p_card_id: command.cardId,
        p_starts_at: command.starts_at,
        p_ends_at: command.ends_at,
      })
    case 'save':
      return rpc('save_session', {
        p_id: command.id,
        p_version: command.version,
        p_starts_at: command.starts_at,
        p_ends_at: command.ends_at,
      })
    case 'delete':
      return rpc('delete_session', {
        p_id: command.id,
        p_version: command.version,
      })
    case 'preferences':
      return rpc('save_calendar_preferences', {
        p_version: command.preferences.version,
        p_timezone: command.preferences.timezone,
        p_week_starts_on: command.preferences.week_starts_on,
        p_calendar_view: command.preferences.calendar_view,
      })
  }
}
