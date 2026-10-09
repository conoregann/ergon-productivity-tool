import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, expect, it, vi } from 'vitest'
import { defaultPreferences } from '../../domain/scheduling'
import { CalendarPreferences } from './CalendarPreferences'
import { SchedulingConflictError } from './api'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
  }
})

it('retains preference drafts after failure, retries with the captured revision, and validates zones', async () => {
  const onSubmit = vi
    .fn()
    .mockRejectedValueOnce(new Error('Write failed'))
    .mockResolvedValue(undefined)
  const onClose = vi.fn()
  render(
    <CalendarPreferences
      preferences={{ ...defaultPreferences, version: 4 }}
      pending={false}
      onSubmit={onSubmit}
      onClose={onClose}
    />,
  )
  fireEvent.change(screen.getByLabelText('Timezone'), {
    target: { value: 'Europe/Dublin' },
  })
  fireEvent.change(screen.getByLabelText('Week starts on'), {
    target: { value: '0' },
  })
  fireEvent.change(screen.getByLabelText('Calendar view'), {
    target: { value: 'agenda' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }))
  await screen.findByRole('alert')
  expect(screen.getByLabelText('Timezone')).toHaveValue('Europe/Dublin')
  expect(onClose).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  expect(onSubmit).toHaveBeenLastCalledWith({
    timezone: 'Europe/Dublin',
    week_starts_on: 0,
    calendar_view: 'agenda',
    version: 4,
  })
})

it('requires reviewing the latest preferences after a stale write without silently overwriting them', async () => {
  const onSubmit = vi.fn().mockRejectedValue(new SchedulingConflictError())
  const onClose = vi.fn()
  render(
    <CalendarPreferences
      preferences={defaultPreferences}
      pending={false}
      onSubmit={onSubmit}
      onClose={onClose}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }))
  await screen.findByRole('alert')
  expect(
    screen.getByRole('button', { name: 'Save preferences' }),
  ).toBeDisabled()
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Close draft and review latest preferences',
    }),
  )
  expect(onClose).toHaveBeenCalledOnce()
})

it('rejects an invalid timezone before writing', async () => {
  const onSubmit = vi.fn()
  render(
    <CalendarPreferences
      preferences={defaultPreferences}
      pending={false}
      onSubmit={onSubmit}
      onClose={() => {}}
    />,
  )
  fireEvent.change(screen.getByLabelText('Timezone'), {
    target: { value: 'Mars/Olympus' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('valid timezone')
  expect(onSubmit).not.toHaveBeenCalled()
})
