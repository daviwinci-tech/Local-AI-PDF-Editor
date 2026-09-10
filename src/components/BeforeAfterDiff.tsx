import React, { useState } from 'react';
import { X, ArrowRightLeft, Sparkles, SplitSquareVertical } from 'lucide-react';
import { DocumentMetadata } from '../types';

interface BeforeAfterDiffProps {
  document: DocumentMetadata;
  currentPage: number;
  originalPdfUrl: string;
  currentPdfUrl: string;
  onClose: () => void;
}

export const BeforeAfterDiff: React.FC<BeforeAfterDiffProps> = ({
  document,
  currentPage,
  originalPdfUrl,
  currentPdfUrl,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'slider'>('side-by-side');
  const [sliderPos, setSliderPos] = useState<number>(50);

  return (
    <div className="absolute inset-0 bg-zinc-950/95 backdrop-blur-md z-50 flex flex-col select-none animate-in fade-in">
      {/* Header */}
      <div className="h-12 border-b border-zinc-800 px-4 flex items-center justify-between bg-zinc-900">
        <div className="flex items-center gap-2">
          <SplitSquareVertical className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-bold text-white">
            Porovnání revizí (Before / After)
          </span>
          <span className="text-xs text-zinc-400 font-mono">
            • Strana {currentPage} z {document.total_pages}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-zinc-800 p-0.5 rounded-lg border border-zinc-700">
            <button
              onClick={() => setViewMode('side-by-side')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition cursor-pointer ${
                viewMode === 'side-by-side' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Vedle sebe
            </button>
            <button
              onClick={() => setViewMode('slider')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition cursor-pointer ${
                viewMode === 'slider' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Překryvný posuvník
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-md transition cursor-pointer border border-zinc-700"
            title="Zavřít porovnání"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Diff Content */}
      <div className="flex-1 overflow-hidden p-6 flex items-center justify-center">
        {viewMode === 'side-by-side' ? (
          <div className="grid grid-cols-2 gap-6 w-full h-full max-w-6xl">
            {/* Before */}
            <div className="flex flex-col h-full bg-zinc-900/60 rounded-xl border border-zinc-800 overflow-hidden shadow-xl">
              <div className="px-4 py-2 bg-zinc-850 border-b border-zinc-800 text-xs font-semibold text-zinc-300 flex items-center justify-between">
                <span>PŮVODNÍ DOKUMENT (Revize #1)</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">Před změnami</span>
              </div>
              <div className="flex-1 p-4 bg-zinc-950/80 flex items-center justify-center overflow-hidden">
                <iframe
                  src={`${originalPdfUrl}#page=${currentPage}&toolbar=0&navpanes=0`}
                  className="w-full h-full rounded border border-zinc-800 bg-white"
                  title="Original PDF"
                />
              </div>
            </div>

            {/* After */}
            <div className="flex flex-col h-full bg-zinc-900/60 rounded-xl border border-indigo-900/40 overflow-hidden shadow-xl">
              <div className="px-4 py-2 bg-indigo-950/60 border-b border-indigo-900/60 text-xs font-semibold text-indigo-200 flex items-center justify-between">
                <span>AKTUÁLNÍ VERZE (Revize #{document.current_revision})</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-600 text-white font-mono">Po úpravách</span>
              </div>
              <div className="flex-1 p-4 bg-zinc-950/80 flex items-center justify-center overflow-hidden">
                <iframe
                  src={`${currentPdfUrl}#page=${currentPage}&toolbar=0&navpanes=0`}
                  className="w-full h-full rounded border border-indigo-950 bg-white"
                  title="Modified PDF"
                />
              </div>
            </div>
          </div>
        ) : (
          /* Slider overlay mode */
          <div className="relative w-full max-w-3xl h-full flex flex-col items-center justify-center">
            <div className="w-full mb-3 flex items-center justify-between text-xs text-zinc-400 font-mono px-2">
              <span>← Původní verze</span>
              <input
                type="range"
                min="0"
                max="100"
                value={sliderPos}
                onChange={(e) => setSliderPos(Number(e.target.value))}
                className="w-64 accent-indigo-500 cursor-ew-resize"
              />
              <span>Aktuální revize →</span>
            </div>

            <div className="relative w-full h-[85%] rounded-xl overflow-hidden border border-zinc-800 bg-white shadow-2xl">
              {/* After Underneath */}
              <iframe
                src={`${currentPdfUrl}#page=${currentPage}&toolbar=0&navpanes=0`}
                className="absolute inset-0 w-full h-full"
                title="Current PDF"
              />
              {/* Before Clipped */}
              <div
                className="absolute inset-0 overflow-hidden border-r-2 border-indigo-500 shadow-xl"
                style={{ width: `${sliderPos}%` }}
              >
                <iframe
                  src={`${originalPdfUrl}#page=${currentPage}&toolbar=0&navpanes=0`}
                  className="absolute top-0 left-0 w-full h-full"
                  style={{ width: '100%' }}
                  title="Original PDF Clipped"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
