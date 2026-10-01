# Optix Toolkit (optixtk)

Internal operational workspace for Team Optix 3749 (~120 members).
React 19 + TanStack Router/Start (SPA) + Vite 8 + Tailwind v4 + TypeScript + Supabase.

## Key info

- **Supabase project ref**: `exvhzdpjuorlzhulnyvl`
- **Supabase CLI**: installed globally, linked. Use `SUPABASE_ACCESS_TOKEN` from `.env`.
- **Run remote SQL**: `SUPABASE_ACCESS_TOKEN=<token> supabase db query --linked "SQL"`
- **GitHub repo**: `Team-Optix-3749/toolkit` (local remote still points to `shouryap4132/optixtk`, GitHub redirects)
- **Deployed**: GitHub Pages at `/toolkit/` — Vite `base` is conditional on `GITHUB_ACTIONS` env var
- **Target URL**: https://tk.team3749.com (not yet configured)
- **PRD**: see pasted PRD in conversation history or `docs/confirmed-decisions.md` (not yet created as a file)

## Stack conventions

- Routes in `src/routes/` use TanStack file-based routing (`_app.` prefix = authenticated layout)
- Shared Tailwind class strings in `src/lib/ui.ts`
- Supabase client in `src/lib/supabase.ts`, auth context in `src/lib/auth.tsx`
- Role hierarchy in `src/lib/rbac.ts`: PENDING → MEMBER → LEADERSHIP → OFFICER → OWNER
- Types in `src/lib/types.ts`, formatting in `src/lib/format.ts`
- Schema reference: `schema.sql` (verified against live DB 2026-09-30)
- Schema inspection: `inspect-schema.sql` (run in Supabase SQL Editor)

## PRD implementation tracker

This is a multi-session effort to bring the app in line with the full PRD.

### Database & core systems
- [x] Seasons table + management (section 15)
- [x] Independent permissions system — 10 granular perms replacing role-only RBAC (section 16.1)
- [x] Tasks table + task groups (section 11)
- [x] Invitations table + reusable invite links (section 16.3)
- [x] Groups table — flat member groups (section 16.5)
- [x] OPI states alignment — change to: Submitted, Changes requested, Resubmitted, Approved, Rejected, Converted to event (section 13)
- [x] Account deactivation/rejection flows in DB (section 16.2)

### Auth & account flows
- [x] Forgot password route `/forgot-password` (section 8)
- [x] Reset password route `/reset-password` (section 8)
- [x] Invitation admission route `/invite` (section 8.3)
- [x] Resend verification route `/resend-verification` (section 8)
- [x] Deactivated/rejected account state pages (section 8.5)

### Dashboard (section 9)
- [x] Show active build checkout prominently (priority 2)
- [x] Show assigned/overdue tasks (priority 3)
- [x] Show tasks awaiting review (priority 4)
- [x] Show upcoming outreach with planned-attendance state (priority 5)
- [x] Remove "Welcome" hero copy — use operational headings

### Team hours (section 10)
- [x] Team-wide sortable table (not just own hours)
- [x] Exact 5 columns: Member name, Outreach hours, Build hours, Outreach-target progress, Build-target progress
- [x] Sorting by any column
- [x] Two decimal places
- [x] Mobile-friendly (stacked rows or scroll)

### Tasks system (section 11) — NEW
- [x] Task CRUD with states: Assigned, In progress, Completed, Cancelled
- [x] Review-required tasks with: Submitted, Changes requested, Resubmitted states
- [x] Task groups (name + color chip)
- [x] Task detail: assignees, reviewers, deadline, evidence (note/link/picture), history
- [x] Evidence upload to private storage
- [x] Task routes: `/tasks`, `/tasks/[id]`
- [x] Dashboard integration

### Outreach (section 12)
- [x] Planned attendance (informational, pre-event) (section 12.2)
- [x] Event leads — assign leads who can manage attendance within event window (section 12.4)
- [x] Event cancellation/restoration with attendance preservation (section 12.1)
- [x] Attendance: arrival, departure, credited time per member/event (section 12.4)

### OPI (section 13)
- [ ] Fix state machine: Submitted → Changes requested → Resubmitted → Approved/Rejected, Converted to event
- [ ] Lock edits while Submitted/Resubmitted
- [ ] Require feedback for Changes requested and Rejected
- [ ] Conversion to outreach event (prefill form, atomic linkage)
- [ ] Preserve submission versions and reviewer feedback

### Build (section 14)
- [ ] QR display restricted to `manage build hours` perm (section 14.2)
- [ ] Rotating QR with short-lived tokens
- [ ] Handle all check-in edge cases: stale token, cancelled session, already checked in, simultaneous session (section 14.3)
- [ ] Idempotent checkout (section 14.4)
- [ ] Auto-close records identification (section 14.4)
- [ ] Build admin corrections (section 14.5)

### Permissions & admin (section 16)
- [ ] 10 independent permissions UI (assign/revoke per user)
- [ ] Permission-aware navigation (show only what user can access)
- [ ] Account approve/reject/deactivate/reactivate (section 16.2)
- [ ] Consequential confirmation dialogs (section 16.2)
- [ ] President-only: create/remove admins, transfer presidency (section 16.4)

### Export (section 17)
- [ ] Attendance CSV with exact columns: Season, Event, Member name, Arrival, Departure, Credited minutes, Attendance status, Event status
- [ ] Build CSV with exact columns: Season, Build location, Build session, Member name, Check-in, Check-out, Credited minutes, Checkout method, Session status
- [ ] Filters: season, member, record type, event, date range
- [ ] ISO 8601 timestamps with UTC offset
- [ ] Restrict to `export records` permission

### Visual system (section 18)
- [ ] Dark "Optix Control" theme as default (Optix Void #06080b background)
- [ ] Tokens: Void, Ink, Surface, Raised surface, Primary text, Muted text, Lime, Cyan, Danger
- [ ] Space Grotesk for headings, IBM Plex Sans for body
- [ ] 8px spacing rhythm

### Responsive & accessibility (sections 21-22)
- [ ] Verify at 390, 768, 1024, 1440, 1920px widths
- [ ] WCAG 2.2 AA compliance
- [ ] Full keyboard operation
- [ ] Semantic HTML (landmarks, headings, tables, labels)
- [ ] Touch targets meet WCAG 2.2
- [ ] Reduced-motion support

### Forms & state handling (sections 19-20)
- [ ] Field-level validation with focusable error summary
- [ ] Preserve input after recoverable failure
- [ ] Confirmation dialogs for destructive actions
- [ ] Define loading/empty/populated/error/not-found states for all surfaces
- [ ] No false success — only confirm after server success
