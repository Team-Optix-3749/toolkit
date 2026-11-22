# Optix Toolkit — design review brief

## Status
Design review only. No application implementation or implementation plan is authorized by this brief. The standalone prototype uses illustrative data and simulated interactions; it does not connect to Supabase.

## Product and people
Optix Toolkit is the team's internal operational application. The user confirms that members join at the start of the season if they are part of the team. OPI means **Optix Passion Initiative (OPI)**. Preserve existing admission, verification, approval and account-state rules; do not reinterpret Toolkit as a public volunteer marketplace.

## Goals
Make current status, next steps and important actions obvious. Reduce navigation and information overload without losing capabilities or useful density. Cover members, assigned event leads, reviewers, independently granted managers, Leadership, Officers and President on desktop, tablet and mobile. Scouting and Docs content are explicitly excluded from this redesign.

## Authority and invariants
Repository evidence: Leadership/Officer titles do not grant all domain powers; independent grants do. Assigned event lead is event-scoped. President has implicit-all authority and exclusive administrator-role/Presidency-transfer authority. Preserve private evidence and retained operational history, task review lifecycles, OPI revisions/conversion, pending-only purchase editing and final purchase decisions, GPS/rotating QR build attendance, outreach lead-recorded attendance, and individual outreach caps.

## Platform and incumbent system
Responsive React web application; TanStack Router/Start, Tailwind 4, custom components. Preserve the incumbent design system: IBM Plex Sans, Space Grotesk and IBM Plex Mono, black/blue translucent surfaces, lime accent, existing radii and dark/light modes. Change organization, placement and interaction rather than introducing a replacement aesthetic. No competing component library.

### Scope correction: incremental polish, not replacement
Keep navigation at the top, based on the existing AppShell. Preserve the approved page/workflow improvements, but use current tokens and shared component treatments as the authority. Maintainability, code cleanup and better interaction placement are goals for later implementation; they do not authorize application refactoring before design approval. No competing design system, component library, or parallel application shell. Prototype CSS is a standalone review artifact, not a stylesheet to copy into production.

## Review assumptions
Recurring-use priority was not settled by the first interview answer. The prototype balances attendance and assigned work; this is a review assumption, not a confirmed priority. No proposed offline sync, email/push delivery, payment processing, scheduling integration or automatic assignment policy is implied.

## Confirmed revision decisions
- Exactly one build session is active at a time. Identify it above QR/location entry and exit controls.
- Retain Season Hours progress; make it a primary destination, replace explanatory panels with a small credited-hours leaderboard with separate Build/Outreach rankings.
- Public Team profiles must not expose email. Authorized contact details are hidden until explicitly requested.
- Docs will eventually cover the app and build manuals. Reserve the destination only; the user owns its content/design. The prototype screen guide is not part of the product.
- Scouting is outside the redesign scope and remains unchanged in the application.
- Add Global Tasks across all team tasks, retain personal/group/review scopes, and use clear icons.
- Event attendance needs direct roster actions and icon refresh; account actions need a compact contextual menu; Setup should use focused task interactions rather than repeated disclosure/dropdown blocks.
- OPI review layout is approved. Keep it intact.
- Remove filler copy; controls should be understandable through labels, grouping, state and behavior.

## Review deliverables
Concrete responsive screens, linked workflow walkthroughs, capability/route coverage, observed audit evidence, explicit proposed improvements and limitations. Application changes and implementation planning wait for design review.
