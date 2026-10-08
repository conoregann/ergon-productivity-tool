import { supabase } from '../../lib/supabase'

export async function listBoards(ownerId: string) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}
