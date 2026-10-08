import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type AuthState = {
  session: Session | null
  status: 'loading' | 'ready' | 'unconfigured'
  error: string | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}
export const AuthContext = createContext<AuthState | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth requires AuthProvider')
  return value
}
