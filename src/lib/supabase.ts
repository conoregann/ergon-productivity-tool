import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { readPublicConfig } from './env'

const config = readPublicConfig(import.meta.env)
export const supabase = config
  ? createClient<Database>(config.url, config.publishableKey, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
