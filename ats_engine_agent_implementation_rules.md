# Implementation Skills & Domain Rules (`SKILLS.md`) — Rezoomifier

Use these deterministic engineering rules when implementing or extending Rezoomifier's client-side parsing, ATS matching, and browser storage engines.

---

## Skill 1: Client-Side PDF Text Extraction (`pdfjs-dist`)
* **Worker Setup:** Always configure `pdfjsLib.GlobalWorkerOptions.workerSrc` using Vite's `?url` asset import (`import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'`) so PDF parsing works offline and without CDN failures.
* **Line Reconstruction:** PDF text items arrive as positioned spans (`item.str` + `item.transform[5]` Y-coordinate). Group items whose Y-coordinates differ by `<= 4` units onto the same line, and insert `\n` when `Math.abs(y - lastY) > 4` to preserve bullet points and section headers accurately.

---

## Skill 2: Stop-Word Stripping & JD Skill Tokenization
* **Token Preservation:** Before stripping punctuation, preserve technical tokens containing `+`, `#`, `.`, or `/` (e.g., `c++`, `c#`, `node.js`, `next.js`, `ci/cd`, `ui/ux`).
* **Multi-Word Phrase Dictionary:** Match common multi-word hard/soft skills prior to single-word splitting (`machine learning`, `deep learning`, `system design`, `rest api`, `restful apis`, `unit testing`, `data structures`, `cloud computing`, `project management`, `problem solving`, `cross-functional`, `version control`, `agile methodology`, `react native`, `tailwind css`).
* **Stop-Word Filtering:** Strip standard English stop-words AND generic job-posting filler (`role`, `team`, `work`, `working`, `years`, `ability`, `strong`, `skills`, `using`, `build`, `looking`, `join`, `must`, `preferred`, `plus`, `responsibilities`, `requirements`).
* **Frequency Ranking:** Rank remaining tokens by frequency in the JD and cap extracted target keywords at the top `25–30` terms to keep the ATS score meaningful and actionable.

---

## Skill 3: Auto-Section Splitter for Raw PDF Text
When a user drops a PDF, provide a one-click `Auto-Fill Structured Fields` parser that scans line headers using case-insensitive regex anchors:
* `Summary`: `/^(summary|profile|objective|about)\b/i`
* `Experience`: `/^(experience|work experience|employment|work history)\b/i`
* `Projects`: `/^(projects|personal projects|key projects)\b/i`
* `Education`: `/^(education|academic|qualifications)\b/i`
* `Skills`: `/^(skills|technical skills|core competencies|technologies)\b/i`
* Anything above the first recognized header maps automatically to `Full Name`, `Target Title`, `Email`, and `Phone`.

---

## Skill 4: IndexedDB Local Persistence (`Dexie.js`)
* Store the active workspace under a deterministic key (`id: 'active-session'`) in `RezoomifierLocalDB`.
* Use `useLiveQuery` from `dexie-react-hooks` for reactive UI updates.
* Include a `Load Sample` preset (with a realistic software/product resume and matching job description) so first-time visitors can see a live 80%+ ATS match immediately.