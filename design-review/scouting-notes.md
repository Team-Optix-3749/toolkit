# Scouting screen review notes

Design review only. `scouting-screens.js` renders sample HTML through the shared prototype shell; it never calls Supabase or mutates application files. Source inspection is not runtime verification. No build, test, formatter, or browser check was run in this slice.

## Routes and capabilities

| Prototype screen | Existing route / evidence | Review coverage |
|---|---|---|
| `scouting` | `src/routes/_app.scouting.index.tsx`; `src/lib/useScoutEvents.ts` | Select an event without activating it; active-event context; match/pit/team counts; own assignments; next match and station; start an entry; reopen own earlier entry; contextual manager link. |
| `scout-match` | `src/routes/_app.scouting.match.tsx`; `MATCH_SECTIONS` in `src/lib/scouting.ts` | Match type/number/team/alliance; scheduled robot selection; autonomous, teleop, endgame and performance sections; notes; own entry update; visible sample-submit confirmation. Sequential native details with Back/Next retain all controls in the same form. |
| `scout-pit` | `src/routes/_app.scouting.pit.tsx`; `PIT_SECTIONS` | Team selection; robot specification; stated capabilities; planned autonomous path; notes; own existing report update without replacing another scout’s report. |
| `scout-teams` | `src/routes/_app.scouting.teams.index.tsx`; `teamStats` | Event selection; team-number substring filter; sortable numeric columns for all existing metrics; horizontal small-screen table; raw CSV sample download. |
| `scout-team` | `src/routes/_app.scouting.teams.$team.tsx` | All existing summary metrics, observed paths with selected-run focus or overlay, planned pit path, separate pit reports, complete match-field history and notes, own-report edit, own-or-manager match-report deletion confirmation. |
| `scout-manage` | `src/routes/_app.scouting.manage.tsx`; `parseSchedule` | Contextual permission gate; active event; event creation fields; make active; schedule import type and exact seven-number parser preview; station assignment; round-robin pool explanation and a sample empty-station fill; clear-assignment confirmation; exact-name event deletion confirmation. |

All navigation stays within these routes and the shared shell. No additional top-level navigation destination or President console is introduced.

## Preserved fields and record identities

- Match identity: `event_id, match_type, match_number, team_number, scout_id`. Alliance is report metadata, not an identity key. Match types remain `pm`, `qm`, `sf`, `f`.
- Match JSON fields: `auto_path`, `auto_leave`, `auto_scored`, `auto_missed`, `tele_scored`, `tele_missed`, `tele_pickups`, `endgame`, `driver`, `defense`, `fouls`, `died`, `tipped`. Notes remain separate. Endgame values remain none/park/low/high/failed; ratings remain 1–5 or unrated.
- Pit identity: `event_id, team_number, scout_id`.
- Pit JSON fields: `drivetrain`, `weight` (lb), `speed` (ft/s), `mechanisms`, `auto_routines`, `planned_auto`, `endgame`, `plays_defense`, `start_position`. Pit endgame does not offer failed attempt.
- Scheduled match identity: `event_id, match_type, match_number`. Import updates this identity rather than inventing match integration. The real parser accepts a row with exactly seven extracted numbers; this prototype intentionally mirrors that behavior instead of adding an undocumented mapping or validation layer.
- Assignment identity: `match_id, station`, where station is red1/red2/red3/blue1/blue2/blue3.
- Path shape remains normalized stroke coordinates (`number[][][]`), red on the left, with the incumbent mirror convention for blue observed paths.
- Summary values are per scouting report, not official game scores; duplicates from distinct scouts remain distinct reports. Climb means low or high. CSV uses the source export’s current field keys and raw-record structure, including JSON-serialized path data.

## Permission preview

The prototype’s admin persona stands for an account with `manage_scouting`; President has implicit authority. Member and assigned outreach event-lead personas do not see management tools and direct navigation renders an access explanation. A displayed leadership label alone must not imply the grant. Own report edit and own-or-manager match deletion follow the existing detail route. Other scouts’ reports remain separate and read-only to members. No new pit-report delete permission or event-scoped scouting administrator role is introduced.

## Interactions and integration hooks

No shell modal IDs are required. Specialist controls use native `details`/`summary`; confirmations are inline forms to keep their target record visible.

- `data-demo-form`: shared-shell sample notices; match and pit forms additionally show a persistent inline `role=status` confirmation with current identity.
- `data-scout-record`, `data-scout-team`, `data-scout-robot`: select sample report/team context before route navigation.
- `data-scout-event`: update in-memory selected event and rerender via `window.renderPrototype()` when available; selection is visibly labeled. It does not activate the event.
- `data-scout-step-to`: Back/Next between native expandable form sections; summary receives focus.
- `data-path-*`: pointer drawing, numerical X/Y keyboard alternative, new stroke, undo and clear; hidden field holds normalized JSON. The path status announces point/stroke counts.
- `data-scout-path-focus`: switch the observed run or show an overlay; pressed state and text caption change.
- `data-scout-filter`, `data-scout-sort`: team-number filtering and numeric sorting; sorting sets `aria-sort`.
- `data-scout-export`: real local download of three clearly named SAMPLE records, not a production export.
- `data-scout-import-preview`: source-equivalent seven-number row preview and line-specific errors. Invalid preview prevents the shared submit-success notice.
- Match-report deletion removes that sample report from the current DOM only. Exact-name event confirmation rejects a mismatch before the generic form success notice.

## Limits and source corrections

The initial delegated description over-attributed capabilities to the current application. Following the parent’s source-grounded correction, the review does **not** add schema-version selection, dynamic custom-field editing/analytics, form templates, intake mapping, column-mapping import, a schedule download template, or a comparison workspace: none is present in the inspected scouting routes/library. The existing forms are configuration-driven in source, but the current form configurations and fields are fixed. Renaming existing JSON keys would orphan historical values, as noted in `scouting.ts`; the design does not rename them.

The prototype intentionally does not claim offline drafts/sync, automatic match integration, live schedule/coverage, official rankings, production exports, server authorization enforcement, persistence or backend validation. Changing the event updates visible context but retains the same explicitly illustrative dataset. The field drawing is schematic rather than a game field. The assignment pool interaction demonstrates filling the sample Q13 empty station, not the entire event’s real round-robin transaction. Event creation/activation/deletion and clearing assignments demonstrate the review forms and confirmations through sample notices, not a persistent data model. After leaving a screen, transient edits can reset.

All seeded competition values are examples, not claims about a real season’s game or a real robot’s performance. The next integration review should exercise desktop/mobile details, focus transitions, event context, own-versus-manager controls, pointer/keyboard paths, filters/sorts, import errors, submit confirmation and local CSV download in the parent’s shared shell.
