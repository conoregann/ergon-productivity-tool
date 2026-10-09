import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { applyCommand } from '../../domain/kanban'
import type { BoardSnapshot, Command } from '../../domain/kanban'
import { executeCommand, getBoardSnapshot } from './api'

export function useBoard(ownerId: string, boardId: string) {
  const cache = useQueryClient()
  const key = ['board', ownerId, boardId]
  const query = useQuery({
    queryKey: key,
    queryFn: () => getBoardSnapshot(boardId),
  })
  const mutation = useMutation({
    mutationFn: ({ command, version }: { command: Command; version: number }) =>
      executeCommand(boardId, version, command),
    onMutate: ({ command }) => {
      // Cancellation reverts an in-flight read synchronously. Publish the new
      // layout in this event so the drop animation measures the destination.
      void cache.cancelQueries({ queryKey: key })
      const previous = cache.getQueryData<BoardSnapshot>(key)
      if (previous) cache.setQueryData(key, applyCommand(previous, command))
      return { previous }
    },
    onError: (_error, _input, context) => {
      // A logout may have cleared the cache while the request was in flight.
      if (context?.previous && cache.getQueryState(key))
        cache.setQueryData(key, context.previous)
    },
    onSettled: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: key }),
        cache.invalidateQueries({ queryKey: ['boards', ownerId] }),
        cache.invalidateQueries({ queryKey: ['timetable', ownerId] }),
        cache.invalidateQueries({ queryKey: ['scheduling', ownerId] }),
      ])
    },
  })
  return { query, mutation }
}
