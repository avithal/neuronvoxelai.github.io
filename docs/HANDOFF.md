# NeuronVoxel AI — Operations Handoff

*Last updated: 2026-07-07. Companion to [ARCHITECTURE.md](ARCHITECTURE.md) —
read that first for the system map; read this to actually run the thing.*

---

## 1. Current state (what's live right now)

| Component | Status | Verified how |
|---|---|---|
| Site (Pages: home, services, quiz, blogs) | ✅ live at neuronvoxelai.com | nav links normalized across all 4 pages; `support.js` runtime + logo committed |
| Worker routes `/analyze`, `/quiz-email` | ✅ live | in production since launch |
| Worker routes `/quiz-event`, `/quiz-stats`, `/quiz-leads` | ✅ live | `/quiz-stats` returns JSON (HTTP 200); `/quiz-leads` returns 401 without token; `/quiz-event` returns `{success:true}` |
| Quiz funnel beacons + share buttons + `?house=` deep link | ✅ shipped in `quiz.html` | bindings verified against `renderVals()` |
| `EXPORT_TOKEN` worker secret | ✅ set | `/quiz-leads` gate active |
| `NIM_API_KEY` worker secret | ✅ set | `/analyze` works |
| Wednesday cloud routine | ✅ scheduled | id `trig_01BY3oRHF2K6HCUZG7F4TnTB`, first run 2026-07-08 04:00 UTC |
| **Worker auto-deploy Action** | ❌ **failing — see §2** | runs #1–#4 red |

## 2. ⚠ Open item: the deploy Action is red

`.github/workflows/deploy-worker.yml` fails at the *Deploy to Cloudflare*
step with: *"it's necessary to set a CLOUDFLARE_API_TOKEN environment
variable"* — i.e. **the GitHub repo secret is missing or mis-saved**. The
workflow itself is correct (Node 22, telemetry disabled).

**Fix:** repo → *Settings → Secrets and variables → Actions* → **Secrets tab**
→ *New repository secret*:

- Name: `CLOUDFLARE_API_TOKEN` (exact, uppercase)
- Value: a Cloudflare API token created from the **"Edit Cloudflare
  Workers"** template (https://dash.cloudflare.com/profile/api-tokens)

Common mistakes: saved under the *Variables* tab instead of *Secrets*; saved
as an *Environment* secret (the job declares no environment); name typo.

Then: *Actions tab → latest "Deploy Worker" run → Re-run all jobs* and
confirm it goes green.

> Until fixed, worker deploys must be done manually (§4.3). The live worker
> is already current, so nothing is broken today — only future auto-deploys.

> 🔐 **Token hygiene:** a `cfut_…` Cloudflare token was pasted in a chat
> session on 2026-07-07. After the secret is working, rotate that token in
> the Cloudflare dashboard and update the GitHub secret with the new value.

## 3. Secrets & credentials inventory

| Secret | Where | Purpose | How to (re)set |
|---|---|---|---|
| `NIM_API_KEY` | Cloudflare worker secret | auth to NVIDIA NIM for `/analyze` | `cd worker && npx wrangler secret put NIM_API_KEY` |
| `EXPORT_TOKEN` | Cloudflare worker secret | bearer token for `/quiz-leads` CSV export | `cd worker && npx wrangler secret put EXPORT_TOKEN` |
| `CLOUDFLARE_API_TOKEN` | GitHub repo secret | lets the deploy Action run `wrangler deploy` | repo Settings → Secrets → Actions |
| Claude GitHub App | github.com installation | lets the Wednesday cloud routine clone/push this repo | https://claude.ai/code (already installed) |

**Local requirement:** wrangler v4 needs **Node ≥ 22**. The dev machine had
v20.20.2 — local `npx wrangler deploy` fails there until Node is upgraded
(nvm/volta), which is another reason to fix the Action.

## 4. Runbook — common operations

### 4.1 Check the quiz funnel
```bash
curl https://neuronvoxel-nim-proxy.neuronvoxelai.workers.dev/quiz-stats
```
Returns totals, per-day buckets, and completion/email/overall conversion
rates. Use this to judge whether each fortnightly quiz refresh helps.

### 4.2 Export the leads (weekly, pairs well with Wednesday)
```bash
curl -H "Authorization: Bearer <EXPORT_TOKEN>" \
  https://neuronvoxel-nim-proxy.neuronvoxelai.workers.dev/quiz-leads -o leads.csv
```
Columns: `email, house, timestamp, scores`. Deduped by email. Then send the
welcome email — template + sending options in
[`outputs/welcome-email.md`](../outputs/welcome-email.md). **No email
provider is wired up yet**; sending is manual until Resend/SendGrid/etc. is
added to the worker.

