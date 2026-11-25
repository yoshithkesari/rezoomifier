import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { UnifiedResumeFontId } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface EditablePDFExtractionResult {
  text: string;
  editableHtml: string;
  editableCss: string;
  detectedFontId: UnifiedResumeFontId;
  pageCount: number;
  durationMs: number;
}

interface StyledSpan {
  str: string;
  xPt: number;
  baselineYPt: number;
  topPt: number;
  bottomPt: number;
  widthPt: number;
  fontSizePt: number;
  isBold: boolean;
  isItalic: boolean;
  colorHex: string;
}

interface HorizontalRule {
  yPt: number;
  x1Pt: number;
  x2Pt: number;
  thicknessPt: number;
  colorHex: string;
}

interface RowCell {
  runs: StyledSpan[];
  xPt: number;
  rightPt: number;
  text: string;
  html: string;
}

interface VisualLine {
  cells: RowCell[];
  fullHtml: string;
  xPt: number;
  rightPt: number;
  topPt: number;
  bottomPt: number;
  baselineYPt: number;
  fontSizePt: number;
  isAllBold: boolean;
  text: string;
  ruleBelow?: HorizontalRule;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizePdfGlyphs(raw: string): string {
  return raw
    .replace(/[\uF0B7\uF0A7\uF0D8\uF076\uF0FC\u25CF\u25AA\uFFFD]/g, '•')
    .replace(/^[\uE000-\uF8FF](?=\s|$)/g, '•');
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  if (r < 45 && g < 45 && b < 50) return '#000000';
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

function normalizeColorArgs(args: unknown[]): string {
  if (!args || args.length === 0) return '#000000';
  if (typeof args[0] === 'string' && args[0].startsWith('#')) return args[0];
  if (args.length >= 3 && typeof args[0] === 'number') {
    const scale =
      args[0] <= 1 && (args[1] as number) <= 1 && (args[2] as number) <= 1 ? 255 : 1;
    return rgbToHex(
      (args[0] as number) * scale,
      (args[1] as number) * scale,
      (args[2] as number) * scale
    );
  }
  if (args.length === 1 && typeof args[0] === 'number') {
    const g = (args[0] <= 1 ? args[0] * 255 : args[0]) as number;
    return rgbToHex(g, g, g);
  }
  return '#000000';
}

export function mapFontNameToUnifiedId(
  realFontName: string,
  fallbackStyleFamily: string
): UnifiedResumeFontId | null {
  const clean = realFontName.replace(/^[A-Z]{6}\+/, '').toLowerCase();

  if (/(symbol|wingdings|dingbats|fontawesome|cmsy|cmex|msam|msbm|lucide|material)/i.test(clean)) {
    return null;
  }

  if (/(calibri|carlito)/i.test(clean)) return 'calibri';
  if (/(cambria)/i.test(clean)) return 'cambria';
  if (/(garamond|cormorant)/i.test(clean)) return 'garamond';
  if (/(georgia|charter)/i.test(clean)) return 'georgia';
  if (
    /(times|nimbusrom|liberationserif|\bcmr|\bcmbx|\bti\d+|\blmr|palatino|minion|baskerville)/i.test(
      clean
    )
  ) {
    return 'times';
  }
  if (/(arial|liberationsans|arimo)/i.test(clean)) return 'arial';
  if (
    /(helvetica|nimbussan|inter|roboto|lato|opensans|montserrat|jakarta|segoe|tahoma|verdana)/i.test(
      clean
    )
  ) {
    return 'inter';
  }

  if (/serif/i.test(fallbackStyleFamily) && !/sans/i.test(fallbackStyleFamily)) {
    return 'times';
  }
  return 'calibri';
}

async function extractPageHorizontalRules(
  page: pdfjsLib.PDFPageProxy,
  viewport1x: pdfjsLib.PageViewport
): Promise<HorizontalRule[]> {
  const rules: HorizontalRule[] = [];
  try {
    const opList = await page.getOperatorList();
    const OPS = pdfjsLib.OPS;

    let ctm: number[] = [1, 0, 0, 1, 0, 0];
    const ctmStack: number[][] = [];
    let strokeHex = '#000000';
    let fillHex = '#000000';
    let lineWidth = 0.75;
    let pendingBBox: [number, number, number, number] | null = null;

    const toViewportPt = (x: number, y: number): [number, number] => {
      const m = pdfjsLib.Util.transform(viewport1x.transform, ctm);
      return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    };

    const recordCandidateBBox = (
      bbox: [number, number, number, number],
      color: string,
      isStroked: boolean
    ) => {
      const [p1x, p1y] = toViewportPt(bbox[0], bbox[1]);
      const [p2x, p2y] = toViewportPt(bbox[2], bbox[3]);
      const x1 = Math.min(p1x, p2x);
      const x2 = Math.max(p1x, p2x);
      const y1 = Math.min(p1y, p2y);
      const y2 = Math.max(p1y, p2y);
      const w = x2 - x1;
      const h = y2 - y1;

      if (w >= 55 && h <= 4.5) {
        if (color.toLowerCase() === '#ffffff') return;
        const scaleY = Math.hypot(ctm[1], ctm[3]) || 1;
        const thicknessPt = isStroked
          ? Math.max(0.6, Math.min(2.5, lineWidth * scaleY))
          : Math.max(0.6, Math.min(2.5, h || 0.8));

        rules.push({
          yPt: (y1 + y2) / 2,
          x1Pt: x1,
          x2Pt: x2,
          thicknessPt,
          colorHex: color,
        });
      }
    };

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i] as unknown[];

      switch (fn) {
        case OPS.save:
          ctmStack.push([...ctm]);
          break;
        case OPS.restore:
          ctm = ctmStack.pop() ?? [1, 0, 0, 1, 0, 0];
          break;
        case OPS.transform:
          if (Array.isArray(args) && args.length >= 6) {
            ctm = pdfjsLib.Util.transform(ctm, args as number[]);
          }
          break;
        case OPS.setLineWidth:
          if (typeof args?.[0] === 'number') lineWidth = args[0];
          break;
        case OPS.setStrokeRGBColor:
        case OPS.setStrokeGray:
          strokeHex = normalizeColorArgs(args);
          break;
        case OPS.setFillRGBColor:
        case OPS.setFillGray:
          fillHex = normalizeColorArgs(args);
          break;
        case OPS.rectangle:
          if (args && args.length >= 4) {
            const rx = Number(args[0]);
            const ry = Number(args[1]);
            const rw = Number(args[2]);
            const rh = Number(args[3]);
            pendingBBox = [rx, ry, rx + rw, ry + rh];
          }
          break;
        case OPS.constructPath: {
          const minMax = args?.[2] as [number, number, number, number] | null | undefined;
          if (minMax && minMax.length >= 4 && Number.isFinite(minMax[0])) {
            pendingBBox = [minMax[0], minMax[1], minMax[2], minMax[3]];
          } else {
            const subOps = (args?.[0] as number[]) ?? [];
            const coords = (args?.[1] as number[]) ?? [];
            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;
            let cj = 0;
            for (const sop of subOps) {
              if (sop === OPS.rectangle && cj + 3 < coords.length) {
                const rx = coords[cj++];
                const ry = coords[cj++];
                const rw = coords[cj++];
                const rh = coords[cj++];
                minX = Math.min(minX, rx, rx + rw);
                maxX = Math.max(maxX, rx, rx + rw);
                minY = Math.min(minY, ry, ry + rh);
                maxY = Math.max(maxY, ry, ry + rh);
              } else if ((sop === OPS.moveTo || sop === OPS.lineTo) && cj + 1 < coords.length) {
                const px = coords[cj++];
                const py = coords[cj++];
                minX = Math.min(minX, px);
                maxX = Math.max(maxX, px);
                minY = Math.min(minY, py);
                maxY = Math.max(maxY, py);
              } else if (sop === OPS.curveTo && cj + 5 < coords.length) {
                cj += 6;
              } else if ((sop === OPS.curveTo2 || sop === OPS.curveTo3) && cj + 3 < coords.length) {
                cj += 4;
              }
            }
            if (Number.isFinite(minX)) {
              pendingBBox = [minX, minY, maxX, maxY];
            }
          }
          break;
        }
        case OPS.stroke:
        case OPS.closeStroke:
          if (pendingBBox) {
            recordCandidateBBox(pendingBBox, strokeHex, true);
            pendingBBox = null;
          }
          break;
        case OPS.fill:
        case OPS.eoFill:
        case OPS.fillStroke:
        case OPS.eoFillStroke:
          if (pendingBBox) {
            recordCandidateBBox(pendingBBox, fillHex, false);
            pendingBBox = null;
          }
          break;
        case OPS.endPath:
          pendingBBox = null;
          break;
      }
    }
  } catch {
    // Ignore optional operator list failures safely
  }

