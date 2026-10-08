import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { AuthContext } from '../features/auth/auth-context'
import { App } from './App'

it('renders a useful unconfigured application', () => {
  render(
    <AuthContext.Provider
      value={{
        session: null,
        status: 'unconfigured',
        error: null,
        signIn: async () => {},
        signOut: async () => {},
      }}
    >
      <App />
    </AuthContext.Provider>,
  )
  expect(screen.getByRole('main')).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { name: 'Welcome to Ergon' }),
  ).toBeVisible()
  expect(
    screen.queryByRole('heading', { name: 'Your boards' }),
  ).not.toBeInTheDocument()
})

it('keeps example content separate from the authenticated workspace', () => {
  const cache = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  })
  cache.setQueryData(
    ['boards', 'alice'],
    [{ id: 'board-1', title: 'Private board' }],
  )
  render(
    <QueryClientProvider client={cache}>
      <AuthContext.Provider
        value={{
          session: {
            user: {
              id: 'alice',
              user_metadata: {
                user_name: 'Alice',
                avatar_url: 'https://example.com/avatar.png',
              },
            },
          } as unknown as Session,
          status: 'ready',
          error: null,
          signIn: async () => {},
          signOut: async () => {},
        }}
      >
        <App />
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
  expect(screen.getByText('Private board')).toBeVisible()
  expect(
    screen.queryByRole('heading', { name: 'Example board' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeVisible()
  expect(screen.getByRole('img', { name: 'GitHub profile' })).toHaveAttribute(
    'src',
    'https://example.com/avatar.png',
  )
  expect(screen.queryByText(/A clear view/)).not.toBeInTheDocument()
})
