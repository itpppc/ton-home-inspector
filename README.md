# TON Home Inspector

> INSIGHT • AUTOMATE • GROW — Professional Home Inspection & Defect Management (PWA, offline-first)

Default project: **Siri Place Rama 2** · plot **1240-032002** · model **TH99B**.

## Stack
Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · shadcn/ui (Radix) · Lucide · Supabase (Auth, Postgres + RLS, Storage) · Dexie (IndexedDB) · Zod + React Hook Form · Recharts · Vitest · Playwright

## Architecture (short)
- **Offline-first:** every write goes to IndexedDB + an outbox in one transaction (`src/lib/db/mutations.ts`), then the sync engine (`src/lib/sync/engine.ts`) pushes to Supabase and pulls deltas by `server_updated_at` (Last-Write-Wins per row).
- **Routes use `?id=`** (not `[id]`) so the service worker can serve any record offline from one cached page.
- **Local mode:** without Supabase env vars the app runs fully on-device; after the first login, local data is adopted by the account and synced.
- **Security:** RLS on every table, project-level roles (ADMIN / INSPECTOR / VIEWER), private photo bucket. See `docs/DATABASE_SCHEMA.md`.
- **Claim deadline:** `transfer_date_actual + claim_window_days` (default 15, transfer day excluded). The planned date is reference only (`src/lib/domain/deadline.ts`).

## Getting started
```bash
npm ci
cp .env.example .env.local   # optional: fill Supabase keys
npm run dev
```

## Supabase setup
1. Create a project, then apply `supabase/migrations/*.sql` in order (`supabase db push` or the SQL editor).
2. Auth → URL Configuration: set Site URL and add `https://<domain>/auth/callback` to Redirect URLs.
3. Put the project URL and anon key in `.env.local` / Vercel env.
4. Promote an admin if needed: `update profiles set role = 'ADMIN' where email = '...';`

## Scripts
| Command | What |
|---|---|
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests (domain, repositories, sync merge) |
| `npm run test:e2e` | Playwright (mobile + desktop, offline) — run `npm run build` first |
| `DATABASE_URL=... node supabase/tests/rls.test.mjs` | RLS/trigger integration test (apply `supabase/tests/supabase_shim.sql` + migrations to a plain Postgres first) |