  const deduped: HorizontalRule[] = [];
  const sorted = rules.sort((a, b) => a.yPt - b.yPt);
  for (const r of sorted) {
    const prev = deduped[deduped.length - 1];
    if (prev && Math.abs(prev.yPt - r.yPt) <= 2 && Math.abs(prev.x1Pt - r.x1Pt) <= 10) {
      prev.x2Pt = Math.max(prev.x2Pt, r.x2Pt);
      continue;
    }
    deduped.push(r);
  }
  return deduped;
}

function renderRunsToHtml(runs: StyledSpan[]): { text: string; html: string } {
  let plain = '';
  let html = '';

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    if (i > 0) {
      const prev = runs[i - 1];
      const gap = run.xPt - (prev.xPt + prev.widthPt);
      if (gap > 18) {
        plain += '   ';
        html += ' &nbsp;&nbsp; ';
      } else {
        const needsSpace =
          gap > 1.5 &&
          !plain.endsWith(' ') &&
          !run.str.startsWith(' ') &&
          !/^[,.:;!?)]/.test(run.str);
        if (needsSpace) {
          plain += ' ';
          html += ' ';
        }
      }
    }
    plain += run.str;
    let chunk = escapeHtml(run.str);
    if (run.isBold) chunk = `<strong>${chunk}</strong>`;
    if (run.isItalic) chunk = `<em>${chunk}</em>`;
    html += chunk;
  }

  return { text: plain.replace(/\s+/g, ' ').trim(), html: html.trim() };
}

