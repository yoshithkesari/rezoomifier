# Design System & UI Specification (`DESIGN.md`) — Rezoomifier

## 1. Aesthetic Direction: Casual, Neat & Colorful (Zero AI Slop)
Rezoomifier rejects generic dark-mode neon gradients, purple/indigo SaaS templates, and heavy glassmorphism. Instead, it uses a **tactile, casual, neat editorial-web aesthetic** built on crisp white/warm-paper surfaces, functional **RGBY** color coding, and subtle wavy SVG dividers.

---

## 2. Color Tokens

### Base Surfaces
* **Primary Canvas:** `#FFFFFF` (Pure White)
* **Casual Warm Surface / App Backdrop:** `#FAF9F6` (Warm Alabaster)
* **Preview Desk Backdrop:** `#F3F4F6` (Soft Neutral Gray)
* **Primary Ink / Typography:** `#0F172A` (Deep Slate)
* **Secondary Muted Text:** `#475569` (Slate 600)
* **Subtle Borders:** `#E2E8F0` (1.5px solid)

### Functional RGBY Accents
Colors carry clear functional meaning across the interface rather than decorative noise:
* **Blue (`#2563EB` / tint `#EFF6FF` / border `#BFDBFE`):** PDF Drop Zone, active navigation tabs, primary action buttons.
* **Green (`#16A34A` / tint `#F0FDF4` / border `#BBF7D0`):** Matched JD keywords, passed ATS formatting checks, local-privacy status dot.
* **Yellow / Amber (`#D97706` / tint `#FFFBEB` / border `#FDE68A`):** ATS Match Scorecard highlight card, gentle warnings, sample data badges.
* **Red / Coral (`#E11D48` / tint `#FFF1F2` / border `#FECDD3`):** Missing keyword chips (`+ skill`), destructive reset actions.

---

## 3. Typography & Hierarchy
* **Primary UI Font:** `'Plus Jakarta Sans', 'Inter', system-ui, sans-serif`
* **Resume Document Font Options:** Clean sans-serif (`Inter`) or editorial serif (`Georgia` / `Newsreader`) for the printed resume sheet.
* **Numeric Readouts:** Always apply `font-variant-numeric: tabular-nums` (`tabular-nums`) on ATS percentages, keyword counts, and bullet counters so numbers never jitter while typing.

---

## 4. Signature Motifs & Component Rules
* **Subtle Wavy Dividers:** Use lightweight inline SVG sine-wave rules (`stroke-width: 1.75px`, `stroke-linecap: round`) under the ATS Match Score and section headers to give the interface warmth and flow.
* **Tactile Pill & Card Geometry:**
  * Cards use `rounded-2xl` (`16px`) with crisp `1.5px` borders and soft elevation (`0 8px 24px rgba(15, 23, 42, 0.04)`).
  * Action buttons and keyword chips use `rounded-full` pill shapes with subtle tactile hover lift (`hover:-translate-y-0.5 transition`).
* **Uncluttered Top Bar:**
  * Left: **Rezoomifier** wordmark + 4 small RGBY dots + `100% Local · No Cloud` pill.
  * Right: RGBY resume accent color switcher, `Load Sample`, `Export/Import JSON`, `Clear Local Data`, and primary `Print / Save PDF` button.
* **Print Isolation (`@media print`):**
  * Hide navbar, left sidebar, wavy decorative chrome, and desk padding during print so only the crisp white resume page renders at full width.