# Calendar implementation spike

Run date: 2026-10-09. Decision: [0002 — FullCalendar Standard](../../decisions/0002-calendar-library.md).

## Scope and success criteria

Evaluate the timetable requirements in `docs/project-overview.md` and decision 0001 before production adoption: daily/weekly grids, external task dragging, movement/resizing, mobile behavior, keyboard alternatives, selected-zone/DST handling, bundle cost, and licensing. Use synthetic cards and sessions; no backend writes or app navigation changes.

A candidate passes when its grid interactions emit usable session instants and card references, all pointer operations have a native form alternative, the mobile agenda fits a phone viewport, UTC values survive timezone changes, deadlines stay date-only, and the required feature licenses are compatible. Document remaining limitations instead of treating a prototype as a release test.

## Candidates

Versions checked against npm metadata on the run date. “Documented” means upstream capability review; only FullCalendar received an executable prototype.

| Criterion              | FullCalendar Standard 7.1.1                                   | React Big Calendar 1.20.0                        | Schedule-X 4.9.1                                                             |
| ---------------------- | ------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------- |
| Day/week grid          | Tested                                                        | Documented                                       | Documented                                                                   |
| External task dragging | Tested, interaction `Draggable` + `eventReceive`              | Official outside-source example, DnD addon       | Not established by reviewed core docs; not tested                            |
| Move/resize            | Tested callbacks, with UTC observations                       | Documented DnD addon                             | Premium plugins                                                              |
| Mobile                 | Tested list agenda and forms; emulated touch movement         | Agenda documented; app layout/forms needed       | Responsive views documented; app forms needed                                |
| Keyboard alternative   | Event activation and native create/edit/remove form tested    | App forms required; not tested                   | App forms required; not tested                                               |
| Selected timezone      | Built-in named-zone support + Temporal form conversion tested | Requires localizer and zone strategy; not tested | Temporal/timezone support documented; not tested                             |
| Production bundle      | Measured below                                                | Not measured                                     | Not measured                                                                 |
| License                | Standard/core/React and Temporal MIT; preserve notices        | MIT; preserve notices                            | Open-source calendar MIT; current interaction plugins require a paid license |

Choose FullCalendar Standard because the required interactions and named-zone behavior passed the prototype without a commercial interaction dependency. Do not select it on an unmeasured claim that it is the smallest candidate.

Primary sources reviewed:

