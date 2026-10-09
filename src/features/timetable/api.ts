import {
  executeSchedulingCommand,
  getSchedulingSnapshot,
} from '../scheduling/api'
import { interval } from '../../domain/scheduling'
import type { Session } from '../../domain/scheduling'

export const loadTimetable = getSchedulingSnapshot
export type SessionChange =
  | {
      kind: 'save'
      id: string
      cardId: string
      start: string
      end: string
      session?: Session | undefined
    }
  | { kind: 'remove'; session: Session }
export async function changeSession(change: SessionChange) {
  if (change.kind === 'remove')
    return executeSchedulingCommand({
      kind: 'delete',
      id: change.session.id,
      version: change.session.version,
    })
  const times = interval(change.start, change.end)
  return executeSchedulingCommand(
    change.session
      ? {
          kind: 'save',
          id: change.session.id,
          version: change.session.version,
          ...times,
        }
      : { kind: 'create', id: change.id, cardId: change.cardId, ...times },
  )
}
