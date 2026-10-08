# Architecture

Ergon is a single React application backed by Supabase Auth and PostgreSQL. Vercel serves the static Vite build. No separate API service is needed.

## Boundaries

- `src/app`: app composition, providers, and global styles.
- `src/features/auth`: session lifecycle, GitHub OAuth, login and logout UI.
- `src/features/boards`: board listing and creation.
- `src/features/kanban`: board editing, movement, and mutation recovery.
- `src/domain`: pure optimistic kanban transformations; scheduling rules come with scheduling.
- `src/lib`: Supabase client and generated database types.
- `supabase/migrations`: authoritative versioned schema and policies.
- `supabase/tests`: database constraint and user-isolation tests.
- `tests/e2e`: browser checks; `src/**/*.test.*`: component and unit checks.

## Data invariants

All entities belong to an authenticated user. Composite foreign keys carry ownership through the board → column → card chain and through labels and sessions. Cards and labels must belong to the same board. RLS restricts CRUD to the owner; anonymous access is revoked. The browser receives only a publishable key.

Sessions reference cards, and store `timestamptz` instants with `ends_at > starts_at`. Due dates use `date`. Completion is represented by `cards.completed_at`; a session derives completion from its card, retaining its original time/history. Columns do not implicitly determine completion.

Ordering uses nonnegative integer positions with deferrable uniqueness per parent. Security-invoker RPCs lock the owned board before mutating columns or cards, then repack positions within one transaction. Movement uses a destination and a before-item anchor; a null anchor appends. Archived cards retain positions and are included in repacking.

Every mutable entity has a monotonically increasing `version`. Column/card writes also advance the parent board revision. Each mutation supplies the revision captured when the editor opened or movement started; a stale revision returns SQL state `PT409` (HTTP 409). The snapshot RPC reads the board, columns, and cards in one statement. TanStack Query cancels in-flight reads before optimistic updates, restores the previous snapshot on failure, and refetches authoritative data after each mutation. Conflicting drafts stay visible until the user closes them to review the latest board.

The narrowly scoped parent-revision trigger runs as a definer so Supabase Auth can cascade user deletion without application-table privileges. Its search path is empty and direct execution is revoked. Mutation RPCs remain invokers and enforce RLS, parent ownership, active-board checks, and revision checks.

Whole task cards support pointer and keyboard sorting; action buttons do not start drags. Column grips support keyboard sorting. Explicit movement forms and column reorder buttons provide native-control alternatives. Archiving never deletes scheduling history. Completion is an explicit task field independent of column movement. Task priority is a validated tier (none, low, medium, high, urgent), saved through the same revision-checked RPCs. Authentication is the opening screen; the authenticated sidebar holds the GitHub profile and sign-out, and can collapse to an icon rail.

## Current scope

Included: repository conventions, strict frontend tooling, authenticated application shell, owner-scoped kanban CRUD, atomic ordering, conflict recovery, schema/RLS, security tests, CI, and Vercel configuration/setup instructions.

Subsequent phases: calendar spike and scheduling; filtering/mobile agenda/accessibility; JSON portability and PWA; release verification. No offline writes or authenticated response caching in the foundation.
