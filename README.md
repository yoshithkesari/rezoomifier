# Rezoomifier

> **Beat the ATS. Edit your own resume with zero friction.**

A 100% client-side, privacy-first ATS resume matcher and Word-style live resume playground built with **Vite + React + TypeScript + Tailwind CSS v4 + `pdfjs-dist` + `docx-preview` + `Dexie.js`**.

## Key Features

- **Edit Your Own `.PDF`, `.DOCX`, or `.DOC` Resume Directly:** Opens your uploaded resume as a live, flowing, editable document preserving your headings, horizontal rules, centered contact bars, split left/right date rows, and bullet lists.
- **Strict Single-Font Consistency:** Automatically detects your document's dominant font (`Calibri`, `Times New Roman`, `Arial`, `Inter`, `Georgia`, `Garamond`, `Cambria`) and enforces one consistent font across the entire resume.
- **Word-Style Playground Ribbon:** Customize font family, font size (`9pt–22pt` + `-`/`+`), **Bold**, **Italic**, **Underline**, **Left / Center / Right / Justify / Split `L↔R`** alignment, bullet & numbered lists, indentation (`Tab` / `Shift+Tab`), line spacing, vertical gap nudges (`Gap -` / `Gap +`), page margins, `+ Section`, `+ Role & Date`, `+ Bullet`, `+ Line`, and **Import / Place Lines**.
- **Deterministic JD Keyword Matcher:** Preserves technical tokens (`C++`, `C#`, `.NET`, `Node.js`, `Next.js`, `CI/CD`, `UI/UX`) and multi-word phrases—click or drag missing `+ keyword` chips directly into your resume.
- **Export as `.PDF` or `.DOC`:** Print clean, selectable vector-text PDFs or save as a Word `.DOC` file, with automatic browser-local session persistence in `IndexedDB`.

## Quick Start

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
npm run preview
```
