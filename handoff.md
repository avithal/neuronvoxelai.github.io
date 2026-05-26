# Handoff — NeuronVoxel AI: Resume-Job Matcher

## What Was Built

Added an **AI-powered Skills Match section** to `neuronvoxelai.com`. Recruiters and clients paste a job description; a Cloudflare Worker calls NVIDIA NIM with the site owner's resume baked server-side; the visitor sees a structured scorecard + detailed analysis of how well the owner's skills match.

## Architecture

```
Visitor Browser  →  GitHub Pages (index.html)  →  Cloudflare Worker (proxy)  →  NVIDIA NIM API
                     (static, no secrets)          (holds resume + API key)      (LLM inference)
```

- **Frontend**: Single `index.html` on GitHub Pages — dark purple theme, Inter font, inline CSS, vanilla JS
- **Backend**: Cloudflare Worker at `https://neuronvoxel-nim-proxy.neuronvoxelai.workers.dev`
- **Model**: `meta/llama-3.1-70b-instruct` (swap in `worker/src/index.js` → `NIM_MODEL` constant)
- **Secrets**: NIM API key stored as a Cloudflare Worker secret (`NIM_API_KEY`), Cloudflare API token was used for deploy only

## Key Files

| File | Purpose |
|------|---------|
| `index.html` | Full site: landing page + AI matcher section + inline JS |
| `worker/src/index.js` | Cloudflare Worker: CORS, rate-limiting, resume, prompt, NIM proxy |
| `worker/wrangler.toml` | Worker config (account ID, name, compatibility date) |
| `worker/package.json` | Worker deps (wrangler only) |
| `.gitignore` | Ignores `skills_mine-main/`, `worker/node_modules/`, `worker/.wrangler/`, `*.pdf` |
| `CNAME` | GitHub Pages custom domain → `neuronvoxelai.com` |

## Credentials & Secrets

- **NVIDIA NIM key**: stored as Cloudflare Worker secret `NIM_API_KEY` — NOT in source code
- **Cloudflare API token**: was set as env var `CLOUDFLARE_API_TOKEN` for deploy — NOT persisted
- **Account ID**: `b1c802cd267fad92711fcab0ea5ef304` (in `wrangler.toml`, non-secret)
- **Worker subdomain**: `neuronvoxelai.workers.dev`

## What's Working

- [x] Cloudflare Worker deployed and accepting POST requests at `/analyze`
- [x] NIM API key set as encrypted Worker secret
- [x] Frontend renders AI matcher section with textarea, button, loading spinner, error handling
- [x] Markdown rendering for AI response (tables, headers, lists, bold, code)
- [x] 10-second client-side + server-side rate limiting
- [x] CORS restricted to allowed origins
- [x] Input validation (min 20 chars, max 10,000 chars)
- [x] Responsive design (desktop, tablet, mobile breakpoints)
- [x] Contact email updated from placeholder to `avithal@gmail.com`
- [x] SEO meta tags and Open Graph tags added
- [x] Committed and pushed to `origin/main`

## Known Issues / Next Steps

- [ ] **TLS propagation**: The `neuronvoxelai.workers.dev` subdomain was just created — TLS certificate may take up to 5 minutes to fully propagate. Test by visiting `https://neuronvoxel-nim-proxy.neuronvoxelai.workers.dev/analyze` in a browser.
- [ ] **Add favicon**: Still no `favicon.ico` or `<link rel="icon">`
- [ ] **`logo1.svg` cleanup**: Unused alternate logo still tracked in repo
- [ ] **DNS verification**: Confirm `neuronvoxelai.com` CNAME/A records point to GitHub Pages IPs
- [ ] **Production NIM model**: Free tier has 40 req/min limit. If traffic grows, consider upgrading or adding a queue.
- [ ] **Custom Worker domain**: Currently on `workers.dev`; could be mapped to `api.neuronvoxelai.com` via Cloudflare dashboard for cleaner URLs.

## Suggested Skills for Next Session

- `/grill-with-docs` — if expanding the site with more pages or features
- `/tdd` — if adding test coverage to the Worker
- `/diagnose` — if debugging NIM API issues or CORS problems

## Deployment Commands

```bash
# Site (GitHub Pages — auto-deploys on push)
git add -A && git commit -m "message" && git push origin main

# Worker (Cloudflare)
cd worker
$env:CLOUDFLARE_API_TOKEN = "<token>"
npx wrangler deploy

# Set/update NIM API key
echo "<key>" | npx wrangler secret put NIM_API_KEY
```
