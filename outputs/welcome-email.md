# Quiz Welcome Email — Template

Send this to every new lead captured by the CV Sorting Hat quiz. It works as a
one-off welcome or as the first touch in a nurture sequence. Swap `{{house}}`,
`{{house_title}}`, and `{{recommendation}}` per lead (all three are stored in KV
and included in the CSV export — see "Weekly export" below).

---

**Subject:** Your Computer Vision house has spoken 🎩

**Preview text:** {{house}} suits you — here's what to do with it.

**Body:**

Hey there,

The Sorting Hat has ruled: you're **{{house}}** — {{house_title}}.

That's not just a fun label. It says something about how you approach real CV
work — the trade-offs you reach for first, the problems you actually enjoy.

Based on your result, one thing worth your time this week:

> **{{recommendation}}**

No pitch, no pressure — just the resource we'd point a {{house}} toward if they
asked us over coffee.

Two quick things:
- Reply to this email with the hardest CV problem on your plate right now. We
  read every one, and we often turn the best questions into a teardown.
- Know someone who'd argue they're a different house? Send them the quiz:
  https://neuronvoxelai.com/quiz.html

Talk soon,
The NeuronVoxel AI team

*You're getting this because you took the CV Sorting Hat quiz. Not for you?
Reply "unsubscribe" and we'll take you off the list — no hard feelings.*

---

## How to actually send these

There is **no email-sending provider wired up yet** — the quiz only *captures*
addresses into Cloudflare KV. To send, pick one:

1. **Manual / batch (simplest):** export the CSV (below), paste into your email
   tool of choice (Mailchimp, Buttondown, plain BCC for small batches), and send
   this template with the per-lead fields filled in.
2. **Automated:** add a provider (Resend / SendGrid / MailChannels) to the
   Worker and call it from the `/quiz-email` route right after the KV write, so
   the welcome email fires on signup. Store the provider key with
   `npx wrangler secret put RESEND_API_KEY` (or similar) — never in source.

## Weekly export (Wednesday cadence pairs with the Scout run)

The Worker exposes a token-protected CSV export. Set the token once:

```bash
cd worker
npx wrangler secret put EXPORT_TOKEN     # paste a long random string
```

Then pull the current lead list any time:

```bash
curl -H "Authorization: Bearer <your-token>" \
  https://neuronvoxel-nim-proxy.neuronvoxelai.workers.dev/quiz-leads \
  -o leads.csv
```

Columns: `email, house, timestamp, scores`. Keys are deduplicated by email, so
re-takers don't create duplicate rows.

## Funnel numbers

The quiz reports a start → complete → email funnel. Check conversion any time:

```bash
curl https://neuronvoxel-nim-proxy.neuronvoxelai.workers.dev/quiz-stats
```

Returns totals, per-day buckets, and completion / email / overall conversion
rates — useful for judging whether each fortnightly quiz refresh actually helps.
