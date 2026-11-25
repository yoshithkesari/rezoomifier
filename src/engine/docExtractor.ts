import { renderAsync } from 'docx-preview';
import { UnifiedResumeFontId } from '../types';
import { mapFontNameToUnifiedId } from './pdfExtractor';

export interface EditableDocExtractionResult {
  text: string;
  editableHtml: string;
  editableCss: string;
  detectedFontId: UnifiedResumeFontId;
  fileType: 'docx' | 'doc';
  pageCount: number;
  durationMs: number;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripInlineFontFamilies(html: string): string {
  return html.replace(/font-family\s*:[^;"']+;?/gi, '');
}

function plainTextToEditableHtml(text: string): string {
  const lines = text.split(/\r?\n/);
  const blocks = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return '<div style="height:8px"></div>';
    return `<div style="font-size:13px;line-height:1.45;color:#000000;margin-top:2px;">${escapeHtml(
      line
    )}</div>`;
  });
  return `<div style="padding:40px 48px;">${blocks.join('\n')}</div>`;
}

function parseRtfToPlainText(rtf: string): string {
  return rtf
    .replace(/\\par[d]?/g, '\n')
    .replace(/\\line\b/g, '\n')
    .replace(/\\tab\b/g, '  ')
    .replace(/\\bullet\b/g, '• ')
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u(-?\d+)\??/g, (_, code) => {
      const c = parseInt(code, 10);
      return String.fromCharCode(c < 0 ? c + 65536 : c);
    })
    .replace(/\{\\(?:fonttbl|colortbl|stylesheet|info|pict|object)[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '')
    .replace(/\\[a-zA-Z]+-?\d*\s?/g, '')
    .replace(/[{}]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractTextFromLegacyBinaryDoc(bytes: Uint8Array): string {
  const asciiChunks: string[] = [];
  let cur = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9) {
      cur += String.fromCharCode(b);
    } else {
      if (cur.trim().length >= 16 && /[a-zA-Z]{3,}/.test(cur)) {
        asciiChunks.push(cur.trim());
      }
      cur = '';
    }
  }
  if (cur.trim().length >= 16) asciiChunks.push(cur.trim());

  const filtered = asciiChunks.filter(
    (chunk) =>
      !/^(?:Microsoft Word|Normal\.dot|MSWordDoc|Word\.Document|Root Entry|CompObj|SummaryInformation)/i.test(
        chunk
      )
  );
  return filtered.join('\n');
}

function detectDominantFontFromCssAndHtml(css: string, html: string): UnifiedResumeFontId {
  const votes = new Map<UnifiedResumeFontId, number>();
  const combined = `${css}\n${html}`;
  const matches = combined.matchAll(/font-family\s*:\s*([^;}"']+)/gi);
  for (const m of matches) {
    const rawName = m[1].replace(/["']/g, '').split(',')[0].trim();
    const mapped = mapFontNameToUnifiedId(rawName, '');
    if (mapped) {
      votes.set(mapped, (votes.get(mapped) ?? 0) + 1);
    }
  }
  let best: UnifiedResumeFontId = 'calibri';
  let bestCount = -1;
  for (const [id, count] of votes.entries()) {
    if (count > bestCount) {
      bestCount = count;
      best = id;
    }
  }
  return best;
}

/**
 * Parses an uploaded .docx or .doc resume into faithful, directly-editable HTML + plain text,
 * enforcing ONE unified font across the entire resume.
 */
export async function extractEditableResumeFromDoc(
  file: File
): Promise<EditableDocExtractionResult> {
  const start = performance.now();
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const isZipDocx =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04;

  if (isZipDocx || file.name.toLowerCase().endsWith('.docx')) {
    const bodyContainer = document.createElement('div');
    const styleContainer = document.createElement('div');

    await renderAsync(arrayBuffer, bodyContainer, styleContainer, {
      className: 'docx-resume',
      inWrapper: false,
      ignoreWidth: false,
      ignoreHeight: true,
      breakPages: false,
      ignoreLastRenderedPageBreak: true,
      useBase64URL: true,
    });

    const sections = bodyContainer.querySelectorAll('section.docx-resume');
    sections.forEach((sec) => {
      const el = sec as HTMLElement;
      el.style.width = '100%';
      el.style.maxWidth = '100%';
      el.style.minHeight = '0';
      el.style.boxShadow = 'none';
      el.style.margin = '0';
    });

    // Replace Wingdings/Symbol bullet characters if any
    bodyContainer.innerHTML = bodyContainer.innerHTML.replace(
      /[\uF0B7\uF0A7\uF0D8\uF076\uF0FC]/g,
      '•'
    );

    const rawCss = Array.from(styleContainer.querySelectorAll('style'))
      .map((s) => s.textContent ?? '')
      .join('\n');

    const detectedFontId = detectDominantFontFromCssAndHtml(rawCss, bodyContainer.innerHTML);

    // Strip mixed font-family declarations so the entire resume strictly uses ONE font
    const editableCss = stripInlineFontFamilies(rawCss);
    bodyContainer.querySelectorAll('[style]').forEach((node) => {
      (node as HTMLElement).style.removeProperty('font-family');
    });
    bodyContainer.querySelectorAll('font').forEach((fontNode) => {
      fontNode.removeAttribute('face');
    });

    bodyContainer.style.position = 'fixed';
    bodyContainer.style.left = '-99999px';
    let plainText = '';
    let editableHtml = '';
    document.body.appendChild(bodyContainer);
    try {
      plainText = bodyContainer.innerText.replace(/\n{3,}/g, '\n\n').trim();
      editableHtml = stripInlineFontFamilies(bodyContainer.innerHTML);
    } finally {
      bodyContainer.remove();
    }

    const durationMs = Math.max(1, Math.round(performance.now() - start));
    return {
      text: plainText,
      editableHtml,
      editableCss,
      detectedFontId,
      fileType: 'docx',
      pageCount: Math.max(1, sections.length),
      durationMs,
    };
  }

  const utf8Sample = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  let editableHtml = '';
  let plainText = '';
  let detectedFontId: UnifiedResumeFontId = 'calibri';

  if (/^\s*(?:<!DOCTYPE|<html|<w:WordDocument)/i.test(utf8Sample)) {
    detectedFontId = detectDominantFontFromCssAndHtml('', utf8Sample);
    const parser = new DOMParser();
    const doc = parser.parseFromString(utf8Sample, 'text/html');
    doc.querySelectorAll('script, meta, link').forEach((n) => n.remove());
    editableHtml = `<div style="padding:36px 44px;color:#000000;">${stripInlineFontFamilies(
      doc.body.innerHTML
    )}</div>`;
    plainText = (doc.body.textContent ?? '').replace(/\s+\n/g, '\n').trim();
  } else if (utf8Sample.trimStart().startsWith('{\\rtf')) {
    plainText = parseRtfToPlainText(utf8Sample);
    editableHtml = plainTextToEditableHtml(plainText);
  } else {
    plainText = extractTextFromLegacyBinaryDoc(bytes);
    if (!plainText.trim()) {
      throw new Error(
        'Could not read legacy binary .doc format. Please save as .DOCX or .PDF and upload.'
      );
    }
    editableHtml = plainTextToEditableHtml(plainText);
  }

  const durationMs = Math.max(1, Math.round(performance.now() - start));
  return {
    text: plainText,
    editableHtml,
    editableCss: '',
    detectedFontId,
    fileType: 'doc',
    pageCount: 1,
    durationMs,
  };
}
