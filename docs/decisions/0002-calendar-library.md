# 0002 — FullCalendar Standard for the timetable

Status: accepted for scheduling implementation; production integration is separate

Date: 2026-10-09

## Decision

Use FullCalendar Standard. The version validated by this spike is **7.1.1**, with React 19.2.8 and temporal-polyfill 1.0.1. Use the React timegrid, list, interaction, and classic theme subpath exports. Pin these versions when integrating; do not copy v6 package imports or assume v6 has v7's named-timezone behavior.

The [spike report](../spikes/calendar/README.md) records the comparison, browser observations, bundle measurements, limitations, and reproduction steps. Its fixture is research material, not another deployable application, and does not import application code, call Supabase, or modify root dependencies.

## Reasons

- Daily/weekly time grids, external task placement, session movement, and duration resizing passed browser checks.
- The list view supports a phone-width agenda; native scheduling controls supply alternatives to every drag operation.
- Named-zone rendering correctly handled Dublin's spring change and preserved distinct UTC instants during its autumn repeated hour. Temporal allows the scheduling form to reject missing or ambiguous wall times.
- The required standard functionality is MIT licensed. No resource views or Premium scheduler package is required. Preserve upstream copyright and license notices. See [FullCalendar licensing](https://fullcalendar.io/license).
- The isolated feature added approximately 95.1 KiB gzip JavaScript and 3.8 KiB gzip CSS over a React-only baseline. Lazy-load the timetable when integrating.

## Implementation conditions

Scheduling changes only session times; it must never move a card or change completion. Events identify a scheduled session, with the card ID held separately, so one card can have multiple sessions. Removing a session retains its card. Completion remains derived from the card.

Store offset-bearing UTC instants, never bare local datetime strings. Use the selected IANA timezone for display and form conversion. Reject DST gaps; either reject a repeated wall time or explicitly offer its two offsets before saving. The standard grid gives both repeated-hour occurrences the same wall-time position and label: show offsets in session details and accessible names. Date-only deadlines stay date-only, rendered separately from timed sessions.

Keep labeled native create/edit/remove controls and an agenda available to keyboard and touch users. Tabbable events are not a keyboard drag implementation. Announce successful changes and failures, and restore focus after editing. A week grid at phone width is an optional secondary view; default to agenda and forms.

Keep server state authoritative. A failed move/resize must revert, an external drop must remove its temporary event on failure, and stale revisions must preserve the draft and refresh authoritative sessions. Implement these in the existing feature/domain/infrastructure boundaries, using the scheduling API's ownership and revision checks. The spike does not validate persistence or conflict recovery.

## Alternatives and limits

React Big Calendar 1.20.0 is also MIT and documents day/week/agenda views and an external-drag addon. It requires a date localizer; selected-zone conversion and DST handling would need additional validation. Schedule-X 4.9.1 documents the required display views, but its current drag/resize plugins require a Premium license. These alternatives received documentation review, not full browser or bundle trials; no performance ranking is inferred.

FullCalendar v7 is a recent major release. The fixture passed Chromium grid, pointer, keyboard, and phone-width agenda/form checks. A Chromium CDP long-press simulation did not emit a move callback; touch dragging remains unverified, rather than a confirmed library defect. Physical iOS/Android testing and screen-reader review remain release checks. No claim of full accessibility conformance is made. Existing v6 integrations must migrate and rerun interaction/timezone tests before being treated as covered by this decision.
