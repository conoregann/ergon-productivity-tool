import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import type { Board } from '../../domain/kanban'
import { Dialog } from '../../app/Dialog'
import { createBoard, getBoardSnapshot } from '../kanban/api'

function BoardTile({
  board,
  ownerId,
  onSelect,
}: {
  board: Board
  ownerId: string
  onSelect: (id: string) => void
}) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['board', ownerId, board.id],
    queryFn: () => getBoardSnapshot(board.id),
  })
  return (
    <button
      className="board-tile"
      aria-label={`Open board ${board.title}`}
      onClick={() => onSelect(board.id)}
    >
      <span className="board-miniature" aria-hidden="true">
        {data?.columns.slice(0, 3).map((column) => (
          <span className="mini-column" key={column.id}>
            <span>{column.title}</span>
            {data.cards
              .filter(
                (card) => card.column_id === column.id && !card.archived_at,
              )
              .slice(0, 2)
              .map((card) => (
                <span className="mini-card" key={card.id}>
                  {card.title}
                </span>
              ))}
          </span>
        ))}
        {!data?.columns.length && (
          <span className="mini-empty">
            {isPending
              ? 'Loading…'
              : isError
                ? 'Preview unavailable'
                : 'Empty board'}
          </span>
        )}
      </span>
      <span className="board-tile-name">{board.title}</span>
    </button>
  )
}

export function Boards({
  ownerId,
  boards,
  archived,
  onSelect,
}: {
  ownerId: string
  boards: Board[]
  archived: boolean
  onSelect: (id: string) => void
}) {
  const cache = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const creation = useMutation({
    mutationFn: createBoard,
    onSuccess: async (id) => {
      await cache.invalidateQueries({ queryKey: ['boards', ownerId] })
      setCreating(false)
      setTitle('')
      onSelect(id)
    },
  })
  return (
    <>
      <div className="board-gallery">
        {boards.map((board) => (
          <BoardTile
            key={board.id}
            board={board}
            ownerId={ownerId}
            onSelect={onSelect}
          />
        ))}
        {!archived && (
          <button
            className="board-tile create-tile"
            onClick={() => {
              creation.reset()
              setCreating(true)
            }}
          >
            <Plus aria-hidden="true" />
            <span>New board</span>
          </button>
        )}
      </div>
      {archived && !boards.length && (
        <p className="empty-note">No archived boards.</p>
      )}
      {creating && (
        <Dialog
          title="New board"
          busy={creation.isPending}
          onClose={() => setCreating(false)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (title.trim()) creation.mutate(title.trim())
            }}
          >
            <label>
              Board name
              <input
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                maxLength={200}
                disabled={creation.isPending}
              />
            </label>
            {creation.error && (
              <p role="alert" className="error">
                {creation.error.message}
              </p>
            )}
            <div className="form-actions">
              <button disabled={creation.isPending || !title.trim()}>
                {creation.isPending ? 'Creating…' : 'Create board'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  )
}
