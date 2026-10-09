import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'
import type { SchedulingSnapshot } from '../../domain/scheduling'
import {
  executeSchedulingCommand,
  getSchedulingSnapshot,
  SchedulingConflictError,
} from './api'
import { useScheduling } from './useScheduling'

vi.mock('./api', async (original) => ({
  ...(await original<typeof import('./api')>()),
  executeSchedulingCommand: vi.fn(),
  getSchedulingSnapshot: vi.fn(),
}))
const snapshot: SchedulingSnapshot = {
  sessions: [],
  cards: [],
  boards: [],
  labels: [],
  card_labels: [],
  preferences: null,
}

it.each([new Error('Write failed'), new SchedulingConflictError()])(
  'keeps saved data and refreshes after a failed write: %s',
  async (error) => {
    const cache = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    })
    cache.setQueryData(['scheduling', 'alice'], snapshot)
    vi.mocked(getSchedulingSnapshot).mockResolvedValue(snapshot)
    vi.mocked(executeSchedulingCommand).mockRejectedValue(error)
    const { result, unmount } = renderHook(() => useScheduling('alice'), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={cache}>{children}</QueryClientProvider>
      ),
    })
    await act(async () => {
      await expect(
        result.current.mutation.mutateAsync({
          kind: 'delete',
          id: 'session',
          version: 1,
        }),
      ).rejects.toThrow(error.message)
    })
    await waitFor(() => expect(result.current.mutation.isError).toBe(true))
    expect(cache.getQueryData(['scheduling', 'alice'])).toEqual(snapshot)
    expect(getSchedulingSnapshot).toHaveBeenCalled()
    expect(cache.getQueryData(['scheduling', 'bob'])).toBeUndefined()
    unmount()
    cache.clear()
  },
)

it('refetches committed data when a response is lost', async () => {
  const cache = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  })
  cache.setQueryData(['scheduling', 'alice'], snapshot)
  const committed = {
    ...snapshot,
    preferences: {
      timezone: 'Europe/Dublin',
      week_starts_on: 0,
      calendar_view: 'agenda',
      version: 1,
    },
  }
  vi.mocked(getSchedulingSnapshot).mockResolvedValue(committed)
  vi.mocked(executeSchedulingCommand).mockRejectedValue(
    new Error('Network interrupted'),
  )
  const { result, unmount } = renderHook(() => useScheduling('alice'), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={cache}>{children}</QueryClientProvider>
    ),
  })
  await act(async () => {
    await result.current.mutation
      .mutateAsync({ kind: 'preferences', preferences: committed.preferences })
      .catch(() => {})
  })
  expect(cache.getQueryData(['scheduling', 'alice'])).toEqual(committed)
  unmount()
  cache.clear()
  expect(cache.getQueryData(['scheduling', 'alice'])).toBeUndefined()
})

it('does not restore the previous user cache after logout during a pending write', async () => {
  const cache = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  })
  cache.setQueryData(['scheduling', 'alice'], snapshot)
  let fail!: (error: Error) => void
  vi.mocked(executeSchedulingCommand).mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject
      }),
  )
  const { result, unmount } = renderHook(() => useScheduling('alice'), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={cache}>{children}</QueryClientProvider>
    ),
  })
  let write!: Promise<unknown>
  act(() => {
    write = result.current.mutation
      .mutateAsync({ kind: 'delete', id: 'session', version: 1 })
      .catch(() => {})
  })
  await waitFor(() => expect(fail).toBeDefined())
  unmount()
  cache.clear()
  await act(async () => {
    fail(new Error('Write failed'))
    await write
  })
  expect(cache.getQueryData(['scheduling', 'alice'])).toBeUndefined()
})
