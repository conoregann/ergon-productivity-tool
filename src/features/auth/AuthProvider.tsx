import { useEffect, useRef, useState } from 'react'
import type { PropsWithChildren } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { AuthContext } from './auth-context'
import type { AuthState } from './auth-context'

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<AuthState['status']>(
    supabase ? 'loading' : 'unconfigured',
  )
  const [error, setError] = useState<string | null>(null)
  const identity = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!supabase) return
    let active = true
    let receivedAuthEvent = false
    function applySession(next: Session | null) {
      if (!active) return
      if (identity.current !== next?.user.id) queryClient.clear()
      identity.current = next?.user.id
      setSession(next)
      setStatus('ready')
    }
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      receivedAuthEvent = true
      applySession(next)
    })
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return
        if (error) setError(error.message)
        if (!receivedAuthEvent) applySession(data.session)
      })
      .catch(() => {
        if (!active) return
        setError('Unable to restore your session. Please reload and try again.')
        if (!receivedAuthEvent) applySession(null)
      })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [queryClient])

  async function signIn() {
    if (!supabase) return
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: window.location.origin },
      })
      if (error) setError(error.message)
    } catch {
      setError('Unable to start sign in. Please try again.')
    }
  }

  async function signOut() {
    if (!supabase) return
    setError(null)
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) {
        setError(error.message)
        return
      }
      queryClient.clear()
      identity.current = undefined
      setSession(null)
    } catch {
      setError('Unable to sign out. Please try again.')
    }
  }

  return (
    <AuthContext.Provider value={{ session, status, error, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