function stripLeadingBulletHtml(html: string): string {
  // Strips a leading bullet marker (even if wrapped inside <strong> or <em>) so semantic <ul><li> renders one clean bullet
  return html
    .replace(
      /^(\s*(?:<(?:strong|em|b|i)>\s*)*)(?:[•▪◦‣–—*-])(?:\s+|&nbsp;)+((?:\s*<\/(?:strong|em|b|i)>)*)/i,
      '$1$2'
    )
    .replace(/^(?:<(?:strong|em|b|i)>\s*<\/(?:strong|em|b|i)>\s*)+/i, '')
    .trim();
}

function buildFlowingColumnHtml(
  spans: StyledSpan[],
  rules: HorizontalRule[],
  colLeftPt: number,
  colRightPt: number,
  pxPerPt: number
): string {
  if (spans.length === 0) return '';
  const colWidthPt = Math.max(100, colRightPt - colLeftPt);
  const colCenterPt = (colLeftPt + colRightPt) / 2;

  const sortedSpans = [...spans].sort((a, b) => {
    if (Math.abs(a.baselineYPt - b.baselineYPt) <= 3.5) return a.xPt - b.xPt;
    return a.baselineYPt - b.baselineYPt;
  });

  const rawLines: StyledSpan[][] = [];
  for (const sp of sortedSpans) {
    const lastLine = rawLines[rawLines.length - 1];
    if (!lastLine) {
      rawLines.push([sp]);
      continue;
    }
    const anchorBaseline = lastLine[0].baselineYPt;
    if (Math.abs(sp.baselineYPt - anchorBaseline) <= 3.5) {
      lastLine.push(sp);
    } else {
      rawLines.push([sp]);
    }
  }

  const visualLines: VisualLine[] = rawLines
    .map((lineSpans) => {
      const ordered = [...lineSpans].sort((a, b) => a.xPt - b.xPt);
      const fullRendered = renderRunsToHtml(ordered);

      // Split into tab-separated cells ONLY across genuine wide tab stops (> 36pt)
      const cellGroups: StyledSpan[][] = [];
      for (const sp of ordered) {
        const prevCell = cellGroups[cellGroups.length - 1];
        if (!prevCell) {
          cellGroups.push([sp]);
          continue;
        }
        const prevEnd =
          prevCell[prevCell.length - 1].xPt + prevCell[prevCell.length - 1].widthPt;
        const gap = sp.xPt - prevEnd;
        if (gap > 36) {
          cellGroups.push([sp]);
        } else {
          prevCell.push(sp);
        }
      }

      const cells: RowCell[] = cellGroups
        .map((cg) => {
          const rendered = renderRunsToHtml(cg);
          const last = cg[cg.length - 1];
          return {
            runs: cg,
            xPt: cg[0].xPt,
            rightPt: last.xPt + last.widthPt,
            text: rendered.text,
            html: rendered.html,
          };
        })
        .filter((c) => c.text.length > 0);

      const xPt = ordered[0].xPt;
      const rightPt = ordered[ordered.length - 1].xPt + ordered[ordered.length - 1].widthPt;
      const topPt = Math.min(...ordered.map((o) => o.topPt));
      const bottomPt = Math.max(...ordered.map((o) => o.bottomPt));
      const baselineYPt =
        ordered.reduce((acc, o) => acc + o.baselineYPt, 0) / ordered.length;
      const maxFontPt = Math.max(...ordered.map((o) => o.fontSizePt));
      const isAllBold = ordered.every((o) => o.isBold || !o.str.trim());

      return {
        cells,
        fullHtml: fullRendered.html,
        xPt,
        rightPt,
        topPt,
        bottomPt,
        baselineYPt,
        fontSizePt: maxFontPt,
        isAllBold,
        text: fullRendered.text,
      };
    })
    .filter((vl) => vl.cells.length > 0);

  const usedRules = new Set<HorizontalRule>();
  for (const rule of rules) {
    if (rule.x2Pt < colLeftPt + 20 || rule.x1Pt > colRightPt - 20) continue;

    let bestLine: VisualLine | null = null;
    let bestDist = Infinity;
    for (const vl of visualLines) {
      const dist = rule.yPt - vl.baselineYPt;
      if (dist >= -1 && dist <= 11 && dist < bestDist) {
        bestDist = dist;
        bestLine = vl;
      }
    }
    if (bestLine && !bestLine.ruleBelow) {
      bestLine.ruleBelow = rule;
      usedRules.add(rule);
    }
  }

  const htmlBlocks: string[] = [];
  let prevBottomPt: number | null = null;
  let openBulletListItems: string[] = [];
  let openBulletFontSizePx = 13;
  let openBulletMarginTopPx = 3;

  const flushBulletList = () => {
    if (openBulletListItems.length === 0) return;
    htmlBlocks.push(
      `<ul class="rz-list" style="margin:${openBulletMarginTopPx}px 0 0 0;padding-left:18px;font-size:${openBulletFontSizePx}px;color:#000000;">` +
        openBulletListItems.join('') +
        `</ul>`
    );
    openBulletListItems = [];
  };

  const emitDivider = (rule: HorizontalRule) => {
    flushBulletList();
    const thickPx = Math.max(1, Math.round(rule.thicknessPt * pxPerPt * 10) / 10);
    htmlBlocks.push(
      `<hr class="rz-divider" contenteditable="false" style="border:none;border-top:${thickPx}px solid ${rule.colorHex};margin:2px 0 3px 0;" />`
    );
  };

  const computeMarginTopPx = (topPt: number, hadDividerJustAbove: boolean): number => {
    if (prevBottomPt === null) return 0;
    const rawGapPt = Math.max(0, topPt - prevBottomPt);
    // Subtract divider's visual margin so section gaps are never double-counted
    const adjustedGapPt = hadDividerJustAbove ? Math.max(1, rawGapPt - 3.5) : rawGapPt;
    if (adjustedGapPt <= 2.5) return 1;
    return Math.min(18, Math.max(2, Math.round(adjustedGapPt * pxPerPt)));
  };

  let hadDividerAbove = false;
  let i = 0;

  while (i < visualLines.length) {
    const line = visualLines[i];
    const fontSizePx = Math.round(line.fontSizePt * pxPerPt * 10) / 10;

    // Emit any standalone unattached horizontal rule above this line
    for (const rule of rules) {
      if (usedRules.has(rule)) continue;
      if (
        prevBottomPt !== null &&
        rule.yPt > prevBottomPt &&
        rule.yPt <= line.topPt + 2 &&
        rule.x2Pt >= colLeftPt + 20 &&
        rule.x1Pt <= colRightPt - 20
      ) {
        usedRules.add(rule);
        emitDivider(rule);
        prevBottomPt = Math.max(prevBottomPt, rule.yPt + rule.thicknessPt);
        hadDividerAbove = true;
      }
    }

    const marginTopPx = computeMarginTopPx(line.topPt, hadDividerAbove);
    hadDividerAbove = false;

    const lineWidthPt = line.rightPt - line.xPt;
    const lineCenterPt = (line.xPt + line.rightPt) / 2;

    // 1. Check full-line centering FIRST (protects centered contact bars like "email | phone | city"!)
    const isCentered =
      Math.abs(lineCenterPt - colCenterPt) <= 24 &&
      lineWidthPt < colWidthPt * 0.88 &&
      line.xPt - colLeftPt > 16 &&
      colRightPt - line.rightPt > 16;

    // 2. Check genuine Left-Title / Right-Date split row
    const isTrueSplitRow =
      !isCentered &&
      line.cells.length >= 2 &&
      line.xPt - colLeftPt <= 32 &&
      colRightPt - line.rightPt <= 36;

    if (isTrueSplitRow) {
      flushBulletList();
      const leftHtml = line.cells.slice(0, -1).map((c) => c.html).join(' &nbsp; ');
      const rightHtml = line.cells[line.cells.length - 1].html;
      const leftIndentPx = Math.max(0, Math.round((line.xPt - colLeftPt) * pxPerPt));

      htmlBlocks.push(
        `<div class="rz-split-row" style="display:flex;justify-content:space-between;align-items:baseline;gap:16px;margin-top:${marginTopPx}px;padding-left:${leftIndentPx}px;font-size:${fontSizePx}px;color:#000000;">` +
          `<span class="rz-split-left">${leftHtml}</span>` +
          `<span class="rz-split-right">${rightHtml}</span>` +
          `</div>`
      );
      prevBottomPt = line.bottomPt;
      if (line.ruleBelow) {
        emitDivider(line.ruleBelow);
        prevBottomPt = Math.max(prevBottomPt, line.ruleBelow.yPt + line.ruleBelow.thicknessPt);
        hadDividerAbove = true;
      }
      i++;
      continue;
    }

    // 3. Check bullet item OR regular paragraph line (merging wrapped continuation lines accurately)
    const isBulletStart = /^(?:[•▪◦‣–—*-])\s+\S/.test(line.text);
    const isCategoryLine = /^[^:•]{2,32}:\s+\S/.test(line.text);
    let combinedHtml = line.fullHtml;
    let groupBottomPt = line.bottomPt;
    let activeRuleBelow = line.ruleBelow;

    if (!isCentered && !line.isAllBold && !activeRuleBelow) {
      while (i + 1 < visualLines.length) {
        const currLine = visualLines[i];
        const next = visualLines[i + 1];
        const vGap = next.topPt - groupBottomPt;
        const nextStartsBullet = /^(?:[•▪◦‣–—*-]|\d+\.)\s+/.test(next.text);
        const nextIsCategory = /^[^:•]{2,32}:\s+\S/.test(next.text);
        const currWidthRatio = (currLine.rightPt - colLeftPt) / colWidthPt;
        const nextCenter = (next.xPt + next.rightPt) / 2;
        const nextCentered =
          Math.abs(nextCenter - colCenterPt) <= 24 &&
          next.rightPt - next.xPt < colWidthPt * 0.88 &&
          next.xPt - colLeftPt > 16 &&
          colRightPt - next.rightPt > 16;
        const nextIsSplit =
          !nextCentered &&
          next.cells.length >= 2 &&
          next.xPt - colLeftPt <= 32 &&
          colRightPt - next.rightPt <= 36;

        // Strict wrap threshold (>= 0.80 for bullets, >= 0.84 for prose) so separate lines never merge!
        const minWrapWidth = isBulletStart ? 0.78 : 0.84;

        const canMerge =
          !nextCentered &&
          !nextIsSplit &&
          !next.isAllBold &&
          !nextStartsBullet &&
          !nextIsCategory &&
          !(isCategoryLine && currWidthRatio < 0.84) &&
          currWidthRatio >= minWrapWidth &&
          vGap >= -2 &&
          vGap <= line.fontSizePt * 0.52 &&
          Math.abs(next.fontSizePt - line.fontSizePt) <= 0.7;

        if (!canMerge) break;
        combinedHtml += ' ' + next.fullHtml;
        groupBottomPt = next.bottomPt;
        if (next.ruleBelow) {
          activeRuleBelow = next.ruleBelow;
          i++;
          break;
        }
        i++;
      }
    }

    if (isBulletStart && !isCentered) {
      if (openBulletListItems.length === 0) {
        openBulletFontSizePx = fontSizePx;
        openBulletMarginTopPx = marginTopPx;
      }
      const cleanBulletInner = stripLeadingBulletHtml(combinedHtml);
      openBulletListItems.push(
        `<li class="rz-li" style="margin-top:2px;font-size:${fontSizePx}px;color:#000000;">${cleanBulletInner}</li>`
      );
      prevBottomPt = groupBottomPt;
      if (activeRuleBelow) {
        emitDivider(activeRuleBelow);
        prevBottomPt = Math.max(prevBottomPt, activeRuleBelow.yPt + activeRuleBelow.thicknessPt);
        hadDividerAbove = true;
      }
      i++;
      continue;
    }

    flushBulletList();

    // Check right-aligned single line (e.g. standalone date/location at far right)
    const isRightAligned =
      !isCentered &&
      line.xPt - colLeftPt > colWidthPt * 0.55 &&
      colRightPt - line.rightPt <= 24;

    const leftIndentPx =
      isCentered || isRightAligned
        ? 0
        : Math.max(0, Math.min(48, Math.round((line.xPt - colLeftPt) * pxPerPt)));

    const alignCss = isCentered
      ? 'text-align:center;'
      : isRightAligned
        ? 'text-align:right;'
        : leftIndentPx > 4
          ? `text-align:left;padding-left:${leftIndentPx}px;`
          : 'text-align:left;';

    htmlBlocks.push(
      `<div class="rz-line" style="margin-top:${marginTopPx}px;${alignCss}font-size:${fontSizePx}px;color:#000000;">${combinedHtml}</div>`
    );

    prevBottomPt = groupBottomPt;
    if (activeRuleBelow) {
      emitDivider(activeRuleBelow);
      prevBottomPt = Math.max(prevBottomPt, activeRuleBelow.yPt + activeRuleBelow.thicknessPt);
      hadDividerAbove = true;
    }
    i++;
  }

  flushBulletList();
  return htmlBlocks.join('\n');
}

