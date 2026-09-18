# Tourism AI Visibility Agent

An AI discovery intelligence platform for tourism businesses. Not a generic SEO
dashboard, not a chatbot — it answers one question: **when travellers ask AI
where they should go, what they should do, and who they should book with, does
this business appear?**

## Architecture at a glance

- **Next.js 16 (App Router) + TypeScript**, Tailwind, hand-rolled shadcn-style UI primitives.
- **Postgres + Prisma** — one schema, every entity hangs off `Business` by
  foreign key, so onboarding another tourism business or destination needs
  zero schema or engine changes.
- **Pluggable AI platform connectors** (`src/lib/connectors`) — ChatGPT,
  Claude, Perplexity, Google AI Overview. Each implements the same
  `AIPlatformConnector` interface; the monitoring pipeline never branches on
  platform identity.
- **Demo mode, never fabrication.** Any platform with no API key configured
  is automatically swapped for a `DemoConnector` that generates synthetic,
  clearly-labeled sample output (`isDemoData: true`, shown with an on-screen
  banner). Add the real key and that platform goes live with no code changes.
- **Transparent scoring** (`src/lib/scoring`) — nine independent visibility
  components (AI discoverability, entity clarity, topical/destination
  relevance, content coverage, third-party authority, reputation, technical
  accessibility, competitive visibility), each with a plain-English
  explanation derived from its own stored signals. There is no single opaque
  score.
- **Engines**, each its own module: crawler + knowledge-profile extraction,
  traveller-query generation, AI monitoring + mention detection, competitor
  intelligence, content-opportunity prioritization, AI fact-checker, and the
  daily action digest ("what changed / why it matters / what to do").

## Getting started

```bash
cp .env.example .env      # point DATABASE_URL at your Postgres instance
npm install
npx prisma migrate dev    # creates the schema
npm run db:seed           # optional: one fully-populated demo business
npm run dev
```

A `docker-compose.yml` is included for a local Postgres instance
(`docker compose up -d`) if you don't already have one running.

Open [http://localhost:3000](http://localhost:3000). With no AI provider keys
configured, onboarding a business still runs the full pipeline end to end —
every AI/search result will be clearly labeled demo data.

## Going live with real AI monitoring

Add any of these to `.env` and that platform switches from demo to live
automatically — no code changes:

| Env var | Platform |
|---|---|
| `OPENAI_API_KEY` | ChatGPT |
| `ANTHROPIC_API_KEY` | Claude |
| `PERPLEXITY_API_KEY` | Perplexity |
| `SERPAPI_API_KEY` | Google AI Overview (via SerpApi, since Google has no direct AI Overview API) |
| `CONTENT_LLM_API_KEY` | Powers LLM-assisted knowledge-profile extraction and "Create it" content drafting (falls back to `ANTHROPIC_API_KEY`, then to heuristic/template generation if neither is set) |

## Key scripts

```bash
npm run dev        # start the dev server
npm run build      # production build (also type-checks)
npm run lint        # eslint
npm run db:seed     # seed one demo business
```
