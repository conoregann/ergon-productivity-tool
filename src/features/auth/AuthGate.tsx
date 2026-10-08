import { LogIn } from 'lucide-react'
import { useState } from 'react'
import type { PropsWithChildren } from 'react'
import { useAuth } from './auth-context'

export function AuthGate({ children }: PropsWithChildren) {
  const { session, status, error, signIn, signOut } = useAuth()
  const [pending, setPending] = useState(false)
  async function run(action: () => Promise<void>) {
    setPending(true)
    try {
      await action()
    } finally {
      setPending(false)
    }
  }
  if (status === 'unconfigured')
    return (
      <section className="panel">
        <h2>Welcome to Ergon</h2>
        <p>The workspace is awaiting configuration. Please check back soon.</p>
      </section>
    )
  if (status === 'loading') return <p role="status">Restoring your session…</p>
  return (
    <>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {session ? (
        <>
          <div className="account">
            <p>Signed in as {session.user.email ?? 'GitHub user'}</p>
            <button
              className="button-secondary"
              disabled={pending}
              onClick={() => void run(signOut)}
            >
              Sign out
            </button>
          </div>
          {children}
        </>
      ) : (
        <section className="panel auth-panel">
          <div className="auth-copy">
            <h2>Your private workspace</h2>
            <p>Sign in to access your boards across devices.</p>
          </div>
          <button disabled={pending} onClick={() => void run(signIn)}>
            <LogIn aria-hidden="true" />
            {pending ? 'Connecting…' : 'Continue with GitHub'}
          </button>
        </section>
      )}
    </>
  )
}
