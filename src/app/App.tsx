import { Columns3, LockKeyhole } from 'lucide-react'
import { AuthGate } from '../features/auth/AuthGate'
import { useAuth } from '../features/auth/auth-context'
import { Boards } from '../features/boards/Boards'
import { WorkspacePreview } from './WorkspacePreview'

export function App() {
  const { session, status } = useAuth()
  return (
    <div className="app-layout">
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>
      <aside className="sidebar" aria-label="Workspace navigation">
        <a className="brand" href="#workspace" aria-label="Ergon workspace">
          <span className="brand-mark" aria-hidden="true">
            e
          </span>
          <span>
            ergon<span className="brand-caption">Tasks & time</span>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          <a className="nav-item" href="#workspace" aria-current="page">
            <Columns3 aria-hidden="true" /> Boards
          </a>
        </nav>
        <div className="sidebar-footer">
          <LockKeyhole aria-hidden="true" />
          <span>Private by design</span>
        </div>
      </aside>
      <main id="workspace" className="workspace" tabIndex={-1}>
        <header className="workspace-header">
          <p className="breadcrumb">
            Workspace <span aria-hidden="true">/</span> <span>Boards</span>
          </p>
          <div className="page-heading">
            <div>
              <h1>Boards</h1>
              <p>A clear view of the work ahead.</p>
            </div>
            <Columns3 className="heading-icon" aria-hidden="true" />
          </div>
        </header>
        <div className="workspace-content">
          <AuthGate>
            <Boards />
          </AuthGate>
          {!session && status !== 'loading' && <WorkspacePreview />}
        </div>
        <footer className="workspace-footer">
          <span>Less noise. More focus.</span>
          <span>Tasks & time</span>
        </footer>
      </main>
    </div>
  )
}
