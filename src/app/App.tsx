import { CalendarDays } from 'lucide-react'
import { AuthGate } from '../features/auth/AuthGate'
import { Boards } from '../features/boards/Boards'

export function App() {
  return (
    <main className="shell">
      <p className="eyebrow">ERGON</p>
      <h1>Make room for meaningful work.</h1>
      <p className="intro">
        Your tasks and your time, in one private workspace.
      </p>
      <AuthGate>
        <Boards />
      </AuthGate>
      <p className="note">
        <CalendarDays aria-hidden="true" /> Plan the work. Protect the time.
      </p>
    </main>
  )
}
