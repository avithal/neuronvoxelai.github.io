// ──────────────────────────────────────────────────────────────
// NeuronVoxel AI — NVIDIA NIM Proxy Worker
// Secure backend that holds the resume + API key server-side.
// Visitors only send a job description; the key never leaves here.
// Routes: /analyze, /quiz-email, /quiz-event, /quiz-stats, /quiz-leads
// ──────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  "https://neuronvoxelai.com",
  "https://www.neuronvoxelai.com",
  "https://avithal.github.io",
  "http://localhost",
  "http://127.0.0.1",
];

// ── Easily swappable model ──────────────────────────────────
const NIM_MODEL = "meta/llama-3.1-8b-instruct";
const NIM_BASE_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

// ── Rate limiting (simple in-memory, per-IP, 10s cooldown) ──
const RATE_LIMIT_MS = 10_000;
const ipTimestamps = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const last = ipTimestamps.get(ip) || 0;
  if (now - last < RATE_LIMIT_MS) return true;
  ipTimestamps.set(ip, now);
  // Prune old entries every ~100 requests
  if (ipTimestamps.size > 500) {
    for (const [k, v] of ipTimestamps) {
      if (now - v > RATE_LIMIT_MS * 6) ipTimestamps.delete(k);
    }
  }
  return false;
}

// ── Resume (baked in — never sent to the browser) ───────────
const RESUME = `
Avithal E. Lautman, MSc
Rockville, MD (DMV Region — US Green Card Holder)
301-232-8139 | avithal@gmail.com
github.com/avithal | linkedin.com/in/avithal-e-lautman-5350aa15/

Senior Computer Vision Engineer — 10+ Years in Perception Systems & Production ML

About Me:
Dynamic "do-it-all" Computer Vision expert with 10+ years of experience building end-to-end robust perception systems. Fast learner of emerging technologies, with a proven ability to self-teach and deploy cutting-edge research into stable production environments. Specialized in resource-constrained optimization, maximizing compute efficiency without sacrificing robustness. Expert in the full SDLC, combining high-level architecture with meticulous documentation and engineering best practices.

Skills:
- Computer Vision & AI: OpenCV, PyTorch, TensorFlow, YOLO, Mask-RCNN, U-Net, ResNet, ViT, DINO, SAM, SLAM, OCR, ONNX
- Emerging Tech: Generative AI, Diffusion models, LLMs, RAG, NeRF, Gaussian Splatting, Claude (Anthropic), Prompt Optimization
- 3D & Medical Imaging: MRI/CT Reconstruction, Point Clouds, SLAM, Quaternions, VTK, SimpleITK
- Systems & MLOps: SDLC Documentation, Google Cloud, Azure DevOps, CI/CD, Jetson Orin Nano, C++, Python, SQL, NSIGHT

Experience:

Freelance — Robotics & Computer Vision Engineer (June 2025 - Present, USA)
• Project 1: Edge Vision & Multimodal AI System
  - Architected and deployed YOLO, OCR, and EfficientNet on a Jetson Orin Nano, prioritizing minimal memory footprints and 100% field robustness utilizing classical CV to deliver a working proof-of-concept in just 2 months.
  - Integrated multimodal features for voice-command operations alongside vision pipelines; developed automation, monitoring, and watchdog fault-recovery scripts to ensure long-term production stability.
  - Applied SDLC best practices, maintaining comprehensive deployment documentation via Git and Azure DevOps.
• Project 2: CNC Machine Tending Automation
  - Programmed a 6-axis robotic arm to automate raw material block loading and unloading for a CNC machine. Designed custom end-of-arm tooling with Gigapose, SAM3, Multiview refinement to ensure precise workpiece placement and 100% operational safety.

Applied Spectral Imaging — Computer Vision Engineer (April 2023 - Dec 2024, Israel)
• High-Impact CV: Slashed diagnostic time by 83% by designing and validating deep learning models (U-Net, ResNet) for genomic analysis.
• Production Scaling: Boosted model accuracy from 90% to 97% by owning the ML lifecycle and implementing CI/CD best practices in PyTorch via Git and Azure DevOps.

Novocure — Algorithm Engineer (June 2021 - March 2023, Israel)
• Precision Modeling and treatment planning cancer: Reconstructed 3D volumetric models and placed electrodes for electrical simulation using MRI/CT meshes and quaternions.
• Technology Pioneer: Self-learned and introduced XGBoost, advanced NeRF research and 3D modeling technologies to drive internal R&D innovation.

EchoLogic Medical — Senior Computer Vision Engineer (June 2017 - June 2021, Israel)
• Low-Resource Optimization: Engineered a GPU-free inference pipeline maintaining 85% accuracy for cost-effective clinical deployment using LeNet and XGBoost.
• FDA Deployment: Led the design of real-time AI prototypes for clinical workflows, bridging technical implementation with regulatory validation.

Earlier CV Innovation (Eyecue & DIR Tech) — Computer Vision Engineer (2015 - 2017, Israel)
• Deep-Rooted CV Expertise: Developed custom SLAM on SURF-based feature detection from scratch, avoiding reliance on external libraries with multi-camera calibration and re-identification (ReID).
• Revenue Growth: Created tailored real-time algorithms for infrared inspection, contributing to $12M in new business.

Education:
Technion - Israel Institute of Technology — M.Sc. Electrical Engineering (Oct 2011 - May 2014)
  Recipient of Joan and Irwin Jacob Scholarship
  Thesis: Statistical Analysis of Particle Transport and Interactions in Metastatic Cancer

Calicut University — B.Tech. Electronics and Communication Engineering (Aug 2006 - July 2010)
  Graduated top of class with honours.
  Final project: Obstacle Detection using Single Camera
`;

