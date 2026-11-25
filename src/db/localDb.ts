import Dexie, { type EntityTable } from 'dexie';
import {
  UNIFIED_FONT_STACKS,
  UnifiedResumeFontId,
  UploadedFileType,
  WorkspaceSession,
} from '../types';

export const ACTIVE_SESSION_ID = 'active-session' as const;

export function stripMixedFontFamilies(htmlOrCss: string): string {
  if (!htmlOrCss) return '';
  return htmlOrCss
    .replace(/font-family\s*:[^;"']+;?/gi, '')
    .replace(/[\uF0B7\uF0A7\uF0D8\uF076\uF0FC]/g, '•');
}

/**
 * Upgrades any legacy hanging-indent .rz-bullet divs in saved sessions to clean semantic <ul><li> lists
 * and normalizes split-row spans so alignment & spacing work cleanly even without re-uploading.
 */
function normalizeSavedResumeHtml(html: string): string {
  const cleaned = stripMixedFontFamilies(html);
  if (!cleaned.trim() || typeof document === 'undefined') return cleaned;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = cleaned;

  // Upgrade consecutive .rz-bullet divs into <ul class="rz-list"><li class="rz-li">...</li></ul>
  const legacyBullets = Array.from(wrapper.querySelectorAll('div.rz-bullet'));
  for (const b of legacyBullets) {
    if (!b.parentElement) continue;
    const fontSize = (b as HTMLElement).style.fontSize || '13px';
    const li = document.createElement('li');
    li.className = 'rz-li';
    li.style.marginTop = '2px';
    li.style.fontSize = fontSize;
    li.style.color = '#000000';
    li.innerHTML = b.innerHTML.replace(/^\s*(?:[•▪◦‣–—*-])(?:\s+|&nbsp;)*/i, '').trim();

    const prev = b.previousElementSibling;
    if (prev && prev.tagName === 'UL' && prev.classList.contains('rz-list')) {
      prev.appendChild(li);
      b.remove();
    } else {
      const ul = document.createElement('ul');
      ul.className = 'rz-list';
      ul.style.margin = `${(b as HTMLElement).style.marginTop || '3px'} 0 0 0`;
      ul.style.paddingLeft = '18px';
      ul.style.fontSize = fontSize;
      ul.style.color = '#000000';
      ul.appendChild(li);
      b.replaceWith(ul);
    }
  }

  // Ensure .rz-split-row children carry .rz-split-left / .rz-split-right classes
  wrapper.querySelectorAll('div.rz-split-row').forEach((row) => {
    const spans = row.querySelectorAll(':scope > span');
    if (spans.length >= 2) {
      spans[0].classList.add('rz-split-left');
      spans[spans.length - 1].classList.add('rz-split-right');
    }
  });

  return wrapper.innerHTML;
}

function plainTextToSimpleHtml(text: string): string {
  if (!text.trim()) return '';
  const lines = text.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return '<div style="height:8px"></div>';
    const escaped = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<div style="font-size:13px;color:#000000;margin-top:2px;">${escaped}</div>`;
  });
  return `<div class="rz-pdf-editable-page" style="padding:40px 48px;">${lines.join('\n')}</div>`;
}

export function createEmptySession(): WorkspaceSession {
  return {
    id: ACTIVE_SESSION_ID,
    uploadedFileName: '',
    uploadedFileType: 'none',
    resumeFontId: 'calibri',
    lineSpacing: '1.3',
    pageMargin: 'normal',
    editableHtml: '',
    editableCss: '',
    originalEditableHtml: '',
    externalRevision: 1,
    rawResumeText: '',
    jobDescription: '',
    updatedAt: Date.now(),
  };
}

class RezoomifierDatabase extends Dexie {
  sessions!: EntityTable<WorkspaceSession, 'id'>;

  constructor() {
    super('RezoomifierLocalDB');
    this.version(1).stores({
      sessions: 'id, updatedAt',
    });
  }
}

export const db = new RezoomifierDatabase();

export async function ensureActiveSession(): Promise<WorkspaceSession> {
  const existing = (await db.sessions.get(ACTIVE_SESSION_ID)) as
    | (Partial<WorkspaceSession> & { isSampleLoaded?: boolean })
    | undefined;

  if (existing && !existing.isSampleLoaded) {
    const rawHtml =
      existing.editableHtml && existing.editableHtml.trim().length > 0
        ? existing.editableHtml
        : plainTextToSimpleHtml(existing.rawResumeText ?? '');

    const cleanedHtml = normalizeSavedResumeHtml(rawHtml);
    const cleanedOriginalHtml = normalizeSavedResumeHtml(
      existing.originalEditableHtml ?? cleanedHtml
    );
    const cleanedCss = stripMixedFontFamilies(existing.editableCss ?? '');

    const validFontId: UnifiedResumeFontId =
      existing.resumeFontId && existing.resumeFontId in UNIFIED_FONT_STACKS
        ? existing.resumeFontId
        : 'calibri';

    const validSpacing = (['1.15', '1.3', '1.45', '1.6'] as const).includes(
      existing.lineSpacing as '1.3'
    )
      ? (existing.lineSpacing as WorkspaceSession['lineSpacing'])
      : '1.3';

    const validMargin = (['narrow', 'normal', 'wide'] as const).includes(
      existing.pageMargin as 'normal'
    )
      ? (existing.pageMargin as WorkspaceSession['pageMargin'])
      : 'normal';

    const normalized: WorkspaceSession = {
      id: ACTIVE_SESSION_ID,
      uploadedFileName: String(existing.uploadedFileName ?? ''),
      uploadedFileType: (existing.uploadedFileType as UploadedFileType) ?? 'none',
      resumeFontId: validFontId,
      lineSpacing: validSpacing,
      pageMargin: validMargin,
      editableHtml: cleanedHtml,
      editableCss: cleanedCss,
      originalEditableHtml: cleanedOriginalHtml,
      externalRevision:
        (typeof existing.externalRevision === 'number' ? existing.externalRevision : 1) + 1,
      rawResumeText: String(existing.rawResumeText ?? ''),
      jobDescription: String(existing.jobDescription ?? ''),
      updatedAt: existing.updatedAt ?? Date.now(),
    };
    await db.sessions.put(normalized);
    return normalized;
  }

  const fresh = createEmptySession();
  await db.sessions.put(fresh);
  return fresh;
}

export async function saveSessionPatch(patch: Partial<WorkspaceSession>): Promise<void> {
  const current = (await db.sessions.get(ACTIVE_SESSION_ID)) ?? createEmptySession();
  await db.sessions.put({
    ...current,
    ...patch,
    id: ACTIVE_SESSION_ID,
    updatedAt: Date.now(),
  });
}

export async function saveLiveResumeEdit(
  editableHtml: string,
  rawResumeText: string
): Promise<void> {
  const current = (await db.sessions.get(ACTIVE_SESSION_ID)) ?? createEmptySession();
  await db.sessions.put({
    ...current,
    editableHtml,
    rawResumeText,
    updatedAt: Date.now(),
  });
}

export async function resetResumeEditsInDB(): Promise<void> {
  const current = await db.sessions.get(ACTIVE_SESSION_ID);
  if (!current || !current.originalEditableHtml) return;

  const temp = document.createElement('div');
  temp.innerHTML = current.originalEditableHtml;
  temp.style.position = 'fixed';
  temp.style.left = '-99999px';
  let restoredText = '';
  document.body.appendChild(temp);
  try {
    restoredText = temp.innerText.trim();
  } finally {
    temp.remove();
  }

  await db.sessions.put({
    ...current,
    editableHtml: current.originalEditableHtml,
    rawResumeText: restoredText,
    externalRevision: (current.externalRevision ?? 1) + 1,
    updatedAt: Date.now(),
  });
}

export async function clearLocalDataInDB(): Promise<void> {
  const current = await db.sessions.get(ACTIVE_SESSION_ID);
  const fresh = createEmptySession();
  fresh.externalRevision = (current?.externalRevision ?? 1) + 1;
  await db.sessions.put(fresh);
}

const PRETTY_TECH_CASING: Record<string, string> = {
  'javascript': 'JavaScript',
  'typescript': 'TypeScript',
  'node.js': 'Node.js',
  'next.js': 'Next.js',
  'vue.js': 'Vue.js',
  'react.js': 'React.js',
  'd3.js': 'D3.js',
  'dexie.js': 'Dexie.js',
  'c++': 'C++',
  'c#': 'C#',
  'f#': 'F#',
  '.net': '.NET',
  'asp.net': 'ASP.NET',
  'ci/cd': 'CI/CD',
  'ui/ux': 'UI/UX',
  'tcp/ip': 'TCP/IP',
  'rest api': 'REST API',
  'restful apis': 'RESTful APIs',
  'graphql': 'GraphQL',
  'postgresql': 'PostgreSQL',
  'mongodb': 'MongoDB',
  'mysql': 'MySQL',
  'sql': 'SQL',
  'nosql': 'NoSQL',
  'aws': 'AWS',
  'gcp': 'GCP',
  'html5': 'HTML5',
  'css3': 'CSS3',
  'tailwind css': 'Tailwind CSS',
  'api': 'API',
  'sdk': 'SDK',
  'llm': 'LLM',
  'ai': 'AI',
};

export function formatKeywordForResume(term: string): string {
  const lower = term.toLowerCase();
  if (PRETTY_TECH_CASING[lower]) return PRETTY_TECH_CASING[lower];
  return lower
    .split(' ')
    .map((word) =>
      PRETTY_TECH_CASING[word]
        ? PRETTY_TECH_CASING[word]
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(' ');
}

export async function appendMissingKeywordToSession(keyword: string): Promise<void> {
  const current = (await db.sessions.get(ACTIVE_SESSION_ID)) ?? createEmptySession();
  const formatted = formatKeywordForResume(keyword);

  if (!current.editableHtml.trim()) {
    const html = `<div class="rz-pdf-editable-page" style="padding:40px 48px;"><div style="font-size:13px;color:#000000;"><strong>Skills:</strong> ${formatted}</div></div>`;
    await db.sessions.put({
      ...current,
      editableHtml: html,
      originalEditableHtml: current.originalEditableHtml || html,
      rawResumeText: `Skills: ${formatted}`,
      externalRevision: (current.externalRevision ?? 1) + 1,
      updatedAt: Date.now(),
    });
    return;
  }

  const container = document.createElement('div');
  container.innerHTML = current.editableHtml;

  const allBlocks = Array.from(container.querySelectorAll('div, p, li, td')).filter((el) => {
    const hasChildBlock = el.querySelector('div, p, li, table, ul, ol');
    const txt = (el.textContent ?? '').trim();
    return !hasChildBlock && txt.length > 0;
  }) as HTMLElement[];

  let targetEl: HTMLElement | null = null;

  const inlineCandidates = allBlocks.filter((el) =>
    /(?:^|\b)(?:technical\s+skills|skills|technologies|frameworks|tools|developer\s+tools|core\s+competencies)\s*(?:&[^:]*)?:/i.test(
      el.textContent ?? ''
    )
  );
  if (inlineCandidates.length > 0) {
    targetEl = inlineCandidates[inlineCandidates.length - 1];
  }

  if (!targetEl) {
    const headerIdx = allBlocks.findIndex((el) => {
      const cleaned = (el.textContent ?? '').replace(/[:•\-–—\s]+$/g, '').trim();
      return /^(?:technical\s+skills|skills|core\s+competencies|technologies|tech\s+stack|skills\s*(?:&|and)\s*\w+)$/i.test(
        cleaned
      );
    });

    if (headerIdx >= 0) {
      for (let i = headerIdx + 1; i < allBlocks.length && i <= headerIdx + 8; i++) {
        const candText = (allBlocks[i].textContent ?? '').replace(/[:\s]+$/g, '').trim();
        if (
          candText.length <= 28 &&
          /^(?:experience|work\s+experience|projects|education|certifications|achievements|publications|summary|leadership)\b/i.test(
            candText
          )
        ) {
          break;
        }
        targetEl = allBlocks[i];
      }
    }
  }

  if (!targetEl && allBlocks.length > 0) {
    targetEl = allBlocks[allBlocks.length - 1];
  }

  if (targetEl) {
    const currentHtml = targetEl.innerHTML.replace(/(?:[.,;\s]|&nbsp;)+$/i, '');
    targetEl.innerHTML = `${currentHtml}, ${formatted}`;
  } else {
    const fallbackDiv = document.createElement('div');
    fallbackDiv.textContent = `Skills: ${formatted}`;
    container.appendChild(fallbackDiv);
  }

  container.style.position = 'fixed';
  container.style.left = '-99999px';
  let nextPlainText = '';
  let nextHtml = '';
  document.body.appendChild(container);
  try {
    nextPlainText = container.innerText.replace(/\n{3,}/g, '\n\n').trim();
    nextHtml = stripMixedFontFamilies(container.innerHTML);
  } finally {
    container.remove();
  }

  await db.sessions.put({
    ...current,
    editableHtml: nextHtml,
    rawResumeText: nextPlainText,
    externalRevision: (current.externalRevision ?? 1) + 1,
    updatedAt: Date.now(),
  });
}

/**
 * Exports the user's edited resume as a Word-compatible .doc file preserving their unified single font!
 */
export function exportResumeAsWordDoc(session: WorkspaceSession): void {
  const fontStack =
    UNIFIED_FONT_STACKS[session.resumeFontId]?.css ?? UNIFIED_FONT_STACKS.calibri.css;

  const docHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <title>${session.uploadedFileName || 'Resume'}</title>
  <style>
    @page { size: 8.5in 11in; margin: 0.5in 0.55in; }
    body, div, p, span, li, td, th, h1, h2, h3, strong, em {
      font-family: ${fontStack} !important;
      color: #000000;
    }
    body { line-height: ${session.lineSpacing}; margin: 0; padding: 0; }
    ${session.editableCss || ''}
  </style>
</head>
<body>
  ${session.editableHtml}
</body>
</html>`;

  const blob = new Blob(['\ufeff', docHtml], {
    type: 'application/msword;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const baseName = (session.uploadedFileName.replace(/\.(pdf|docx|doc)$/i, '') || 'edited-resume')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-');
  anchor.href = url;
  anchor.download = `${baseName}.doc`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
