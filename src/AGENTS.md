# Frontend design instructions

Applies to frontend design and UI work throughout `src/`. Inherit the root `AGENTS.md` engineering standards. These rules guide presentation; they do not authorize new product features or data-model changes.

## Design direction

Build a minimal, clear, clean workspace for managing tasks and time. Use white, off-white, and light/dark greys as the base, with compact colour-coded priority badges and optional soft board backgrounds. Create structure through alignment, spacing, typography, and dividing lines. The interface should feel grounded and orderly, with every element serving the work.

- Keep navigation, toolbars, board columns, cards, and calendar grids aligned to a consistent layout.
- Use flat surfaces and thin borders. Avoid floating panels, decorative shadows, gradients, glass effects, oversized rounding, and ornamental backgrounds.
- Keep the main workspace prominent. Use compact, readable controls and restrained headings; reserve generous space for task content.
- Prefer a few meaningful divisions over borders around every nested element. Avoid unnecessary card-within-card containers.
- Use one consistent sans-serif type family with a small, deliberate hierarchy of sizes and weights.
- Improve clarity before adding visual detail. Remove anything that does not help navigation, comprehension, or action.

## Reference interpretation

The supplied kanban references establish visual direction, not functionality or copy to reproduce.

- Reference 1: retain clear column headings, quiet counts, readable task titles, secondary metadata, and compact importance indicators. Improve alignment and reduce redundant enclosing borders and unused space.
- Reference 2: retain the restrained sidebar, subtle surface differences, fine structural dividers, compact controls, and emphasis on the workspace. Use available screen space efficiently.
- The colourful image previews, gradients, and extra navigation destinations in the references are not requirements. GitHub profile avatars and names belong in the sidebar. Add content and controls only when supported by the product scope.
- Aim for a more coherent hierarchy and spacing system than the references, not more decoration.

## Elements of design

| Element      | Application                                                                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Line         | Use thin, consistent dividers to define navigation, headers, workflow columns, and time grids. Lines must explain structure.                                    |
| Shape        | Prefer simple rectangles and modest, consistent corner radii. Reserve pills for compact labels or counts when useful.                                           |
| Form         | Establish grouping through surface tone, borders, and placement. Avoid simulated depth and raised or floating surfaces.                                         |
| Colour       | Keep interface controls neutral in both themes. Use labelled priority colours and the user-selected soft board background; keep text contrast clear.            |
| Texture      | Keep surfaces plain. Do not add noise, patterns, gradients, or decorative imagery.                                                                              |
| Space        | Use a consistent spacing scale. Group related information closely; separate distinct regions clearly. Preserve breathing room without wasting the workspace.    |
| Value (tone) | Use dark text for primary content, legible grey for metadata, and subtle light tones for surfaces. Ensure boundaries and interactive states remain perceivable. |

## Principles of design

| Principle  | Application                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Balance    | Give navigation, controls, and task content appropriate visual weight. Avoid oversized headers or sidebars that crowd the board.           |
| Contrast   | Establish hierarchy through tone, weight, spacing, and borders. Maintain accessible contrast for text, controls, and focus indicators.     |
| Emphasis   | Make task titles, the current view, and the primary action easiest to identify. Keep secondary actions and metadata quieter.               |
| Movement   | Guide reading from navigation to view heading to columns or time slots to individual tasks. Use animation only to explain a state change.  |
| Pattern    | Repeat useful visual conventions, such as metadata placement, column headers, and time-grid markings. Avoid decorative patterns.           |
| Rhythm     | Keep consistent spacing between cards, columns, rows, and controls so scanning feels predictable.                                          |
| Unity      | Use shared typography, spacing, border, surface, icon, and state conventions across boards and calendar views.                             |
| Harmony    | Keep neutral tones and component treatments compatible. Prevent individual controls from introducing unrelated visual styles.              |
| Proportion | Size components according to content and use. Task content deserves more space than chrome; metadata should support the title.             |
| Scale      | Use restrained size differences to establish hierarchy. Keep text readable and touch targets usable at every viewport size.                |
| Repetition | Reuse established component treatments and tokens. The same action or status should look and behave the same everywhere.                   |
| Variety    | Introduce differences only to communicate meaning, such as importance, selection, errors, or completion. Avoid variation for its own sake. |

