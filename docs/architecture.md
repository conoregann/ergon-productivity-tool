# Architecture

Ergon is a single React application backed by Supabase Auth and PostgreSQL. Vercel serves the static Vite build. No separate API service is needed.

## Boundaries

- `src/app`: app composition, providers, and global styles.
- `src/features/auth`: session lifecycle, GitHub OAuth, login and logout UI.
- `src/features/boards`: board queries and the initial authenticated read-only view.
- `src/domain`: pure task and scheduling rules (introduced with their consumers).
- `src/lib`: Supabase client and generated database types.
- `supabase/migrations`: authoritative versioned schema and policies.
- `supabase/tests`: database constraint and user-isolation tests.
- `tests/e2e`: browser checks; `src/**/*.test.*`: component and unit checks.

## Data invariants

All entities belong to an authenticated user. Composite foreign keys carry ownership through the board → column → card chain and through labels and sessions. Cards and labels must belong to the same board. RLS restricts CRUD to the owner; anonymous access is revoked. The browser receives only a publishable key.

Sessions reference cards, and store `timestamptz` instants with `ends_at > starts_at`. Due dates use `date`. Completion is represented by `cards.completed_at`; a session derives completion from its card, retaining its original time/history. Columns do not implicitly determine completion.

Ordering uses nonnegative integer positions with deferrable uniqueness per parent. Transactional reorder RPCs will be implemented alongside kanban movement, not speculative foundation APIs.

Every mutable entity has a monotonically increasing `version` set by a database trigger. Future edit mutations must filter by the version originally read and return an explicit conflict when zero rows change. A timestamp alone is not the concurrency contract. TanStack Query refetches on window focus; mutation rollback is added with the first editable feature.

## Foundation scope

Included: repository conventions, strict frontend tooling, authenticated application shell, owner-scoped board reads, schema/RLS, security tests, CI, and Vercel configuration/setup instructions.

Subsequent phases: board/card CRUD and atomic reordering; calendar spike and scheduling; filtering/mobile agenda/accessibility; JSON portability and PWA; release verification. No offline writes or authenticated response caching in the foundation.