- [FullCalendar React setup and v7 subpath imports](https://fullcalendar.io/docs/react), [external dragging](https://fullcalendar.io/docs/external-dragging), and [move/resize callbacks](https://fullcalendar.io/docs/event-dragging-resizing).
- [FullCalendar timezone semantics](https://fullcalendar.io/docs/timeZone), [accessibility options](https://fullcalendar.io/docs/accessibility), [touch behavior](https://fullcalendar.io/docs/touch), and [Standard versus Premium licensing](https://fullcalendar.io/license). Inspected installed `@fullcalendar/react` and `@fullcalendar/core` 7.1.1 license files, plus temporal-polyfill 1.0.1 package metadata: MIT.
- [React Big Calendar README and localizers](https://github.com/bigcalendar/react-big-calendar), [outside-source dragging example](https://github.com/bigcalendar/react-big-calendar/blob/master/stories/demos/exampleCode/dndOutsideSource.js), [Luxon localizer](https://github.com/bigcalendar/react-big-calendar/blob/master/src/localizers/luxon.js), and [MIT license](https://github.com/bigcalendar/react-big-calendar/blob/master/LICENSE).
- [Schedule-X documentation](https://schedule-x.dev/docs/calendar), [v4 license split](https://schedule-x.dev/blog/schedule-x-v4), and [Premium drag-and-drop plugin](https://schedule-x.dev/docs/calendar/plugins/drag-and-drop). Do not use unsupported pre-v4 interaction packages to bypass the current licensing decision.

## Executed observations

Browser: Playwright CLI Chromium, desktop 1280 × 720 and phone viewport 390 × 844. React StrictMode enabled. Fixture uses the classic theme, 30-minute slots, and a 600-pixel calendar. The form intentionally stays visible for inspecting alternatives, rather than implementing production dialogs.

| Check                     | Observation                                                                                                                                                                 | Result                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Daily/weekly grid         | Switching views yielded 1 and 7 date column headers respectively; the same session rendered in both                                                                         | Pass                                                |
| External drop             | Real mouse drag placed Research on Tuesday 2026-10-20 at 11:30 Dublin for one hour; callback retained `cardId: card-2`                                                      | Pass                                                |
| Resize end                | Dragging Proposal's bottom edge extended its one-hour duration to two hours; `eventResize` fired                                                                            | Pass                                                |
| Move session              | Real mouse drag moved the resized Proposal to 11:00–13:00 Dublin; observed UTC start/end `2026-10-19T10:00:00.000Z` / `2026-10-19T12:00:00.000Z`; `cardId: card-1` retained | Pass                                                |
| Keyboard event activation | Enter activated the focusable Proposal event and selected its session for editing                                                                                           | Pass                                                |
| Keyboard/form alternative | Native labeled inputs and selects plus Enter submission created a session, changed start and duration, and removed it; status announced results                             | Pass                                                |
| Mobile agenda             | Initial phone view was listWeek; document width and viewport were both 390 px, with no horizontal overflow; controls remained visible and usable                            | Pass                                                |
| Mobile form               | Scheduling 10:00 Dublin for 90 minutes produced `09:00Z`–`10:30Z`; agenda updated                                                                                           | Pass                                                |
| Emulated touch            | CDP touch emulation with a 1.2-second long press did not emit `eventDrop`; this does not establish physical-device behavior                                                 | Inconclusive; native agenda/form alternative passed |
| Zone switch               | Initial Proposal `08:00Z` displayed 09:00 Dublin; moved `10:00Z` displayed 06:00 New York. Changing display zone left session instants unchanged                            | Pass                                                |
| Spring DST                | Dublin 2026-03-29: `00:30Z` rendered 00:30 and `01:30Z` rendered 02:30                                                                                                      | Pass                                                |
| Autumn DST                | Dublin 2026-10-25: `00:30Z` and `01:30Z` both rendered 01:30 and retained different instants                                                                                | Pass with repeated-hour display limitation          |
| DST input                 | The form rejected Dublin 2026-03-29 01:30 (missing) and 2026-10-25 01:30 (ambiguous), using Temporal `disambiguation: reject`                                               | Pass                                                |
| Deadline                  | `2026-10-23` remained a date-only all-day marker on October 23 after changing to New York                                                                                   | Pass                                                |

Pointer callbacks are normalized with `Date.toISOString()` in the fixture. FullCalendar's `toPlainObject()` may emit an offset-bearing local string; its offset must not be stripped. Application persistence should receive UTC instants explicitly.

The autumn grid places both repeated-hour occurrences together and displays the same wall-time label. It is not an elapsed-time axis. Use UTC intervals for duration and overlap calculations; two sessions occupying the same apparent wall slot need not overlap in actual time. Show the offset in details/accessible labels and use the form for ambiguous-hour edits. This is the main timezone UX limitation found.

Mobile uses an agenda and form because narrow seven-column time grids are difficult to target. The library supports long-press dragging, but simulated Chromium touch cannot establish Safari behavior, scroll ergonomics, or physical-device usability. Keep real iOS/Android and screen-reader checks on the scheduling release checklist. No automatic accessibility audit or conformance claim is included.

## Bundle measurement

Pinned fixture lockfile, Node 22.22.2, Vite 8.3.0 production defaults. `measure.mjs` builds the fixture and a React-only heading baseline under identical settings, sums emitted JS/CSS asset bytes, then gzip-compresses each asset with Node's default gzip settings. HTML, dev-server code, source maps, and dependency download sizes are excluded. This is a prototype estimate, not the final application's chunk size or load time.

| Build               | JS bytes | JS gzip bytes | CSS bytes | CSS gzip bytes |
| ------------------- | -------: | ------------: | --------: | -------------: |
| React-only baseline |  190,253 |        59,238 |         0 |              0 |
| Calendar + fixture  |  541,744 |       156,646 |    17,088 |          3,928 |
| Increment           |  351,491 |        97,408 |    17,088 |          3,928 |

Increment: **95.1 KiB gzip JS + 3.8 KiB gzip CSS**. Includes the test form, fixture data, and Temporal conversion logic. React is already shipped by Ergon. Load the timetable on demand; avoid all-plugins/all-locales imports and do not add Premium resource plugins for this scope. Remeasure the production route after integration.

## Reproduce

The fixture is not part of the root application's build or dependency graph. Copy it to a temporary directory to keep research installations separate:

```sh
spike_dir=$(mktemp -d /tmp/ergon-calendar-spike.XXXXXX)
cp docs/spikes/calendar/{package.json,package-lock.json,index.html,main.jsx,style.css,measure.mjs} "$spike_dir/"
cd "$spike_dir"
# Use Node 22.12–22.x, matching the root application's engine requirement.
npm ci --ignore-scripts --no-audit --no-fund
npm run measure
npm run dev
```

Open `http://127.0.0.1:4180`. Reset the page between cases. Observe callback messages and the UTC observations block.

1. Switch Day/Week; verify one/seven dates and the Proposal session. Drag Research from the external panel onto Tuesday at 11:30; verify one-hour duration and card-2 association.
2. Resize Proposal from 09:00–10:00 to 09:00–11:00, then move it to 11:00–13:00; verify UTC values and retained card-1 association. Every event has its own session ID.
3. Tab to a session and press Enter. Use the Session selector and labeled Local start/Minutes fields to create, edit and remove a session with keyboard controls. Verify the external source card remains available. Multiple new sessions may refer to the same card.
4. Change Timezone through Dublin, New York and UTC. Confirm existing instants do not change and the October 23 deadline does not shift. Use Spring DST/Fall DST buttons for the fixture instants above. Enter both invalid Dublin wall times in the form and confirm rejection.
5. Reload at 390 × 844; confirm agenda is initial view, no horizontal overflow, Enter activates sessions, and forms update the agenda. Switch to Day and long-press a session before moving it on a touch device. Also check scrolling without starting an unwanted drag.
6. Rerun root `npm run check` and `npm run test:e2e` after integration. Exercise real server failures, revision conflicts, and timezone changes there; these are outside this fixture.

## Repository verification

Spike production build and scoped formatting checks passed. Scoped Oxlint reported only the fixture entrypoint's Fast Refresh warning (the component and root render share a research file); no lint errors.

At the initial verification point, root `npm run check` stopped on formatting issues in concurrently edited files. Root `npm run test:e2e` could not start its web server because the ongoing timetable/calendar-experience code imported scheduling exports that did not exist at that point (`Session`, `interval`, `localInput`). These are separate changes; the spike did not repair or overwrite them.

The final root `npm run check` attempt stopped on formatting in `.portability-playwright.config.ts`. The final `npm run test:e2e` attempt still could not start its build/web server. A direct `npm run build` exposed in-progress integration errors: missing `@fullcalendar/luxon3`, `cardLabels` versus `card_labels` on `SchedulingSnapshot`, and an unresolved generated database-types import. The isolated spike builds successfully; repository-wide checks must be rerun once those concurrent changes stabilize.
