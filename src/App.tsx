import React, { useState, useEffect, useCallback } from 'react';
import { TopBar } from './components/TopBar';
import { LeftSidebar } from './components/LeftSidebar';
import { PDFViewer } from './components/PDFViewer';
import { AIChat } from './components/AIChat';
import { SettingsModal } from './components/SettingsModal';
import { BeforeAfterDiff } from './components/BeforeAfterDiff';
import { api } from './lib/api';
import {
  DocumentMetadata,
  DocumentAnalysis,
  ChatMessage,
  SelectedElement,
  AppSettings,
  RevisionInfo,
  PDFOperation,
} from './types';

export default function App() {
  const [docAnalysis, setDocAnalysis] = useState<DocumentAnalysis | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [diffMode, setDiffMode] = useState<boolean>(false);

  const [revisionCounter, setRevisionCounter] = useState<number>(0);
  const [history, setHistory] = useState<RevisionInfo[]>([]);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);

  const [settings, setSettings] = useState<AppSettings>({
    ollama_url: 'http://localhost:11434',
    model: 'qwen2.5:latest',
    temperature: 0.2,
    auto_apply: false,
    keep_revision_history: true,
    output_directory: './exports',
    ai_engine: 'ollama',
  });

  const [ollamaStatus, setOllamaStatus] = useState<{
    online: boolean;
    version?: string;
    error?: string;
  }>({
    online: false,
  });

  // Check Ollama connection and load settings on mount
  const checkOllama = useCallback(async () => {
    try {
      const status = await api.getOllamaStatus();
      setOllamaStatus(status);
    } catch (e) {
      setOllamaStatus({ online: false, error: 'Ollama offline' });
    }
  }, []);

  useEffect(() => {
    async function init() {
      await checkOllama();
      try {
        const savedSettings = await api.getSettings();
        setSettings(savedSettings);
      } catch (e) {}

      // Automatically load sample document for instant trial
      handleLoadSample();
    }
    init();
  }, [checkOllama]);

  // Load Sample Document
  const handleLoadSample = async () => {
    try {
      const analysis = await api.loadSampleDocument();
      setDocAnalysis(analysis);
      setCurrentPage(1);
      setSelectedElement(null);
      setRevisionCounter((prev) => prev + 1);
      await refreshHistory(analysis.metadata.id);

      // Initial welcome message
      setChatMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content:
            'Ahoj! Jsem váš lokální AI PDF Assistant. Můžete mi zadávat přirozené příkazy v češtině k úpravě otevřeného dokumentu.\n\nNapříklad:\n• „Změň datum 1. 9. 2026 na 10. 9. 2026.“\n• „Změň Hello World na Hello David.“\n• „Začerň IČO a důvěrný údaj.“\n• „Odstraň tento odstavec.“\n• Nebo klikněte na libovolný text v náhledu a napište: „Změň tohle na...“',
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } catch (err: any) {
      console.error('Failed to load sample:', err);
    }
  };

  // Upload PDF
  const handleUpload = async (file: File) => {
    try {
      const analysis = await api.uploadDocument(file);
      setDocAnalysis(analysis);
      setCurrentPage(1);
      setSelectedElement(null);
      setRevisionCounter((prev) => prev + 1);
      await refreshHistory(analysis.metadata.id);

      setChatMessages([
        {
          id: 'doc_uploaded',
          role: 'assistant',
          content: `Dokument „${analysis.metadata.filename}“ (${analysis.metadata.total_pages} ${
            analysis.metadata.total_pages === 1 ? 'strana' : 'strany'
          }) byl úspěšně načten a analyzován. Jaké úpravy si přejete provést?`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } catch (err: any) {
      alert(`Chyba při nahrávání: ${err.message || err}`);
    }
  };

  const refreshHistory = async (docId: string) => {
    try {
      const histData = await api.getHistory(docId);
      setHistory(histData.history);
      setCanUndo(histData.can_undo);
      setCanRedo(histData.can_redo);
    } catch (e) {}
  };

  // Send AI Command
  const handleSendMessage = async (prompt: string) => {
    if (!docAnalysis) return;

    const userMsgId = `user_${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: prompt,
      timestamp: new Date().toLocaleTimeString(),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setIsAiLoading(true);

    try {
      const response = await api.sendAiCommand(
        docAnalysis.metadata.id,
        prompt,
        currentPage,
        selectedElement
          ? {
              page: selectedElement.page,
              text: selectedElement.text,
              bbox: selectedElement.bbox,
              fontSize: selectedElement.fontSize,
              color: selectedElement.color,
            }
          : undefined,
        settings.model
      );

      const assistantMsgId = `asst_${Date.now()}`;
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: response.explanation,
        timestamp: new Date().toLocaleTimeString(),
        operations: response.operations,
        model_used: response.model_used || settings.model,
        status: response.operations.length > 0 ? 'pending_review' : undefined,
      };

      setChatMessages((prev) => [...prev, assistantMsg]);

      // If Auto Apply is enabled and there are operations, apply them automatically
      if (settings.auto_apply && response.operations.length > 0) {
        handleApplyOperations(response.operations, assistantMsgId);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `Chyba při zpracování příkazu: ${err.message || err}`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Apply Operations
  const handleApplyOperations = async (operations: PDFOperation[], messageId: string) => {
    if (!docAnalysis) return;

    setIsApplying(true);
    try {
      const result = await api.applyOperations(docAnalysis.metadata.id, operations);
      if (result.success) {
        setDocAnalysis(result.analysis);
        setRevisionCounter((prev) => prev + 1);
        setSelectedElement(null);
        await refreshHistory(docAnalysis.metadata.id);

        // Update message status to applied
        setChatMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, status: 'applied' } : m))
        );
      }
    } catch (err: any) {
      alert(`Chyba při aplikaci změn: ${err.message || err}`);
    } finally {
      setIsApplying(false);
    }
  };

  // Cancel Operations
  const handleCancelOperations = (messageId: string) => {
    setChatMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, status: 'cancelled' } : m))
    );
  };

  // Undo
  const handleUndo = async () => {
    if (!docAnalysis || !canUndo) return;
    try {
      const res = await api.undo(docAnalysis.metadata.id);
      setDocAnalysis(res.analysis);
      setRevisionCounter((prev) => prev + 1);
      setSelectedElement(null);
      await refreshHistory(docAnalysis.metadata.id);
    } catch (e: any) {
      console.error(e);
    }
  };

  // Redo
  const handleRedo = async () => {
    if (!docAnalysis || !canRedo) return;
    try {
      const res = await api.redo(docAnalysis.metadata.id);
      setDocAnalysis(res.analysis);
      setRevisionCounter((prev) => prev + 1);
      setSelectedElement(null);
      await refreshHistory(docAnalysis.metadata.id);
    } catch (e: any) {
      console.error(e);
    }
  };

  // Export PDF
  const handleExport = () => {
    if (!docAnalysis) return;
    window.location.href = `/api/documents/${docAnalysis.metadata.id}/export`;
  };

  // Keyboard shortcuts (Ctrl+Z, Ctrl+Y, etc.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, docAnalysis]);

  const currentPdfUrl = docAnalysis ? api.getDocumentPdfUrl(docAnalysis.metadata.id) : null;
  const originalPdfUrl = docAnalysis ? api.getOriginalPdfUrl(docAnalysis.metadata.id) : null;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      {/* Top Navigation Bar */}
      <TopBar
        document={docAnalysis?.metadata || null}
        onUpload={handleUpload}
        onLoadSample={handleLoadSample}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onExport={handleExport}
        onOpenSettings={() => setIsSettingsOpen(true)}
        ollamaStatus={ollamaStatus}
        onRefreshOllama={checkOllama}
        diffMode={diffMode}
        onToggleDiffMode={() => setDiffMode(!diffMode)}
        isApplying={isApplying}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar: Pages, Revisions History, Inspector */}
        <LeftSidebar
          document={docAnalysis?.metadata || null}
          currentPage={currentPage}
          onSelectPage={setCurrentPage}
          revisions={history}
          currentRevision={docAnalysis?.metadata.current_revision || 1}
          selectedElement={selectedElement}
          onSelectElement={setSelectedElement}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* Center: Large High-Quality PDF Viewer */}
        <PDFViewer
          document={docAnalysis?.metadata || null}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          selectedElement={selectedElement}
          onSelectElement={setSelectedElement}
          pdfUrl={currentPdfUrl}
          revisionCounter={revisionCounter}
        />

        {/* Right: AI PDF Assistant Chat */}
        <AIChat
          messages={chatMessages}
          onSendMessage={handleSendMessage}
          isLoading={isAiLoading}
          selectedElement={selectedElement}
          onClearSelectedElement={() => setSelectedElement(null)}
          onApplyOperations={handleApplyOperations}
          onCancelOperations={handleCancelOperations}
          activeModel={settings.model}
          isApplying={isApplying}
        />
      </div>

      {/* Before / After Revision Diff Overlay */}
      {diffMode && docAnalysis && originalPdfUrl && currentPdfUrl && (
        <BeforeAfterDiff
          document={docAnalysis.metadata}
          currentPage={currentPage}
          originalPdfUrl={originalPdfUrl}
          currentPdfUrl={currentPdfUrl}
          onClose={() => setDiffMode(false)}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={async (newSettings) => {
          setSettings(newSettings);
          await api.updateSettings(newSettings);
          await checkOllama();
        }}
        ollamaStatus={ollamaStatus}
        onRefreshOllama={checkOllama}
      />
    </div>
  );
}
