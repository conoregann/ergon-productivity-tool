import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { readPublicConfig } from './env'

const config = readPublicConfig(import.meta.env)
const params = new URLSearchParams(window.location.search)
export const shareToken =
  params.get('share') ??
  (params.has('code') ? sessionStorage.getItem('ergon-share-return') : null)
if (params.has('code')) sessionStorage.removeItem('ergon-share-return')
export const supabase = config
  ? createClient<Database>(config.url, config.publishableKey, {
      global: { headers: shareToken ? { 'x-board-share': shareToken } : {} },
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
