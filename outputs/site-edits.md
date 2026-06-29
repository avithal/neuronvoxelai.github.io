# Task 1: Site Link Audit — Quiz Placement Opportunities

> Every page and section where a link to the CV Sorting Hat quiz (`quiz.html`) would naturally fit.

---

## Homepage (`index.html`)

### Placement 1: Hero Section — Below the subtitle
**Location:** Homepage hero section, directly below "Bridging complex research with production-ready code..."
**Exact copy to add:**
```html
<a href="quiz.html" style="display:inline-block;margin-top:1.5rem;background:linear-gradient(135deg,#7a42b8,#9333ea);color:#fff;padding:0.7rem 1.8rem;border-radius:10px;font-weight:600;text-decoration:none;transition:transform 0.15s,box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">🎩 Take the CV Sorting Hat Quiz</a>
```
**Why it fits:** The hero is the highest-traffic real estate. A CTA here catches every visitor before they scroll. The quiz is a low-commitment, fun entry point that contrasts with the serious technical hero text.

---

### Placement 2: After the 3 capability cards (Medical Image Computing, Robust CV Pipelines, Edge Deployment)
**Location:** Homepage, between the cards grid and the AI Skills Match section
**Exact copy to add:**
```html
<section style="text-align:center;margin-bottom:3rem;padding:2rem;background:linear-gradient(145deg,#141126,#1a1436);border:1px solid rgba(122,66,184,0.15);border-radius:16px;">
    <p style="font-size:1.1rem;color:#a39fb8;margin-bottom:1rem;">Curious which type of CV engineer you are?</p>
    <a href="quiz.html" class="btn">🎩 Take the 2-Minute Sorting Hat Quiz</a>
</section>
```
**Why it fits:** After reading 3 serious technical cards, visitors are primed to engage with something lighter. This is the natural "break" point where a fun CTA converts curiosity into interaction.

---

### Placement 3: Inside the CTA section ("Let's build together")
**Location:** Homepage CTA section, below the "Get in Touch" button
**Exact copy to add:**
```html
<p style="color:#a39fb8;margin-top:1.5rem;font-size:0.9rem;">Or, discover your CV archetype first → <a href="quiz.html" style="color:#c084fc;text-decoration:underline;">Take the Quiz</a></p>
```
**Why it fits:** Visitors who aren't ready to email you need a softer next step. The quiz captures their email without the commitment of a contact form.

---

### Placement 4: AI Skills Match section — After analyzing a job description
**Location:** Inside the results panel, after the AI analysis renders (JavaScript injection)
**Exact copy to add (in the JS `showResults` or stream-complete callback):**
```html
<div style="text-align:center;margin-top:2rem;padding:1.5rem;border-top:1px solid rgba(122,66,184,0.15);">
    <p style="color:#a39fb8;font-size:0.9rem;">Enjoyed the analysis? Find out which CV house you belong to →</p>
    <a href="quiz.html" style="color:#c084fc;font-weight:600;text-decoration:underline;">Take the Sorting Hat Quiz</a>
</div>
```
**Why it fits:** Post-analysis is peak engagement — the visitor just interacted with the AI. They're invested. This is the warmest moment to cross-sell the quiz.

---

## Services Page (`services.html`)

### Placement 5: Below the pricing cards, above the tech stack section
**Location:** Services page, between the 3 pricing tiers and "Hardened Production Stack"
**Exact copy to add:**
```html
<section style="text-align:center;padding:3rem 1rem;max-width:700px;margin:0 auto;">
    <p style="color:#a39fb8;font-size:1rem;margin-bottom:1rem;">Not sure which engagement model fits your team?</p>
    <a href="quiz.html" class="btn">🎩 Take the Quiz — Find Your CV Archetype</a>
</section>
```
**Why it fits:** After seeing pricing ($250/hr, $50K+, $8.5K/mo), some visitors hesitate. The quiz is a zero-friction alternative that still captures their email and lets you follow up.

---

## Quiz Page (`quiz.html`)

### Placement 6: After quiz results — cross-link to services
**Location:** Quiz results panel, below the "Retake the Quiz" button
**Exact copy to add:**
```html
<div style="text-align:center;margin-top:1.5rem;">
    <a href="services.html" style="color:#c084fc;font-size:0.9rem;text-decoration:underline;">Ready to level up? Check out our services →</a>
</div>
```
**Why it fits:** The quiz ends with a recommendation. The natural next step is "how do I actually get this?" — linking to services closes the loop.

---

## Summary: Priority Order

| Priority | Location | Impact |
|---|---|---|
| 🔴 HIGH | Hero section CTA | Catches every visitor |
| 🔴 HIGH | Post-AI-analysis cross-sell | Warmest engagement moment |
| 🟡 MED | After capability cards | Natural content break |
| 🟡 MED | CTA section soft link | Catches non-ready-to-contact visitors |
| 🟢 LOW | Services page below pricing | Friction reducer |
| 🟢 LOW | Quiz → Services cross-link | Closes the funnel |