// ── System prompt ───────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert technical recruiter AI for NeuronVoxel AI. You have deep knowledge of the candidate whose resume is provided below. When given a job description, you must analyze how well this candidate matches the role.

CANDIDATE RESUME:
${RESUME}

YOUR OUTPUT FORMAT (use exactly this structure, with markdown):

## 🎯 Overall Match: [X]%

### Category Scores
| Category | Score | Notes |
|----------|-------|-------|
| Technical Skills | X/10 | [brief note] |
| Experience Level | X/10 | [brief note] |
| Domain Fit | X/10 | [brief note] |
| Education & Research | X/10 | [brief note] |

### ✅ Strengths
- [bullet points of matching strengths]

### ⚠️ Gaps
- [bullet points of missing or weak areas]

### 💡 Detailed Analysis
[2-3 paragraphs of detailed analysis explaining the match, calling out specific resume items that align with job requirements, and noting any areas where additional experience or skills would strengthen the candidacy. Be specific — reference exact technologies, projects, and achievements from the resume.]

### 📋 Recommendation
[One paragraph summary: would you recommend this candidate for the role, and why or why not?]

RULES:
- Be honest and objective. If the candidate is not a good fit, say so clearly.
- Always reference specific items from the resume.
- The overall % should reflect a weighted combination of the four category scores.
- Format your response in clean markdown.`;

// ── CORS helpers ────────────────────────────────────────────
function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

// ── Quiz funnel analytics ───────────────────────────────────
// One JSON counter per UTC day, stored in the same KV namespace under
// the `stat:` prefix. Read-modify-write is fine at lead-magnet traffic;
// at high concurrency swap this for a Durable Object counter.
const VALID_EVENTS = { start: "starts", complete: "completions", email: "emails" };

async function bumpStat(env, type) {
  const field = VALID_EVENTS[type];
  if (!field || !env.QUIZ_EMAILS) return;
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const key = `stat:${day}`;
  let rec = { starts: 0, completions: 0, emails: 0 };
  try {
    const cur = await env.QUIZ_EMAILS.get(key);
    if (cur) rec = { ...rec, ...JSON.parse(cur) };
  } catch {}
  rec[field] = (rec[field] || 0) + 1;
  await env.QUIZ_EMAILS.put(key, JSON.stringify(rec));
}

// ── Main handler ────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const corsHeaders = getCorsHeaders();

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // ── Route: GET /quiz-stats — public funnel numbers ──
    if (request.method === "GET" && url.pathname === "/quiz-stats") {
      const totals = { starts: 0, completions: 0, emails: 0 };
      const byDay = {};
      try {
        const list = await env.QUIZ_EMAILS.list({ prefix: "stat:" });
        for (const k of list.keys) {
          const cur = await env.QUIZ_EMAILS.get(k.name);
          if (!cur) continue;
          const rec = JSON.parse(cur);
          const day = k.name.slice(5);
          byDay[day] = rec;
          totals.starts += rec.starts || 0;
          totals.completions += rec.completions || 0;
          totals.emails += rec.emails || 0;
        }
      } catch (err) {
        console.error("Stats read error:", err);
        return json({ error: "Failed to read stats." }, 500);
      }
      const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
      return json({
        totals,
        conversion: {
          completionRate: pct(totals.completions, totals.starts),
          emailRate: pct(totals.emails, totals.completions),
          overallRate: pct(totals.emails, totals.starts),
        },
        byDay,
      });
    }

    // ── Route: GET /quiz-leads — token-protected CSV export ──
    if (request.method === "GET" && url.pathname === "/quiz-leads") {
      const auth = request.headers.get("Authorization") || "";
      const token = auth.replace(/^Bearer\s+/i, "").trim();
      if (!env.EXPORT_TOKEN || token !== env.EXPORT_TOKEN) {
        return json({ error: "Unauthorized." }, 401);
      }
      try {
        const rows = [["email", "house", "timestamp", "scores"]];
        let cursor;
        do {
          const list = await env.QUIZ_EMAILS.list({ prefix: "lead:", cursor });
          for (const k of list.keys) {
            const cur = await env.QUIZ_EMAILS.get(k.name);
            if (!cur) continue;
            const r = JSON.parse(cur);
            const csvCell = (v) => `"${String(v).replace(/"/g, '""')}"`;
            rows.push([
              csvCell(r.email || ""),
              csvCell(r.house || ""),
              csvCell(r.timestamp || ""),
              csvCell(JSON.stringify(r.scores || {})),
            ]);
          }
          cursor = list.list_complete ? undefined : list.cursor;
        } while (cursor);
        const csv = rows.map((r) => r.join(",")).join("\n");
        return new Response(csv, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="quiz-leads.csv"',
          },
        });
      } catch (err) {
        console.error("Leads export error:", err);
        return json({ error: "Failed to export leads." }, 500);
      }
    }

    // Only accept POST for everything below
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed." }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Route: POST /quiz-email — save quiz lead to KV ──
    if (url.pathname === "/quiz-email") {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid JSON body." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const email = (body.email || "").trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return new Response(
          JSON.stringify({ error: "Invalid email address." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const record = {
        email,
        house: body.house || "unknown",
        scores: body.scores || {},
        timestamp: new Date().toISOString(),
        ip: request.headers.get("CF-Connecting-IP") || "unknown",
      };

      try {
        // Store in KV with email as key (deduplicates)
        await env.QUIZ_EMAILS.put(
          `lead:${email}`,
          JSON.stringify(record),
          { expirationTtl: 60 * 60 * 24 * 365 } // 1 year
        );
        await bumpStat(env, "email");
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        console.error("KV write error:", err);
        return new Response(
          JSON.stringify({ error: "Failed to save. Please try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Route: POST /quiz-event — funnel analytics beacon ──
    if (url.pathname === "/quiz-event") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON body." }, 400);
      }
      if (!VALID_EVENTS[body.type]) {
        return json({ error: "Invalid event type." }, 400);
      }
      try {
        await bumpStat(env, body.type);
      } catch (err) {
        console.error("Stat bump error:", err);
      }
      return json({ success: true });
    }

    // ── Route: POST /analyze — NIM resume matcher ───────
    if (url.pathname !== "/analyze") {
      return json(
        { error: "Not found. Use POST /analyze, POST /quiz-email, POST /quiz-event, GET /quiz-stats, or GET /quiz-leads." },
        404
      );
    }

    // Rate limit
    const clientIP =
      request.headers.get("CF-Connecting-IP") ||
      request.headers.get("X-Forwarded-For") ||
      "unknown";
    if (isRateLimited(clientIP)) {
      return new Response(
        JSON.stringify({
          error: "Please wait a few seconds before trying again.",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jobDescription = (body.jobDescription || "").trim();
    if (!jobDescription || jobDescription.length < 20) {
      return new Response(
        JSON.stringify({
          error: "Please provide a job description (at least 20 characters).",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (jobDescription.length > 10000) {
      return new Response(
        JSON.stringify({
          error: "Job description is too long. Please keep it under 10,000 characters.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call NVIDIA NIM with streaming
    try {
      const nimResponse = await fetch(NIM_BASE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.NIM_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: NIM_MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `Please analyze how well the candidate matches this job description:\n\n---\n${jobDescription}\n---`,
            },
          ],
          temperature: 0.3,
          max_tokens: 1024,
          stream: true,
        }),
      });

      if (!nimResponse.ok) {
        const errText = await nimResponse.text();
        console.error("NIM API error:", nimResponse.status, errText);
        let userMsg = "AI service temporarily unavailable. Please try again in a moment.";
        try {
          const errJson = JSON.parse(errText);
          if (errJson.detail) userMsg = "NIM error: " + errJson.detail;
          if (errJson.error) userMsg = "NIM error: " + (errJson.error.message || errJson.error);
        } catch {}
        return new Response(
          JSON.stringify({ error: userMsg }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Stream the response through to the client
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      // Process the SSE stream from NIM in the background
      (async () => {
        try {
          const reader = nimResponse.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;
              const data = trimmed.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || "";
                if (content) {
                  await writer.write(encoder.encode(content));
                }
              } catch {}
            }
          }
        } catch (err) {
          console.error("Stream processing error:", err);
        } finally {
          await writer.close();
        }
      })();

      return new Response(readable, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain; charset=utf-8",
          "Transfer-Encoding": "chunked",
          "X-Model": NIM_MODEL,
        },
      });
    } catch (err) {
      console.error("Worker error:", err);
      return new Response(
        JSON.stringify({ error: "An unexpected error occurred." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  },
};
