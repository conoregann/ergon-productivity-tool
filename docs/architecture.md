# Architecture

Ergon is a single React application backed by Supabase Auth and PostgreSQL. Vercel serves the static Vite build. No separate API service is needed.

## Boundaries

- `src/app`: app composition, providers, and global styles.
- `src/features/auth`: session lifecycle, GitHub OAuth, login and logout UI.
- `src/features/boards`: board listing and creation.
- `src/features/kanban`: board editing, movement, and mutation recovery.
- `src/features/scheduling` and `src/features/timetable`: calendar preferences, scheduled sessions, time grids, and mobile agenda.
- `src/features/portability`: JSON export/import.
- `src/domain`: pure kanban transformations, filtering, scheduling/timezone rules, and portability validation.
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

Whole task cards support pointer and keyboard sorting; action buttons do not start drags. Column grips support keyboard sorting. Card editing uses a native modal with focus containment, Escape dismissal, and focus restoration. Placement forms live inside the editor; columns retain keyboard sorting. Board and column names rename inline using the revision captured when editing began. Archiving never deletes scheduling history. Completion is an explicit task field independent of column movement. Task priority is a validated tier (none, low, medium, high, urgent), saved through the same revision-checked RPCs. Authentication is the opening screen; the authenticated sidebar holds the GitHub profile and sign-out, and can collapse to an icon rail. Boards opens the gallery; a separate sidebar disclosure and archive entry provide navigation. The overview previews real snapshot data; the board fills the viewport with independent column scrolling and contained horizontal navigation. A local preference persists the neutral light/dark theme; reduced-motion preferences suppress interaction animations. Coloured priority badges retain text labels. Board background is a constrained preset stored on the owned board and saved through its revision-checked RPC; previews reflect it. Nested vertical column scrolling allows horizontal scroll chaining to the board. A viewport drag overlay avoids column clipping, with source and destination feedback. A styled date-only picker retains direct native date entry and keyboard navigation; it does not select or implement the scheduling calendar library.

## Current scope

Included: repository conventions, strict frontend tooling, authenticated application shell, owner-scoped kanban CRUD and labels/filtering, atomic ordering, conflict recovery, scheduling and calendar preferences, daily/weekly grids and mobile agenda, JSON portability, schema/RLS, security tests, CI, and Vercel configuration/setup instructions.

Remaining: PWA and release verification, including physical-device and screen-reader checks. No offline writes or authenticated response caching. The calendar library decision and spike are recorded in `docs/decisions/0002-calendar-library.md`.

Labels belong to a board. Label CRUD and card assignment writes lock and revision-check that board; labels and their assignments advance its aggregate revision. Board snapshots include both collections. Task creation/editing saves assignments atomically with card fields; omitted assignments preserve existing links for older clients and an empty list clears them. The label manager retains failed/conflicting drafts and deletion removes assignments without deleting tasks. Board search matches titles/descriptions case-insensitively and combines with label, priority, and explicit completion filters; archived tasks use the same filters in their separate disclosure. Filtering never rewrites task positions or workflow state.

Scheduling snapshots read all owned sessions, cards, boards, labels, assignments, and calendar preferences in one statement, including archived/completed history. Session edits and removal check the session revision, independently of board revisions; session writes never update cards, deadlines, or workflow status. Client-generated session IDs make create retries safe after a lost response. Active task/board checks also apply to direct session inserts and updates; archived sessions remain readable and removable. Calendar preferences are saved with a revision check, using version zero for the first insert. Scheduling keeps saved data visible until writes succeed, retains failed drafts, and refetches after success or failure to recover from uncertain network outcomes. The saved timezone controls local form conversion to UTC instants; nonexistent or ambiguous daylight-saving times require correction instead of silent normalization. Week-start and calendar-view preferences control the timetable range and initial view.
