# NeuronVoxel AI — System Architecture

*Last updated: 2026-07-07*

This document describes every moving part of the NeuronVoxel AI setup — the
static site, the Cloudflare Worker backend, the data layer, the CI/CD
pipeline, and the AI agent fleet — and exactly how each module talks to the
others.

---

## 1. Bird's-eye view

```
                         ┌────────────────────────────────────────────┐
                         │              VISITOR'S BROWSER              │
                         │  index.html · services.html · quiz.html ·  │
                         │  blogs.html  (DCLogic components + React)   │
                         └──────┬─────────────────────────┬───────────┘
                                │ static assets           │ fetch / sendBeacon
                                │ (HTML, JS, images)      │ (JSON over HTTPS)
                                ▼                         ▼
              ┌─────────────────────────┐   ┌─────────────────────────────────┐
              │      GITHUB PAGES       │   │        CLOUDFLARE WORKER        │
              │ avithal/                │   │  neuronvoxel-nim-proxy          │
              │ neuronvoxelai.github.io │   │  *.neuronvoxelai.workers.dev    │
              │ (serves the site at     │   │                                 │
              │  neuronvoxelai.com)     │   │  POST /analyze    ── NIM proxy  │
              └──────────▲──────────────┘   │  POST /quiz-email ── save lead  │
                         │ git push          │  POST /quiz-event ── count stat │
                         │ (auto-publish)    │  GET  /quiz-stats ── funnel     │
              ┌──────────┴──────────────┐   │  GET  /quiz-leads ── CSV export │
              │      GITHUB REPO        │   └───────┬───────────────┬─────────┘
              │  main branch            │           │               │
              │  ├─ *.html  (site)      │           ▼               ▼
              │  ├─ support.js (runtime)│   ┌───────────────┐ ┌──────────────┐
              │  ├─ worker/  (backend)  │   │ CLOUDFLARE KV │ │  NVIDIA NIM  │
              │  ├─ .github/workflows/  │   │  QUIZ_EMAILS  │ │  API (cloud) │
              │  ├─ assets/agents/*.md  │   │  lead:* stat:*│ │ llama-3.1-8b │
              │  └─ outputs/            │   └───────────────┘ └──────────────┘
              └──────────▲──────────────┘
                         │ commits & pushes
         ┌───────────────┴───────────────────┐
         │                                   │
┌────────┴─────────┐              ┌──────────┴─────────────┐
│  GITHUB ACTIONS  │              │  CLAUDE CLOUD ROUTINE  │
│ deploy-worker.yml│              │ "Wednesday Scout +     │
│ (wrangler deploy │              │  LinkedIn Post"        │
│  on worker/**    │              │ cron 0 4 * * 3 (UTC)   │
│  changes)        │              │ → outputs/*.md → push  │
└──────────────────┘              └────────────────────────┘
```

---

## 2. The modules

### 2.1 Static site (GitHub Pages)

| File | Purpose |
|---|---|
| `index.html` | Home page + **AI Resume Matcher** (paste a job description, get a streamed match analysis) |
| `services.html` | Services / offerings page |
| `quiz.html` | **CV Sorting Hat quiz** — 6-question personality quiz, lead magnet |
| `blogs.html` | Blog landing page (posts coming soon) |
| `support.js` | The **DCLogic runtime** (generated from `dc-runtime/src/*.ts`). Bootstraps React 18.3.1 + ReactDOM from unpkg, then renders the `<x-dc>` component markup on each page |
| `logo-mark-bright.png`, `logo.svg` | Brand assets |

**How the pages work.** Each page is a single self-contained HTML file built
with a visual-builder framework ("DCLogic"). The declarative markup lives in
`<x-dc>…</x-dc>` with `{{ binding }}` placeholders, `<sc-if>` conditionals and
`<sc-for>` loops. The page's logic is a `class Component extends DCLogic`
inside a `<script type="text/x-dc">` tag — React-style (`state`, `setState`,
`componentDidMount`, `renderVals()`). `support.js` reads that markup + class
and renders it with React. **Without `support.js` the pages are inert**, so it
must always ship with the site.

**Hosting.** Pushing to `main` automatically republishes GitHub Pages. The
custom domain `neuronvoxelai.com` points at it.

### 2.2 Cloudflare Worker (`worker/`)

A single Worker (`neuronvoxel-nim-proxy`) is the **entire dynamic backend**.
Source: `worker/src/index.js`, config: `worker/wrangler.toml`.

