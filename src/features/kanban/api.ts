import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'
import type { BoardSnapshot, Command } from '../../domain/kanban'

type Functions = Database['public']['Functions']
export class ConflictError extends Error {
  constructor() {
    super(
      'This board changed on another device. The latest version has been loaded. Review your changes before trying again.',
    )
    this.name = 'ConflictError'
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
      throw new ConflictError()
    throw new Error(error.message)
  }
  return data
}
export async function getBoardSnapshot(
  boardId: string,
): Promise<BoardSnapshot> {
  const data = await rpc('get_board_snapshot', { p_board_id: boardId })
  if (!data) throw new Error('Board unavailable. It may have been deleted.')
  return data as unknown as BoardSnapshot
}
export async function createBoard(title: string): Promise<string> {
  return (await rpc('create_board', { p_title: title })) as string
}
export async function executeCommand(
  boardId: string,
  version: number,
  command: Command,
) {
  const args = { p_board_id: boardId, p_version: version }
  switch (command.kind) {
    case 'saveBoard':
      return rpc('save_board', {
        ...args,
        p_title: command.title,
        p_archived: command.archived,
      })
    case 'deleteBoard':
      return rpc('delete_board', args)
    case 'createColumn':
      return rpc('create_column', { ...args, p_title: command.title })
    case 'saveColumn':
      return rpc('save_column', {
        ...args,
        p_column_id: command.id,
        p_title: command.title,
      })
    case 'deleteColumn':
      return rpc('delete_column', { ...args, p_column_id: command.id })
    case 'moveColumn':
      return rpc('move_column', {
        ...args,
        p_column_id: command.id,
        p_before_id: command.beforeId,
      })
    case 'createCard':
      return rpc('create_card', {
        ...args,
        p_column_id: command.columnId,
        p_title: command.fields.title,
        p_description: command.fields.description,
        p_due_date: command.fields.due_date,
      })
    case 'saveCard':
      return rpc('save_card', {
        ...args,
        p_card_id: command.id,
        p_title: command.fields.title,
        p_description: command.fields.description,
        p_due_date: command.fields.due_date,
        p_completed: Boolean(command.fields.completed_at),
        p_archived: Boolean(command.fields.archived_at),
      })
    case 'deleteCard':
      return rpc('delete_card', { ...args, p_card_id: command.id })
    case 'moveCard':
      return rpc('move_card', {
        ...args,
        p_card_id: command.id,
        p_column_id: command.columnId,
        p_before_id: command.beforeId,
      })
  }
}
