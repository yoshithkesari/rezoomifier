# Software Requirements Specification (SRS) — Rezoomifier

## 1. Product Overview
* **Product Name:** Rezoomifier
* **Tagline:** *"Beat the ATS. Leave no traces and footsteps around it."*
* **Core Concept:** A 100% client-side, privacy-first ATS resume matcher, analyzer, and live resume builder. All PDF parsing, job description tokenization, ATS scoring, and data persistence happen strictly inside the user's browser with zero backend servers, accounts, or cloud databases.
* **Target Audience:** Job seekers, students, and engineers tailoring resumes to specific job descriptions without uploading personal data to external servers.

---

## 2. System Architecture & Technology Stack
* **Framework:** Vite + React 18+ + TypeScript
* **Styling:** Tailwind CSS v4 (or v3) + Lucide Icons (`lucide-react`)
* **Client-Side PDF Extraction:** `pdfjs-dist` (configured with local Vite worker URL)
* **Local Persistence:** IndexedDB via `Dexie.js` (`dexie` + `dexie-react-hooks`)
* **PDF Export:** Native browser print engine (`@media print` stylesheet outputting clean, ATS-readable selectable text PDFs)

---

## 3. Functional Requirements

### FR-1: Launch Page & Workspace Navigation
* **FR-1.1:** Provide a casual, colorful, welcoming launch view on a crisp off-white/pure-white canvas with a clear privacy badge (`100% Local · Zero Cloud`).
* **FR-1.2:** Allow instant entry into the split-screen editor with zero sign-up or login gates, plus a `Load Sample` action to test the ATS matcher immediately.

### FR-2: Client-Side Drop Zone (PDF Upload & Text Paste)
* **FR-2.1:** Support drag-and-drop and file-picker upload for `.pdf` files.
* **FR-2.2:** Extract raw text locally in the browser using `pdfjs-dist`, reconstructing multi-line reading order via PDF Y-axis coordinate transforms (`item.transform[5]`).
* **FR-2.3:** Provide an editable raw text area so users can paste plain-text resumes directly or inspect extracted PDF text.

### FR-3: Job Description (JD) Parser & Tokenizer
* **FR-3.1:** Provide a dedicated text area for pasting target job descriptions.
* **FR-3.2:** Normalize text (lowercase, strip noise punctuation while preserving technical tokens such as `c++`, `c#`, `node.js`, `next.js`, `ci/cd`).
* **FR-3.3:** Filter out standard English and HR stop-words (`and`, `the`, `with`, `experience`, `responsibilities`, `ability`, etc.).
* **FR-3.4:** Extract both multi-word domain phrases (e.g., `machine learning`, `system design`, `rest api`, `cross-functional`) and ranked single-word hard/soft skill keywords.

### FR-4: Deterministic ATS Match Engine
* **FR-4.1 (Keyword Coverage Score):** Calculate real-time match percentage:
  $$\text{Coverage \%} = \left( \frac{\text{Matched JD Keywords}}{\text{Total Extracted JD Keywords}} \right) \times 100$$
* **FR-4.2 (Interactive Missing Keywords):** Display missing keywords as clickable chips. Clicking any missing keyword chip automatically appends it to the user's `Skills` / resume text and recalculates the score in real time.
* **FR-4.3 (Matched Keywords Feedback):** Display matched keywords clearly so users see what is already working.
* **FR-4.4 (Formatting & Structural Heuristics):** Run live rule checks for:
  1. Contact information presence (valid email + phone pattern)
  2. Standard `Experience` section header
  3. Standard `Education` section header
  4. Bullet point structure ($\ge 3$ action bullets)
  5. Quantified impact metrics ($\ge 2$ numbers, percentages, or multipliers like `40%`, `2x`, `$1M`)

### FR-5: Live Resume Builder & ATS-Safe Print Export
* **FR-5.1:** Provide structured editor inputs (`Full Name`, `Target Title`, `Email`, `Phone`, `Location`, `Summary`, `Experience`, `Projects`, `Education`, `Skills`) alongside a live A4/Letter preview sheet.
* **FR-5.2:** Include an auto-section splitter button that parses raw dropped PDF text into the structured fields (`Summary`, `Experience`, `Projects`, `Education`, `Skills`).
* **FR-5.3:** Clicking `Print / Save PDF` hides all editor controls via `@media print` and exports a clean, ATS-parsable PDF document.

### FR-6: Browser-Local Persistence (IndexedDB)
* **FR-6.1:** Automatically persist all workspace fields, raw PDF text, job description, and theme accent choice to IndexedDB (`RezoomifierLocalDB`) on every edit.
* **FR-6.2:** Restore the exact session automatically when the user closes and reopens the browser tab.
* **FR-6.3:** Provide a `Clear Local Data` button to wipe IndexedDB state on demand, plus `Export JSON` / `Import JSON` for local file backup.

---

## 4. Non-Functional Requirements
* **Privacy:** Zero external network calls for user resume or JD data.
* **Performance:** PDF parsing completes in `< 500ms` for standard 1–2 page resumes; ATS re-scoring runs in `< 50ms` per input change.
* **Print Integrity:** Exported PDFs must contain selectable vector text (never rasterized screenshots) so real ATS parsers can read them.