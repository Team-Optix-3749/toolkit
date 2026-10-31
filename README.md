# Toolkit

TanStack React Start/Router, React, Vite, Tailwind and Supabase. Requires Node 22.x.

## Local development

```sh
npm ci
npx supabase start
npx supabase db reset --local
npm run dev
```

The Supabase CLI needs Docker Desktop or a compatible local Docker runtime. The local project is `optixtk`: API `http://127.0.0.1:54321`, PostgreSQL `postgresql://postgres:postgres@127.0.0.1:54322/postgres`, application `http://127.0.0.1:5176`. Get local keys using `npx supabase status -o env`; place only the local API URL and anon key in ignored `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Never put service keys in client variables.

`supabase/migrations/` is the only executable schema source. `supabase/seed.sql` is deterministic **local fake data only**. Fake identities use `example.test` addresses and password `Optix-local-only-3749!`; see the seed for exact roles and grants. Local email verification/recovery is captured by Supabase Mailpit. No workflow email or push is delivered.

## Lossless upgrades

Do not reset a database containing real data. Before an authorized upgrade, inventory it read-only. Local tooling rejects non-loopback database URLs and connection-host overrides:

```sh
npm run check:db
node scripts/check-schema.mjs --mapping corrections.json
node scripts/upgrade-local.mjs --mapping corrections.json
node scripts/upgrade-local.mjs --mapping corrections.json --apply
```

The last command is an explicitly requested **local** transaction, not a hosted deployment command. It locks source tables, rechecks the data, applies all ordered migrations and records their versions atomically. Any validation/migration failure rolls back the transaction. For hosted inventory, an authorized operator may run `sql/preflight.sql`; this does not authorize this assistant or local scripts to connect to hosted data.

Recognized shapes are the legacy build/outreach/OPI names, the current route model, or both. Duplicate UUIDs must agree on mapped values. Conflicts, overlapping credited intervals, duplicate attendance, missing required associations, missing historical ends and inconsistent OPI links require explicit source correction. No seasons, ends, student/mentor classification, President or task ownership are guessed. Corrections are JSON objects keyed by authoritative table and record UUID, for example:

```json
{
  "profiles": {
    "10000000-0000-4000-8000-000000000004": {"account_type": "member"}
  },
  "tasks": {
    "70000000-0000-4000-8000-000000000001": {
      "season_id": "20000000-0000-4000-8000-000000000001",
      "owner_group_id": "60000000-0000-4000-8000-000000000001"
    }
  }
}
```

Mappings may correct profile name/type/role, required parent seasons, task ownership, build locations/session association, and explicit historical ends. Association IDs must exist; timestamp corrections include an offset. Conflicting duplicate copies and overlapping intervals must be fixed in the source, never resolved by precedence. Original source payloads, unconsumed legacy fields, recurrence metadata and old rounded credit caches remain in the non-exposed `toolkit_upgrade` schema. Exact elapsed numeric minutes, not those caches, are authoritative. No writable compatibility aliases or dual-write model are provided.

## Verification

```sh
npm run typecheck
npm run build
npm run test:db
npm run test:upgrade
npm run test
npm run test:e2e
```

Database regressions use loopback only and run serially. Upgrade regressions create isolated disposable databases, exercise legacy/current/both inputs and remove only those test databases. Browser configuration targets the local application and real local Auth. Auth/session credentials are never source fixtures outside the documented fake accounts.

Run `npm run seed:storage` after a full reset to create real private attachment fixtures through fake-user Auth and domain actions. See [local verification](docs/verification.md) for exercised browser journeys, the Firefox runtime limitation, unconfigured OAuth/device limits and safe subpath build commands.

## Account authority

Every protected request requires verified email, active admitted membership and a JWT `session_id` matching a current Auth session. Deactivation revokes both sessions and refresh credentials without deleting history; reactivation requires fresh sign-in.

`OWNER` is displayed as President and is the only implicit-all role. `LEADERSHIP` and `OFFICER` may assign independent configurable grants but have no implicit domain authority. Only the President may change student-administrator status or transfer Presidency. Mentors cannot hold student-administrator roles. Cosmetic displayed roles never grant access. Account managers may admit/reject prospective accounts and deactivate/reactivate ordinary admitted accounts, never administer elevated accounts.

Account/profile changes use typed RPC actions, not direct profile writes. `public_directory` contains active public profile fields; `historical_profiles` retains names for consequential records without email/permission exposure. Private evidence, proofs and receipts are downloaded through authenticated Storage requests and displayed using temporary browser object URLs, not reusable public or signed bearer URLs.
