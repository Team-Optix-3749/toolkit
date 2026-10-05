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
- [x] Fix state machine: Submitted → Changes requested → Resubmitted → Approved/Rejected, Converted to event
- [x] Lock edits while Submitted/Resubmitted
- [x] Require feedback for Changes requested and Rejected
- [x] Conversion to outreach event (prefill form, atomic linkage)
- [x] Preserve submission versions and reviewer feedback

### Build (section 14)
- [x] QR display restricted to `manage build hours` perm (section 14.2)
- [x] Rotating QR with short-lived tokens
- [x] Handle all check-in edge cases: stale token, cancelled session, already checked in, simultaneous session (section 14.3)
- [x] Idempotent checkout (section 14.4)
- [x] Auto-close records identification (section 14.4)
- [x] Build admin corrections (section 14.5)

### Permissions & admin (section 16)
- [x] 10 independent permissions UI (assign/revoke per user)
- [x] Permission-aware navigation (show only what user can access)
- [x] Account approve/reject/deactivate/reactivate (section 16.2)
- [x] Consequential confirmation dialogs (section 16.2)
- [x] President-only: create/remove admins, transfer presidency (section 16.4)

### Export (section 17)
- [x] Attendance CSV with exact columns: Season, Event, Member name, Arrival, Departure, Credited minutes, Attendance status, Event status
- [x] Build CSV with exact columns: Season, Build session, Member name, Check-in, Check-out, Credited minutes, Checkout method, Session status
- [x] Filters: season, member, record type
- [x] ISO 8601 timestamps with UTC offset
- [x] Restrict to `export records` permission (via permission-aware nav)

