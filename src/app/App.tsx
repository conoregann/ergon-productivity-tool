import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Archive,
  ChevronDown,
  Columns3,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
} from 'lucide-react'
import { GitHubIcon } from '../features/auth/GitHubIcon'
import { AuthGate } from '../features/auth/AuthGate'
import { useAuth } from '../features/auth/auth-context'
import { Boards } from '../features/boards/Boards'
import { listBoards } from '../features/boards/api'
import { Portability } from '../features/portability/Portability'
import { Kanban } from '../features/kanban/Kanban'

function Workspace() {
  const { session, signOut } = useAuth()
  const ownerId = session!.user.id
  const [selected, setSelected] = useState<string | null>(null)
  const [archived, setArchived] = useState(false)
  const [boardsOpen, setBoardsOpen] = useState(true)
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 760)
  const [pending, setPending] = useState(false)
  const [dark, setDark] = useState(
    () => localStorage.getItem('ergon-theme') === 'dark',
  )
  const query = useQuery({
    queryKey: ['boards', ownerId],
    queryFn: () => listBoards(ownerId),
  })
  const boards = query.data ?? []
  const metadata = session!.user.user_metadata
  const name =
    metadata?.full_name ??
    metadata?.user_name ??
    session!.user.email ??
    'GitHub account'
  const avatar =
    typeof metadata?.avatar_url === 'string' ? metadata.avatar_url : null
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    localStorage.setItem('ergon-theme', dark ? 'dark' : 'light')
  }, [dark])
  function overview(showArchived = false) {
    setSelected(null)
    setArchived(showArchived)
  }
  async function logout() {
    setPending(true)
    try {
      await signOut()
    } finally {
      setPending(false)
    }
  }
  const sidebarControl = (
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
  )
  return (
    <div className={`app-layout ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>
      <aside id="sidebar" className="sidebar" aria-label="Workspace navigation">
        <button
          className="brand"
          aria-label="Ergon home"
          onClick={() => overview()}
        >
          <span className="brand-mark" aria-hidden="true">
            e
          </span>
          <span className="sidebar-label">ergon</span>
        </button>
        <nav aria-label="Main navigation">
          <div className="boards-navigation">
            <button
              className="nav-item"
              aria-label="Boards"
              aria-current={!selected && !archived ? 'page' : undefined}
              onClick={() => overview()}
            >
              <Columns3 aria-hidden="true" />
              <span className="sidebar-label">Boards</span>
            </button>
            {!collapsed && (
              <button
                className="icon-button boards-disclosure"
                aria-label={boardsOpen ? 'Hide board list' : 'Show board list'}
                aria-expanded={boardsOpen}
                aria-controls="sidebar-boards"
                onClick={() => setBoardsOpen(!boardsOpen)}
              >
                <ChevronDown
                  className={`nav-chevron ${boardsOpen ? 'is-open' : ''}`}
                  aria-hidden="true"
                />
              </button>
            )}
          </div>
          {boardsOpen && !collapsed && (
            <div id="sidebar-boards" className="sidebar-boards">
              {boards
                .filter((board) => !board.archived_at)
                .map((board) => (
                  <button
                    className="sidebar-board"
                    key={board.id}
                    aria-current={selected === board.id ? 'page' : undefined}
                    onClick={() => setSelected(board.id)}
                  >
                    {board.title}
                  </button>
                ))}
            </div>
          )}
          <button
            className="nav-item archive-nav"
            aria-label="Archived boards"
            aria-current={!selected && archived ? 'page' : undefined}
            onClick={() => overview(true)}
          >
            <Archive aria-hidden="true" />
            <span className="sidebar-label">Archive</span>
          </button>
        </nav>
        <div className="sidebar-account">
          <Portability ownerId={ownerId} />
          <button
            className="signout-button"
            onClick={() => setDark(!dark)}
            aria-label={dark ? 'Use light mode' : 'Use dark mode'}
          >
            {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            <span className="sidebar-label">
              {dark ? 'Light mode' : 'Dark mode'}
            </span>
          </button>
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
                <GitHubIcon />
              </span>
            )}
            <strong className="sidebar-label profile-copy">
              {String(name)}
            </strong>
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
      <main
        id="workspace"
        className={`workspace ${selected ? 'board-workspace' : ''}`}
        tabIndex={-1}
      >
        {selected ? (
          <Kanban
            key={selected}
            ownerId={ownerId}
            boardId={selected}
            boardPreview={boards.find((board) => board.id === selected)}
            sidebarControl={sidebarControl}
            onBack={() => overview()}
          />
        ) : (
          <>
            <header className="workspace-header">
              {sidebarControl}
              <h1>{archived ? 'Archive' : 'Boards'}</h1>
            </header>
            <div className="workspace-content">
              {query.isError && (
                <p role="alert" className="error">
                  Unable to load boards.{' '}
                  <button onClick={() => void query.refetch()}>
                    Try again
                  </button>
                </p>
              )}
              <Boards
                ownerId={ownerId}
                boards={boards.filter(
                  (board) => Boolean(board.archived_at) === archived,
                )}
                archived={archived}
                onSelect={setSelected}
              />
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export function App() {
  return (
    <AuthGate>
      <Workspace />
    </AuthGate>
  )
}
