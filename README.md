# Tourism AI Visibility Agent

An AI discovery intelligence platform for tourism businesses. Not a generic SEO
dashboard, not a chatbot — it answers one question: **when travellers ask AI
where they should go, what they should do, and who they should book with, does
this business appear?**

## Architecture at a glance

- **Next.js 16 (App Router) + TypeScript**, Tailwind, hand-rolled shadcn-style UI primitives.
- **Postgres + Prisma** — one schema, every entity hangs off `Business` by
  foreign key, so onboarding another tourism business or destination needs
  zero schema or engine changes. Businesses in turn hang off `Account`, so
  the app is multi-tenant from the ground up.
- **Auth** — email/password with signed, HttpOnly session cookies (`jose` +
  `bcryptjs`; no third-party auth service). Every business, and every API
  route under `/api/businesses/*`, is scoped to the signed-in account; a
  cross-tenant request gets a 404, not a 403, so it can't even confirm
  another account's business exists. See `src/proxy.ts` (Next 16's
  `middleware` → `proxy` rename) and `src/lib/auth`.
- **Pluggable AI platform connectors** (`src/lib/connectors`) — ChatGPT,
  Claude, Perplexity, Google AI Overview. Each implements the same
  `AIPlatformConnector` interface; the monitoring pipeline never branches on
  platform identity. The same pattern is used for review platforms
  (`src/lib/reviews`) — Google Places and TripAdvisor.
- **Demo mode, never fabrication.** Any platform with no API key configured
  is automatically swapped for a demo connector that generates synthetic,
  clearly-labeled sample output (`isDemoData: true`, shown with an on-screen
  banner). Add the real key and that platform goes live with no code changes.
- **Transparent scoring** (`src/lib/scoring`) — nine independent visibility
  components (AI discoverability, entity clarity, topical/destination
  relevance, content coverage, third-party authority, reputation, technical
  accessibility, competitive visibility), each with a plain-English
  explanation derived from its own stored signals. There is no single opaque
  score.
- **Engines**, each its own module: crawler + knowledge-profile extraction
  (with DOM-structural FAQ detection, not just regex over flattened text),
  traveller-query generation, AI monitoring + mention detection, review
  sync, competitor intelligence, content-opportunity prioritization, AI
  fact-checker, and the daily action digest ("what changed / why it matters
  / what to do"). All of it is wired together in `src/lib/pipeline.ts`.
- **Rate limiting / cost control** (`src/lib/rate-limit.ts`) — a per-business
  cooldown between monitoring/pipeline runs, a rolling 24h cap on real
  (non-demo) AI/search calls per business, and a bounded concurrency pool
  for in-flight connector calls. All three are env-configurable.

## Getting started

```bash
cp .env.example .env      # point DATABASE_URL at your Postgres instance, set AUTH_SECRET
npm install
npx prisma migrate dev    # creates the schema
npm run db:seed           # optional: one fully-populated demo account + business
npm run dev
```

A `docker-compose.yml` is included for a local Postgres instance
(`docker compose up -d`) if you don't already have one running. Generate
`AUTH_SECRET` with `openssl rand -base64 32`.

Open [http://localhost:3000](http://localhost:3000) — you'll land on `/login`.
Either sign up fresh, or (after seeding) sign in with:

```
email:    demo@tourism-ai-visibility.test
password: demo-password-123
```

With no AI provider keys configured, onboarding a business still runs the
full pipeline end to end — every AI/search result will be clearly labeled
demo data.

## Going live with real data

Add any of these to `.env` and that platform switches from demo to live
automatically — no code changes:

| Env var | Platform |
|---|---|
| `OPENAI_API_KEY` | ChatGPT |
| `ANTHROPIC_API_KEY` | Claude |
| `PERPLEXITY_API_KEY` | Perplexity |
| `SERPAPI_API_KEY` | Google AI Overview (via SerpApi, since Google has no direct AI Overview API) |
| `CONTENT_LLM_API_KEY` | Powers LLM-assisted knowledge-profile extraction and "Create it" content drafting (falls back to `ANTHROPIC_API_KEY`, then to heuristic/template generation if neither is set) |
| `GOOGLE_PLACES_API_KEY` | Google review rating/count on the Reputation tab |
| `TRIPADVISOR_API_KEY` | TripAdvisor review rating/count on the Reputation tab |

## Scheduled runs

`/api/cron/daily` runs the full pipeline for every onboarded business. It's
not covered by the session-auth proxy (it's meant for a scheduler, not a
signed-in user) — it instead requires `Authorization: Bearer <CRON_SECRET>`,
and refuses every request if `CRON_SECRET` isn't set.

- **Vercel**: `vercel.json` already declares the cron (06:00 UTC daily).
  Vercel automatically sends the `CRON_SECRET` bearer header for cron
  invocations when that env var is set on the project — nothing else to wire up.
- **Anywhere else**: `.github/workflows/daily-pipeline.yml` hits the same
  endpoint on the same schedule via `curl`. Set the `APP_URL` and
  `CRON_SECRET` repo secrets to use it.

Each business's run is isolated — one failing business (e.g. a dead
website) is recorded and skipped rather than aborting the run for everyone
else.

## Rate limiting / cost control

Configurable via env vars (see `.env.example`):

- `PIPELINE_COOLDOWN_MINUTES` (default 15) — minimum time between
  monitoring/pipeline runs for the same business, enforced inside
  `runMonitoring()` itself so it applies uniformly whether triggered by a
  dashboard button, onboarding, or the daily cron.
- `MAX_DISCOVERY_RESULTS_PER_DAY_PER_BUSINESS` (default 500) — caps real
  (non-demo) AI/search calls per business per rolling 24h; monitoring stops
  issuing new calls once the budget is hit rather than failing outright.
- `MONITORING_CONCURRENCY` (default 4) — max in-flight connector calls
  during a monitoring run.

## Key scripts

```bash
npm run dev        # start the dev server
npm run build      # production build (also type-checks)
npm run lint       # eslint
npm run test       # vitest — unit tests for scoring, opportunities, fact-checker,
                    # mention detection, query generation, and FAQ extraction
npm run db:seed    # seed one demo account + fully-populated business
```
