# Optix Toolkit — revised design review

Design prototype only. Application code, database records and permissions are unchanged. No implementation plan.

Open [index.html](index.html) directly in a browser. The preview starts at Home. Use the role selector to inspect Member, assigned Event lead, Officer with demo grants, or President. Sample-data notice appears once in the shell.

## This revision
The scope is **incremental polish of the current UI**, not a replacement design system. Navigation is restored to the top using the existing two-row glass header pattern. Account links and Reviews are in the header account menu. Page widths, compact mono section headings, labels, ghost buttons, accent buttons and glass cards now follow `src/components/AppShell.tsx`, `src/lib/ui.ts` and `src/styles.css`. The approved attendance, hours, task, profile, Setup and OPI workflows remain. Prototype CSS has been consolidated into one readable set of component rules instead of stacked visual overrides.

Maintainability and cleanup are implementation goals, not completed application changes: reuse existing components/tokens, consolidate repeated UI, preserve behavior and permissions, and avoid introducing a second system. No implementation plan or application refactor has begun.

Current top-navigation captures are in `top-nav-screenshots/`; earlier screenshot folders are superseded for shell/layout review.

| Feedback | Revised interaction |
|---|---|
| Event attendance is clunky | Searchable roster; All / Not arrived / Here / Left filters; direct Arrive / Depart actions; icon refresh and correction controls. |
| One active build session | Session name, location and schedule stay above QR / location choices for both arrival and departure. No session chooser. |
| Guide is unclear | Removed from the product prototype. Docs is reserved in navigation; all Docs content, including build manuals, is yours to design and outside this scope. |
| Hours progress is good; add leaderboard | Season Hours is a main destination, not Personal. Progress stays; a compact leaderboard has separate credited Build and Outreach rankings. Cap detail is secondary. |
| Hide email | Public Team profiles omit email. Account administration hides contact information until deliberately revealed. |
| Account action menu needs work | Compact anchored action menu, with a focused confirmation only for the selected operation. |
| OPI review is good | Existing review layout retained. |
| Remove Scouting | Excluded from the prototype’s navigation, script loading, screen list and current captures. Existing application Scouting is untouched. |
| Setup is repetitive | Groups, Invitations, Season and Task categories use focused views. Select a record to edit it; creation and consequential actions are contextual. |
| Add Global Tasks and icons | Team-wide task scope alongside personal, groups and assigned review; labeled icons for common actions and views. |
| Keep design system | Incumbent Plex/Grotesk type, dark translucent panels, lime accent, familiar radii and light/dark modes. Layout and interaction change, not the brand. |
| Too much filler text | Removed repeated policy explanations, sample warnings and instructions from working screens; retained only necessary labels, state and decision consequences. |

## Review destinations

- `#attendance` — choose Event lead or a manager
- `#checkin` — current build session and QR/location check-in/out
- `#hours` — season progress and leaderboard
- `#team` — individual public profiles
- `#member` — account actions and permissions; President for role/transfer actions
- `#setup` — choose Administrator or President
- `#work-global` — every team task
- `#opi-review` — retained approved layout; manager preview

`revised-screenshots/` contains the current review captures. `screenshots/` and scouting-specific files are historical first-pass artifacts, not current scope. `baseline/` contains the existing application captures.

## Rules unchanged

Task assignments derive from group membership; selected reviewers have narrow authority. Assigned event leads are event-scoped. Independent grants are separate from role titles and cosmetic displayed roles. Purchase approve/reject decisions remain final. Private proofs/receipts remain private. Individual outreach ranking uses official credited hours after the season cap; no unapproved hours or combined Build/Outreach score.

The single-active-session rule and QR/location checkout interaction are confirmed design requirements from this review; this prototype does not modify the current application’s check-in/out implementation.

## Verification

Top-shell polish verification is in `top-navigation-verification.json`: all 62 screen/state views checked at 1440, 768 and 390 px (186 renders), no page-level overflow or unlabelled inspected controls; 24 axe runs across six key screens in light/dark at desktop/mobile returned no violations after the reserved Docs label contrast fix. Header account navigation, Escape/focus return, role-filtered Reviews, direct event arrival and QR-entry/location-exit were exercised. Eighteen current page captures plus a stable viewport comparison are in `top-nav-screenshots/`. Application source remains unchanged.

`revision-verification.json` records the current pass: 62 screen/state views rendered at 1440, 768 and 390 px (186 checks), no page-level horizontal overflow or unlabelled inspected form controls; all four preview roles render without errors or broken screen links. Forty axe runs cover ten changed/retained screens in light/dark at desktop/mobile, with no reported violations. Direct attendance, correction, single-session entry/exit, leaderboard switching, global task filters, account privacy/menu/transfer, invitation creation, group membership, category creation and season save were exercised. Current PNGs are in `revised-screenshots/`; a viewport `diffScreenshot` comparison returned zero changed pixels. These establish prototype behavior only: no real camera/location request, upload, server mutation, authorization enforcement or email delivery is exercised.

The original route audit covered all page families before this narrowed revision. Docs and Scouting are deliberately excluded by your feedback, not missing from the application.