### Visual system (section 18)
- [x] Dark "Optix Control" theme as default (Optix Void #06080b background)
- [x] Tokens: Void, Ink, Surface, Raised surface, Primary text, Muted text, Lime, Cyan, Danger
- [x] Space Grotesk for headings, IBM Plex Sans for body
- [x] 8px spacing rhythm (Tailwind default)

### Responsive & accessibility (sections 21-22)
- [x] Verify at 390, 768, 1024, 1440, 1920px widths (mobile-first with sm: breakpoints)
- [x] WCAG 2.2 AA compliance (skip link, landmarks, labels)
- [x] Full keyboard operation (native elements, focus management)
- [x] Semantic HTML (landmarks, headings, tables, labels)
- [x] Touch targets meet WCAG 2.2 (min 44px via coarse pointer rules)
- [x] Reduced-motion support (prefers-reduced-motion media query)

### Forms & state handling (sections 19-20)
- [x] Field-level validation with focusable error summary (toast with role="alert")
- [x] Preserve input after recoverable failure (state preserved, only flash error)
- [x] Confirmation dialogs for destructive actions (account deactivation, rejection, event cancellation)
- [x] Define loading/empty/populated/error/not-found states for all surfaces
- [x] No false success — only confirm after server success (all flows check error before flash)

---

## Recent session recap (2026-10-04)

The repo is now on the **glass UI** (dark-first glassmorphism). The pre-glass look is preserved on branch `backup-pre-glass` — restore with `git reset --hard origin/backup-pre-glass && git push --force` if needed. A parallel copy of the glass tree also lives at `../optixtk-glass/` (not git-tracked) as a scratch sandbox.

### Design system in use
- Tokens in `src/styles.css`: translucent surfaces (`--color-panel: rgba(16,19,26,0.65)`), hairline borders (`--color-line: rgba(255,255,255,0.08)`), lime accent `#b4f54e`, radii `--radius`/`--radius-lg`/`--radius-xl`.
- `.glass` utility: `backdrop-filter: blur(20px) saturate(1.4)` + inner-shadow highlight.
- `.bg-ambient::before`: subtle fixed radial-gradient wash (lime + cyan) sitting behind content for refraction.
- Global 150ms transitions on all interactive elements, focus-visible accent rings, custom slim scrollbar, skeleton shimmer keyframe, `prefers-reduced-motion` respected.
- Shared Tailwind strings in `src/lib/ui.ts` (`card`, `btn`, `btnGhost`, `input`, `textarea`, `cardHead`, `cardTitle`, `label`). All include `rounded-lg`/`rounded-2xl`, hover border-brightening, `active:scale-[0.98]` press feedback.

### Custom components
- `src/components/Select.tsx` — glass-themed custom dropdown. Replaces native `<select>` because `<option>` can't be styled on Chromium. Keyboard-accessible (Arrow / Enter / Esc), checkmark on selected, click-outside closes. Size variants `sm` / `md`.
- `src/components/OwnerTable.tsx` — reusable owner-only table with per-row hard-delete via `owner_delete_row` RPC. Used by OPIs / Purchases / Events pages.
- `src/components/AppShell.tsx` — glass header + pill-style top nav. Dedicated **Owner** entry with accent dot when `isOwner(role)`.
- `src/components/Badge.tsx` — dark-glass tone map (`bg-[#c0392b]/10 text-[#f07070]` etc.) — never `bg-[#fbeeec]`.

### Owner console (`/owner`)
Owner-only area (hard-guarded in `_app.owner.tsx`, redirects non-owners to `/dashboard`). Routes:
- `/owner` — overview with live row counts, danger-zone links, admin shortcuts
- `/owner/members` — all profiles; type-the-name confirm → hard-delete
- `/owner/opis`, `/owner/purchases`, `/owner/events`, `/owner/tasks` — generic OwnerTable per entity (tasks has an extra Calendar/List view, see below)

### Hard-delete model (DB)
Two `SECURITY DEFINER` plpgsql functions, both role-gated to `OWNER`:

- `owner_delete_member(target_id uuid)` — self-delete blocked, OWNER targets blocked (raises `'Owners cannot be hard-deleted'`). SET NULL on history/metadata (`reviewer_id`, `created_by`, `awarded_by` across `opis`, `purchases`, `individual_outreach`, `outreach_events`, `build_sessions`, `events`, `invitations`, `tasks`, `hours_log`). DELETE on user-owned rows across `build_records`, `outreach_attendance`/`leads`/`rsvps`, `event_checkins`, `task_*` tables, `individual_outreach`, `purchases`, `opi_feedback`, `opi_versions`, `opis`, `notifications`, `notification_preferences`, `group_members`, `login_events`. Then `profiles` + `auth.users`.
- `owner_delete_row(table_name text, row_id uuid)` — whitelisted tables only: `opis, purchases, individual_outreach, outreach_events, build_sessions, build_records, tasks, task_groups, seasons, invitations, groups, notifications`.

If a new FK referencing `auth.users` or `profiles` is ever added, extend `owner_delete_member` — otherwise cascade will raise an FK violation.

### Role masking (`displayed_role`)
- `profiles.displayed_role` column (nullable text) with trigger `check_displayed_role` enforcing the displayed role is at or below the real role in `ROLES` order.
- Helper `publicRole(profile)` in `src/lib/rbac.ts` returns `displayed_role || role`.
- UI in `/profile`: LEADERSHIP+ users see a "Displayed role" `<Select>` with options from their actual role down to MEMBER, plus a "Default" entry that clears the override.
- `useAuth()` still exposes the **real** `role` — admin guards and permission checks use that. Only *public* displays of someone else's role should use `publicRole`.

### Auth race-condition fix
`auth.tsx` returns `role: profile?.role ?? 'PENDING'` as a fallback. Previously `Guards.tsx` / `login.tsx` / `auth.callback.tsx` would act on this fallback during the brief window after `loading=false` but before the profile row loaded, routing legit members to `/pending-approval`. All three now wait for `profile` to be non-null before deciding.

### Admin nav
- `_app.admin.tsx` sub-nav is a scrollable glass pill rail wrapped in a single card, each item has an icon (home / people / wrench / megaphone / spark / cart / chart / gear). Active state is tinted lime (`bg-accent/15 border-accent/25`). Mobile version is an icon-prefixed dropdown button with "Admin / {CurrentPage}" and an animated panel.
- The top-level **Admin** nav link in `AppShell` now goes to `/admin` (overview), not `/admin/members`.

### RLS policy fixes
Four task policies had a `ta.task_id = ta.task_id` self-reference bug (always true, and recursive on `task_assignees`/`task_reviewers` themselves). Rewritten:
- `task_assignees.ta_select` / `task_reviewers.tr_select` → `has_perm('manage_tasks') OR user_id = auth.uid()` (no self-reference, no recursion).
- `task_evidence.te_select` / `task_history.th_select` → `EXISTS (… WHERE ta.task_id = task_evidence.task_id …)` properly bound to the outer row.

### Owner tasks calendar
`/owner/tasks` has a **Calendar / List** toggle:
- Calendar: month grid, prev/next/today controls, each day shows up to 2 task chips + "+N more". Today highlighted. Clicking a day pins it and reveals a per-day task list below with status + assignee names.
- List: flat list with inline hard-delete.
- Assignees resolved via join on `task_assignees → profiles`.

### Dashboards
Both the user dashboard (`_app.dashboard.tsx`) and admin dashboard (`_app.admin.index.tsx`) use glass stat tiles with skeleton loaders during load, subtle `hover:bg-white/[0.03]` row shifts, thinner `divide-white/4` dividers, animated progress bars (500ms fill). The admin dashboard shows a prominent lime-tinted "Owner console" card linking to `/owner` when `isOwner(role)`.

### Light-mode leftovers
If you see `bg-[#fbeeec]` / `border-[#e3a9a1]` / `text-[#c0392b]` on dark bg, convert to translucent pairs:
```
bg-[#c0392b]/10  text-[#f07070]  border-[#c0392b]/30  (danger)
bg-accent/10     text-accent      border-accent/25     (primary accent)
bg-white/5       text-ink-soft    border-white/10      (neutral ghost)
```
`bg-canvas` for hover is also wrong on glass surfaces — use `bg-white/[0.03]`.

### Attribution preference
The user prefers commits pushed from their own account with no Co-Authored-By / Claude-Session trailers. Don't add them.
