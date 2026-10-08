# Ergon

Private kanban task management and calendar planning. Tasks and scheduled work share one data model; deadlines and reserved work time remain distinct.

**Status:** foundation implemented. Includes a React/TypeScript application shell, persistent GitHub OAuth integration, owner-scoped board listing, PostgreSQL schema/RLS, automated isolation tests, and CI. Board editing, calendar interactions, JSON portability, and PWA support follow in later phases. The app shows a setup state until Supabase is configured.

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
npm run test:e2e     # Production-build smoke tests on desktop and mobile
npm run db:types     # Regenerate scalar table types from SQL migrations
```

Database tests execute the actual migration in PGlite (PostgreSQL compiled to WASM); only Supabase's identity plumbing is substituted. Docker is not required for these tests. They verify RLS, anonymous denial, cross-owner and cross-board foreign keys, date/session constraints, version conflicts, completion history, and cascading deletion. They do not substitute for live OAuth and full Supabase integration verification.

The local type generator produces scalar CRUD types. Before adding joined queries, replace it with the official `supabase gen types typescript --local` generator, which also emits relationship metadata.

## Structure

```text
src/
  app/                 Composition and styles
  features/auth/       Session lifecycle and authentication UI
  features/boards/     Board query and read-only workspace
  domain/              Pure rules, added with their consumers
  lib/                 Supabase client, environment and generated types
  test/                Test setup
supabase/
  migrations/          Versioned schema and ownership policies
  tests/               PostgreSQL security/invariant tests
tests/e2e/             Browser checks
scripts/               Database type generation
docs/                  Product scope, architecture, deployment and decisions
.github/workflows/     Quality gates
```

See [project overview](docs/project-overview.md), [architecture](docs/architecture.md), [deployment](docs/deployment.md), and [agent instructions](AGENTS.md).

## Next milestones

1. Board/column/card CRUD, accessible movement, and transactional reorder RPCs.
2. Calendar library spike, session CRUD, daily/weekly grids, and timezone/DST tests.
3. Search, filters, deadlines, overlaps, and mobile agenda/forms.
4. JSON export/import and installable PWA (application-shell caching only).
5. Real multi-user isolation, cross-device concurrency, and failure-recovery release checks.