| Route | Method | What it does | Auth |
|---|---|---|---|
| `/analyze` | POST | Proxies a job description to **NVIDIA NIM** (`meta/llama-3.1-8b-instruct`) with the resume baked in server-side; streams the response back to the browser | Per-IP rate limit (10 s cooldown) |
| `/quiz-email` | POST | Validates + stores a quiz lead in KV (`lead:<email>`, 1-year TTL, dedup by email); bumps the daily `emails` counter | none |
| `/quiz-event` | POST | Funnel beacon: `{type: "start" \| "complete" \| "email"}` increments the day's counter | none |
| `/quiz-stats` | GET | Returns funnel totals, per-day buckets, and conversion rates (completion / email / overall) | public |
| `/quiz-leads` | GET | Streams all leads as CSV (`email, house, timestamp, scores`) | `Authorization: Bearer <EXPORT_TOKEN>` |

**Secrets** (set with `npx wrangler secret put …`, never in source):

- `NIM_API_KEY` — NVIDIA NIM API key used by `/analyze`
- `EXPORT_TOKEN` — bearer token protecting `/quiz-leads`

### 2.3 Data layer (Cloudflare KV)

One KV namespace, `QUIZ_EMAILS` (id in `wrangler.toml`), holds two kinds of
keys:

- `lead:<email>` → `{email, house, scores, timestamp, ip}` — quiz leads,
  deduplicated by email, 1-year TTL.
- `stat:<YYYY-MM-DD>` → `{starts, completions, emails}` — one counter object
  per UTC day.

> Note: counters use read-modify-write, which can drop a count under heavy
> concurrency. Fine at lead-magnet traffic; swap for a Durable Object counter
> if volume ever spikes (noted in the code).

### 2.4 CI/CD

- **Site**: GitHub Pages redeploys automatically on every push to `main` —
  no workflow needed.
- **Worker**: `.github/workflows/deploy-worker.yml` runs on pushes that touch
  `worker/**` (or the workflow itself), and on manual dispatch. Steps:
  checkout → Node **22** (wrangler v4 requires ≥22) → `npm ci` →
  `npx wrangler deploy`. Requires the repo secret `CLOUDFLARE_API_TOKEN`
  (Cloudflare token with *Edit Cloudflare Workers* permissions).

### 2.5 AI agent fleet (`assets/agents/`)

Markdown prompt files defining a marketing/content automation fleet:

| Agent | File | Cadence | Job |
|---|---|---|---|
| **Orchestrator** | `orchestrator.md` | per cycle | Spawns the other agents, synthesizes `outputs/next-steps.md`, keeps a memory across cycles |
| **Builder** | `builder.md` | **fortnightly** | Regenerates the CV Sorting Hat quiz. Must satisfy a fixed question-topic distribution (2× model training, 1× deployment, 1× basic image processing, 2× classical non-deep-learning CV) verified by an **LLM-as-judge** pass with a **3-attempt retry cap** (ship only on PASS) |
| **Scout** | `scout.md` | **weekly (Wednesdays)** | Researches content opportunities (Reddit, trends, competitors, YouTube), scores them 1–5 on four axes, writes `outputs/content-ideas.md` with a "Previously covered" memory to avoid repeats |
| **Growth** | `growth.md` | post-launch | Site link audit, launch email, social captions, next-lead-magnet recommendation |

All agent deliverables land in `outputs/`.

### 2.6 Scheduled cloud routine

