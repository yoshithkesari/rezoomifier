import React, { useRef, useState } from 'react';
import {
  ArrowRight,
  FileUp,
  AlignLeft,
  Target,
  FileDown,
  Sparkles,
  FileText,
} from 'lucide-react';
import { CleanHeroIllustration } from './CleanHeroIllustration';

interface LaunchPageProps {
  existingFileName: string;
  hasExistingResume: boolean;
  isParsingFile: boolean;
  onEnterPlayground: () => void;
  onUploadAndRedirect: (file: File) => void;
}

const ACCEPTED_FILES =
  '.pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword';

export const LaunchPage: React.FC<LaunchPageProps> = ({
  existingFileName,
  hasExistingResume,
  isParsingFile,
  onEnterPlayground,
  onUploadAndRedirect,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onUploadAndRedirect(file);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#0F172A] flex flex-col">
      {/* Minimal Launch Top Nav */}
      <header className="bg-[#FFFFFF]/90 backdrop-blur-xs border-b border-[#E2E8F0]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <span className="text-lg font-extrabold tracking-tight text-[#000000]">
            Rezoomifier
          </span>

          <button
            type="button"
            onClick={onEnterPlayground}
            className="pill-lift inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-[#0F172A] text-white hover:bg-[#000000] cursor-pointer"
          >
            {hasExistingResume ? 'Continue Editing' : 'Open Playground'}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Split-Column Launch Hero */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col justify-center">
        <section className="card-tactile bg-[#FFFFFF] p-6 sm:p-10 lg:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            {/* Left Side: Headline, Actions & Direct Drop Zone (7 cols) */}
            <div className="lg:col-span-7">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#FAF9F6] text-[#0F172A] border border-[#CBD5E1] mb-5">
                <Sparkles className="w-3 h-3" />
                ATS Matcher &amp; Live Resume Playground
              </span>

              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#000000] leading-[1.12]">
                Beat the ATS.{' '}
                <span className="underline decoration-[#000000] decoration-[3px] underline-offset-8">
                  Edit your own resume
                </span>{' '}
                with zero friction.
              </h1>

              <p className="mt-5 text-sm sm:text-base text-[#475569] leading-relaxed max-w-xl">
                Upload your existing <strong className="text-[#0F172A]">.PDF</strong>,{' '}
                <strong className="text-[#0F172A]">.DOCX</strong>, or{' '}
                <strong className="text-[#0F172A]">.DOC</strong> resume, match it against any job
                description, customize fonts and alignments in a Word-style playground, and export a
                clean ATS-readable PDF or Word document.
              </p>

              {/* Primary CTA Redirecting to Playground */}
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onEnterPlayground}
                  className="pill-lift inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-sm font-bold bg-[#0F172A] text-white border border-[#0F172A] hover:bg-[#000000] shadow-xs cursor-pointer"
                >
                  {hasExistingResume
                    ? `Resume Workspace${existingFileName ? ` (${existingFileName})` : ''}`
                    : 'Launch Resume Playground'}
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="pill-lift inline-flex items-center gap-2 px-5 py-3.5 rounded-full text-sm font-bold bg-[#FAF9F6] text-[#0F172A] border border-[#CBD5E1] hover:border-[#000000] cursor-pointer"
                >
                  <FileUp className="w-4 h-4" />
                  Upload .PDF / .DOCX
                </button>
              </div>

              {/* Direct Drag & Drop Redirect Strip */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
                }}
                className={`mt-7 rounded-2xl border-[1.5px] border-dashed p-4 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isDragging
                    ? 'bg-[#F1F5F9] border-[#000000]'
                    : 'bg-[#FAF9F6] border-[#CBD5E1] hover:border-[#000000] hover:bg-[#F8FAFC]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#FFFFFF] border border-[#0F172A] flex items-center justify-center text-[#000000] shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-[#0F172A] truncate">
                      {isParsingFile
                        ? 'Opening your resume inside the Playground...'
                        : 'Drop your .PDF, .DOCX, or .DOC resume here'}
                    </p>
                    <p className="text-[11px] text-[#64748B] truncate mt-0.5">
                      Redirects straight to the live Word-style editor
                    </p>
                  </div>
                </div>

                <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#0F172A] text-white shrink-0">
                  Browse
                </span>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_FILES}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUploadAndRedirect(file);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>

            {/* Right Side: Clean Floating Sticker Illustration (5 cols) */}
            <div className="lg:col-span-5 flex items-center justify-center">
              <CleanHeroIllustration
                src="/hero-illustration.webp"
                alt="Inspecting resume closely with a magnifying glass"
                className="w-full max-w-[380px] max-h-[360px]"
              />
            </div>
          </div>
        </section>

        {/* Clean 3-Card Feature Strip */}
        <section className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card-tactile p-5">
            <div className="w-9 h-9 rounded-lg bg-[#FAF9F6] border border-[#0F172A] text-[#000000] flex items-center justify-center mb-3">
              <Target className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-[#0F172A]">Live JD Keyword Matching</h2>
            <p className="mt-1.5 text-xs text-[#475569] leading-relaxed">
              Paste any job description to spot missing technical &amp; domain keywords, then click
              or drag them straight into your resume.
            </p>
          </div>

          <div className="card-tactile p-5">
            <div className="w-9 h-9 rounded-lg bg-[#FAF9F6] border border-[#0F172A] text-[#000000] flex items-center justify-center mb-3">
              <AlignLeft className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-[#0F172A]">Word-Style Playground</h2>
            <p className="mt-1.5 text-xs text-[#475569] leading-relaxed">
              Customize unified fonts, sizes, bold/italic, Left / Center / Right / Split L↔R
              alignments, spacing, margins, and import lines at your cursor.
            </p>
          </div>

          <div className="card-tactile p-5">
            <div className="w-9 h-9 rounded-lg bg-[#FAF9F6] border border-[#0F172A] text-[#000000] flex items-center justify-center mb-3">
              <FileDown className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-[#0F172A]">Save as .PDF or .DOC</h2>
            <p className="mt-1.5 text-xs text-[#475569] leading-relaxed">
              Export clean, selectable vector-text PDFs or downloadable Word documents ready for any
              ATS portal.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
};
