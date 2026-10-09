import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import type { Card } from '../../domain/kanban'
import type { Session } from '../../domain/scheduling'
import { SchedulingConflictError } from '../scheduling/api'
import { SessionEditor } from './SessionEditor'

beforeAll(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.setAttribute('open', '')
      },
    },
    close: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.removeAttribute('open')
      },
    },
  })
})
afterAll(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
})

const card = { id: 'task', title: 'Proposal', board_id: 'work' } as Card
const draft = {
  id: 'new-session',
  cardId: card.id,
  start: '2026-10-09T09:00:00Z',
  end: '2026-10-09T10:00:00Z',
}

it('shows hidden-session overlaps and saves selected-zone form times as UTC instants', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  const onClose = vi.fn()
  render(
    <SessionEditor
      draft={draft}
      timezone="Europe/Dublin"
      cards={[card]}
      sessions={
        [
          {
            id: 'hidden',
            starts_at: '2026-10-09T09:30:00Z',
            ends_at: '2026-10-09T10:30:00Z',
          },
        ] as Session[]
      }
      pending={false}
      error={null}
      onClose={onClose}
      onSubmit={onSubmit}
      onEditTask={vi.fn()}
    />,
  )
  expect(screen.getByLabelText('Start time')).toHaveValue('2026-10-09T10:00')
  expect(screen.getByRole('status')).toHaveTextContent(
    'Overlaps another session',
  )
  fireEvent.change(screen.getByLabelText('Start time'), {
    target: { value: '2026-10-09T10:15' },
  })
  fireEvent.change(screen.getByLabelText('End time'), {
    target: { value: '2026-10-09T11:15' },
  })
  await user.click(screen.getByRole('button', { name: 'Save session' }))
  expect(onSubmit).toHaveBeenCalledWith({
    kind: 'save',
    id: draft.id,
    cardId: card.id,
    start: '2026-10-09T09:15:00.000Z',
    end: '2026-10-09T10:15:00.000Z',
    session: undefined,
  })
  expect(onClose).toHaveBeenCalled()
})

it('preserves the exact saved instants in the repeated autumn hour', async () => {
  const user = userEvent.setup()
  const session = {
    id: 'fall',
    card_id: card.id,
    starts_at: '2026-10-25T01:30:00Z',
    ends_at: '2026-10-25T01:45:00Z',
    version: 2,
  } as Session
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  render(
    <SessionEditor
      draft={{
        id: session.id,
        cardId: card.id,
        start: session.starts_at,
        end: session.ends_at,
        session,
      }}
      timezone="Europe/Dublin"
      cards={[card]}
      sessions={[session]}
      pending={false}
      error={null}
      onClose={vi.fn()}
      onSubmit={onSubmit}
      onEditTask={vi.fn()}
    />,
  )
  expect(screen.getByText(/Saved:/)).toHaveTextContent('2026-10-25 01:30 GMT')
  await user.click(screen.getByRole('button', { name: 'Save session' }))
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      start: '2026-10-25T01:30:00.000Z',
      end: '2026-10-25T01:45:00.000Z',
    }),
  )
})

it('keeps a conflicted draft for review and blocks writes with its stale revision', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const onSubmit = vi.fn()
  render(
    <SessionEditor
      draft={draft}
      cards={[card]}
      sessions={[]}
      pending={false}
      error={new SchedulingConflictError()}
      onClose={onClose}
      onSubmit={onSubmit}
      onEditTask={vi.fn()}
    />,
  )
  expect(screen.getByRole('button', { name: 'Save session' })).toBeDisabled()
  expect(screen.getByLabelText('Start time')).toHaveValue('2026-10-09T09:00')
  await user.click(
    screen.getByRole('button', {
      name: 'Close draft and review latest session',
    }),
  )
  expect(onClose).toHaveBeenCalled()
  expect(onSubmit).not.toHaveBeenCalled()
})
