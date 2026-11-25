import React, { useRef, useState } from 'react';
import { FileUp, Plus, Check, Eraser, AlertCircle } from 'lucide-react';
import { ATSAnalysisResult } from '../types';

interface ATSScorecardProps {
  uploadedFileName: string;
  isParsingFile: boolean;
  parseError: string | null;
  jobDescription: string;
  analysis: ATSAnalysisResult;
  onUploadFile: (file: File) => void;
  onChangeJobDescription: (jd: string) => void;
  onAddMissingKeyword: (keyword: string) => void;
}

const ACCEPTED_FILES =
  '.pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword';

export const ATSScorecard: React.FC<ATSScorecardProps> = ({
  uploadedFileName,
  isParsingFile,
  parseError,
  jobDescription,
  analysis,
  onUploadFile,
  onChangeJobDescription,
  onAddMissingKeyword,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { coverageScore, totalKeywords, matchedKeywords, missingKeywords } = analysis;
  const hasJD = jobDescription.trim().length > 0;

  const scoreColor = !hasJD
    ? '#64748B'
    : coverageScore >= 75
      ? '#16A34A'
      : coverageScore >= 50
        ? '#D97706'
        : '#E11D48';

  return (
    <aside className="space-y-4">
      {/* Compact Resume Upload Card */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onUploadFile(f);
        }}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
        }}
        className={`card-tactile p-3.5 cursor-pointer flex items-center justify-between gap-3 transition-colors ${
          isDragging ? 'border-[#000000] bg-[#F1F5F9]' : 'hover:border-[#000000]'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#FAF9F6] border border-[#CBD5E1] flex items-center justify-center text-[#000000] shrink-0">
            <FileUp className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#0F172A] truncate">
              {isParsingFile
                ? 'Loading resume...'
                : uploadedFileName || 'Upload Resume (.PDF, .DOCX, .DOC)'}
            </p>
            <p className="text-[11px] text-[#64748B] truncate">
              {uploadedFileName ? 'Click or drop to replace file' : 'Drop file here or click'}
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#0F172A] text-white shrink-0">
          Browse
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILES}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUploadFile(f);
            e.target.value = '';
          }}
        />
      </div>

      {parseError && (
        <div className="px-3 py-2 rounded-xl bg-[#FFF1F2] border border-[#FECDD3] text-xs font-medium text-[#E11D48] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{parseError}</span>
        </div>
      )}

      {/* Job Description Card */}
      <div className="card-tactile p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <label htmlFor="jd-input" className="text-xs font-extrabold uppercase tracking-wider text-[#0F172A]">
            Job Description
          </label>
          {hasJD && (
            <button
              type="button"
              onClick={() => onChangeJobDescription('')}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#64748B] hover:text-[#E11D48] cursor-pointer"
            >
              <Eraser className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        <textarea
          id="jd-input"
          rows={6}
          value={jobDescription}
          onChange={(e) => onChangeJobDescription(e.target.value)}
          placeholder="Paste target job description here..."
          className="w-full rounded-xl bg-[#FAF9F6] border border-[#E2E8F0] focus:border-[#000000] focus:bg-[#FFFFFF] focus:outline-none px-3 py-2.5 text-xs text-[#0F172A] leading-relaxed resize-y"
        />
      </div>

      {/* Clean ATS Score + Keywords Card */}
      <div className="card-tactile p-4 space-y-4">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#0F172A]">
              ATS Match
            </span>
            <span className="text-xs font-semibold text-[#475569] tabular-nums">
              {matchedKeywords.length} / {totalKeywords} keywords
            </span>
          </div>

          <div className="mt-1 flex items-baseline gap-2">
            <span
              className="text-4xl font-extrabold tracking-tight tabular-nums"
              style={{ color: scoreColor }}
            >
              {coverageScore}%
            </span>
          </div>

          <div className="mt-2 w-full h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, Math.max(0, coverageScore))}%`,
                backgroundColor: scoreColor,
              }}
            />
          </div>
        </div>

        {/* Missing Keywords (Click or Drag onto Document!) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#E11D48]">
              Missing Keywords (Click or Drag to Resume)
            </span>
            <span className="text-[11px] font-bold text-[#E11D48] tabular-nums">
              {missingKeywords.length}
            </span>
          </div>

          {!hasJD ? (
            <p className="text-xs text-[#64748B]">
              Paste a job description above to see missing keywords.
            </p>
          ) : missingKeywords.length === 0 ? (
            <p className="text-xs font-semibold text-[#16A34A]">
              All target keywords matched!
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {missingKeywords.map((kw) => (
                <button
                  key={kw.term}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', kw.term);
                  }}
                  onClick={() => onAddMissingKeyword(kw.term)}
                  title="Click to insert or drag directly onto any line in your resume"
                  className="pill-lift inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#FFF1F2] text-[#E11D48] border border-[#FECDD3] hover:bg-[#FFE4E6] cursor-pointer"
                >
                  <Plus className="w-3 h-3 stroke-[2.5]" />
                  <span>{kw.term}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Matched Keywords */}
        {matchedKeywords.length > 0 && (
          <div className="pt-3 border-t border-[#E2E8F0]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#16A34A]">
                Matched
              </span>
              <span className="text-[11px] font-bold text-[#16A34A] tabular-nums">
                {matchedKeywords.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {matchedKeywords.map((kw) => (
                <span
                  key={kw.term}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]"
                >
                  <Check className="w-3 h-3 stroke-[2.5]" />
                  <span>{kw.term}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
