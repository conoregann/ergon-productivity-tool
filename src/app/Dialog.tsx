import { useEffect, useRef } from 'react'
import type { PropsWithChildren } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export function Dialog({
  title,
  busy = false,
  onClose,
  children,
  className = '',
}: PropsWithChildren<{
  title: string
  busy?: boolean
  onClose: () => void
  className?: string
}>) {
  const ref = useRef<HTMLDialogElement>(null)
  const returnFocus = useRef(document.activeElement as HTMLElement | null)
  useEffect(() => {
    const dialog = ref.current!
    const previousFocus = returnFocus.current
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => {
      dialog.close()
      document.body.style.overflow = overflow
      requestAnimationFrame(() => {
        if (previousFocus?.isConnected) previousFocus.focus()
      })
    }
  }, [])
  return createPortal(
    <dialog
      ref={ref}
      className={`editor-dialog ${className}`}
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <header className="dialog-header">
        <h2 id="dialog-title">{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close dialog"
          disabled={busy}
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </header>
      {children}
    </dialog>,
    document.body,
  )
}
