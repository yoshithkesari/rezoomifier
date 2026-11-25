import React, { useRef, useState } from 'react';
import { FileUp, FileDown, Trash2, Printer, Home } from 'lucide-react';

interface TopBarProps {
  uploadedFileName: string;
  hasResume: boolean;
  onGoLaunchPage: () => void;
  onUploadFile: (file: File) => void;
  onExportWordDoc: () => void;
  onClearData: () => void;
  onPrintPdf: () => void;
}

const ACCEPTED_FILES =
  '.pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword';

export const TopBar: React.FC<TopBarProps> = ({
  uploadedFileName,
  hasResume,
  onGoLaunchPage,
  onUploadFile,
  onExportWordDoc,
  onClearData,
  onPrintPdf,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleClearClick = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      window.setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    setConfirmClear(false);
    onClearData();
  };

  return (
    <header className="no-print sticky top-0 z-30 bg-[#FFFFFF]/95 backdrop-blur-xs border-b-[1.5px] border-[#E2E8F0]">
      <div className="max-w-[1680px] mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onGoLaunchPage}
            title="Back to Launch Page"
            className="inline-flex items-center gap-2 text-left hover:opacity-75 transition-opacity cursor-pointer"
          >
            <span className="text-lg font-extrabold tracking-tight text-[#000000]">
              Rezoomifier
            </span>
          </button>

          <button
            type="button"
            onClick={onGoLaunchPage}
            title="Launch Page"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold text-[#475569] hover:text-[#000000] hover:bg-[#FAF9F6] border border-transparent hover:border-[#E2E8F0] transition-colors cursor-pointer"
          >
            <Home className="w-3 h-3" />
            <span>Home</span>
          </button>

          {uploadedFileName && (
            <span className="text-xs font-medium text-[#475569] truncate max-w-[220px] hidden sm:inline">
              · {uploadedFileName}
            </span>
          )}
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="pill-lift inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#FAF9F6] text-[#0F172A] border-[1.5px] border-[#CBD5E1] hover:border-[#000000] transition-colors cursor-pointer"
          >
            <FileUp className="w-3.5 h-3.5" />
            Upload .PDF / .DOCX
          </button>
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

          {hasResume && (
            <button
              type="button"
              onClick={onExportWordDoc}
              title="Download edited resume as Word .doc"
              className="pill-lift inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#FFFFFF] text-[#0F172A] border-[1.5px] border-[#E2E8F0] hover:border-[#000000] transition-colors cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" />
              Save .DOC
            </button>
          )}

          <button
            type="button"
            onClick={handleClearClick}
            className={`pill-lift inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-[1.5px] transition-colors cursor-pointer ${
              confirmClear
                ? 'bg-[#E11D48] text-white border-[#E11D48]'
                : 'bg-[#FFF1F2] text-[#E11D48] border-[#FECDD3] hover:bg-[#FFE4E6]'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {confirmClear ? 'Confirm?' : 'Clear'}
          </button>

          <button
            type="button"
            onClick={onPrintPdf}
            className="pill-lift inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-[#0F172A] text-white border-[1.5px] border-[#0F172A] hover:bg-[#000000] transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Save PDF
          </button>
        </div>
      </div>
    </header>
  );
};
