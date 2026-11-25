import React, { useEffect, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  IndentDecrease,
  IndentIncrease,
  Undo2,
  Redo2,
  RotateCcw,
  FileUp,
  Plus,
  Minus,
  ClipboardPaste,
  Columns2,
  Heading,
  Sparkles,
  ArrowLeftRight,
  ChevronsUpDown,
  X,
} from 'lucide-react';
import {
  PlaygroundBlockKind,
  UNIFIED_FONT_STACKS,
  UnifiedResumeFontId,
  WorkspaceSession,
} from '../types';
import { formatKeywordForResume } from '../db/localDb';
import { extractEditableResumeFromPDF } from '../engine/pdfExtractor';
import { extractEditableResumeFromDoc } from '../engine/docExtractor';

interface ResumePreviewSheetProps {
  editableHtml: string;
  editableCss: string;
  originalEditableHtml: string;
  externalRevision: number;
  resumeFontId: UnifiedResumeFontId;
  lineSpacing: WorkspaceSession['lineSpacing'];
  pageMargin: WorkspaceSession['pageMargin'];
  uploadedFileName: string;
  onChangeResumeFont: (fontId: UnifiedResumeFontId) => void;
  onChangeLineSpacing: (spacing: WorkspaceSession['lineSpacing']) => void;
  onChangePageMargin: (margin: WorkspaceSession['pageMargin']) => void;
  onLiveEdit: (nextHtml: string, nextPlainText: string) => void;
  onResetEdits: () => void;
  onUploadFile: (file: File) => void;
}

type BlockAlignment = 'left' | 'center' | 'right' | 'justify' | 'split';

const ACCEPTED_FILES =
  '.pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword';

const FONT_SIZES_PT = ['9', '10', '10.5', '11', '12', '14', '16', '18', '22'];

const MARGIN_PADDING_CLASS: Record<WorkspaceSession['pageMargin'], string> = {
  narrow: 'rz-margin-narrow',
  normal: 'rz-margin-normal',
  wide: 'rz-margin-wide',
};

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isPageWrapper(el: HTMLElement, editor: HTMLElement): boolean {
  return (
    el === editor ||
    el.classList.contains('rz-pdf-editable-page') ||
    el.classList.contains('docx-resume') ||
    el.tagName === 'SECTION' ||
    el.tagName === 'ARTICLE' ||
    el.tagName === 'UL' ||
    el.tagName === 'OL' ||
    el.tagName === 'TABLE' ||
    el.tagName === 'TBODY' ||
    el.tagName === 'TR'
  );
}

/**
 * Accurate range-to-block intersection check that ignores trailing blocks where endOffset === 0
 * (prevents triple-click or line-end selection from accidentally aligning the next line below!).
 */
function rangeTrulyTouchesBlock(range: Range, block: HTMLElement): boolean {
  if (!range.intersectsNode(block)) return false;
  if (
    block.contains(range.endContainer) &&
    range.endOffset === 0 &&
    !block.contains(range.startContainer)
  ) {
    // Check if endContainer is the very start of this block
    let cur: Node | null = range.endContainer;
    let isAtVeryStart = true;
    while (cur && cur !== block) {
      if (cur.previousSibling) {
        isAtVeryStart = false;
        break;
      }
      cur = cur.parentNode;
    }
    if (isAtVeryStart) return false;
  }
  return true;
}

