# Ergon

**Organise tasks. Plan your time.**

A private kanban workspace with calendar planning. Deadlines, scheduled work, and task completion stay independent.

## Features

- **Boards:** custom columns, draggable tasks, priorities, labels, search, filters, and archives.
- **Planning:** daily/weekly calendars, mobile agenda, multiple sessions per task, timezone preferences, and overlap warnings.
- **Sharing:** revocable viewer links and signed-in link editing.
- **Portability:** validated JSON backups and imports that create copies.
- **Interface:** light/dark themes, board backgrounds, keyboard sorting, and scheduling/placement forms.

**Status:** core web workflows are implemented. PWA installation and the original unscheduled-task drag-to-calendar flow remain incomplete. Hosted acceptance and device/accessibility verification are release gates. See the [final review](docs/final-review.md).

## Run locally

Requires **Node 22** and a Supabase project.

```sh
npm ci
cp .env.example .env.local
# Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.
npm run dev
```

Apply the [database migrations](docs/migrations.md) and configure [GitHub OAuth](docs/deployment.md) before signing in. Frontend environment variables are public; keep service-role keys and OAuth secrets out of them.

## Verify

```sh
npm run check                    # Formatting, lint, types, unit/database tests, build
npx playwright install chromium
npm run test:e2e                 # Desktop and mobile browser workflows
npm run db:types                 # Regenerate types after schema changes
npm run test:live                # Hosted integration; requires Supabase CLI login
```

Database tests run migrations in PGlite without Docker. Browser tests use a simulated backend. The hosted check creates and removes temporary users/data; real GitHub OAuth and production acceptance require separate verification.

## Project map

React · strict TypeScript · Vite · Supabase · TanStack Query · dnd-kit · FullCalendar.

| Location                  | Purpose                                                 |
| ------------------------- | ------------------------------------------------------- |
| `src/app`, `src/features` | Application shell and feature UI                        |
| `src/domain`, `src/lib`   | Pure rules, data access infrastructure, generated types |
| `supabase`                | Versioned migrations and isolation tests                |
| `tests/e2e`               | Browser workflows and recovery checks                   |

[Scope](docs/project-overview.md) · [Architecture](docs/architecture.md) · [Deployment](docs/deployment.md) · [JSON format](docs/json-portability.md) · [Final review](docs/final-review.md)
