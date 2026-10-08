import { GitHubIcon } from './GitHubIcon'
import { useState } from 'react'
import type { PropsWithChildren } from 'react'
import { useAuth } from './auth-context'

export function AuthGate({ children }: PropsWithChildren) {
  const { session, status, error, signIn } = useAuth()
  const [pending, setPending] = useState(false)
  async function login() {
    setPending(true)
    try {
      await signIn()
    } finally {
      setPending(false)
    }
  }
  if (session)
    return (
      <>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {children}
      </>
    )
  return (
    <main className="auth-screen">
      <a className="brand auth-brand" href="/" aria-label="Ergon">
        <span className="brand-mark" aria-hidden="true">
          e
        </span>
        ergon
      </a>
      <section className="auth-entry" aria-labelledby="welcome-heading">
        <h1 id="welcome-heading">Welcome to Ergon</h1>
        {status === 'unconfigured' ? (
          <p>
            The workspace is awaiting configuration. Please check back soon.
          </p>
        ) : status === 'loading' ? (
          <p role="status">Restoring your session…</p>
        ) : (
          <>
            <p>Sign up or sign in with your GitHub account.</p>
            <button
              className="github-login"
              disabled={pending}
              onClick={() => void login()}
            >
              <GitHubIcon aria-hidden="true" />
              {pending ? 'Connecting…' : 'Sign up with GitHub'}
            </button>
            <p className="auth-note">
              Already have an account? This signs you in too.
            </p>
          </>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </section>
    </main>
  )
}
