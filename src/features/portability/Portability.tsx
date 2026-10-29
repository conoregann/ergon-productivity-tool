import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileJson,
  Upload,
} from 'lucide-react'
import { Dialog } from '../../app/Dialog'
import {
  parseWorkspaceExport,
  type WorkspaceExport,
} from '../../domain/portability'
import { exportWorkspace, importWorkspace } from './api'
import './portability.css'

export function Portability({ ownerId }: { ownerId: string }) {
  const cache = useQueryClient()
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [data, setData] = useState<WorkspaceExport | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  async function download() {
    setBusy(true)
    setError('')
    try {
      const data = await exportWorkspace()
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      )
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'ergon-export.json'
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }
  async function read(file: File) {
    setBusy(true)
    setData(null)
    setError('')
    setMessage('')
    try {
      setData(parseWorkspaceExport(await file.text()))
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to read file')
    } finally {
      setBusy(false)
    }
  }
  async function restore() {
    if (!data) return
    setBusy(true)
    setError('')
    try {
      await importWorkspace(data)
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['boards', ownerId] }),
        cache.invalidateQueries({ queryKey: ['scheduling', ownerId] }),
        cache.invalidateQueries({ queryKey: ['timetable', ownerId] }),
      ])
      setData(null)
      setMessage('Import complete. Your boards have been added.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button
        ref={trigger}
        className="signout-button"
        aria-label="Export and import JSON"
        onClick={() => {
          setOpen(true)
          setError('')
          setMessage('')
          setData(null)
        }}
      >
        <Download aria-hidden="true" />
        <span className="sidebar-label">Export / import</span>
      </button>
      {open && (
        <Dialog
          title="Export and import JSON"
          className="portability-dialog"
          busy={busy}
          onClose={() => {
            setOpen(false)
            requestAnimationFrame(() => trigger.current?.focus())
          }}
        >
          <div className="portability-content" aria-busy={busy}>
            <div className="portability-intro">
              <FileJson aria-hidden="true" />
              <p>
                Keep a backup of your workspace or bring an Ergon export into
                this account.
              </p>
            </div>
            <section
              className="portability-section portability-export"
              aria-labelledby="portability-export-title"
            >
              <div className="portability-section-heading">
                <Download aria-hidden="true" />
                <div>
                  <h3 id="portability-export-title">Export workspace</h3>
                </div>
              </div>
              <p className="portability-description">
                Includes all boards and archived content, columns, cards,
                labels, and scheduled sessions.
              </p>
              <button
                className="button-secondary"
                disabled={busy}
                onClick={() => void download()}
              >
                <Download aria-hidden="true" /> Export JSON
              </button>
            </section>
            <section
              className="portability-section"
              aria-labelledby="portability-import-title"
            >
              <div className="portability-section-heading">
                <Upload aria-hidden="true" />
                <div>
                  <h3 id="portability-import-title">Import workspace</h3>
                </div>
              </div>
              <p
                id="portability-import-description"
                className="portability-description"
              >
                Imported boards are added as copies. Your existing boards stay
                in place. Relationships, deadlines, completion, and scheduled
                times are preserved.
              </p>
              <label className="portability-file">
                <span>Import JSON file</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  aria-describedby="portability-import-description"
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void read(file)
                  }}
                />
              </label>
              {data && (
                <div className="portability-preview">
                  <h4>
                    <CheckCircle2 aria-hidden="true" /> Ready to import
                  </h4>
                  <dl className="portability-counts">
                    {[
                      ['Boards', data.boards.length],
                      ['Columns', data.columns.length],
                      ['Cards', data.cards.length],
                      ['Labels', data.labels.length],
                      ['Sessions', data.scheduled_sessions.length],
                    ].map(([label, count]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{count}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="portability-import-action">
                    <span>Creates new boards in your account.</span>
                    <button disabled={busy} onClick={() => void restore()}>
                      <Upload aria-hidden="true" /> Import copies
                    </button>
                  </div>
                </div>
              )}
            </section>
            {busy && (
              <p className="portability-feedback" role="status">
                Working…
              </p>
            )}
            {message && (
              <p className="portability-feedback" role="status">
                <CheckCircle2 aria-hidden="true" />
                {message}
              </p>
            )}
            {error && (
              <p role="alert" className="portability-feedback error">
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
