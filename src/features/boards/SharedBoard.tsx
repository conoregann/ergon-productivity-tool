import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/auth-context'
import { shareToken } from '../../lib/supabase'
import { getBoardSnapshot } from '../kanban/api'
import { Kanban } from '../kanban/Kanban'

export function SharedBoard() {
  const { session, status, signIn, error } = useAuth()
  const [pending, setPending] = useState(false)
  useEffect(() => {
    if (
      status === 'ready' &&
      !new URLSearchParams(window.location.search).has('share')
    )
      window.history.replaceState(
        null,
        '',
        `/?share=${encodeURIComponent(shareToken!)}`,
      )
  }, [status])
  const query = useQuery({
    queryKey: ['shared-board', shareToken, session?.user.id ?? 'anonymous'],
    queryFn: () => getBoardSnapshot('shared'),
    retry: false,
    refetchInterval: 15000,
  })
  if (query.isError)
    return (
      <main className="workspace-content">
        <h1>Board unavailable</h1>
        <p>This sharing link is invalid or has been disabled.</p>
        <button onClick={() => void query.refetch()}>Try again</button>
        <a href="/">Ergon home</a>
      </main>
    )
  if (!query.data)
    return (
      <main>
        <p role="status">Loading shared board…</p>
      </main>
    )
  const canEdit = Boolean(session) && query.data.access === 'editor'
  return (
    <main className="workspace board-workspace">
      {error && <p role="alert">{error}</p>}
      <Kanban
        key={`${session?.user.id ?? 'anonymous'}:${canEdit}`}
        ownerId={session?.user.id ?? 'anonymous'}
        boardId={query.data.board.id}
        boardPreview={query.data.board}
        shared
        readOnly={!canEdit}
        onBack={() => {
          window.location.href = '/'
        }}
        onTimetable={() => {}}
        sidebarControl={
          <>
            <a className="button-secondary" href="/">
              Ergon
            </a>
            {!session && query.data.access === 'editor' && (
              <button
                disabled={pending}
                onClick={() => {
                  setPending(true)
                  void signIn().finally(() => setPending(false))
                }}
              >
                Sign in to edit
              </button>
            )}
          </>
        }
      />
    </main>
  )
}
