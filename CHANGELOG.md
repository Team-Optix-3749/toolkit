# Changelog

## Unreleased

### Database foundation

- Made ordered Supabase migrations the sole executable schema source; retired competing setup overlays.
- Added localhost-only read-only catalog/data preflight, explicit per-record correction input and a locked atomic local upgrade runner.
- Preserved legacy UUIDs, historical authors, source payloads, recurrence metadata and rounded cache values privately while importing current authoritative participation/OPI tables and exact numeric elapsed credit.
- Added reproducible Node 22 dependencies, local fake Auth/domain seed and serial foundation/legacy/current/both upgrade regressions, including generated-range compatibility.
- Configured local verification/recovery redirects and retained the existing application architecture and visual system.

### Identity and authorization

- Bound protected database, RPC, reporting and Storage access to verified admission and a current Auth-issued session ID.
- Added atomic account/profile actions, independent domain permissions, President-only administrator/Presidency changes and ordinary-account lifecycle management without history deletion.
- Removed client profile provisioning, direct privileged writes, operational purge controls and obsolete permission consumers; public directories omit account authority/contact data and histories retain names.
- Added retryable profile-load failures, identity/authority-scoped page invalidation, nonprivileged member/mentor signup and authenticated private attachment downloads.

### Invitations and recovery

- Replaced invitation-table token access with hashed reusable-token inspection, atomic verified-only redemption and permission-scoped management.
- Preserved invitation continuity across password/provider entry, verification, resend and recovery; distinguished expired links from invalid/revoked links.
- Added durable provider/callback/provisioning errors and corrected recovery session handling without granting admission on authentication alone.

### Time, seasons and settings

- Added exact elapsed-minute calculation and Los Angeles wall-clock conversion with rejected spring gaps and explicit repeated-time selection.
- Preserved date-only deadlines through next Los Angeles midnight, with overdue indicators independent of task status; hour displays use two decimals without rounding official aggregates.
- Added serialized atomic season configuration and current-season switching, uniform targets and separately authorized individual caps.
- Replaced arbitrary organization key editing with validated President-only settings and the fixed America/Los_Angeles policy.

### Outreach and individual credit

- Replaced member geolocation attendance with scoped event-lead/global attendance entry, exact completed intervals and atomic overlap/cancellation/restore enforcement.
- Added complete event editing, lead assignment, pre-start RSVP boundaries, explicit seasons and timestamp-derived event states.
- Migrated individual claims/approvals to exact minutes and dynamic per-member seasonal caps; raw approvals, cap, counted amount and official totals are shown separately.
- Made visual proofs private and immutable after submission, with real authenticated uploads/downloads and cleanup of abandoned uploads.

### Build attendance

- Added session-bound hashed rotating QR tokens, configured-location GPS admission, caller-owned idempotent checkout and actual-timestamp administrative corrections.
- Enforced required session associations, same-location window exclusions, one active member record and exact cross-domain credited/reserved interval checks.
- Removed the browser's fixed school fallback and 180-minute cutoff; shortened sessions, cancellation and explicit cancelled-credit corrections are server transactions.
- Added private minutely auto-checkout at configured session close and explicit scheduler-health reporting, plus geofence/session/attendance editing surfaces.

### Shared tasks

- Replaced writable individual assignments with one owning member group; all current group members are effective assignees while colored categories remain separate.
- Added atomic legal task actions, selected-reviewer decisions, retained submission/evidence references and scoped private work reads.
- Added complete paginated all-group overviews, group filtering, shared calendar data, reassignment controls and configurable image evidence limits.
- Preserved contribution/review authors across membership changes and file removal; removed obsolete assignment callers and group-owned notification dependencies.

### OPI review

- Enforced private immutable submission versions, legal review/reopen states and required change/rejection feedback.
- Added shared validated Google Docs previews with retained-version selection, persistent external links and explicit sharing/sign-in limitations.
- Added read-only prefilled event-conversion drafts and atomic dual-permission conversion through the shared outreach validator; failed or abandoned drafts preserve Approved state.

### Season reporting and exports

- Replaced all-time combined summaries with exact named-member season totals and separate build/outreach targets.
- Added validated Hours category URLs, accessible three-column tabs, exact-value sorting, shared name search and 20-row paging.
- Added permission-scoped half-open record exports with composite keyset pagination, retained names, empty-file headers and formula-safe CSV encoding.

### Retained modules and PWA

- Added atomic purchase submission/pending edits/decisions with independent purchase-review authority and immutable decisions.
- Protected scouting author identity and retained its existing JSON/statistics/assignment model; retired workflow-email template delivery surfaces while keeping in-app notifications.
- Added explicit application/router base-path support and scope-relative static-only service-worker caching; protected navigation/API payloads are never cached and offline navigation shows the offline page.

### Accessibility and shared workspace integration

- Corrected custom-select labeling, active options, scoped keyboard navigation, typeahead and focus restoration; added native consequence dialogs and durable associated mutation feedback.
- Added URL-preserved multi-group Calendar/Kanban/List tasks, explicit empty selection, list-only group destinations and complete mobile Groups navigation.
- Removed hidden mobile-drawer focusability; verified 390px Hours/workspace surfaces with no whole-document overflow and no axe violations in exercised states.
- Added real authenticated attachment fixture seeding and permanent Chromium/mobile/WebKit workflow checks; Firefox launch is currently blocked by the local browser runtime's missing-profile error.
