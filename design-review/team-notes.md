# Team, reviews, and setup

Standalone design proposal only. This slice changes `design-review/team-screens.js` and this note, not application routes, database fields, or authorization rules. The shell identifies sample state once.

## Review surfaces

| Route | Surface |
|---|---|
| `team` | Compact active-member cards, name/group search, own groups, permission-qualified management links. Each card opens its own profile. |
| `profile-maya`, `profile-alex`, `profile-sam`, `profile-devon` | Public member profiles: name, displayed role, grade, biography when supplied, and group membership. No email fields or contact links. Inactive/pending profiles are unavailable. |
| `members` | Filterable active/pending/unverified/inactive accounts. Role and independent grant count stay separate. |
| `member`, `member-alex`, `member-sam` | Active ordinary accounts; contact hidden until an authorized explicit reveal. Account overflow opens one focused form or confirmation at a time. |
| `member-admission`, `member-unverified` | Verified and unverified prospective accounts. Admission requires verification; rejection explains retained-history restriction. |
| `member-inactive` | Reactivation with retained-history and grant consequences. |
| `member-admin` | Officer account with one independent task grant; President-only demotion without an alternate-state disclosure. |
| `setup` | Four task-focused sections: Groups, Invitations, Season, Task categories. Selection/editor replaces repeated accordions and action dropdowns. |
| `reviews`, `individual-review` | Permission-qualified queue and individual-outreach decision evidence. Existing OPI screen is untouched. |
| `reports` | Hours exports, hour summaries, OPI/purchase reports, and President retained-record search. Downloads remain explicitly named sample CSV files. |
| `settings` | President-only organization name, fixed input timezone, positive check-in radius, and contextual successor/operations links. |

## Setup interactions

- **Groups:** select a group in the list, check/uncheck its members in one inline editor, and save. Creation selects the new empty group. Confirmed deletion removes membership, not accounts/history.
- **Invitations:** visible active/revoked list, create dialog with 1/7/30-day expiry, selected link/copy action, and confirmed revocation. Clipboard denial leaves the selected link available. Generated URLs use the reserved `example.test` domain and are explicitly invalid for signup.
- **Season:** select one season, edit name and uniform build/outreach targets plus individual-outreach cap. Create selects the new season without silently making it current; a separate confirmation changes current season. New seasons retain the existing 6-hour cap default. Cap consequences preserve raw approvals and uncapped event attendance.
- **Task categories:** contextual creation/deletion beside the list. Categories in use show status instead of a deletion action; unused newly created categories can be deleted. Review routing links to the task, not a parallel reviewer model.

All these controls mutate in-memory sample state, retained while navigating during the current page load. Refreshing resets it. No network requests or live application mutations occur. Existing domain review/settings forms remain non-mutating design interactions; their messages do not claim live success.

## Authority and privacy

- Member and event-scoped lead have no team-management controls. Direct management routes deny access concisely.
- Officer preview has 12 explicitly assigned operational grants; President has implicit all-permission access. Officer/Leadership role alone never grants all operations.
- Public profiles and directory markup contain no emails. Authorized account details expose contact only in an explicit native dialog; closing it removes revealed details.
- Actual authorization role, cosmetic enumerated displayed role, and independent operational grants are distinct. Demotion retains grants; grant editing is limited to active non-President accounts and the student-administrator preview actors.
- Account managers act on ordinary accounts only. President first demotes an administrator before ordinary-account deactivation becomes available. President-only promotion offers Leadership/Officer, not arbitrary role text.
- Transfer requires an active, verified student target and confirmation. Target becomes President; acting President becomes Officer and loses implicit all-permission access. Independent grant assignments remain unchanged.
- No hard-delete tools for retained historical accounts, no extra backend fields, and no scouting-design links are introduced. The existing `manage_scouting` independent grant remains among all 12 source permissions; its domain UI is outside this proposal.

## Existing source constraints

Source paths are relative to `toolkit/`:

- `src/lib/types.ts` (`AccountActionPayload`, `PERMISSIONS`, `PERMISSION_LABELS`): existing role-change actions and all 12 independent grants, including exact `manage_build_hours` spelling.
- `src/lib/rbac.ts`, `src/components/Guards.tsx`: authorization remains permission-based; event lead does not receive global administration.
- `supabase/migrations/20261030003000_identity_security.sql:191–273`: ordinary-account action restrictions, verified admission, retained-history rejection guard, student-admin grant editing, President-only role changes, transfer and demotion grant retention.
- `src/routes/_app.admin.members.index.tsx`, `_app.admin.members.pending.tsx`, `_app.admin.members.$id.tsx`: directory filters, admissions, account status, independent grants, promotion/demotion/transfer.
- `src/routes/_app.admin.setup.tsx`: season create/edit/current behavior, 6-hour cap default, reusable invitations and expiry/revocation, group membership/deletion, unused task-category deletion.
- `src/routes/_app.profile.tsx` and identity-security migration: displayed role is an enumerated cosmetic choice no higher than authority.
- Existing hours/outreach/OPI/purchase/owner report routes retain original-domain links, raw-versus-counted credit, CSV source columns, retained search, and distinct domain decision lifecycles. No generic cross-domain decision policy is added.
- `src/routes/_app.admin.settings.tsx`, `src/lib/time.ts`: organization name/radius, fixed Los Angeles input timezone, viewer-local saved instants.

## Integration and verification handoff

Uses `window.U` and registers `window.screens`. Delegated `data-team-action` and `data-team-form` handlers own sample account/setup transitions; existing `data-demo-form` handlers remain with the shell for unchanged report/review/settings forms. Native `#team-dialog` provides focus trapping, Escape dismissal, explicit close, and focus restoration. The anchored account menu exposes expanded state and closes on outside click/Escape.

Parent owns navigation and CSS: profile/member routes belong under Team. Styling hooks: `team-profile-grid`, `team-profile-card`, `team-avatar`, `team-menu`, `team-menu-panel`, `team-dialog`, `team-setup-layout`, `team-choice-list`, `team-section-tabs`, `team-contact`.

No build, test, lint, formatter, or browser verification was run in this worker slice. Parent should inspect desktop/tablet/mobile layouts, public contact privacy, keyboard overflow/dialog behavior, role gates, membership save, invitation create/copy/revoke, category create/delete and in-use state, season edit/create/current transitions, and account confirmation outcomes after integration.
