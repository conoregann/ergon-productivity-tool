import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
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
