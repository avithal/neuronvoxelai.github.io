# NeuronVoxel AI — Project Handoff

## Repository

| Field | Value |
|-------|-------|
| **Remote** | [https://github.com/avithal/neuronvoxelai.github.io](https://github.com/avithal/neuronvoxelai.github.io) |
| **Branch** | `main` |
| **Custom Domain** | `neuronvoxelai.com` (configured via `CNAME`) |
| **Hosting** | GitHub Pages (serves from `main` branch root) |
| **Local Path** | `D:\neuronvoxelai-site` |

---

## File Inventory

| File / Dir | Purpose |
|------------|---------|
| `index.html` | Single-page landing site — all HTML, CSS, and layout are self-contained (inline `<style>` block). |
| `logo.svg` | Primary SVG logo used in the header. |
| `logo1.svg` | Alternate logo variant (tracked but not currently referenced by `index.html`). |
| `logo.png` | Raster version of the logo. |
| `CNAME` | GitHub Pages custom-domain pointer → `neuronvoxelai.com`. |
| `.gitignore` | Ignores `skills_mine-main/` to keep local skill files out of the repo. |
| `skills_mine-main/` | **Local-only** directory (git-ignored). Contains personal/skill reference material; never pushed to remote. |

---

## Tech Stack & Architecture

- **Pure static site** — no build step, no bundler, no framework.
- CSS is embedded inline in `index.html` using CSS custom properties (`:root` variables).
- Color scheme: dark purple/indigo (`--bg-color: #0b0914`, accent `--accent-purple: #7a42b8`).
- Responsive grid layout (`auto-fit, minmax(300px, 1fr)`).
- Hover micro-animations on cards (`translateY`, border-color transition).

---

## What Was Done in This Session

1. **Pulled latest changes** from `origin/main` (resolved a diverged-history via `git pull --rebase`).
2. **Created `.gitignore`** — added `skills_mine-main/` so the local skill files stay out of version control.
3. **Staged and committed** new files (`logo.png`, `.gitignore`).
4. **Pushed** everything to `origin/main` — the remote is now fully in sync.

---

## Next Steps / Open Items

- [ ] **Update contact email** — `index.html` line 189 still has the placeholder `your-email@example.com`.
- [ ] **Verify DNS** — ensure `neuronvoxelai.com` A/CNAME records point to GitHub Pages IPs (`185.199.108-111.153`). Check under repo **Settings → Pages** for any HTTPS / DNS errors.
- [ ] **Add favicon** — no `favicon.ico` or `<link rel="icon">` tag is present yet.
- [ ] **Consider separating CSS** — the inline `<style>` block works fine for a single page, but an external `style.css` would be cleaner if more pages are added.
- [ ] **SEO meta tags** — add `<meta name="description">` and Open Graph tags for better link previews.
- [ ] **`logo1.svg` cleanup** — decide whether to keep or remove the unused alternate logo.

---

## Deployment

Pushing to `main` is all that's needed — GitHub Pages auto-deploys from the branch root.

```bash
git add -A
git commit -m "your message"
git push origin main
```

The site should be live at **https://neuronvoxelai.com** (and **https://avithal.github.io/neuronvoxelai.github.io** as fallback) within ~60 seconds of a push.