### 4.3 Deploy the worker manually (while the Action is red)
```bash
cd worker
npx wrangler login          # one-time, needs Node >= 22
npx wrangler deploy
```

### 4.4 Update the site
Edit the HTML, push to `main` — GitHub Pages republishes automatically.
Pages are DCLogic components: markup in `<x-dc>`, logic in the
`<script type="text/x-dc">` class. Any new `{{ binding }}` in markup **must**
have a matching key in `renderVals()` or it renders blank. Never remove the
`<script src="./support.js">` tag.

### 4.5 Manage the Wednesday routine
https://claude.ai/code/routines → "Wednesday Scout + LinkedIn Post".
Runs Wed 04:00 UTC = midnight ET (11 PM Tue during winter time — cron is
fixed UTC). It commits `outputs/content-ideas.md` + `outputs/linkedin/<date>.md`
to `main`. Its pushes don't touch `worker/**`, so they never trigger a
worker deploy. Deleting routines is only possible in that web UI.

### 4.6 Run the agent fleet manually
The prompts live in `assets/agents/` (orchestrator, builder, scout, growth).
Paste one into a Claude Code session (or have the orchestrator spawn the
others). Rules encoded in the prompts:

- **Builder** (fortnightly): quiz must have exactly 6 questions with the
  topic mix 2× training / 1× deployment / 1× basic image processing /
  2× classical non-DL CV, verified by an LLM-as-judge; max **3**
  revise-and-rejudge attempts, then stop and flag for human review. Verdicts
  logged to `outputs/builder_log.md`.
- **Scout** (weekly): must read the previous `outputs/content-ideas.md` and
  not repeat ideas; keeps a "Previously covered" list.

## 5. Known issues & sharp edges

1. **Deploy Action red** — §2. Highest-priority open item.
2. **Duplicated agent prompts** — `orchestrator.md` embeds copies of the
   Builder/Scout prompts. They were synced on 2026-07-07, but future edits
   must be made in **both** places (or refactor the orchestrator to reference
   the standalone files).
3. **KV counter race** — funnel counters are read-modify-write; heavy
   concurrency can drop counts. Acceptable now; Durable Object counter is the
   upgrade path (commented in `worker/src/index.js`).
4. **In-memory rate limiting** — the `/analyze` cooldown map is per-isolate;
   Cloudflare may run many isolates, so it's best-effort.
5. **CORS is `*`** — fine for public routes; `/quiz-leads` relies solely on
   the bearer token. Don't weaken that check.
6. **`support.js` loads React from unpkg** — an external CDN dependency. If
   unpkg is down, pages don't render. Self-hosting the two React UMD files is
   a cheap resilience win.
7. **DST shift** — the Wednesday routine fires at 04:00 UTC year-round
   (midnight EDT / 11 PM Tue EST).
8. **`old_webpage/`** — archive of the pre-rebuild site (the old quiz there
   contains the original analytics/share implementation that was ported).
   Safe to delete once confident; kept for reference.
9. **Emails are captured, not contacted** — leads accumulate in KV, but no
   welcome/nurture email is sent automatically. See `outputs/welcome-email.md`.
10. **`blogs.html` is a placeholder** — "coming soon" card; Scout's
    `outputs/content-ideas.md` is the intended source of post topics.

## 6. Suggested next steps (in priority order)

1. Fix the `CLOUDFLARE_API_TOKEN` repo secret → green auto-deploys (§2),
   then rotate the exposed token.
2. Wire an email provider (Resend/MailChannels) into `/quiz-email` so the
   welcome email sends itself; template is ready.
3. Publish the first blog post from the Scout's top-scoring idea; swap the
   blogs.html placeholder for a post list.
4. Self-host React UMD bundles next to `support.js`.
5. Watch `/quiz-stats` for two Builder cycles to get a baseline conversion
   rate before judging quiz refreshes.

## 7. Key file map

```
├── index.html / services.html / quiz.html / blogs.html   ← the site
├── support.js                     ← DCLogic runtime (do not edit; generated)
├── logo-mark-bright.png, logo.svg ← brand
├── worker/
│   ├── src/index.js               ← ALL backend logic (5 routes)
│   └── wrangler.toml              ← worker name, account, KV binding
├── .github/workflows/deploy-worker.yml  ← worker CI/CD
├── assets/agents/                 ← agent fleet prompts (md)
├── outputs/                       ← agent deliverables, logs, templates
│   ├── content-ideas.md           ← Scout output (rewritten weekly)
│   ├── linkedin/<date>.md         ← weekly LinkedIn posts
│   └── welcome-email.md           ← lead email template + runbook
├── docs/                          ← this documentation
└── old_webpage/                   ← pre-rebuild archive
```
