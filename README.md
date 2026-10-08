# Ergon

Private kanban task management and calendar planning. Tasks and scheduled work share one data model; deadlines and reserved work time remain distinct.

**Status:** authenticated kanban implemented. Boards, columns, and tasks support editing, archiving, whole-card dragging, keyboard/form controls, optimistic updates, and stale-edit recovery. Tasks have persisted colour-coded priorities. Authentication opens first, with the GitHub profile and sign-out in a collapsible sidebar. PostgreSQL RLS and automated isolation tests protect private data. Scheduling, JSON portability, and PWA support remain later phases. Real GitHub OAuth and deployment require the verification steps in the deployment guide.

## Local development

Requires Node 22 (see `.nvmrc`) and npm.

```sh
npm ci
cp .env.example .env.local
# Set the Supabase project URL and publishable key in .env.local.
npm run dev
```

Never put a Supabase service-role key or GitHub client secret in `VITE_*` variables. All Vite variables are public browser configuration.

```sh
npm run check        # Format, lint, TypeScript, unit/auth and database tests, production build
npx playwright install chromium
npm run test:e2e     # Production-build workflow and recovery tests on desktop and mobile
npm run db:types     # Regenerate table and RPC types from SQL migrations
```

Database tests execute all migrations in PGlite (PostgreSQL compiled to WASM); only Supabase's identity plumbing is substituted. Docker is not required for these tests. They verify RLS, anonymous denial, cross-owner and cross-board foreign keys, date/session constraints, version conflicts, completion history, and cascading deletion. They do not substitute for live OAuth and full Supabase integration verification.

The local type generator produces scalar CRUD and RPC types. Before adding joined queries, replace it with the official `supabase gen types typescript --local` generator, which also emits relationship metadata.

## Structure

```text
src/
  app/                 Composition and styles
  features/auth/       Session lifecycle and authentication UI
  features/boards/     Board listing and creation
  features/kanban/      Editing, movement and optimistic recovery
  domain/              Pure kanban rules
  lib/                 Supabase client, environment and generated types
  test/                Test setup
supabase/
  migrations/          Versioned schema and ownership policies
  tests/               PostgreSQL security/invariant tests
tests/e2e/             Browser checks
scripts/               Database types and hosted verification
docs/                  Product scope, architecture, deployment and decisions
.github/workflows/     Quality gates
```

See [project overview](docs/project-overview.md), [architecture](docs/architecture.md), [deployment](docs/deployment.md), and [agent instructions](AGENTS.md).

## Next milestones

1. Complete real GitHub login/reload/logout and deployed multi-user acceptance checks.
2. Calendar library spike, session CRUD, daily/weekly grids, and timezone/DST tests.
3. Search, filters, deadlines, overlaps, and mobile agenda/forms.
4. JSON export/import and installable PWA (application-shell caching only).
5. Real multi-user isolation, cross-device concurrency, and failure-recovery release checks.
