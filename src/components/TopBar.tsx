import React, { useRef } from 'react';
import {
  FileUp,
  FileText,
  Undo2,
  Redo2,
  Download,
  Settings,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  SplitSquareVertical,
  Lock,
  Unlock,
  KeyRound,
} from 'lucide-react';
import { DocumentMetadata } from '../types';

interface TopBarProps {
  document: DocumentMetadata | null;
  onUpload: (file: File) => void;
  onLoadSample: () => void;
  onLoadSampleLocked?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExport: () => void;
  onOpenSettings: () => void;
  ollamaStatus: { online: boolean; version?: string; error?: string };
  onRefreshOllama: () => void;
  diffMode: boolean;
  onToggleDiffMode: () => void;
  isApplying?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  document,
  onUpload,
  onLoadSample,
  onLoadSampleLocked,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExport,
  onOpenSettings,
  ollamaStatus,
  onRefreshOllama,
  diffMode,
  onToggleDiffMode,
  isApplying,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files[0]);
      e.target.value = '';
    }
  };

  return (
    <header className="h-14 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-md px-4 flex items-center justify-between select-none z-30 shrink-0">
      {/* Brand & File info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-lg shadow-sm">
          <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
          <span className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
            Local AI PDF <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-300 font-medium">Desktop</span>
          </span>
        </div>

        {document && (
          <div className="hidden md:flex items-center gap-2 pl-2 border-l border-zinc-800">
            <FileText className="w-4 h-4 text-zinc-400" />
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-zinc-200 max-w-[160px] lg:max-w-[240px] truncate" title={document.filename}>
                  {document.filename}
                </span>
                {document.is_password_protected && (
                  <span className="flex items-center gap-1 px-1.5 py-0.2 bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] rounded font-medium" title="Tento dokument byl chráněn heslem">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Zaheslováno</span>
                  </span>
                )}
              </div>
              <span className="text-[10px] text-zinc-400">
                Revize {document.current_revision} z {document.total_revisions} • {document.total_pages} {document.total_pages === 1 ? 'strana' : 'strany'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Center Actions: Open, Sample, Undo, Redo, Diff */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-100 rounded-md text-xs font-medium transition shadow-sm border border-zinc-700/60 cursor-pointer"
          title="Otevřít libovolné PDF z počítače (včetně zaheslovaných)"
        >
          <FileUp className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">Otevřít PDF</span>
        </button>

        <button
          onClick={onLoadSample}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-950/60 hover:bg-indigo-900/80 active:bg-indigo-800 text-indigo-200 border border-indigo-700/50 rounded-md text-xs font-medium transition cursor-pointer"
          title="Načíst ukázkovou smlouvu pro okamžité vyzkoušení AI příkazů"
        >
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden lg:inline">Ukázka</span>
        </button>

        {onLoadSampleLocked && (
          <button
            onClick={onLoadSampleLocked}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-950/50 hover:bg-amber-900/70 active:bg-amber-800 text-amber-200 border border-amber-700/50 rounded-md text-xs font-medium transition cursor-pointer"
            title="Vyzkoušet zaheslovaný vzor (heslo: 1234)"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xl:inline">Zaheslovaný vzor (1234)</span>
          </button>
        )}

        <div className="h-4 w-px bg-zinc-800 mx-1" />

        {/* Undo / Redo */}
        <div className="flex items-center bg-zinc-950/80 p-0.5 rounded-lg border border-zinc-800">
          <button
            onClick={onUndo}
            disabled={!canUndo || isApplying}
            className={`p-1.5 rounded-md transition ${
              canUndo && !isApplying
                ? 'text-zinc-200 hover:bg-zinc-800 hover:text-white cursor-pointer active:scale-95'
                : 'text-zinc-600 cursor-not-allowed'
            }`}
            title="Zpět (Undo) - Vrátit poslední úpravu (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo || isApplying}
            className={`p-1.5 rounded-md transition ${
              canRedo && !isApplying
                ? 'text-zinc-200 hover:bg-zinc-800 hover:text-white cursor-pointer active:scale-95'
                : 'text-zinc-600 cursor-not-allowed'
            }`}
            title="Vpřed (Redo) - Znovu provést (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Before / After Diff mode */}
        {document && document.total_revisions > 1 && (
          <button
            onClick={onToggleDiffMode}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition border cursor-pointer ${
              diffMode
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700/60'
            }`}
            title="Režim porovnání změn Before / After"
          >
            <SplitSquareVertical className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xl:inline">{diffMode ? 'Zavřít porovnání' : 'Before / After'}</span>
          </button>
        )}
      </div>

      {/* Right Actions: Ollama Status & Export & Settings */}
      <div className="flex items-center gap-2">
        {/* Ollama Status pill */}
        <div
          onClick={onRefreshOllama}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition cursor-pointer border ${
            ollamaStatus.online
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/60'
              : 'bg-zinc-800/80 text-amber-300 border-zinc-700 hover:bg-zinc-700'
          }`}
          title={
            ollamaStatus.online
              ? `Ollama připojena (${ollamaStatus.version || 'lokální'}). Klikněte pro obnovení.`
              : `Ollama offline: Aplikace používá rychlý inteligentní NLP engine. Klikněte pro test spojení.`
          }
        >
          {ollamaStatus.online ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span className="hidden sm:inline font-mono text-[10px]">
            {ollamaStatus.online ? 'Ollama: Online' : 'AI Engine: Local'}
          </span>
          <RefreshCw className="w-2.5 h-2.5 text-zinc-400 hover:rotate-180 transition-transform duration-300" />
        </div>

        {/* Export PDF */}
        <button
          onClick={onExport}
          disabled={!document || isApplying}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition shadow-sm cursor-pointer ${
            document && !isApplying
              ? 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-indigo-900/20'
              : 'bg-zinc-800 text-zinc-600 cursor-not-allowed border border-zinc-800'
          }`}
          title="Uložit a stáhnout upravené PDF"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export PDF</span>
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-md transition border border-zinc-700/60 cursor-pointer"
          title="Nastavení aplikace a AI modelů"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
