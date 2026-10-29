import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  Check,
  Copy,
  Globe2,
  LockKeyhole,
  Share2,
} from 'lucide-react'
import './sharing.css'
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
          className="sharing-dialog"
          busy={pending}
          onClose={() => setOpen(false)}
        >
          <div className="sharing-content">
            <div className="sharing-board">
              <Share2 aria-hidden="true" />
              <div>
                <span>Board</span>
                <strong>{board.title}</strong>
              </div>
            </div>
            {query.isPending ? (
              <p className="sharing-feedback" role="status">
                Loading sharing settings…
              </p>
            ) : query.isError ? (
              <p className="sharing-feedback error" role="alert">
                {query.error.message}{' '}
                <button
                  className="button-secondary"
                  onClick={() => void query.refetch()}
                >
                  Try again
                </button>
              </p>
            ) : (
              <>
                <section className="sharing-access" aria-label="Board access">
                  <label>
                    <span>Link access</span>
                    <select
                      aria-label="Link access"
                      aria-describedby="sharing-access-description"
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
                  <p
                    id="sharing-access-description"
                    className="sharing-access-description"
                  >
                    {link ? (
                      <Globe2 aria-hidden="true" />
                    ) : (
                      <LockKeyhole aria-hidden="true" />
                    )}
                    <span>
                      {!link
                        ? 'Only you can access this board. Choose link access to share it.'
                        : query.data?.access === 'editor'
                          ? 'People with this link can view the board. Signed-in people can edit tasks.'
                          : 'Anyone with this link can view the board. Editing is disabled.'}
                    </span>
                  </p>
                </section>
                {link && (
                  <section
                    className="sharing-link-section"
                    aria-label="Share a link"
                  >
                    <label htmlFor="board-sharing-link">Sharing link</label>
                    <div className="sharing-link-row">
                      <input
                        id="board-sharing-link"
                        aria-label="Sharing link"
                        readOnly
                        value={link}
                        onFocus={(event) => event.target.select()}
                      />
                      <button
                        className="button-secondary"
                        disabled={pending}
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(link)
                            .then(() => setCopied(true))
                            .catch(() =>
                              setError(
                                'Select and copy the sharing link above.',
                              ),
                            )
                        }}
                      >
                        {copied ? (
                          <Check aria-hidden="true" />
                        ) : (
                          <Copy aria-hidden="true" />
                        )}
                        {copied ? 'Copied' : 'Copy link'}
                      </button>
                    </div>
                    {copied && (
                      <p role="status" className="sharing-copy-status">
                        Link copied.
                      </p>
                    )}
                  </section>
                )}
                <p className="sharing-note">
                  {link
                    ? 'You control sharing and board deletion. Setting access to Private invalidates this link.'
                    : 'Disabling sharing invalidates the previous link.'}
                </p>
              </>
            )}
            {error && (
              <p role="alert" className="sharing-feedback error">
                <AlertCircle aria-hidden="true" />
                {error}
              </p>
            )}
          </div>
        </Dialog>
      )}
    </>
  )
}
