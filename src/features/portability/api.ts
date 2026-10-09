import { supabase } from '../../lib/supabase'
import type { Json } from '../../lib/database.types'
import {
  validateWorkspaceExport,
  type WorkspaceExport,
} from '../../domain/portability'

export async function exportWorkspace() {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.rpc('export_workspace')
  if (error) throw new Error(error.message)
  return validateWorkspaceExport(data)
}

export async function importWorkspace(data: WorkspaceExport) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase.rpc('import_workspace', {
    p_data: validateWorkspaceExport(data) as Json,
  })
  if (error) throw new Error(error.message)
}
