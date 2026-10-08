import { useRef, useState } from 'react'

export function Rename({
  value,
  label,
  disabled,
  onSave,
}: {
  value: string
  label: string
  disabled?: boolean
  onSave: (title: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(value)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const action = useRef(onSave)
  const stopped = useRef(false)
  async function save() {
    if (stopped.current) return
    if (!title.trim()) {
      setError('Enter a name.')
      return
    }
    stopped.current = true
    if (title.trim() === value) {
      setEditing(false)
      return
    }
    setBusy(true)
    try {
      await action.current(title.trim())
      setEditing(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to rename')
      stopped.current = false
    } finally {
      setBusy(false)
    }
  }
  return editing ? (
    <span className="rename-form">
      <input
        autoFocus
        aria-label={label}
        value={title}
        maxLength={200}
        disabled={busy}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={() => void save()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void save()
          }
          if (event.key === 'Escape') {
            stopped.current = true
            setEditing(false)
          }
        }}
      />
      {error && <span role="alert">{error}</span>}
    </span>
  ) : (
    <button
      className="rename-title"
      aria-label={`Rename ${label.toLowerCase()}: ${value}`}
      disabled={disabled}
      onClick={() => {
        action.current = onSave
        stopped.current = false
        setTitle(value)
        setError(null)
        setEditing(true)
      }}
    >
      {value}
    </button>
  )
}
