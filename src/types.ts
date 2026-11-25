import React from 'react';

export interface WorkspaceSession {
  id: 'active-session';
  uploadedFileName: string;
  uploadedFileType: UploadedFileType;
  resumeFontId: UnifiedResumeFontId;
  lineSpacing: '1.15' | '1.3' | '1.45' | '1.6';
  pageMargin: 'narrow' | 'normal' | 'wide';
  editableHtml: string;
  editableCss: string;
  originalEditableHtml: string;
  externalRevision: number;
  rawResumeText: string;
  jobDescription: string;
  updatedAt: number;
}

export type UploadedFileType = 'pdf' | 'docx' | 'doc' | 'none';

export type UnifiedResumeFontId =
  | 'calibri'
  | 'times'
  | 'arial'
  | 'inter'
  | 'georgia'
  | 'garamond'
  | 'cambria';

export const UNIFIED_FONT_STACKS: Record<UnifiedResumeFontId, { label: string; css: string }> = {
  calibri: {
    label: 'Calibri',
    css: "Calibri, 'Inter', 'Segoe UI', Arial, sans-serif",
  },
  times: {
    label: 'Times New Roman',
    css: "'Times New Roman', Times, Georgia, serif",
  },
  arial: {
    label: 'Arial',
    css: 'Arial, Helvetica, sans-serif',
  },
  inter: {
    label: 'Inter',
    css: "'Inter', Helvetica, Arial, sans-serif",
  },
  georgia: {
    label: 'Georgia',
    css: "Georgia, 'Times New Roman', serif",
  },
  garamond: {
    label: 'Garamond',
    css: "Garamond, Georgia, 'Times New Roman', serif",
  },
  cambria: {
    label: 'Cambria',
    css: "Cambria, Georgia, 'Times New Roman', serif",
  },
};

export interface ExtractedKeyword {
  term: string;
  count: number;
  isPhrase: boolean;
}

export interface HeuristicCheck {
  id: 'contact' | 'experience' | 'education' | 'bullets' | 'metrics';
  label: string;
  detail: string;
  passed: boolean;
}

export interface ATSAnalysisResult {
  coverageScore: number;
  totalKeywords: number;
  matchedKeywords: ExtractedKeyword[];
  missingKeywords: ExtractedKeyword[];
  heuristics: HeuristicCheck[];
  bulletCount: number;
  metricCount: number;
  computeTimeMs: number;
}

export type PlaygroundBlockKind = 'section' | 'role-date' | 'bullet' | 'divider' | 'paragraph';
export type UnusedReactRef = React.RefObject<HTMLDivElement | null>;
