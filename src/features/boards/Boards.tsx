import { useQuery } from '@tanstack/react-query'
import { Columns3 } from 'lucide-react'
import { useAuth } from '../auth/auth-context'
import { listBoards } from './api'

export function Boards() {
  const { session } = useAuth()
  const ownerId = session?.user.id
  const query = useQuery({
    queryKey: ['boards', ownerId],
    queryFn: () => listBoards(ownerId!),
    enabled: Boolean(ownerId),
  })
  return (
    <section className="panel" aria-labelledby="boards-heading">
      <h2 id="boards-heading">
        <Columns3 aria-hidden="true" /> Your boards
      </h2>
      {query.isPending && <p role="status">Loading boards…</p>}
      {query.isError && (
        <>
          <p role="alert" className="error">
            Unable to load your boards.
          </p>
          <button onClick={() => void query.refetch()}>Try again</button>
        </>
      )}
      {query.isSuccess &&
        (query.data.length ? (
          <ul className="board-list">
            {query.data.map((board) => (
              <li key={board.id}>
                <Columns3 aria-hidden="true" />
                <span>{board.title}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No boards yet. Your workspace is ready for the kanban workflow.</p>
        ))}
    </section>
  )
}
