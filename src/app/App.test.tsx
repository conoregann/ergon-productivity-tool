import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { App } from './App'

it('renders the workspace landmark', () => {
  render(<App />)
  expect(screen.getByRole('main')).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { name: 'Make room for meaningful work.' }),
  ).toBeVisible()
})