export async function extractEditableResumeFromPDF(
  file: File
): Promise<EditablePDFExtractionResult> {
  const start = performance.now();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const pageHtmlFragments: string[] = [];
  const pagePlainTexts: string[] = [];
  const fontCharVotes = new Map<UnifiedResumeFontId, number>();
  const TARGET_SHEET_WIDTH_PX = 794;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport1x = page.getViewport({ scale: 1 });
    const pxPerPt = TARGET_SHEET_WIDTH_PX / viewport1x.width;

    const rules = await extractPageHorizontalRules(page, viewport1x);
    const content = await page.getTextContent();

    const styles = content.styles as Record<
      string,
      { fontFamily?: string; ascent?: number; descent?: number }
    >;

    const fontMetaCache = new Map<
      string,
      { realName: string; isBold: boolean; isItalic: boolean; votedFont: UnifiedResumeFontId | null }
    >();

    const getFontMeta = (fontKey: string, styleFamily: string) => {
      const cached = fontMetaCache.get(fontKey);
      if (cached) return cached;

      let realName = fontKey;
      let objBold = false;
      let objItalic = false;

      try {
        if (page.commonObjs.has(fontKey)) {
          const obj = page.commonObjs.get(fontKey) as {
            name?: string;
            bold?: boolean;
            italic?: boolean;
            black?: boolean;
          } | null;
          if (obj) {
            if (typeof obj.name === 'string' && obj.name) realName = obj.name;
            objBold = Boolean(obj.bold || obj.black);
            objItalic = Boolean(obj.italic);
          }
        }
      } catch {
        // Ignore safely
      }

      const cleanName = realName.replace(/^[A-Z]{6}\+/, '');
      const isBold =
        objBold ||
        /(bold|semibold|demibold|demi|black|heavy|extrabold|\bbx\d*|\bcmb|-b\b)/i.test(cleanName);
      const isItalic =
        objItalic || /(italic|oblique|\bit\b|\bti\d+|\bcmi)/i.test(cleanName);
      const votedFont = mapFontNameToUnifiedId(cleanName, styleFamily);

      const meta = { realName: cleanName, isBold, isItalic, votedFont };
      fontMetaCache.set(fontKey, meta);
      return meta;
    };

    const spans: StyledSpan[] = [];
    const plainLines: Array<Array<{ str: string; x: number; width: number }>> = [];
    let currPlainLine: Array<{ str: string; x: number; width: number }> = [];
    let lastRawY: number | null = null;

    for (const item of content.items) {
      if (!('str' in item)) continue;
      const sanitizedStr = sanitizePdfGlyphs(item.str);
      if (!sanitizedStr && !item.hasEOL) continue;

      const rawX = Number(item.transform[4] ?? 0);
      const rawY = Number(item.transform[5] ?? 0);
      const rawW = Number(item.width ?? 0);

      if (lastRawY !== null && Math.abs(rawY - lastRawY) > 4) {
        if (currPlainLine.length > 0) {
          plainLines.push(currPlainLine);
          currPlainLine = [];
        }
      }
      if (sanitizedStr) currPlainLine.push({ str: sanitizedStr, x: rawX, width: rawW });
      lastRawY = rawY;
      if (item.hasEOL && currPlainLine.length > 0) {
        plainLines.push(currPlainLine);
        currPlainLine = [];
        lastRawY = null;
      }

      if (sanitizedStr && sanitizedStr.trim().length > 0) {
        const tx = pdfjsLib.Util.transform(viewport1x.transform, item.transform);
        const vx = tx[4];
        const vyBaseline = tx[5];
        const fontSizePt = Math.max(
          6.5,
          Math.hypot(tx[2], tx[3]) ||
            Math.hypot(item.transform[0], item.transform[1]) ||
            Number(item.height) ||
            10
        );
        const styleMeta = styles[item.fontName] ?? {};
        const ascent =
          typeof styleMeta.ascent === 'number' && styleMeta.ascent > 0.4 && styleMeta.ascent <= 1.2
            ? styleMeta.ascent
            : 0.82;
        const descent =
          typeof styleMeta.descent === 'number' && Math.abs(styleMeta.descent) <= 0.5
            ? Math.abs(styleMeta.descent)
            : 0.2;

        const fontMeta = getFontMeta(item.fontName, styleMeta.fontFamily ?? '');

        const alphaCount = (sanitizedStr.match(/[a-zA-Z]/g) ?? []).length;
        if (alphaCount > 0 && fontMeta.votedFont) {
          fontCharVotes.set(
            fontMeta.votedFont,
            (fontCharVotes.get(fontMeta.votedFont) ?? 0) + alphaCount
          );
        }

        spans.push({
          str: sanitizedStr,
          xPt: vx,
          baselineYPt: vyBaseline,
          topPt: vyBaseline - ascent * fontSizePt,
          bottomPt: vyBaseline + descent * fontSizePt,
          widthPt: Math.max(3, rawW),
          fontSizePt,
          isBold: fontMeta.isBold,
          isItalic: fontMeta.isItalic,
          colorHex: '#000000',
        });
      }
    }

    if (currPlainLine.length > 0) plainLines.push(currPlainLine);

    const plainText = plainLines
      .map((lineSpans) => {
        const sorted = [...lineSpans].sort((a, b) => a.x - b.x);
        let s = '';
        for (let i = 0; i < sorted.length; i++) {
          if (i > 0) {
            const gap = sorted[i].x - (sorted[i - 1].x + sorted[i - 1].width);
            if (
              gap > 2 &&
              !s.endsWith(' ') &&
              !sorted[i].str.startsWith(' ') &&
              !/^[,.:;!?)]/.test(sorted[i].str)
            ) {
              s += ' ';
            }
          }
          s += sorted[i].str;
        }
        return s.replace(/\s+/g, ' ').trim();
      })
      .filter(Boolean)
      .join('\n');

    pagePlainTexts.push(plainText);

    const allLefts = [...spans.map((s) => s.xPt), ...rules.map((r) => r.x1Pt)];
    const allRights = [
      ...spans.map((s) => s.xPt + s.widthPt),
      ...rules.map((r) => r.x2Pt),
    ];
    const allTops = spans.map((s) => s.topPt);

    const minLeftPt =
      allLefts.length > 0 ? Math.max(18, Math.min(72, Math.min(...allLefts))) : 42;
    const maxRightPt =
      allRights.length > 0
        ? Math.min(viewport1x.width - 18, Math.max(viewport1x.width - 72, Math.max(...allRights)))
        : viewport1x.width - 42;
    const minTopPt = allTops.length > 0 ? Math.max(16, Math.min(68, Math.min(...allTops))) : 36;

    const padLeftPx = Math.round(minLeftPt * pxPerPt);
    const padRightPx = Math.round((viewport1x.width - maxRightPt) * pxPerPt);
    const padTopPx = Math.round(minTopPt * pxPerPt);

    const columnBodyHtml = buildFlowingColumnHtml(
      spans,
      rules,
      minLeftPt,
      maxRightPt,
      pxPerPt
    );

    const pageDivider =
      pageNum > 1
        ? 'border-top:1.5px dashed #CBD5E1;margin-top:24px;padding-top:24px;'
        : '';

    pageHtmlFragments.push(
      `<div class="rz-pdf-editable-page" style="padding:${padTopPx}px ${padRightPx}px 36px ${padLeftPx}px;${pageDivider}">${columnBodyHtml}</div>`
    );
  }

  let detectedFontId: UnifiedResumeFontId = 'calibri';
  let bestVotes = -1;
  for (const [fontId, count] of fontCharVotes.entries()) {
    if (count > bestVotes) {
      bestVotes = count;
      detectedFontId = fontId;
    }
  }

  const durationMs = Math.max(1, Math.round(performance.now() - start));
  return {
    text: pagePlainTexts.join('\n\n').trim(),
    editableHtml: pageHtmlFragments.join('\n'),
    editableCss: '',
    detectedFontId,
    pageCount: pdf.numPages,
    durationMs,
  };
}
