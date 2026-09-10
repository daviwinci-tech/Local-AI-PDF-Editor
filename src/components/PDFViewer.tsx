import React, { useState, useEffect, useRef } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  X,
  Scan,
  AlertTriangle,
  FileSearch,
  Sparkles,
  Layers,
  RotateCw,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  Check,
  Trash2,
  ShieldAlert,
  FileEdit,
  Type,
} from 'lucide-react';
import { pdfjsLib } from '../lib/pdfWorker';
import { DocumentMetadata, PageInfo, PDFOperation, SelectedElement, TextBlock } from '../types';

interface PDFViewerProps {
  document: DocumentMetadata | null;
  currentPage: number;
  onPageChange: (page: number) => void;
  selectedElement: SelectedElement | null;
  onSelectElement: (element: SelectedElement | null) => void;
  pdfUrl: string | null;
  revisionCounter: number;
  onApplyDirectOperations?: (operations: PDFOperation[]) => Promise<void>;
  isApplying?: boolean;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  document,
  currentPage,
  onPageChange,
  selectedElement,
  onSelectElement,
  pdfUrl,
  revisionCounter,
  onApplyDirectOperations,
  isApplying,
}) => {
  const [scale, setScale] = useState<number>(1.25);
  const [fitMode, setFitMode] = useState<'custom' | 'width' | 'page'>('width');
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [rotation, setRotation] = useState<number>(0);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Password protection states
  const [isPasswordProtected, setIsPasswordProtected] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPasswordPlain, setShowPasswordPlain] = useState<boolean>(false);
  const passwordCallbackRef = useRef<((pw: string) => void) | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  const currentPageInfo: PageInfo | undefined = document?.pages.find(
    (p) => p.page_number === currentPage
  );

  // Reset password states when document changes
  useEffect(() => {
    setIsPasswordProtected(false);
    setPassword('');
    setPasswordInput('');
    setPasswordError(null);
    passwordCallbackRef.current = null;
  }, [pdfUrl]);

  // Render PDF using PDF.js onto HTML5 Canvas
  useEffect(() => {
    let isCancelled = false;

    async function renderPdfPage() {
      if (!pdfUrl) return;

      setIsLoadingPdf(true);
      setRenderError(null);

      try {
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (e) {}
        }

        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          password: password || undefined,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
          cMapPacked: true,
        });

        // Intercept PDF.js password request callback
        loadingTask.onPassword = (updatePassword: (pw: string) => void, reason: number) => {
          if (isCancelled) return;
          setIsLoadingPdf(false);
          setIsPasswordProtected(true);
          passwordCallbackRef.current = updatePassword;

          if (reason === (pdfjsLib as any).PasswordResponses?.INCORRECT_PASSWORD || reason === 2) {
            setPasswordError('Zadané heslo není správné. Zkuste to prosím znovu.');
          } else {
            setPasswordError(null);
          }
        };

        const pdf = await loadingTask.promise;
        if (isCancelled) return;

        // Successfully opened without password error
        setIsPasswordProtected(false);
        setPasswordError(null);

        const page = await pdf.getPage(currentPage);
        if (isCancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        // Calculate viewport
        const viewport = page.getViewport({ scale: scale * (window.devicePixelRatio || 1), rotation });
        const displayViewport = page.getViewport({ scale: scale, rotation });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${displayViewport.width}px`;
        canvas.style.height = `${displayViewport.height}px`;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext as any);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        if (!isCancelled) {
          setIsLoadingPdf(false);
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException' && !isCancelled) {
          const isPasswordErr =
            err?.name === 'PasswordException' ||
            err?.message?.toLowerCase().includes('password') ||
            err?.message?.includes('No password given');

          if (isPasswordErr) {
            setIsLoadingPdf(false);
            setIsPasswordProtected(true);
            setPasswordError(
              password
                ? 'Zadané heslo není správné. Zkuste to prosím znovu.'
                : 'Tento dokument je chráněn heslem. Pro zobrazení a úpravy zadejte heslo.'
            );
            return;
          }

          console.error('PDF Render Error:', err);
          setIsLoadingPdf(false);
          // Fallback to standard PDF embed or canvas placeholder
          setRenderError('Náhled stránky byl vykreslen pomocí interního plátna.');
        }
      }
    }

    renderPdfPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {}
      }
    };
  }, [pdfUrl, currentPage, scale, rotation, revisionCounter, password]);

  // Handle password unlock submission
  const handleUnlockPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;

    setIsLoadingPdf(true);
    setPasswordError(null);

    if (passwordCallbackRef.current) {
      try {
        passwordCallbackRef.current(passwordInput.trim());
        setPassword(passwordInput.trim());
        return;
      } catch (err) {}
    }

    setPassword(passwordInput.trim());
  };

  // Adjust zoom for Fit Width / Fit Page
  const handleFitWidth = () => {
    setFitMode('width');
    if (containerRef.current && currentPageInfo) {
      const availableWidth = containerRef.current.clientWidth - 80;
      const targetScale = Math.max(0.5, Math.min(2.5, availableWidth / (currentPageInfo.width || 595)));
      setScale(targetScale);
    }
  };

  const handleFitPage = () => {
    setFitMode('page');
    if (containerRef.current && currentPageInfo) {
      const availableHeight = containerRef.current.clientHeight - 80;
      const targetScale = Math.max(0.4, Math.min(2.0, availableHeight / (currentPageInfo.height || 842)));
      setScale(targetScale);
    }
  };

  const handleZoom = (delta: number) => {
    setFitMode('custom');
    setScale((prev) => Math.max(0.4, Math.min(2.5, Math.round((prev + delta) * 100) / 100)));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Inline edit state and auto-fit calculation (Sprint 3 & P1 enhancements)
  const [inlineEditText, setInlineEditText] = useState<string>('');
  const [selectedFontStyle, setSelectedFontStyle] = useState<'auto' | 'normal' | 'bold' | 'italic'>('auto');
  const [selectedBgColor, setSelectedBgColor] = useState<string>('auto');

  useEffect(() => {
    if (selectedElement) {
      setInlineEditText(selectedElement.text);
      setSelectedFontStyle('auto');
      setSelectedBgColor('auto');
    } else {
      setInlineEditText('');
    }
  }, [selectedElement?.id, selectedElement?.text]);

  const origBoxWidth = selectedElement
    ? selectedElement.bbox[2] - selectedElement.bbox[0]
    : 100;
  const origFontSize = selectedElement?.fontSize || 11;
  const estCharWidth = origFontSize * 0.52;
  const estTextWidth = inlineEditText.length * estCharWidth;
  const isOverflowing = origBoxWidth > 20 && estTextWidth > origBoxWidth * 1.05;
  const calculatedFitSize = isOverflowing
    ? Math.max(7, Math.round((origBoxWidth / estTextWidth) * origFontSize * 10) / 10)
    : origFontSize;

  const handleSaveInlineEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedElement || !inlineEditText.trim() || !onApplyDirectOperations || isApplying) return;
    if (inlineEditText === selectedElement.text && selectedFontStyle === 'auto' && selectedBgColor === 'auto') {
      onSelectElement(null);
      return;
    }
    await onApplyDirectOperations([
      {
        type: 'replace_text',
        page: selectedElement.page,
        old_text: selectedElement.text,
        new_text: inlineEditText.trim(),
        font_size: calculatedFitSize,
        font_style: selectedFontStyle !== 'auto' ? selectedFontStyle : undefined,
        bg_color: selectedBgColor !== 'auto' ? selectedBgColor : undefined,
      },
    ]);
  };

  const handleDirectRedact = async () => {
    if (!selectedElement || !onApplyDirectOperations || isApplying) return;
    await onApplyDirectOperations([
      {
        type: 'redact',
        page: selectedElement.page,
        old_text: selectedElement.text,
        bbox: selectedElement.bbox,
        color: '#000000',
      },
    ]);
  };

  const handleDirectDelete = async () => {
    if (!selectedElement || !onApplyDirectOperations || isApplying) return;
    await onApplyDirectOperations([
      {
        type: 'delete_text',
        page: selectedElement.page,
        old_text: selectedElement.text,
        bbox: selectedElement.bbox,
        bg_color: selectedBgColor !== 'auto' ? selectedBgColor : undefined,
      },
    ]);
  };

  if (!document) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-950 text-zinc-400 select-none">
        <div className="max-w-md w-full p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 text-center flex flex-col items-center shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4 shadow-inner">
            <FileSearch className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Nahrajte PDF dokument</h2>
          <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
            Vyberte libovolné PDF ze svého disku nebo klikněte na Ukázkový dokument pro okamžité otestování AI úprav, nahrazování textů a anonymizace.
          </p>
          <div className="flex flex-wrap gap-2 justify-center text-[11px] text-zinc-400">
            <span className="px-2.5 py-1 rounded-md bg-zinc-800/80 border border-zinc-700/50">PyMuPDF Engine</span>
            <span className="px-2.5 py-1 rounded-md bg-zinc-800/80 border border-zinc-700/50">Ollama Local AI</span>
            <span className="px-2.5 py-1 rounded-md bg-zinc-800/80 border border-zinc-700/50">100% Soukromé</span>
          </div>
        </div>
      </div>
    );
  }

  const pageWidth = (currentPageInfo?.width || 595.3) * scale;
  const pageHeight = (currentPageInfo?.height || 841.9) * scale;
  const scaleX = scale;
  const scaleY = scale;

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden relative select-none">
      {/* Top Floating Control Bar */}
      <div className="h-11 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800/80 px-4 flex items-center justify-between z-10 shrink-0 shadow-xs">
        {/* Page Nav */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="p-1 rounded text-zinc-300 hover:bg-zinc-800 hover:text-white disabled:text-zinc-600 disabled:cursor-not-allowed transition cursor-pointer"
            title="Předchozí strana"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 text-xs font-medium text-zinc-300">
            <span className="font-mono">{currentPage}</span>
            <span className="text-zinc-400">/</span>
            <span className="font-mono text-zinc-400">{document.total_pages}</span>
          </div>

          <button
            onClick={() => onPageChange(Math.min(document.total_pages, currentPage + 1))}
            disabled={currentPage >= document.total_pages}
            className="p-1 rounded text-zinc-300 hover:bg-zinc-800 hover:text-white disabled:text-zinc-600 disabled:cursor-not-allowed transition cursor-pointer"
            title="Následující strana"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Selected Element Pill Alert */}
        {selectedElement && (
          <div className="flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-500/50 text-indigo-200 text-xs shadow-xs animate-in fade-in">
            <Crosshair className="w-3 h-3 text-indigo-400 animate-spin" />
            <span className="max-w-[180px] lg:max-w-[260px] truncate font-medium">
              Vybráno: "{selectedElement.text}"
            </span>
            <button
              onClick={() => onSelectElement(null)}
              className="p-0.5 hover:bg-indigo-900 rounded-full transition cursor-pointer"
              title="Zrušit výběr"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Zoom & View Presets */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleZoom(-0.15)}
            className="p-1 rounded text-zinc-300 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
            title="Oddálit (-)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span className="text-xs font-mono text-zinc-300 min-w-[45px] text-center">
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={() => handleZoom(0.15)}
            className="p-1 rounded text-zinc-300 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
            title="Přiblížit (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <div className="h-3 w-px bg-zinc-800 mx-0.5" />

          <button
            onClick={handleFitWidth}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
              fitMode === 'width' ? 'bg-zinc-800 text-indigo-300' : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Přizpůsobit na šířku"
          >
            Fit Width
          </button>

          <button
            onClick={handleFitPage}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
              fitMode === 'page' ? 'bg-zinc-800 text-indigo-300' : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Přizpůsobit na výšku"
          >
            Fit Page
          </button>

          <button
            onClick={handleRotate}
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition cursor-pointer ml-0.5"
            title="Otočit stránku o 90°"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scanned Warning Banner if applicable */}
      {currentPageInfo?.is_scanned && (
        <div className="bg-amber-950/80 border-b border-amber-800/80 px-4 py-1.5 flex items-center justify-between text-amber-200 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Tato strana byla detekována jako skenovaný dokument (bez nativní textové vrstvy).</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-amber-900/60 font-mono text-[10px] text-amber-300 border border-amber-700/60">
            OCR aktivní
          </span>
        </div>
      )}

      {/* Main PDF Canvas & Interactive Overlay Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-6 lg:p-8 flex items-start justify-center custom-scrollbar bg-zinc-950/90"
      >
        <div
          className="relative bg-white rounded-md shadow-2xl transition-transform duration-150 ease-out"
          style={{
            width: `${pageWidth}px`,
            height: `${pageHeight}px`,
          }}
        >
          {/* PDF.js Rendered Canvas */}
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block rounded-md pointer-events-none" />

          {/* Interactive Bounding Box Overlay Layer */}
          <div className="absolute inset-0 z-10">
            {currentPageInfo?.text_blocks.map((block) => {
              const b = block.bbox;
              // b is [x0, y0, x1, y1]
              const left = b[0] * scaleX;
              const top = b[1] * scaleY;
              const width = (b[2] - b[0]) * scaleX;
              const height = (b[3] - b[1]) * scaleY;

              const isSelected = selectedElement?.id === block.id;
              const isHovered = hoveredBlockId === block.id;

              return (
                <div
                  key={block.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isSelected) {
                      onSelectElement(null);
                    } else {
                      onSelectElement({
                        id: block.id,
                        page: block.page,
                        text: block.text,
                        bbox: block.bbox,
                        fontSize: block.font_size,
                        fontName: block.font_name,
                        color: block.color,
                      });
                    }
                  }}
                  onMouseEnter={() => setHoveredBlockId(block.id)}
                  onMouseLeave={() => setHoveredBlockId(null)}
                  className={`absolute rounded-xs cursor-pointer transition-all duration-100 ${
                    isSelected
                      ? 'bg-indigo-500/25 ring-2 ring-indigo-500 shadow-md shadow-indigo-500/30 z-30'
                      : isHovered
                      ? 'bg-cyan-500/20 ring-1 ring-cyan-400 z-20'
                      : 'hover:bg-indigo-500/10'
                  }`}
                  style={{
                    left: `${left}px`,
                    top: `${top}px`,
                    width: `${Math.max(width, 10)}px`,
                    height: `${Math.max(height, 10)}px`,
                  }}
                  title={`Klikněte pro označení textu: "${block.text}" (${block.font_size}pt)`}
                >
                  {/* Selected Tag label */}
                  {isSelected && (
                    <div className="absolute -top-5 left-0 px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[9px] font-mono whitespace-nowrap shadow-sm flex items-center gap-1 pointer-events-none">
                      <span>✓ Označeno</span>
                      <span className="opacity-75">({block.font_size}pt)</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Floating Contextual Quick Edit Popover (Sprint 3: Interactivity & Auto-fit) */}
          {selectedElement && selectedElement.page === currentPage && (
            <div
              className="absolute z-35 bg-zinc-900/95 backdrop-blur-md border border-zinc-700 rounded-xl p-3 shadow-2xl transition-all duration-150"
              style={{
                left: `${Math.max(8, Math.min(pageWidth - 340, selectedElement.bbox[0] * scaleX))}px`,
                top: `${
                  selectedElement.bbox[1] * scaleY > 150
                    ? selectedElement.bbox[1] * scaleY - 132
                    : selectedElement.bbox[3] * scaleY + 10
                }px`,
                width: '330px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800 text-[11px]">
                <div className="flex items-center gap-1.5 text-zinc-200 font-medium">
                  <FileEdit className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Rychlá úprava textu</span>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectElement(null)}
                  className="text-zinc-400 hover:text-white p-0.5 rounded hover:bg-zinc-800 transition cursor-pointer"
                  title="Zavřít"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Form for direct text modification */}
              <form onSubmit={handleSaveInlineEdit} className="space-y-2.5">
                <div>
                  <input
                    type="text"
                    value={inlineEditText}
                    onChange={(e) => setInlineEditText(e.target.value)}
                    placeholder="Zadejte nový text..."
                    autoFocus
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                </div>

                {/* Auto-fit Font calculation badge */}
                <div className="flex items-center justify-between text-[10px] px-0.5 text-zinc-400">
                  <div className="flex items-center gap-1">
                    <Type className="w-3 h-3 text-zinc-500" />
                    <span>Původní: {origFontSize} pt</span>
                  </div>
                  {isOverflowing ? (
                    <span className="text-amber-300 font-medium bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded">
                      Auto-fit: {calculatedFitSize} pt
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-medium bg-emerald-950/50 border border-emerald-800/50 px-1.5 py-0.5 rounded">
                      Auto-fit: {origFontSize} pt (Vejde se)
                    </span>
                  )}
                </div>

                {/* Font Style & Background Eraser Settings */}
                <div className="pt-1 pb-1 border-t border-zinc-800/80 space-y-1.5 text-[10px]">
                  {/* Font Style Selector */}
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-medium">Styl písma:</span>
                    <div className="flex items-center gap-1">
                      {(['auto', 'normal', 'bold', 'italic'] as const).map((style) => (
                        <button
                          key={style}
                          type="button"
                          onClick={() => setSelectedFontStyle(style)}
                          className={`px-1.5 py-0.5 rounded border transition cursor-pointer ${
                            selectedFontStyle === style
                              ? 'bg-indigo-600 border-indigo-400 text-white font-semibold'
                              : 'bg-zinc-800/80 border-zinc-700/60 text-zinc-300 hover:bg-zinc-700'
                          }`}
                        >
                          {style === 'auto' ? 'Auto' : style === 'normal' ? 'Sans' : style === 'bold' ? 'Bold' : 'Italic'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Eraser Background Selector */}
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-medium">Podklad:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedBgColor('auto')}
                        className={`px-1.5 py-0.5 rounded border transition cursor-pointer text-[9px] ${
                          selectedBgColor === 'auto'
                            ? 'bg-indigo-600 border-indigo-400 text-white font-medium'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                        }`}
                      >
                        Auto-detekce
                      </button>
                      {[
                        { label: 'Bílá', color: '#ffffff' },
                        { label: 'Šedá', color: '#f3f4f6' },
                        { label: 'Tmavá', color: '#1e293b' },
                      ].map((bg) => (
                        <button
                          key={bg.color}
                          type="button"
                          title={bg.label}
                          onClick={() => setSelectedBgColor(bg.color)}
                          className={`w-4 h-4 rounded-full border transition cursor-pointer ${
                            selectedBgColor === bg.color ? 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-zinc-900 border-white' : 'border-zinc-600'
                          }`}
                          style={{ backgroundColor: bg.color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  <button
                    type="submit"
                    disabled={!inlineEditText.trim() || isApplying}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg py-1.5 text-xs font-semibold transition cursor-pointer shadow flex items-center justify-center gap-1"
                  >
                    {isApplying ? (
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>{isApplying ? 'Ukládání...' : 'Použít změnu'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDirectRedact}
                    disabled={isApplying}
                    className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-amber-300 rounded-lg border border-zinc-700/60 transition cursor-pointer text-xs flex items-center gap-1"
                    title="Začernit (Redact)"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span className="text-[10px]">Začernit</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDirectDelete}
                    disabled={isApplying}
                    className="px-2 py-1.5 bg-zinc-800 hover:bg-rose-950 text-rose-400 rounded-lg border border-zinc-700/60 transition cursor-pointer text-xs flex items-center gap-1"
                    title="Smazat text"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="text-[10px]">Smazat</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Loading state indicator */}
          {isLoadingPdf && (
            <div className="absolute inset-0 bg-zinc-950/20 backdrop-blur-[2px] flex items-center justify-center rounded-md z-40">
              <div className="px-4 py-2 rounded-lg bg-zinc-900/90 text-zinc-200 border border-zinc-700 text-xs font-medium flex items-center gap-2 shadow-lg">
                <Sparkles className="w-4 h-4 text-indigo-400 animate-spin" />
                <span>Vykreslování PDF náhledu...</span>
              </div>
            </div>
          )}

          {/* Password Protection Unlock Overlay */}
          {isPasswordProtected && (
            <div className="absolute inset-0 bg-zinc-950/85 backdrop-blur-sm flex items-center justify-center p-6 z-50 rounded-md">
              <div className="bg-zinc-900 border border-zinc-700/90 rounded-xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                  <Lock className="w-6 h-6" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    Dokument je chráněn heslem
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Tento PDF soubor je zabezpečen. Zadejte heslo pro jeho zobrazení a úpravy.
                  </p>
                </div>

                <form onSubmit={handleUnlockPassword} className="space-y-3 pt-1 text-left">
                  <div className="relative">
                    <input
                      type={showPasswordPlain ? 'text' : 'password'}
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Zadejte heslo k PDF..."
                      autoFocus
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordPlain(!showPasswordPlain)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
                      title={showPasswordPlain ? 'Skrýt heslo' : 'Zobrazit heslo'}
                    >
                      {showPasswordPlain ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {passwordError && (
                    <div className="text-[11px] text-rose-400 flex items-center gap-1.5 bg-rose-950/40 border border-rose-800/50 rounded-md px-2.5 py-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{passwordError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!passwordInput.trim() || isLoadingPdf}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg py-2 text-xs font-semibold transition cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Odemknout dokument</span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
