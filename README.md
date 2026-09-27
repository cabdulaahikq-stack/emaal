# CODING AGENTS: READ THIS FIRST

This is a **handoff bundle** from Claude Design (claude.ai/design).

A user mocked up designs in HTML/CSS/JS using an AI design tool, then exported this bundle so a coding agent can implement the designs for real.

## What you should do — IMPORTANT

**Read the chat transcripts first.** There are 1 chat transcript(s) in `chats/`. The transcripts show the full back-and-forth between the user and the design assistant — they tell you **what the user actually wants** and **where they landed** after iterating. Don't skip them. The final HTML files are the output, but the chat is where the intent lives.

**Read `project/Wallet Admin.dc.html` in full.** The user had this file open when they triggered the handoff, so it's almost certainly the primary design they want built. Read it top to bottom — don't skim. Then **follow its imports**: open every file it pulls in (shared components, CSS, scripts) so you understand how the pieces fit together before you start implementing.

**If anything is ambiguous, ask the user to confirm before you start implementing.** It's much cheaper to clarify scope up front than to build the wrong thing.

## About the design files

The design medium is **HTML/CSS/JS** — these are prototypes, not production code. Your job is to **recreate them pixel-perfectly** in whatever technology makes sense for the target codebase (React, Vue, native, whatever fits). Match the visual output; don't copy the prototype's internal structure unless it happens to fit.

**Don't render these files in a browser or take screenshots unless the user asks you to.** Everything you need — dimensions, colors, layout rules — is spelled out in the source. Read the HTML and CSS directly; a screenshot won't tell you anything they don't.

## Bundle contents

- `README.md` — this file
- `chats/` — conversation transcripts (read these!)
- `project/` — the `Wallet Management and API Integration` project files (HTML prototypes, assets, components)

---

## Implementation status

The prototype's **core wallet + admin console** scope (the original request, before
the marketplace/inventory/staff features were layered on in later chat turns) has
been implemented as a real, production-oriented backend + mobile app:

- `backend/` — Node.js/TypeScript/Express/Prisma/PostgreSQL API: PIN-protected
  wallets, deposit/withdraw/transfer with a double-entry ledger, an admin
  console API (dashboard, wallet/transaction lookup, a manual approval queue
  for transactions ≥ $5,000 that reserves funds so they can't be double-spent
  while pending), and a partner-facing API (scoped keys, rate limiting,
  request logging, HMAC-signed webhooks, admin-managed settlement balances).
  See `backend/` — run `npm install && npm run prisma:migrate && npm run dev`
  (needs a local Postgres; `.env.example` has the connection string). 22
  automated tests: `npm test`.
- `mobile/` — Expo/React Native/TypeScript app implementing the Organic design
  system with its teal accent override and Emaal branding: PIN unlock,
  step-up PIN confirmation before every money-moving action, the customer
  wallet (balance, deposit/withdraw/send-by-phone, activity), and the admin
  console (dashboard, wallet search, approvals queue, partner/API-key
  management, live API docs). Run `npm install && npm start` (or `npm run
  web` for a browser preview); set `EXPO_PUBLIC_API_URL` if the backend isn't
  on `localhost:4000`.

**Deferred** (out of this pass's scope per the original request's boundary):
the Marketplace (wholesale/retail), Merchant and Staff roles, inventory
(barcodes/QR, size variants, stock caps), and the cash-register/receipt
screens added later in the chat transcript. The backend's data model and
ledger were built to extend cleanly to those if/when they're prioritized.

### Database: Supabase

A dedicated Supabase project, **emaal-wallet** (ref `loogwzoticnpmfkfbsyr`,
`eu-west-1`), has the full schema already migrated — all 10 tables from
`backend/prisma/migrations/`, with Row Level Security enabled on every table
(and no policies, by design: nothing should ever reach these tables through
Supabase's PostgREST/anon-key path — only the backend's own direct,
fully-authenticated Postgres connection does, which bypasses RLS as the
table owner).

To point the backend at it instead of the local dev Postgres, grab the
database password from the Supabase dashboard (`emaal-wallet` → Project
Settings → Database) — it's not retrievable through any API, only shown
there — and set in `backend/.env`:

```
DATABASE_URL="postgresql://postgres.loogwzoticnpmfkfbsyr:<password>@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

Use the **connection pooler** (port 6543), not the direct host
(`db.loogwzoticnpmfkfbsyr.supabase.co:5432`) — the direct host resolves to an
IPv6 address only, which is unreachable from IPv4-only serverless platforms
(confirmed against the deployed Vercel backend: direct host failed with
`Can't reach database server`). The pooler resolves to IPv4 and works
everywhere. Note the pooler host's cluster index is `aws-1`, not the more
common `aws-0` — Supabase's own docs warn this index varies per project and
must be copied from the dashboard's Connect dialog, not guessed; `aws-0`
resolves and accepts TCP connections but Supavisor rejects it with
`Tenant or user not found` since this project's tenant lives on cluster 1.

Then `npm run prisma:generate` and restart the backend. No migration step
needed — the schema's already there.

**Not reachable from this sandbox:** this container's network policy blocks
outbound connections to Supabase's domains entirely (confirmed via a `403`
from the egress proxy for both the direct host and the pooler), so
`backend/.env` here stays on local Postgres. The connection string above is
verified-working from a real host (deployed and tested live on Vercel,
see "Deployment" below).

### Deployment: Vercel

The backend is deployed and live at **https://emaal-wallet-backend.vercel.app**
(project `emaal-wallet-backend`), running against the Supabase database above
via the pooler connection string. `/health` returns `{"ok":true}`; signup,
login, and wallet operations have been smoke-tested end-to-end against the
real database. To redeploy: it's a zero-config Vercel Node.js project — the
Express app is exposed as a single serverless function
(`api/index.js` → `dist/app.js`, built via `npm run build`); `vercel.json`
rewrites every path to it. Required production env vars: `DATABASE_URL`
(pooler string above), `JWT_SECRET`, `NODE_ENV=production`,
`APPROVAL_THRESHOLD_USD`.

### Mobile web app: Vercel

The mobile app's web build is deployed and live at
**https://emaal-wallet-mobile.vercel.app**, wired to the backend above via
`EXPO_PUBLIC_API_URL`. It's a git-linked Vercel project (`emaal-wallet-mobile`)
tracking this repo's `main` branch with root directory `mobile` — every push
to `main` redeploys automatically. Build command:
`npx expo export -p web --output-dir dist`, output directory `dist`.

On web, the app renders immediately with the system-font fallback instead of
blocking on the custom Caprasimo/Figtree webfonts (see the `Platform.OS`
check in `src/RootApp.tsx`) — native builds still gate on font load as
before.
