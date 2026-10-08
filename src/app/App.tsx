import { CalendarDays, Columns3 } from 'lucide-react'

export function App() {
  return (
    <main className="shell">
      <p className="eyebrow">ERGON</p>
      <h1>Make room for meaningful work.</h1>
      <p className="intro">
        Your tasks and your time, in one private workspace.
      </p>
      <section className="panel" aria-label="Workspace">
        <h2>
          <Columns3 aria-hidden="true" /> Boards
        </h2>
        <p>Your workspace foundation is ready.</p>
      </section>
      <p className="note">
        <CalendarDays aria-hidden="true" /> Plan the work. Protect the time.
      </p>
    </main>
  )
}
