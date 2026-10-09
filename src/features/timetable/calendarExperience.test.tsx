import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import type { Board, Card, Label } from '../../domain/kanban'
import type { ScheduledSession } from '../../domain/scheduling'
import { CalendarAgenda } from './CalendarAgenda'
import { CalendarFilters } from './CalendarFilters'

const boards = [
  { id: 'work', title: 'Work' },
  { id: 'home', title: 'Home' },
] as Board[]
const cards = [
  {
    id: 'task',
    board_id: 'work',
    title: 'Proposal',
    due_date: '2026-10-09',
    completed_at: '2026-10-08T10:00:00Z',
  },
] as Card[]
const sessions = [
  {
    id: 'session',
    card_id: 'task',
    starts_at: '2026-10-09T09:00:00Z',
    ends_at: '2026-10-09T10:00:00Z',
  },
] as ScheduledSession[]

it('opens a completed session and a separate date-only deadline using the keyboard', async () => {
  const user = userEvent.setup()
  const onSession = vi.fn()
  const onTask = vi.fn()
  render(
    <CalendarAgenda
      dates={['2026-10-09', '2026-10-10']}
      timezone="Europe/Dublin"
      cards={cards}
      boards={boards}
      sessions={sessions}
      conflicts={new Set(['session'])}
      onSession={onSession}
      onTask={onTask}
    />,
  )
  const deadline = screen.getByRole('button', {
    name: 'Deadline Proposal Completed',
  })
  const session = screen.getByRole('button', {
    name: 'Edit session Proposal, 2026-10-09 10:00 GMT+1 to 2026-10-09 11:00 GMT+1, completed, overlap',
  })
  expect(screen.getByText('Overlaps another session')).toBeVisible()
  expect(screen.getByText('No sessions or deadlines.')).toBeVisible()
  deadline.focus()
  await user.keyboard('{Enter}')
  expect(onTask).toHaveBeenCalledWith(cards[0])
  await user.tab()
  expect(session).toHaveFocus()
  await user.keyboard(' ')
  expect(onSession).toHaveBeenCalledWith(sessions[0])
  expect(sessions[0]!.starts_at).toBe('2026-10-09T09:00:00Z')
})

it('clears a label from another board when switching boards', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(
    <CalendarFilters
      boards={boards}
      labels={[{ id: 'focus', board_id: 'work', name: 'Focus' }] as Label[]}
      value={{ boardId: '', labelId: 'focus', completion: 'all' }}
      onChange={onChange}
    />,
  )
  await user.selectOptions(screen.getByLabelText('Board'), 'home')
  expect(onChange).toHaveBeenCalledWith({
    boardId: 'home',
    labelId: '',
    completion: 'all',
  })
  await user.click(screen.getByRole('button', { name: 'Clear filters' }))
  expect(onChange).toHaveBeenLastCalledWith({
    boardId: '',
    labelId: '',
    completion: 'all',
  })
})
