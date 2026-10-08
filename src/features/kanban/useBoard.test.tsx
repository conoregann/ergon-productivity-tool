import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'
import { applyCommand } from '../../domain/kanban'
import type { BoardSnapshot, Command } from '../../domain/kanban'
import { executeCommand, getBoardSnapshot } from './api'
import { useBoard } from './useBoard'

vi.mock('./api', () => ({ executeCommand: vi.fn(), getBoardSnapshot: vi.fn() }))

it('publishes optimistic placement synchronously and ignores a cancelled stale read', async () => {
  const cache = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  })
  const key = ['board', 'alice', 'work']
  const snapshot: BoardSnapshot = {
    board: {
      id: 'work',
      owner_id: 'alice',
      title: 'Work',
      background: 'neutral',
      archived_at: null,
      version: 1,
      created_at: '2026-10-08T09:00:00Z',
      updated_at: '2026-10-08T09:00:00Z',
    },
    columns: [],
    cards: [],
  }
  const command: Command = {
    kind: 'createColumn',
    id: 'new',
    title: 'New column',
  }
  const next = applyCommand(snapshot, command)
  cache.setQueryData(key, snapshot)
  vi.mocked(getBoardSnapshot).mockResolvedValue(next)
  let finishWrite!: () => void
  vi.mocked(executeCommand).mockImplementation(
    () =>
      new Promise<undefined>((resolve) => {
        finishWrite = () => resolve(undefined)
      }),
  )
  const { result, unmount } = renderHook(() => useBoard('alice', 'work'), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={cache}>{children}</QueryClientProvider>
    ),
  })
  let finishRead!: (data: BoardSnapshot) => void
  const read = cache
    .fetchQuery({
      queryKey: key,
      staleTime: 0,
      queryFn: () =>
        new Promise<BoardSnapshot>((resolve) => {
          finishRead = resolve
        }),
    })
    .catch(() => {})
  act(() => {
    result.current.mutation.mutate({ command, version: 1 })
  })
  expect(cache.getQueryData<BoardSnapshot>(key)?.columns[0]?.id).toBe('new')
  await act(async () => {
    finishRead(snapshot)
    await read
  })
  expect(cache.getQueryData<BoardSnapshot>(key)?.columns[0]?.id).toBe('new')
  await waitFor(() => expect(executeCommand).toHaveBeenCalled())
  await act(async () => {
    finishWrite()
  })
  await waitFor(() => expect(result.current.mutation.isSuccess).toBe(true))
  expect(snapshot.columns).toEqual([])
  unmount()
  cache.clear()
})
