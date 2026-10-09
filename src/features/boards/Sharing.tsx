import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Share2 } from 'lucide-react'
import { Dialog } from '../../app/Dialog'
import { supabase } from '../../lib/supabase'
import type { Board } from '../../domain/kanban'

export function Sharing({
  board,
  onSaved,
}: {
  board: Board
  onSaved: () => Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const query = useQuery({
    queryKey: ['sharing', board.owner_id, board.id],
    enabled: open,
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase is not configured')
      const { data, error } = await supabase
        .from('board_shares')
        .select('*')
        .eq('board_id', board.id)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data
    },
  })
  const link = query.data
    ? `${window.location.origin}/?share=${query.data.token}`
    : ''
  async function save(access: string | null) {
    setPending(true)
    setError(null)
    setCopied(false)
    try {
      if (!supabase) throw new Error('Supabase is not configured')
      const { error } = await supabase.rpc('set_board_sharing', {
        p_board_id: board.id,
        p_version: board.version,
        p_access: access,
      })
      if (error) throw new Error(error.message)
      await query.refetch()
      await onSaved()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Unable to change sharing',
      )
      await onSaved()
    } finally {
      setPending(false)
    }
  }
  return (
    <>
      <button
        className="button-secondary board-tool"
        aria-label="Share board"
        title="Share board"
        onClick={() => {
          setError(null)
          setCopied(false)
          setOpen(true)
        }}
      >
        <Share2 aria-hidden="true" />
      </button>
      {open && (
        <Dialog
          title="Share board"
          busy={pending}
          onClose={() => setOpen(false)}
        >
          <div className="sharing-content">
            <p>
              Anyone with the link can access this board. Editors must sign in.
              You control sharing and board deletion.
            </p>
            {query.isPending ? (
              <p role="status">Loading sharing settings…</p>
            ) : query.isError ? (
              <p role="alert">
                {query.error.message}{' '}
                <button onClick={() => void query.refetch()}>Try again</button>
              </p>
            ) : (
              <>
                <label>
                  Link access
                  <select
                    aria-label="Link access"
                    value={query.data?.access ?? 'private'}
                    disabled={pending}
                    onChange={(event) =>
                      void save(
                        event.target.value === 'private'
                          ? null
                          : event.target.value,
                      )
                    }
                  >
                    <option value="private">Private</option>
                    <option value="viewer">
                      Anyone with the link — viewer
                    </option>
                    <option value="editor">
                      Anyone with the link — editor
                    </option>
                  </select>
                </label>
                {link && (
                  <>
                    <label>
                      Sharing link
                      <input
                        aria-label="Sharing link"
                        readOnly
                        value={link}
                        onFocus={(event) => event.target.select()}
                      />
                    </label>
                    <button
                      disabled={pending}
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(link)
                          .then(() => setCopied(true))
                          .catch(() =>
                            setError('Select and copy the sharing link above.'),
                          )
                      }}
                    >
                      {copied ? 'Copied' : 'Copy link'}
                    </button>
                  </>
                )}
                {!link && (
                  <p>
                    This board is private. Disabling sharing invalidates the
                    previous link.
                  </p>
                )}
              </>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
          </div>
        </Dialog>
      )}
    </>
  )
}
