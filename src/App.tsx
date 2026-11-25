import React, { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ACTIVE_SESSION_ID,
  appendMissingKeywordToSession,
  clearLocalDataInDB,
  createEmptySession,
  db,
  ensureActiveSession,
  exportResumeAsWordDoc,
  resetResumeEditsInDB,
  saveLiveResumeEdit,
  saveSessionPatch,
} from './db/localDb';
import { extractEditableResumeFromPDF } from './engine/pdfExtractor';
import { extractEditableResumeFromDoc } from './engine/docExtractor';
import { analyzeATS } from './engine/atsMatcher';
import { TopBar } from './components/TopBar';
import { LaunchPage } from './components/LaunchPage';
import { ATSScorecard } from './components/ATSScorecard';
import { ResumePreviewSheet } from './components/ResumePreviewSheet';

function isPlaygroundHash(hash: string): boolean {
  return hash === '#/playground' || hash === '#/editor' || hash === '#/workspace';
}

export const App: React.FC = () => {
  const liveSession = useLiveQuery(() => db.sessions.get(ACTIVE_SESSION_ID), []);
  const [isHydrated, setIsHydrated] = useState(false);
  const [inPlayground, setInPlayground] = useState<boolean>(() =>
    typeof window !== 'undefined' ? isPlaygroundHash(window.location.hash) : false
  );
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    ensureActiveSession().finally(() => setIsHydrated(true));
  }, []);

  // Sync browser Back/Forward buttons smoothly between Launch Page (#/) and Playground (#/playground)
  useEffect(() => {
    const onHashChange = () => {
      setInPlayground(isPlaygroundHash(window.location.hash));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigateToPlayground = () => {
    if (window.location.hash !== '#/playground') {
      window.location.hash = '#/playground';
    }
    setInPlayground(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToLaunchPage = () => {
    if (window.location.hash !== '#/') {
      window.location.hash = '#/';
    }
    setInPlayground(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const session = liveSession ?? createEmptySession();

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 2400);
  };

  const analysis = useMemo(
    () => analyzeATS(session.rawResumeText, session.jobDescription, session.editableHtml),
    [session.rawResumeText, session.jobDescription, session.editableHtml]
  );

  const handleUploadResumeFile = async (file: File) => {
    const lower = file.name.toLowerCase();
    const isPdf = lower.endsWith('.pdf') || file.type === 'application/pdf';
    const isDoc =
      lower.endsWith('.docx') ||
      lower.endsWith('.doc') ||
      file.type.includes('word') ||
      file.type.includes('officedocument');

    if (!isPdf && !isDoc) {
      setParseError('Please upload a .PDF, .DOCX, or .DOC resume file.');
      navigateToPlayground();
      return;
    }

    setParseError(null);
    setIsParsingFile(true);
    try {
      if (isPdf) {
        const res = await extractEditableResumeFromPDF(file);
        await saveSessionPatch({
          uploadedFileName: file.name,
          uploadedFileType: 'pdf',
          resumeFontId: res.detectedFontId,
          editableHtml: res.editableHtml,
          editableCss: res.editableCss,
          originalEditableHtml: res.editableHtml,
          externalRevision: (session.externalRevision ?? 1) + 1,
          rawResumeText: res.text,
        });
      } else {
        const res = await extractEditableResumeFromDoc(file);
        await saveSessionPatch({
          uploadedFileName: file.name,
          uploadedFileType: res.fileType,
          resumeFontId: res.detectedFontId,
          editableHtml: res.editableHtml,
          editableCss: res.editableCss,
          originalEditableHtml: res.editableHtml,
          externalRevision: (session.externalRevision ?? 1) + 1,
          rawResumeText: res.text,
        });
      }
      navigateToPlayground();
      showToast(`Loaded ${file.name} into playground.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to open resume file.';
      setParseError(msg);
      navigateToPlayground();
    } finally {
      setIsParsingFile(false);
    }
  };

  if (!isHydrated && !liveSession) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center text-sm font-semibold text-[#475569]">
        Loading Rezoomifier...
      </div>
    );
  }

  if (!inPlayground) {
    return (
      <>
        {toastMessage && (
          <div className="no-print fixed bottom-5 right-5 z-40 px-4 py-2 rounded-full bg-[#000000] text-[#FFFFFF] text-xs font-semibold shadow-lg">
            {toastMessage}
          </div>
        )}
        <LaunchPage
          existingFileName={session.uploadedFileName}
          hasExistingResume={session.editableHtml.trim().length > 0}
          isParsingFile={isParsingFile}
          onEnterPlayground={navigateToPlayground}
          onUploadAndRedirect={handleUploadResumeFile}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#0F172A]">
      <TopBar
        uploadedFileName={session.uploadedFileName}
        hasResume={session.editableHtml.trim().length > 0}
        onGoLaunchPage={navigateToLaunchPage}
        onUploadFile={handleUploadResumeFile}
        onExportWordDoc={() => {
          exportResumeAsWordDoc(session);
          showToast('Saved Word .DOC file.');
        }}
        onClearData={async () => {
          await clearLocalDataInDB();
          setParseError(null);
          showToast('Cleared playground.');
        }}
        onPrintPdf={() => window.print()}
      />

      {toastMessage && (
        <div className="no-print fixed bottom-5 right-5 z-40 px-4 py-2 rounded-full bg-[#000000] text-[#FFFFFF] text-xs font-semibold shadow-lg">
          {toastMessage}
        </div>
      )}

      <main className="print-only-reset max-w-[1680px] mx-auto px-4 sm:px-6 py-5">
        <div className="print-only-reset grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Clean Left Panel (4 cols): Upload + JD + ATS Keywords */}
          <div className="no-print lg:col-span-4">
            <ATSScorecard
              uploadedFileName={session.uploadedFileName}
              isParsingFile={isParsingFile}
              parseError={parseError}
              jobDescription={session.jobDescription}
              analysis={analysis}
              onUploadFile={handleUploadResumeFile}
              onChangeJobDescription={(jobDescription) =>
                saveSessionPatch({ jobDescription })
              }
              onAddMissingKeyword={async (kw) => {
                await appendMissingKeywordToSession(kw);
                showToast(`Inserted "${kw}" into resume.`);
              }}
            />
          </div>

          {/* Spacious Word-Doc Resume Playground (8 cols) */}
          <div className="print-only-reset lg:col-span-8">
            <ResumePreviewSheet
              editableHtml={session.editableHtml}
              editableCss={session.editableCss}
              originalEditableHtml={session.originalEditableHtml}
              externalRevision={session.externalRevision ?? 1}
              resumeFontId={session.resumeFontId ?? 'calibri'}
              lineSpacing={session.lineSpacing ?? '1.3'}
              pageMargin={session.pageMargin ?? 'normal'}
              uploadedFileName={session.uploadedFileName}
              onChangeResumeFont={(resumeFontId) => saveSessionPatch({ resumeFontId })}
              onChangeLineSpacing={(lineSpacing) => saveSessionPatch({ lineSpacing })}
              onChangePageMargin={(pageMargin) => saveSessionPatch({ pageMargin })}
              onLiveEdit={(nextHtml, nextPlainText) =>
                saveLiveResumeEdit(nextHtml, nextPlainText)
              }
              onResetEdits={async () => {
                await resetResumeEditsInDB();
                showToast('Reverted to uploaded original.');
              }}
              onUploadFile={handleUploadResumeFile}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
