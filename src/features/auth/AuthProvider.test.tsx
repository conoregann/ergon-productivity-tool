import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { beforeEach, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './auth-context'

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
}))
vi.mock('../../lib/supabase', () => ({ supabase: { auth } }))
let emit: (event: string, session: Session | null) => void
const unsubscribe = vi.fn()
const session = { user: { id: 'alice', email: 'alice@example.com' } } as Session

beforeEach(() => {
  vi.clearAllMocks()
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  auth.onAuthStateChange.mockImplementation((callback) => {
    emit = callback
    return { data: { subscription: { unsubscribe } } }
  })
  auth.signInWithOAuth.mockResolvedValue({ error: null })
  auth.signOut.mockResolvedValue({ error: null })
})

function Consumer() {
  const { session, status, error, signIn, signOut } = useAuth()
  return (
    <>
      <p>{status}</p>
      <p>{session?.user.id ?? 'signed out'}</p>
      {error && <p role="alert">{error}</p>}
      <button onClick={() => void signIn()}>Login</button>
      <button onClick={() => void signOut()}>Logout</button>
    </>
  )
}
function mount() {
  const cache = new QueryClient()
  const view = render(
    <QueryClientProvider client={cache}>
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    </QueryClientProvider>,
  )
  return { cache, ...view }
}

it('restores a persistent session and unsubscribes on unmount', async () => {
  auth.getSession.mockResolvedValue({ data: { session }, error: null })
  const view = mount()
  expect(await screen.findByText('alice')).toBeVisible()
  view.unmount()
  expect(unsubscribe).toHaveBeenCalledOnce()
})

it('does not let a stale restoration overwrite a newer auth event', async () => {
  let resolve!: (value: unknown) => void
  auth.getSession.mockReturnValue(
    new Promise((done) => {
      resolve = done
    }),
  )
  mount()
  act(() => emit('SIGNED_IN', session))
  await act(async () => resolve({ data: { session: null }, error: null }))
  expect(screen.getByText('alice')).toBeVisible()
})

it('clears private query data when identities change', async () => {
  const { cache } = mount()
  await screen.findByText('ready')
  act(() => emit('SIGNED_IN', session))
  cache.setQueryData(['boards', 'alice'], [{ title: 'Private' }])
  act(() => emit('SIGNED_IN', { user: { id: 'bob' } } as Session))
  expect(cache.getQueryData(['boards', 'alice'])).toBeUndefined()
})

it('starts GitHub OAuth with the current origin as callback', async () => {
  mount()
  await screen.findByText('ready')
  await userEvent.click(screen.getByRole('button', { name: 'Login' }))
  expect(auth.signInWithOAuth).toHaveBeenCalledWith({
    provider: 'github',
    options: { redirectTo: window.location.origin },
  })
})

it('keeps the session and reports failed logout', async () => {
  auth.getSession.mockResolvedValue({ data: { session }, error: null })
  auth.signOut.mockResolvedValue({ error: { message: 'Network unavailable' } })
  mount()
  await screen.findByText('alice')
  await userEvent.click(screen.getByRole('button', { name: 'Logout' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Network unavailable',
  )
  expect(screen.getByText('alice')).toBeVisible()
})

it('clears session and cache after successful logout', async () => {
  auth.getSession.mockResolvedValue({ data: { session }, error: null })
  const { cache } = mount()
  await screen.findByText('alice')
  cache.setQueryData(['boards', 'alice'], ['private'])
  await userEvent.click(screen.getByRole('button', { name: 'Logout' }))
  expect(await screen.findByText('signed out')).toBeVisible()
  expect(cache.getQueryData(['boards', 'alice'])).toBeUndefined()
})

it('reports restoration failure without leaving an indefinite loading screen', async () => {
  auth.getSession.mockRejectedValue(new Error('Network unavailable'))
  mount()
  await waitFor(() => expect(screen.getByText('ready')).toBeVisible())
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Unable to restore your session',
  )
})

it('preserves a shared board through sign-in while keeping the origin callback', async () => {
  window.history.replaceState(null, '', '/?share=editor-link')
  try {
    mount()
    await screen.findByText('ready')
    await userEvent.click(screen.getByRole('button', { name: 'Login' }))
    expect(sessionStorage.getItem('ergon-share-return')).toBe('editor-link')
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'github',
      options: { redirectTo: window.location.origin },
    })
  } finally {
    window.history.replaceState(null, '', '/')
    sessionStorage.clear()
  }
})
