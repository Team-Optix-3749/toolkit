# Local verification

Only local fake data was used. No hosted database or production deployment was touched.

## Exercised

Latest completed checks: 57 database regressions, 7 pure behavior tests, 3 browser workflow runs (Chromium, mobile Chromium, WebKit), TypeScript, and the `/toolkit/` production build. A real authorized browser also downloaded the exact header-only outreach CSV for an empty inclusive date range.

- Node 22 dependency installation and lockfile replay; TypeScript and production builds, including `/toolkit/`.
- Fresh Supabase migration/seed replay and isolated PostgreSQL legacy/current/both upgrades.
- Database authorization/state/credit regressions, including actual Auth-issued access/refresh revocation, Presidency serialization, private evidence, legal group-task review, immutable OPI conversion and more than 1,000 tied-timestamp export rows.
- Real local verification/recovery email capture and token return paths, password update, invitation admission, private image upload/registration/download, QR deep-link/manual admission and checkout, configured GPS admission and private scheduler closure.
- Chromium desktop/mobile and WebKit real-Auth workflow tests. Mobile Hours/workspace axe checks reported no violations in exercised states. Native dialog initial focus/Escape restoration, group filter persistence and explicit empty selection were exercised.
- Both themes, reduced-motion mode and 200% text zoom on the mobile Hours surface; measured whole-document width remained 390px after pagination wrapping correction.
- `/toolkit/` service-worker scope, static-only cached resources and offline fallback. Protected API/navigation responses were not cached.

## Verification limits

- Firefox installed, but its local Playwright process exits before application load with “Could not find profile folder”; retrying with `/tmp` also fails. This is not a passing Firefox result.
- Real OAuth provider credentials/redirect registrations are not configured locally. Provider error/retry UI was exercised; successful Google/Discord OAuth was not asserted.
- Google Docs iframe access depends on Google sharing/sign-in/browser policy. Only URL validation, constructed preview URL, external fallback and draft behavior were verified; document access was not asserted.
- No physical iOS/Android camera or screen-reader hardware was available. Chromium camera fallback is truthful; physical QR scanning and native-device assistive technology require device acceptance.

## Commands

Use Node 22.x and a local Docker runtime:

```sh
npm ci
npx supabase start
npx supabase db reset --local
npm run seed:storage
npm run typecheck
npm test
npm run test:db
env -u CI npm run test:e2e -- --project=chromium --project=mobile-chromium --project=webkit
VITE_BASE_PATH=/toolkit/ npm run build
```

`seed:storage` reads ignored local environment configuration and signs in fake fixture users; it does not use hosted service credentials. `sql/preflight.sql` is read-only operator inventory. Live migration/rollout remains an authorized operator action after source-specific preflight and explicit corrections.