A Claude Code **cloud routine** (id `trig_01BY3oRHF2K6HCUZG7F4TnTB`,
manage at https://claude.ai/code/routines) runs **every Wednesday at
04:00 UTC** (midnight ET; 11 PM Tue ET when DST ends):

1. Clones this repo in an isolated cloud sandbox (via the Claude GitHub App).
2. Runs the **Scout** research task → rewrites `outputs/content-ideas.md`.
3. Writes one **LinkedIn post** → `outputs/linkedin/<date>.md`.
4. Commits and pushes to `main`.

Model: `claude-sonnet-5`. Because the push touches only `outputs/`, it does
**not** trigger the worker deploy workflow.

---

## 3. How the modules talk to each other

| From → To | Channel | Payload |
|---|---|---|
| Browser → GitHub Pages | HTTPS GET | HTML, `support.js`, images |
| `support.js` → unpkg CDN | HTTPS GET (once per load) | React / ReactDOM 18.3.1 UMD bundles |
| `index.html` → Worker `/analyze` | `fetch` POST, streamed response | `{jobDescription}` → text/plain stream (markdown) |
| `quiz.html` → Worker `/quiz-event` | `navigator.sendBeacon` (fallback `fetch keepalive`) | `{type: start\|complete}` — fire-and-forget, never blocks UX |
| `quiz.html` → Worker `/quiz-email` | `fetch` POST | `{email, house, scores}` |
| Worker → NVIDIA NIM | HTTPS POST (SSE stream) | chat completion request; Worker re-streams deltas to the browser |
| Worker → KV | Workers binding (`env.QUIZ_EMAILS`) | put/get/list of `lead:*` and `stat:*` keys |
| Operator → Worker `/quiz-stats`, `/quiz-leads` | curl / browser | funnel JSON; CSV export (Bearer token) |
| Push to `main` (worker/**) → GitHub Actions → Cloudflare | `wrangler deploy` with `CLOUDFLARE_API_TOKEN` | new Worker bundle |
| Cloud routine → GitHub repo | git commit + push (GitHub App auth) | `outputs/*.md` content updates |
| Share links → `quiz.html?house=G\|R\|H\|S` | URL param, read in `componentDidMount` | deep-links a shared result straight to that house |

---

## 4. Why Cloudflare — and why it matters

The site itself is static (GitHub Pages). Static hosting is free, fast, and
zero-maintenance — but it **cannot keep a secret and cannot run server code**.
Everything dynamic therefore lives in the Cloudflare Worker. Concretely:

1. **Secret custody.** The NVIDIA NIM API key and the resume text live only
   inside the Worker (secret store + server-side constant). If the browser
   called NIM directly, the API key would be visible to anyone who opened
   DevTools — and would be stolen within hours. The Worker means *the key
   never leaves Cloudflare*.

2. **A backend without servers.** There is no VM, no container, no Node
   process to patch or monitor. Workers are deployed as code and Cloudflare
   runs them on demand. For a solo-operated business this removes an entire
   category of ops work.

3. **Global edge latency.** Workers execute in Cloudflare's points of
   presence close to the visitor, so quiz beacons and lead capture feel
   instant worldwide — important for a lead magnet where every extra 100 ms
   costs conversions.

4. **Free-tier economics.** Workers (100k req/day) and KV comfortably cover
   lead-magnet traffic at $0. The only paid dependency is the NIM API usage
   itself.

5. **Built-in data store (KV).** Leads and funnel counters need *some*
   persistence, but a real database would be overkill. KV gives durable,
   globally replicated storage with a two-line API — and because it's bound
   to the Worker (`env.QUIZ_EMAILS`), there are no connection strings or
   credentials to manage.

6. **Abuse control at the edge.** The Worker enforces per-IP rate limiting on
   the expensive `/analyze` route and validates/normalizes emails before
   they're stored — filtering junk *before* it costs anything.

7. **Streaming proxy.** `/analyze` re-streams NIM's SSE tokens to the browser
   as plain text, so the visitor sees the analysis being "typed" in real
   time. Workers' `TransformStream` support makes this a few lines of code.

**In short:** GitHub Pages is the free, fast face; Cloudflare is the free,
fast brain. The Worker is the single trust boundary of the whole system — the
only place secrets exist, the only place data is written, and the only thing
that must be deployed with care.

---

## 5. Security model at a glance

| Asset | Where it lives | Exposure |
|---|---|---|
| NVIDIA NIM API key | Worker secret (`NIM_API_KEY`) | Never sent to browser |
| Resume text | Worker source constant | Server-side only; browser gets the analysis, not the resume |
| Lead emails | KV `lead:*` | Readable only via `/quiz-leads` with `EXPORT_TOKEN` |
| `EXPORT_TOKEN` | Worker secret | Compared against `Authorization: Bearer` header |
| `CLOUDFLARE_API_TOKEN` | GitHub repo secret | Used only inside the deploy Action |
| Funnel stats | KV `stat:*` | Public via `/quiz-stats` (aggregate counts only, no PII) |

CORS is currently `Access-Control-Allow-Origin: *` on the API routes; the
sensitive route (`/quiz-leads`) relies on the bearer token rather than origin
checks. Rate limiting on `/analyze` is in-memory per isolate (best-effort, not
a hard guarantee).