## Importance and status indicators

- When importance is part of an implemented feature, show a compact, consistent indicator near the task title. Keep its placement stable across cards.
- Prefer clear text such as `High`, `Medium`, and `Low`, optionally paired with a simple icon and restrained semantic colour. Never communicate importance through colour alone.
- Keep indicators subordinate to the task title. Avoid large badges, saturated fills, and competing clusters of chips.
- Keep importance, workflow status, completion, deadlines, and scheduled time visually distinct. Do not infer importance from a due date or treat scheduling as workflow progress.
- Task priority is an authorized feature: none, low, medium, high, and urgent. Use labelled, colour-coded badges and persist the selected tier.

## Layout and interaction

- Start with a shared spacing and surface vocabulary in the existing styling system. Add tokens when they are used; avoid a speculative design-system package.
- Use normal document flow for the application shell. Menus, dialogs, tooltips, and drag previews may overlay content when required by an interaction; keep them restrained and functionally justified.
- Keep essential actions discoverable. Hover-only controls must also appear on keyboard focus and have a usable touch equivalent.
- Provide visible focus, selected, hover, disabled, loading, empty, and error states. Use borders, tone, labels, and small icons consistently.
- Use Lucide icons consistently, usually alongside text. Give icon-only buttons accessible names and adequate targets.
- Keep boards usable on narrow screens through intentional column navigation or contained scrolling. Avoid accidental page-wide horizontal overflow; use the planned agenda and scheduling forms for mobile calendar work.
- Support long titles, wrapped metadata, empty columns, and dense boards without broken alignment or fixed-height clipping.
- Preserve native semantics and keyboard operation. Every drag interaction needs a keyboard or form alternative.
- Honour reduced-motion preferences. Avoid ornamental entrance animations, bouncing elements, and unnecessary movement.

## Review before completing UI work

Inspect the implemented view at desktop and mobile sizes and with keyboard navigation. Verify:

- The main task, current view, and next action are immediately clear.
- Spacing, alignment, dividers, typography, and indicators follow one consistent system.
- Neutral surfaces stay flat and grounded; dark actions and labelled priority colours give meaningful emphasis.
- Text, controls, and focus indicators meet accessibility contrast requirements; colour is never the only cue.
- Realistic long content, empty/loading/error states, and dense content remain usable.
- No decorative chrome, unnecessary overlays, hidden essential actions, or accidental overflow has been introduced.

Run the relevant checks required by the root instructions for implementation changes. For documentation-only changes, formatting and diff review are sufficient. Report what was actually verified.

Cards are draggable across their whole surface; do not add a separate card grab box or visible Edit/Move buttons. Clicking a card opens a centred native modal; Enter opens it from the keyboard, while Space starts dragging. Placement controls belong inside the modal. Keep keyboard dragging for cards and columns. Signed-out users see authentication first; authenticated profiles and sign-out live in the collapsible sidebar.

Board views fill the available screen and use contained horizontal scrolling. Board and column names rename inline; omit duplicate headings, contextual slogans, back links, and column arrow controls. Add-column is a header-height placeholder after the columns. The Boards button opens the home gallery of rectangular previews and a matching create tile. A separate chevron controls the sidebar board list; omit a redundant Overview entry. Support light and dark themes with neutral tokens. Use short, restrained interaction animations, smooth scrolling and proximity snap; nested column scrolling must allow horizontal gestures to reach the board. Never replace native wheel scrolling or override reduced-motion preferences.

Board settings offers a small set of soft backgrounds with a preview and revision-checked persistence. Keep sliders and arbitrary colours out until explicitly needed. Task dragging uses a viewport overlay, a source placeholder, and destination feedback; avoid clipping or changing card dimensions while dragging. Publish optimistic placement synchronously and keep scroll snapping suspended until the drop animation finishes. The due-date picker supports direct date entry, a styled month grid, keyboard navigation, shortcuts, and clearing. It is separate from the scheduling calendar spike.