export const ResumePreviewSheet: React.FC<ResumePreviewSheetProps> = ({
  editableHtml,
  editableCss,
  originalEditableHtml,
  externalRevision,
  resumeFontId,
  lineSpacing,
  pageMargin,
  onChangeResumeFont,
  onChangeLineSpacing,
  onChangePageMargin,
  onLiveEdit,
  onResetEdits,
  onUploadFile,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const snippetFileInputRef = useRef<HTMLInputElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const appliedRevisionRef = useRef<number>(-1);

  const [activeAlign, setActiveAlign] = useState<BlockAlignment>('left');
  const [activeFontSizePt, setActiveFontSizePt] = useState<string>('10.5');
  const [activeMarks, setActiveMarks] = useState({
    bold: false,
    italic: false,
    underline: false,
  });
  const [showImportDrawer, setShowImportDrawer] = useState(false);
  const [importLinesText, setImportLinesText] = useState('');
  const [importAsBullets, setImportAsBullets] = useState(false);
  const [isImportingSnippet, setIsImportingSnippet] = useState(false);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (appliedRevisionRef.current !== externalRevision) {
      el.innerHTML = editableHtml;
      appliedRevisionRef.current = externalRevision;
    }
  }, [editableHtml, externalRevision]);

  const findLineBlock = (node: Node | null): HTMLElement | null => {
    const editor = editorRef.current;
    if (!editor || !node) return null;
    let cur: Node | null = node;
    while (cur && cur !== editor) {
      if (
        cur instanceof HTMLElement &&
        !isPageWrapper(cur, editor) &&
        /^(DIV|P|LI|H1|H2|H3|H4|H5|H6|TD|TH)$/.test(cur.tagName)
      ) {
        return cur;
      }
      cur = cur.parentNode;
    }
    return null;
  };

  const detectActiveAlignment = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    try {
      setActiveMarks({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
      });
    } catch {
      // Ignore safely
    }

    const anchorEl =
      sel.anchorNode instanceof HTMLElement
        ? sel.anchorNode
        : sel.anchorNode?.parentElement ?? null;
    if (anchorEl && editorRef.current?.contains(anchorEl)) {
      const px = parseFloat(window.getComputedStyle(anchorEl).fontSize);
      if (Number.isFinite(px) && px > 0) {
        const ptRaw = px / 1.333;
        let closest = FONT_SIZES_PT[0];
        let bestDiff = Infinity;
        for (const candidate of FONT_SIZES_PT) {
          const diff = Math.abs(parseFloat(candidate) - ptRaw);
          if (diff < bestDiff) {
            bestDiff = diff;
            closest = candidate;
          }
        }
        setActiveFontSizePt(closest);
      }
    }

    const block = findLineBlock(sel.anchorNode);
    if (!block) return;

    if (
      block.classList.contains('rz-split-row') ||
      window.getComputedStyle(block).display === 'flex'
    ) {
      setActiveAlign('split');
      return;
    }

    const ta = (block.style.textAlign || window.getComputedStyle(block).textAlign || 'left')
      .toLowerCase()
      .trim();
    if (ta === 'center') setActiveAlign('center');
    else if (ta === 'right' || ta === 'end') setActiveAlign('right');
    else if (ta === 'justify') setActiveAlign('justify');
    else setActiveAlign('left');
  };

  const saveSelectionRange = () => {
    const sel = window.getSelection();
    const editor = editorRef.current;
    if (!sel || sel.rangeCount === 0 || !editor) return;
    const range = sel.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
      detectActiveAlignment();
    }
  };

  const restoreSelectionRange = (): boolean => {
    const editor = editorRef.current;
    if (!editor) return false;
    editor.focus();
    const saved = savedRangeRef.current;
    if (saved && editor.contains(saved.commonAncestorContainer)) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(saved);
        return true;
      }
    }
    return false;
  };

  const syncEditorToStore = () => {
    const el = editorRef.current;
    if (!el) return;
    onLiveEdit(el.innerHTML, el.innerText);
    saveSelectionRange();
  };

  const runExecCommand = (cmd: string, value?: string) => {
    restoreSelectionRange();
    document.execCommand(cmd, false, value);
    syncEditorToStore();
  };

  const getSelectedBlocks = (): HTMLElement[] => {
    const editor = editorRef.current;
    if (!editor) return [];
    restoreSelectionRange();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return [];

    const range = sel.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return [];

    if (range.collapsed) {
      const single = findLineBlock(range.startContainer);
      return single ? [single] : [];
    }

    const candidates = Array.from(
      editor.querySelectorAll('div, p, li, h1, h2, h3, h4, td')
    ).filter((el) => {
      const htmlEl = el as HTMLElement;
      if (isPageWrapper(htmlEl, editor)) return false;
      if (htmlEl.querySelector('div, p, li, table, ul, ol')) return false;
      return rangeTrulyTouchesBlock(range, htmlEl);
    }) as HTMLElement[];

    if (candidates.length > 0) return candidates;
    const fallback = findLineBlock(range.startContainer);
    return fallback ? [fallback] : [];
  };

  /**
   * Deterministic Left / Center / Right / Justify / Split Left-Right alignment.
   */
  const applyAlignment = (align: BlockAlignment) => {
    const editor = editorRef.current;
    if (!editor) return;
    const blocks = getSelectedBlocks();

    if (blocks.length === 0) {
      runExecCommand(
        align === 'center'
          ? 'justifyCenter'
          : align === 'right'
            ? 'justifyRight'
            : align === 'justify'
              ? 'justifyFull'
              : 'justifyLeft'
      );
      setActiveAlign(align);
      return;
    }

    for (const block of blocks) {
      if (align === 'split') {
        if (!block.classList.contains('rz-split-row')) {
          // If converting an <li>, unwrap or style cleanly
          const existingHtml = block.innerHTML.trim() || 'Role / Organization';
          block.classList.add('rz-split-row');
          block.style.display = 'flex';
          block.style.justifyContent = 'space-between';
          block.style.alignItems = 'baseline';
          block.style.gap = '16px';
          block.style.textAlign = 'left';
          block.style.paddingLeft = '0px';
          block.style.textIndent = '0px';
          block.innerHTML =
            `<span class="rz-split-left">${existingHtml}</span>` +
            `<span class="rz-split-right">Date / Location</span>`;
        }
        continue;
      }

      if (
        block.classList.contains('rz-split-row') ||
        window.getComputedStyle(block).display === 'flex'
      ) {
        const spans = Array.from(block.querySelectorAll(':scope > span'));
        if (spans.length >= 2) {
          block.innerHTML = spans
            .map((s) => s.innerHTML.trim())
            .filter(Boolean)
            .join(' &nbsp;|&nbsp; ');
        }
        block.classList.remove('rz-split-row');
        block.style.display = block.tagName === 'LI' ? 'list-item' : 'block';
        block.style.removeProperty('justify-content');
        block.style.removeProperty('align-items');
        block.style.removeProperty('gap');
      }

      block.style.setProperty('text-align', align, 'important');

      if (align === 'center' || align === 'right') {
        block.style.paddingLeft = '0px';
        block.style.textIndent = '0px';
      } else if (align === 'left') {
        block.style.textIndent = '0px';
      }
    }

    setActiveAlign(align);
    syncEditorToStore();
  };

  const adjustBlockIndent = (deltaPx: number) => {
    const blocks = getSelectedBlocks();
    if (blocks.length === 0) {
      runExecCommand(deltaPx > 0 ? 'indent' : 'outdent');
      return;
    }
    for (const block of blocks) {
      const target =
        block.tagName === 'LI' && block.parentElement instanceof HTMLElement
          ? block.parentElement
          : block;
      const base = target.tagName === 'UL' || target.tagName === 'OL' ? 18 : 0;
      const curr = parseFloat(target.style.paddingLeft || String(base)) || base;
      const next = Math.max(base, Math.min(160, curr + deltaPx));
      target.style.paddingLeft = `${next}px`;
    }
    syncEditorToStore();
  };

  /**
   * Fine-tunes vertical gap (margin-top) above the active line or section in 2px steps!
   */
  const adjustVerticalGap = (deltaPx: number) => {
    const blocks = getSelectedBlocks();
    if (blocks.length === 0) return;
    const first = blocks[0];
    // If cursor is on the first <li> of a <ul>, adjust the <ul>'s top gap; otherwise adjust the block itself
    const target =
      first.tagName === 'LI' &&
      !first.previousElementSibling &&
      first.parentElement instanceof HTMLElement
        ? first.parentElement
        : first;
    const curr = parseFloat(window.getComputedStyle(target).marginTop || '0') || 0;
    const next = Math.max(0, Math.min(40, Math.round(curr + deltaPx)));
    target.style.marginTop = `${next}px`;
    syncEditorToStore();
  };

  const applyFontSizePt = (sizePt: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    restoreSelectionRange();

    const sel = window.getSelection();
    const px = Math.round(sizePt * 1.333 * 10) / 10;

    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        const blocks = getSelectedBlocks();
        // If full blocks are selected, update block font-size cleanly instead of nested spans
        if (blocks.length > 1) {
          for (const b of blocks) b.style.fontSize = `${px}px`;
          syncEditorToStore();
          return;
        }
        const span = document.createElement('span');
        span.style.fontSize = `${px}px`;
        try {
          range.surroundContents(span);
        } catch {
          const frag = range.extractContents();
          span.appendChild(frag);
          range.insertNode(span);
        }
        syncEditorToStore();
        return;
      }
    }

    const block = sel ? findLineBlock(sel.anchorNode) : null;
    if (block) {
      block.style.fontSize = `${px}px`;
      syncEditorToStore();
    }
  };

  const stepFontSize = (deltaPt: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    restoreSelectionRange();
    const sel = window.getSelection();
    let currentPx = 13.5;
    if (sel && sel.anchorNode) {
      const el =
        sel.anchorNode instanceof HTMLElement
          ? sel.anchorNode
          : sel.anchorNode.parentElement;
      if (el && editor.contains(el)) {
        const computed = parseFloat(window.getComputedStyle(el).fontSize);
        if (Number.isFinite(computed)) currentPx = computed;
      }
    }
    const nextPt = Math.max(8, Math.min(28, Math.round((currentPx / 1.333 + deltaPt) * 2) / 2));
    setActiveFontSizePt(String(nextPt));
    applyFontSizePt(nextPt);
  };

  const insertHtmlNodesAtCursor = (htmlSnippet: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    if (!editor.innerHTML.trim()) {
      editor.innerHTML = `<div class="rz-pdf-editable-page">${htmlSnippet}</div>`;
      syncEditorToStore();
      return;
    }

    const hadCursor = restoreSelectionRange();
    const temp = document.createElement('div');
    temp.innerHTML = htmlSnippet;
    const nodes = Array.from(temp.childNodes);
    if (nodes.length === 0) return;

    const sel = window.getSelection();
    if (hadCursor && sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      let blockAnchor: Node | null = range.endContainer;
      const pageRoot =
        editor.querySelector('.rz-pdf-editable-page, section.docx-resume') ?? editor;

      while (
        blockAnchor &&
        blockAnchor.parentNode &&
        blockAnchor.parentNode !== pageRoot &&
        blockAnchor.parentNode !== editor
      ) {
        blockAnchor = blockAnchor.parentNode;
      }

      // If blockAnchor is followed immediately by an <hr class="rz-divider">, insert AFTER the divider!
      if (
        blockAnchor &&
        blockAnchor.nextSibling instanceof HTMLElement &&
        blockAnchor.nextSibling.classList.contains('rz-divider')
      ) {
        blockAnchor = blockAnchor.nextSibling;
      }

      if (blockAnchor && blockAnchor.parentNode) {
        const refNode: Node | null = blockAnchor.nextSibling;
        let lastInserted: Node | null = null;
        for (const n of nodes) {
          blockAnchor.parentNode.insertBefore(n, refNode);
          lastInserted = n;
        }
        if (lastInserted) {
          const nextRange = document.createRange();
          nextRange.selectNodeContents(lastInserted);
          nextRange.collapse(false);
          sel.removeAllRanges();
          sel.addRange(nextRange);
          savedRangeRef.current = nextRange.cloneRange();
        }
        syncEditorToStore();
        return;
      }
    }

    const containers = editor.querySelectorAll('.rz-pdf-editable-page, section.docx-resume');
    const targetContainer =
      (containers.length > 0 ? containers[containers.length - 1] : editor) as HTMLElement;
    let lastNode: Node | null = null;
    for (const n of nodes) {
      targetContainer.appendChild(n);
      lastNode = n;
    }
    if (lastNode && sel) {
      editor.focus();
      const nextRange = document.createRange();
      nextRange.selectNodeContents(lastNode);
      nextRange.collapse(false);
      sel.removeAllRanges();
      sel.addRange(nextRange);
      savedRangeRef.current = nextRange.cloneRange();
    }
    syncEditorToStore();
  };

  const placePlaygroundBlock = (kind: PlaygroundBlockKind) => {
    switch (kind) {
      case 'section':
        insertHtmlNodesAtCursor(
          `<div class="rz-line" style="margin-top:12px;font-size:14.5px;text-align:left;color:#000000;"><strong>SECTION TITLE</strong></div>` +
            `<hr class="rz-divider" contenteditable="false" style="border:none;border-top:1px solid #000000;margin:2px 0 3px 0;" />`
        );
        break;
      case 'role-date':
        insertHtmlNodesAtCursor(
          `<div class="rz-split-row" style="display:flex;justify-content:space-between;align-items:baseline;gap:16px;margin-top:6px;font-size:13.5px;color:#000000;">` +
            `<span class="rz-split-left"><strong>Role / Organization Name</strong></span>` +
            `<span class="rz-split-right"><strong>2024 – Present</strong></span>` +
            `</div>`
        );
        break;
      case 'bullet': {
        // If cursor is already inside a <ul>, add a sibling <li> seamlessly; else insert a clean <ul class="rz-list">
        restoreSelectionRange();
        const sel = window.getSelection();
        const block = sel ? findLineBlock(sel.anchorNode) : null;
        if (block && block.tagName === 'LI' && block.parentElement) {
          const li = document.createElement('li');
          li.className = 'rz-li';
          li.style.marginTop = '2px';
          li.style.fontSize = block.style.fontSize || '13px';
          li.style.color = '#000000';
          li.textContent = 'Action bullet...';
          block.parentElement.insertBefore(li, block.nextSibling);
          const r = document.createRange();
          r.selectNodeContents(li);
          sel?.removeAllRanges();
          sel?.addRange(r);
          savedRangeRef.current = r.cloneRange();
          syncEditorToStore();
        } else {
          insertHtmlNodesAtCursor(
            `<ul class="rz-list" style="margin:3px 0 0 0;padding-left:18px;font-size:13px;color:#000000;">` +
              `<li class="rz-li" style="margin-top:2px;font-size:13px;color:#000000;">Write your action bullet here...</li>` +
              `</ul>`
          );
        }
        break;
      }
      case 'divider':
        insertHtmlNodesAtCursor(
          `<hr class="rz-divider" contenteditable="false" style="border:none;border-top:1px solid #000000;margin:4px 0;" />`
        );
        break;
      case 'paragraph':
        insertHtmlNodesAtCursor(
          `<div class="rz-line" style="margin-top:3px;font-size:13px;text-align:left;color:#000000;">New line...</div>`
        );
        break;
    }
  };

  const handleImportLinesIntoPlayground = () => {
    const rawLines = importLinesText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (rawLines.length === 0) return;

    if (importAsBullets) {
      const items = rawLines
        .map((line) => {
          const clean = line.replace(/^(?:[•▪◦‣–—*-])\s*/, '');
          return `<li class="rz-li" style="margin-top:2px;font-size:13px;color:#000000;">${escapeHtml(
            clean
          )}</li>`;
        })
        .join('');
      insertHtmlNodesAtCursor(
        `<ul class="rz-list" style="margin:3px 0 0 0;padding-left:18px;font-size:13px;color:#000000;">${items}</ul>`
      );
    } else {
      const htmlLines = rawLines
        .map(
          (line) =>
            `<div class="rz-line" style="margin-top:2px;font-size:13px;text-align:left;color:#000000;">${escapeHtml(
              line
            )}</div>`
        )
        .join('\n');
      insertHtmlNodesAtCursor(htmlLines);
    }

    setImportLinesText('');
    setShowImportDrawer(false);
  };

  const handleExtractLinesFromExternalFile = async (file: File) => {
    setIsImportingSnippet(true);
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.pdf')) {
        const res = await extractEditableResumeFromPDF(file);
        setImportLinesText((prev) => (prev ? `${prev}\n${res.text}` : res.text));
      } else if (lower.endsWith('.docx') || lower.endsWith('.doc')) {
        const res = await extractEditableResumeFromDoc(file);
        setImportLinesText((prev) => (prev ? `${prev}\n${res.text}` : res.text));
      } else {
        const txt = await file.text();
        setImportLinesText((prev) => (prev ? `${prev}\n${txt}` : txt));
      }
    } catch {
      // Ignore snippet parse errors gracefully
    } finally {
      setIsImportingSnippet(false);
    }
  };

  /**
   * Smart Enter, Tab, and Alignment shortcuts so editing never clones flex rows or big section gaps!
   */
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
        const block = findLineBlock(sel.anchorNode);

        // 1. Pressing Enter inside a Split L↔R Row OR a heading followed by <hr> inserts a clean left-aligned line below!
        const hasDividerNext =
          block?.nextElementSibling instanceof HTMLElement &&
          block.nextElementSibling.classList.contains('rz-divider');

        if (
          block &&
          (block.classList.contains('rz-split-row') || hasDividerNext)
        ) {
          e.preventDefault();
          const newLine = document.createElement('div');
          newLine.className = 'rz-line';
          newLine.style.marginTop = '2px';
          newLine.style.fontSize = '13px';
          newLine.style.textAlign = 'left';
          newLine.style.color = '#000000';
          newLine.innerHTML = '<br>';

          const anchorAfter = hasDividerNext ? block.nextElementSibling! : block;
          anchorAfter.parentNode?.insertBefore(newLine, anchorAfter.nextSibling);

          const r = document.createRange();
          r.setStart(newLine, 0);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
          savedRangeRef.current = r.cloneRange();
          syncEditorToStore();
          return;
        }

        // 2. If pressing Enter on a regular div/p that had a big section margin-top (> 4px),
        // normalize the newly created sibling line's margin-top to 2px on next microtask!
        if (block && block.tagName !== 'LI') {
          const origMargin = parseFloat(block.style.marginTop || '0') || 0;
          if (origMargin > 4) {
            window.requestAnimationFrame(() => {
              const nextEl = block.nextElementSibling;
              if (nextEl instanceof HTMLElement && nextEl.style.marginTop === block.style.marginTop) {
                nextEl.style.marginTop = '2px';
                syncEditorToStore();
              }
            });
          }
        }
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        adjustBlockIndent(-18);
      } else {
        const sel = window.getSelection();
        if (sel && sel.isCollapsed && sel.anchorOffset > 0) {
          document.execCommand('insertText', false, '\u00A0\u00A0\u00A0\u00A0');
          syncEditorToStore();
        } else {
          adjustBlockIndent(18);
        }
      }
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === 'l') {
        e.preventDefault();
        applyAlignment('left');
      } else if (key === 'e') {
        e.preventDefault();
        applyAlignment('center');
      } else if (key === 'r') {
        e.preventDefault();
        applyAlignment('right');
      } else if (key === 'j') {
        e.preventDefault();
        applyAlignment('justify');
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (text) {
      document.execCommand('insertText', false, text);
      syncEditorToStore();
    }
  };

  const handleSheetDrop = (e: React.DragEvent<HTMLElement>) => {
    const file = e.dataTransfer.files?.[0];
    if (file) {
      e.preventDefault();
      onUploadFile(file);
      return;
    }

    const draggedKeyword = e.dataTransfer.getData('text/plain');
    if (draggedKeyword) {
      e.preventDefault();
      const formatted = formatKeywordForResume(draggedKeyword);
      const docAny = document as Document & {
        caretRangeFromPoint?: (x: number, y: number) => Range | null;
      };
      if (typeof docAny.caretRangeFromPoint === 'function') {
        const dropRange = docAny.caretRangeFromPoint(e.clientX, e.clientY);
        const sel = window.getSelection();
        if (dropRange && sel && editorRef.current?.contains(dropRange.commonAncestorContainer)) {
          sel.removeAllRanges();
          sel.addRange(dropRange);
        }
      }
      document.execCommand('insertText', false, formatted);
      syncEditorToStore();
    }
  };

  const unifiedFontCss =
    UNIFIED_FONT_STACKS[resumeFontId]?.css ?? UNIFIED_FONT_STACKS.calibri.css;

  const hasContent = editableHtml.trim().length > 0;
  const hasModifications =
    Boolean(originalEditableHtml) && editableHtml !== originalEditableHtml;

  const alignBtnClass = (mode: BlockAlignment) =>
    `inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
      activeAlign === mode
        ? 'bg-[#0F172A] text-white'
        : 'text-[#0F172A] hover:bg-[#E2E8F0]/70'
    }`;

  return (
    <div className="print-only-reset bg-[#F3F4F6] rounded-2xl border-[1.5px] border-[#E2E8F0] p-3 sm:p-5">
      {editableCss && <style dangerouslySetInnerHTML={{ __html: editableCss }} />}

      {/* ========================================================================
          WORD-STYLE PLAYGROUND RIBBON (Hidden during @media print)
         ======================================================================== */}
      <div className="no-print bg-[#FFFFFF] rounded-xl border border-[#E2E8F0] p-2.5 mb-4 space-y-2 shadow-2xs">
        {/* Ribbon Row 1: Font, Size, B/I/U, Alignment, Lists, Indent, Undo/Redo */}
        <div className="flex items-center flex-wrap gap-1.5">
          <select
            aria-label="Resume Font"
            value={resumeFontId}
            onChange={(e) => onChangeResumeFont(e.target.value as UnifiedResumeFontId)}
            className="h-8 px-2.5 rounded-lg bg-[#FAF9F6] border border-[#CBD5E1] text-xs font-bold text-[#0F172A] focus:border-[#000000] focus:outline-none cursor-pointer"
          >
            {(Object.keys(UNIFIED_FONT_STACKS) as UnifiedResumeFontId[]).map((id) => (
              <option key={id} value={id}>
                {UNIFIED_FONT_STACKS[id].label}
              </option>
            ))}
          </select>

          <div className="inline-flex items-center rounded-lg bg-[#FAF9F6] border border-[#CBD5E1] px-1 h-8">
            <select
              aria-label="Font Size"
              value={activeFontSizePt}
              onChange={(e) => {
                setActiveFontSizePt(e.target.value);
                applyFontSizePt(parseFloat(e.target.value));
              }}
              className="text-xs font-bold text-[#0F172A] bg-transparent focus:outline-none cursor-pointer px-1"
            >
              {FONT_SIZES_PT.map((sz) => (
                <option key={sz} value={sz}>
                  {sz}pt
                </option>
              ))}
            </select>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                stepFontSize(-0.5);
              }}
              title="Decrease Font Size"
              className="p-1 text-[#0F172A] hover:bg-[#E2E8F0] rounded cursor-pointer"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                stepFontSize(0.5);
              }}
              title="Increase Font Size"
              className="p-1 text-[#0F172A] hover:bg-[#E2E8F0] rounded cursor-pointer"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <span className="w-[1px] h-5 bg-[#E2E8F0]" aria-hidden="true" />

          {/* Bold / Italic / Underline */}
          <div className="inline-flex items-center gap-0.5">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                runExecCommand('bold');
              }}
              title="Bold (Ctrl+B)"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                activeMarks.bold
                  ? 'bg-[#0F172A] text-white'
                  : 'text-[#0F172A] hover:bg-[#F1F5F9]'
              }`}
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                runExecCommand('italic');
              }}
              title="Italic (Ctrl+I)"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                activeMarks.italic
                  ? 'bg-[#0F172A] text-white'
                  : 'text-[#0F172A] hover:bg-[#F1F5F9]'
              }`}
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                runExecCommand('underline');
              }}
              title="Underline (Ctrl+U)"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                activeMarks.underline
                  ? 'bg-[#0F172A] text-white'
                  : 'text-[#0F172A] hover:bg-[#F1F5F9]'
              }`}
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
          </div>

          <span className="w-[1px] h-5 bg-[#E2E8F0]" aria-hidden="true" />

          {/* Word-Style Alignment Bar (Left, Center, Right, Justify, Split L↔R) */}
          <div
            className="inline-flex items-center gap-0.5 rounded-lg bg-[#FAF9F6] border border-[#CBD5E1] p-0.5"
            role="group"
            aria-label="Text Alignment"
          >
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                applyAlignment('left');
              }}
              title="Align Left (Ctrl+L)"
              className={alignBtnClass('left')}
            >
              <AlignLeft className="w-3.5 h-3.5" />
              <span>Left</span>
            </button>

            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                applyAlignment('center');
              }}
              title="Align Center (Ctrl+E)"
              className={alignBtnClass('center')}
            >
              <AlignCenter className="w-3.5 h-3.5" />
              <span>Center</span>
            </button>

            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                applyAlignment('right');
              }}
              title="Align Right (Ctrl+R)"
              className={alignBtnClass('right')}
            >
              <AlignRight className="w-3.5 h-3.5" />
              <span>Right</span>
            </button>

            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                applyAlignment('justify');
              }}
              title="Justify Paragraph (Ctrl+J)"
              className={alignBtnClass('justify')}
            >
              <AlignJustify className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Justify</span>
            </button>

            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                applyAlignment('split');
              }}
              title="Split Left & Right on Same Line (Role on Left, Date on Right)"
              className={alignBtnClass('split')}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Split L↔R</span>
            </button>
          </div>

          <span className="w-[1px] h-5 bg-[#E2E8F0]" aria-hidden="true" />

          {/* Lists & Indentation */}
          <div className="inline-flex items-center gap-0.5">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                runExecCommand('insertUnorderedList');
              }}
              title="Bullet List"
              className="p-1.5 rounded-lg text-[#0F172A] hover:bg-[#F1F5F9] cursor-pointer"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                runExecCommand('insertOrderedList');
              }}
              title="Numbered List"
              className="p-1.5 rounded-lg text-[#0F172A] hover:bg-[#F1F5F9] cursor-pointer"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                adjustBlockIndent(-18);
              }}
              title="Decrease Indent (Shift+Tab)"
              className="p-1.5 rounded-lg text-[#0F172A] hover:bg-[#F1F5F9] cursor-pointer"
            >
              <IndentDecrease className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                adjustBlockIndent(18);
              }}
              title="Increase Indent (Tab)"
              className="p-1.5 rounded-lg text-[#0F172A] hover:bg-[#F1F5F9] cursor-pointer"
            >
              <IndentIncrease className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Undo / Redo / Revert */}
          <div className="inline-flex items-center gap-0.5 ml-auto">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                runExecCommand('undo');
              }}
              title="Undo (Ctrl+Z)"
              className="p-1.5 rounded-lg text-[#0F172A] hover:bg-[#F1F5F9] cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                runExecCommand('redo');
              }}
              title="Redo (Ctrl+Y)"
              className="p-1.5 rounded-lg text-[#0F172A] hover:bg-[#F1F5F9] cursor-pointer"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
            {hasModifications && (
              <button
                type="button"
                onClick={onResetEdits}
                title="Revert back to uploaded original"
                className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FAF9F6] text-[#0F172A] border border-[#CBD5E1] hover:border-[#000000] cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Revert
              </button>
            )}
          </div>
        </div>

        {/* Ribbon Row 2: Place Blocks, Line Gap Nudge, Spacing, Margins & Import Lines */}
        <div className="pt-2 border-t border-[#F1F5F9] flex items-center flex-wrap gap-1.5">
          <span className="text-[11px] font-bold text-[#64748B] mr-0.5">
            Place:
          </span>

          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              placePlaygroundBlock('section');
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FAF9F6] text-[#0F172A] border border-[#E2E8F0] hover:border-[#000000] cursor-pointer"
          >
            <Heading className="w-3 h-3" />
            + Section
          </button>

          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              placePlaygroundBlock('role-date');
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FAF9F6] text-[#0F172A] border border-[#E2E8F0] hover:border-[#000000] cursor-pointer"
          >
            <Columns2 className="w-3 h-3" />
            + Role &amp; Date
          </button>

          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              placePlaygroundBlock('bullet');
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FAF9F6] text-[#0F172A] border border-[#E2E8F0] hover:border-[#000000] cursor-pointer"
          >
            <Sparkles className="w-3 h-3" />
            + Bullet
          </button>

          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              placePlaygroundBlock('divider');
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FAF9F6] text-[#0F172A] border border-[#E2E8F0] hover:border-[#000000] cursor-pointer"
          >
            + Line
          </button>

          <span className="w-[1px] h-4 bg-[#E2E8F0] mx-0.5" aria-hidden="true" />

          {/* Fine-grain Vertical Gap Nudge for Selected Line / Section */}
          <div className="inline-flex items-center rounded-lg bg-[#FAF9F6] border border-[#E2E8F0] px-1.5 h-7 gap-1">
            <ChevronsUpDown className="w-3 h-3 text-[#64748B]" />
            <span className="text-[11px] font-semibold text-[#475569]">Gap</span>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                adjustVerticalGap(-2);
              }}
              title="Tighten vertical space above current line"
              className="px-1 py-0.5 text-[#0F172A] hover:bg-[#E2E8F0] rounded cursor-pointer"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                adjustVerticalGap(2);
              }}
              title="Increase vertical space above current line"
              className="px-1 py-0.5 text-[#0F172A] hover:bg-[#E2E8F0] rounded cursor-pointer"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <select
            aria-label="Line Spacing"
            value={lineSpacing}
            onChange={(e) =>
              onChangeLineSpacing(e.target.value as WorkspaceSession['lineSpacing'])
            }
            title="Document Line Spacing"
            className="h-7 px-2 rounded-lg bg-[#FAF9F6] border border-[#E2E8F0] text-[11px] font-semibold text-[#0F172A] focus:outline-none cursor-pointer"
          >
            <option value="1.15">Line 1.15</option>
            <option value="1.3">Line 1.3</option>
            <option value="1.45">Line 1.45</option>
            <option value="1.6">Line 1.6</option>
          </select>

          <select
            aria-label="Page Margins"
            value={pageMargin}
            onChange={(e) =>
              onChangePageMargin(e.target.value as WorkspaceSession['pageMargin'])
            }
            title="Page Margins"
            className="h-7 px-2 rounded-lg bg-[#FAF9F6] border border-[#E2E8F0] text-[11px] font-semibold text-[#0F172A] focus:outline-none cursor-pointer"
          >
            <option value="narrow">Narrow Margin</option>
            <option value="normal">Normal Margin</option>
            <option value="wide">Wide Margin</option>
          </select>

          <button
            type="button"
            onClick={() => {
              saveSelectionRange();
              setShowImportDrawer((v) => !v);
            }}
            className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
              showImportDrawer
                ? 'bg-[#0F172A] text-white border-[#0F172A]'
                : 'bg-[#FAF9F6] text-[#0F172A] border-[#0F172A] hover:bg-[#F1F5F9]'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            Import / Place Lines
          </button>
        </div>

        {/* Playground Import / Place Lines Drawer */}
        {showImportDrawer && (
          <div className="mt-2 p-3 rounded-xl bg-[#FAF9F6] border border-[#CBD5E1] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#0F172A]">
                Paste or import lines from another file to place right at your cursor
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => snippetFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FFFFFF] text-[#0F172A] border border-[#CBD5E1] hover:border-[#000000] cursor-pointer"
                >
                  <FileUp className="w-3 h-3" />
                  {isImportingSnippet ? 'Reading...' : 'Import from .PDF / .DOCX / .TXT'}
                </button>
                <input
                  ref={snippetFileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleExtractLinesFromExternalFile(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowImportDrawer(false)}
                  className="p-1 text-[#64748B] hover:text-[#000000] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <textarea
              rows={4}
              value={importLinesText}
              onChange={(e) => setImportLinesText(e.target.value)}
              placeholder="Paste bullet points, achievements, project lines, or skills here..."
              className="w-full rounded-lg bg-[#FFFFFF] border border-[#CBD5E1] focus:border-[#000000] focus:outline-none px-3 py-2 text-xs text-[#0F172A] leading-relaxed"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#0F172A] cursor-pointer">
                <input
                  type="checkbox"
                  checked={importAsBullets}
                  onChange={(e) => setImportAsBullets(e.target.checked)}
                  className="rounded border-[#CBD5E1] accent-[#0F172A]"
                />
                Format each line as a bullet point (•)
              </label>

              <button
                type="button"
                disabled={!importLinesText.trim()}
                onClick={handleImportLinesIntoPlayground}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#0F172A] text-white hover:bg-[#000000] disabled:opacity-40 cursor-pointer"
              >
                Place into Document
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================
          WORD-DOC RESUME PAPER SHEET (100% Live Editable Playground)
         ======================================================================== */}
      <div className="print-only-reset relative w-full max-w-[816px] mx-auto">
        {!hasContent && (
          <div className="no-print pointer-events-none absolute inset-x-0 top-24 z-10 flex flex-col items-center text-center px-6">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="pointer-events-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold bg-[#0F172A] text-white hover:bg-[#000000] shadow-sm cursor-pointer"
            >
              <FileUp className="w-4 h-4" />
              Upload Your .PDF or .DOCX Resume
            </button>
            <p className="text-xs text-[#64748B] mt-2.5">
              Or click anywhere on this blank page to start typing &amp; placing blocks directly
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FILES}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUploadFile(file);
                e.target.value = '';
              }}
            />
          </div>
        )}

        <article
          id="ats-resume-sheet"
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck
          onInput={syncEditorToStore}
          onKeyDown={handleEditorKeyDown}
          onKeyUp={saveSelectionRange}
          onMouseUp={saveSelectionRange}
          onBlur={saveSelectionRange}
          onPaste={handlePaste}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleSheetDrop}
          aria-label="Word-Style Editable Resume Playground"
          style={
            {
              '--resume-unified-font': unifiedFontCss,
              '--resume-line-spacing': lineSpacing,
            } as React.CSSProperties
          }
          className={`editable-resume-surface ${MARGIN_PADDING_CLASS[pageMargin]} bg-[#FFFFFF] text-[#000000] w-full min-h-[1040px] rounded-sm border border-[#CBD5E1] focus:border-[#000000] focus:outline-none shadow-[0_8px_28px_rgba(15,23,42,0.08)] overflow-x-auto transition-colors`}
        />
      </div>
    </div>
  );
};
