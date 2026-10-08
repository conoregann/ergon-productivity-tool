import { lazy, Suspense, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Columns3 } from 'lucide-react'
import { useAuth } from '../auth/auth-context'
import { createBoard } from '../kanban/api'

import { listBoards } from './api'

const Kanban = lazy(() =>
  import('../kanban/Kanban').then((module) => ({ default: module.Kanban })),
)

export function Boards() {
  const { session } = useAuth()
  const ownerId = session!.user.id
  const cache = useQueryClient()
  const [selected, setSelected] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const query = useQuery({
    queryKey: ['boards', ownerId],
    queryFn: () => listBoards(ownerId),
  })
  const creation = useMutation({
    mutationFn: createBoard,
    onSuccess: async (id) => {
      await cache.invalidateQueries({ queryKey: ['boards', ownerId] })
      setTitle('')
      setSelected(id)
    },
  })
  if (selected)
    return (
      <Suspense fallback={<p role="status">Opening board…</p>}>
        <Kanban
          key={selected}
          ownerId={ownerId}
          boardId={selected}
          onBack={() => setSelected(null)}
        />
      </Suspense>
    )
  const boards =
    query.data?.filter(
      (board) => Boolean(board.archived_at) === showArchived,
    ) ?? []
  return (
    <section className="panel" aria-labelledby="boards-heading">
      <header className="section-header">
        <h2 id="boards-heading">
          <Columns3 aria-hidden="true" /> Your boards
        </h2>
        <button
          className="text-button"
          aria-pressed={showArchived}
          onClick={() => setShowArchived(!showArchived)}
        >
          {showArchived ? 'Show active boards' : 'Show archived boards'}
        </button>
      </header>
      <form
        className="new-board-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (title.trim()) creation.mutate(title.trim())
        }}
      >
        <label>
          Board name
          <input
            name="board-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={200}
            placeholder="e.g. Personal projects"
            disabled={creation.isPending}
          />
        </label>
        <button disabled={creation.isPending || !title.trim()}>
          {creation.isPending ? 'Creating…' : 'Create board'}
        </button>
      </form>
      {creation.error && (
        <p role="alert" className="error">
          {creation.error.message}
        </p>
      )}
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
        (boards.length ? (
          <ul className="board-list">
            {boards.map((board) => (
              <li key={board.id}>
                <Columns3 aria-hidden="true" />
                <button
                  className="board-link text-button"
                  onClick={() => setSelected(board.id)}
                >
                  {board.title}
                </button>
                {board.archived_at && (
                  <span className="quiet-badge">Archived</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="preview-note">
            {showArchived
              ? 'No archived boards.'
              : 'No boards yet. Create one to start organising your work.'}
          </p>
        ))}
    </section>
  )
}
