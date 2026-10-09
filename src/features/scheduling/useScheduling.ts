import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { executeSchedulingCommand, getSchedulingSnapshot } from './api'

export function useScheduling(ownerId: string) {
  const cache = useQueryClient()
  const key = ['scheduling', ownerId]
  const query = useQuery({ queryKey: key, queryFn: getSchedulingSnapshot })
  const mutation = useMutation({
    mutationFn: executeSchedulingCommand,
    retry: false,
    // Keep saved data visible until the server confirms a write. Refetch even
    // after errors: a response may be lost after the transaction committed.
    onSettled: async () => {
      await cache.invalidateQueries({ queryKey: key })
    },
  })
  return { query, mutation }
}
