import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Download, Upload } from 'lucide-react'
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
          busy={busy}
          onClose={() => {
            setOpen(false)
            requestAnimationFrame(() => trigger.current?.focus())
          }}
        >
          <div className="portability-content">
            <p>
              Export all boards, including archived boards, columns, cards,
              labels, and scheduled sessions.
            </p>
            <button disabled={busy} onClick={() => void download()}>
              <Download aria-hidden="true" /> Export JSON
            </button>
            <p>
              Import adds copies to your account and keeps existing boards.
              Relationships, deadlines, completion, and scheduled times are
              preserved.
            </p>
            <label>
              Import JSON file
              <input
                type="file"
                accept=".json,application/json"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void read(file)
                }}
              />
            </label>
            {data && (
              <>
                <p>
                  Ready to import: boards: {data.boards.length}, columns:{' '}
                  {data.columns.length}, cards: {data.cards.length}, labels:{' '}
                  {data.labels.length}, sessions:{' '}
                  {data.scheduled_sessions.length}.
                </p>
                <button disabled={busy} onClick={() => void restore()}>
                  <Upload aria-hidden="true" /> Import copies
                </button>
              </>
            )}
            {busy && <p role="status">Working…</p>}
            {message && <p role="status">{message}</p>}
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
