Build a lightweight, authenticated application that combines **kanban task management with calendar-based planning**. Users organise tasks into private boards, track progress through customisable columns, and schedule those same tasks in a timetable.

The application is hosted on the web, supports desktop and mobile browsers, and is installable as a Progressive Web App (PWA). Data persists centrally and is accessible across devices.

## Core Scope

| Area           | Capabilities                                                           |
| -------------- | ---------------------------------------------------------------------- |
| Authentication | GitHub OAuth, persistent sessions, logout                              |
| Boards         | Create, edit, archive, and delete boards                               |
| Columns        | Customizable workflow stages and ordering                              |
| Cards          | Titles, descriptions, priority tiers, labels, due dates, and archiving |
| Organization   | Drag-and-drop movement, search, and filtering                          |
| Timetable      | Daily and weekly calendar views for scheduled tasks                    |
| Portability    | JSON export/import and PWA installation                                |
| Accessibility  | Responsive layouts, keyboard controls, and alternatives to dragging    |

## Timetable and Calendar

The timetable is **another view of the same cards**, rather than a separate collection of events. A card’s workflow status and scheduled time are independent: scheduling a task does not move it into “In Progress.”

The calendar includes an **unscheduled-task panel** where users can select cards from their boards and place them into time slots.

Key interactions:

- Drag a card onto the calendar to create a scheduled work session.
- Move or resize a session to change its start time or duration.
- Open a session to edit the underlying card or its scheduling details.
- Remove a session without deleting the card.
- Schedule multiple sessions for one card when work spans several days.
- Filter the timetable by board, label, or completion status.

**Due dates and scheduled sessions serve different purposes.** A due date represents a deadline; a session reserves time to work on the task. Due dates appear as deadline markers, while sessions occupy time slots.

For example, “Prepare proposal” could be due Friday and have work sessions scheduled for Tuesday morning and Thursday afternoon. Both sessions reference the same card.

The first version should support daily and weekly views, visible overlap warnings, and timezone-aware scheduling. On mobile, provide an agenda view and a scheduling form alongside drag-and-drop interactions. Completing a card marks its sessions as completed while preserving their history.

## Technology Stack

| Layer               | Technology                                    | Responsibility                                  |
| ------------------- | --------------------------------------------- | ----------------------------------------------- |
| Application         | React, TypeScript, Vite                       | Frontend and build tooling                      |
| Interface           | Tailwind CSS, Lucide                          | Styling and icons                               |
| Kanban interactions | dnd-kit                                       | Card and column movement                        |
| Calendar            | Established React-compatible calendar library | Time-grid rendering and scheduling interactions |
| Server state        | TanStack Query                                | Fetching, caching, optimistic updates           |
| Authentication      | Supabase Auth                                 | OAuth and session management                    |
| Database            | Supabase PostgreSQL                           | Persistent application data                     |
| API                 | Supabase PostgREST and database RPC           | CRUD and transactional operations               |
| Authorization       | PostgreSQL row-level security                 | Ownership and access enforcement                |
| Hosting             | Vercel                                        | Deployment and HTTPS delivery                   |
| PWA                 | Web manifest, service worker                  | Installation and application-shell caching      |
| Testing             | Vitest, Playwright                            | Logic, integration, and browser verification    |

Select the calendar library during a small implementation spike, validating time-grid support, external task dragging, resizing, mobile behavior, accessibility, and licensing.

## Architecture and Data

The React application communicates with Supabase through its client SDK. PostgreSQL is the source of truth, and row-level security enforces ownership for every entity. A separate NestJS or FastAPI service is unnecessary for the initial scope.

Keep presentation, domain operations, and data access separate. Use database functions for atomic operations such as card reordering, and introduce server functions when integrations or privileged operations require them.

The main entities are:

- `boards`, `columns`, `cards`
- `labels`, `card_labels`
- `scheduled_sessions`, referencing a card with a start and end timestamp
- `user_preferences`, including timezone and calendar settings

Use versioned SQL migrations, foreign keys, and database constraints. Store session timestamps as UTC instants and display them in the selected timezone. Preserve date-only deadlines as dates.

Use optimistic updates with rollback on failed writes. Define conflict handling for edits from multiple devices, and refresh data when the application regains focus.

## Implementation Plan

1. **Foundation:** Scaffold the application, establish deployment, configure authentication, and implement the schema and ownership policies.
2. **Kanban workflow:** Build board, column, and card management with persistent ordering and transactional movement.
3. **Scheduling:** Validate the calendar library, add scheduled sessions, and implement daily/weekly views, task placement, movement, and resizing.
4. **Product experience:** Add search, filtering, deadline markers, overlap warnings, mobile agenda, and accessible controls.
5. **Portability:** Implement export/import and PWA installation.
6. **Release verification:** Test user isolation, cross-device persistence, scheduling across timezone and daylight-saving changes, concurrent edits, and failed-write recovery.

## Potential Extensions

These are optional directions after the core workflow is reliable:

| Feature                    | What It Adds                                                       |
| -------------------------- | ------------------------------------------------------------------ |
| **Daily planning**         | Select today’s priorities and arrange them around available time   |
| **Capacity planning**      | Compare scheduled workload against configurable working hours      |
| **Recurring tasks**        | Generate repeated tasks and sessions for routines                  |
| **Focus mode**             | Open a scheduled task in a distraction-free view with a timer      |
| **Estimate versus actual** | Compare planned duration with recorded work time                   |
| **Dependencies**           | Identify blocked cards and prerequisites                           |
| **Calendar integration**   | Export sessions or synchronize with external calendars             |
| **Planning suggestions**   | Suggest available slots based on duration, priority, and deadlines |
| **Board templates**        | Reuse workflows and task structures                                |
| **Offline editing**        | Queue changes locally and reconcile them when connectivity returns |

The strongest early additions would be **daily planning, capacity indicators, and focus mode**: they connect the board to how you actually spend your time.
