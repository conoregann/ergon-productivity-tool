import { useState } from 'react'
import { Columns3, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { GitHubIcon } from '../features/auth/GitHubIcon'
import { AuthGate } from '../features/auth/AuthGate'
import { useAuth } from '../features/auth/auth-context'
import { Boards } from '../features/boards/Boards'

export function App() {
  const { session, signOut } = useAuth()
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 760)
  const [boardView, setBoardView] = useState(0)
  const [pending, setPending] = useState(false)
  const metadata = session?.user.user_metadata
  const name =
    metadata?.full_name ??
    metadata?.user_name ??
    session?.user.email ??
    'GitHub account'
  const avatar =
    typeof metadata?.avatar_url === 'string' ? metadata.avatar_url : null
  async function logout() {
    setPending(true)
    try {
      await signOut()
    } finally {
      setPending(false)
    }
  }
  return (
    <AuthGate>
      <div className={`app-layout ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <a className="skip-link" href="#workspace">
          Skip to workspace
        </a>
        <aside
          id="sidebar"
          className="sidebar"
          aria-label="Workspace navigation"
        >
          <a
            className="brand"
            href="#workspace"
            aria-label="Ergon workspace"
            onClick={() => setBoardView((view) => view + 1)}
          >
            <span className="brand-mark" aria-hidden="true">
              e
            </span>
            <span className="sidebar-label">ergon</span>
          </a>
          <nav aria-label="Main navigation">
            <p className="nav-label sidebar-label">Workspace</p>
            <a
              className="nav-item"
              href="#workspace"
              aria-current="page"
              aria-label="Boards"
              onClick={() => setBoardView((view) => view + 1)}
            >
              <Columns3 aria-hidden="true" />{' '}
              <span className="sidebar-label">Boards</span>
            </a>
          </nav>
          <div className="sidebar-account">
            <div className="profile" title={String(name)}>
              {avatar ? (
                <img
                  className="profile-avatar"
                  src={avatar}
                  alt="GitHub profile"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="profile-avatar">
                  <GitHubIcon aria-hidden="true" />
                </span>
              )}
              <div className="sidebar-label profile-copy">
                <strong>{String(name)}</strong>
                <span>Personal workspace</span>
              </div>
            </div>
            <button
              className="signout-button"
              disabled={pending}
              onClick={() => void logout()}
              aria-label="Sign out"
            >
              <LogOut aria-hidden="true" />
              <span className="sidebar-label">Sign out</span>
            </button>
          </div>
        </aside>
        <main id="workspace" className="workspace" tabIndex={-1}>
          <header className="workspace-header">
            <button
              className="icon-button sidebar-toggle"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              aria-controls="sidebar"
            >
              {collapsed ? (
                <PanelLeftOpen aria-hidden="true" />
              ) : (
                <PanelLeftClose aria-hidden="true" />
              )}
            </button>
            <h1>Boards</h1>
            <span className="workspace-context">Personal workspace</span>
          </header>
          <div className="workspace-content">
            <Boards key={boardView} />
          </div>
        </main>
      </div>
    </AuthGate>
  )
}
