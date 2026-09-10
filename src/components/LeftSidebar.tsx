import React, { useState } from 'react';
import {
  FileText,
  History,
  Layers,
  ChevronLeft,
  ChevronRight,
  Search,
  Crosshair,
  CheckCircle,
  Clock,
  Scan,
  Type,
  MousePointerClick,
} from 'lucide-react';
import { DocumentMetadata, PageInfo, RevisionInfo, SelectedElement, TextBlock } from '../types';

interface LeftSidebarProps {
  document: DocumentMetadata | null;
  currentPage: number;
  onSelectPage: (page: number) => void;
  revisions: RevisionInfo[];
  currentRevision: number;
  onSelectRevision?: (revNum: number) => void;
  selectedElement: SelectedElement | null;
  onSelectElement: (element: SelectedElement | null) => void;
  isOpen: boolean;
  onToggle: () => void;
}

type TabType = 'pages' | 'history' | 'inspector';

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  document,
  currentPage,
  onSelectPage,
  revisions,
  currentRevision,
  onSelectRevision,
  selectedElement,
  onSelectElement,
  isOpen,
  onToggle,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('pages');
  const [inspectorFilter, setInspectorFilter] = useState('');

  if (!isOpen) {
    return (
      <aside className="w-10 border-r border-zinc-800 bg-zinc-900 flex flex-col items-center py-3 gap-4 select-none shrink-0 z-20">
        <button
          onClick={onToggle}
          className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition cursor-pointer"
          title="Rozbalit postranní panel"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="flex flex-col gap-3 text-zinc-500">
          <button
            onClick={() => {
              setActiveTab('pages');
              onToggle();
            }}
            className="p-1.5 hover:text-indigo-400 hover:bg-zinc-800 rounded transition cursor-pointer"
            title="Stránky"
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setActiveTab('history');
              onToggle();
            }}
            className="p-1.5 hover:text-indigo-400 hover:bg-zinc-800 rounded transition cursor-pointer"
            title="Historie revizí"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setActiveTab('inspector');
              onToggle();
            }}
            className="p-1.5 hover:text-indigo-400 hover:bg-zinc-800 rounded transition cursor-pointer"
            title="Inspektor elementů"
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>
      </aside>
    );
  }

  const currentPageInfo = document?.pages.find((p) => p.page_number === currentPage);
  const filteredBlocks = (currentPageInfo?.text_blocks || []).filter((b) =>
    b.text.toLowerCase().includes(inspectorFilter.toLowerCase())
  );

  return (
    <aside className="w-64 lg:w-72 border-r border-zinc-800 bg-zinc-900/95 flex flex-col select-none shrink-0 z-20 overflow-hidden">
      {/* Sidebar Header with Tabs */}
      <div className="h-10 border-b border-zinc-800 px-2 flex items-center justify-between bg-zinc-900">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('pages')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
              activeTab === 'pages'
                ? 'bg-zinc-800 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Stránky</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
              activeTab === 'history'
                ? 'bg-zinc-800 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Historie</span>
            {revisions.length > 0 && (
              <span className="text-[10px] px-1 bg-zinc-700 text-zinc-300 rounded-full font-mono">
                {revisions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('inspector')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
              activeTab === 'inspector'
                ? 'bg-zinc-800 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Prvky</span>
          </button>
        </div>

        <button
          onClick={onToggle}
          className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition cursor-pointer"
          title="Skrýt postranní panel"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {/* TAB 1: PAGES */}
        {activeTab === 'pages' && (
          <div className="flex flex-col gap-3">
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-1">
              Stránky dokumentu ({document?.total_pages || 0})
            </div>

            {document ? (
              <div className="grid grid-cols-2 gap-2.5">
                {document.pages.map((p) => {
                  const isSelected = p.page_number === currentPage;
                  return (
                    <div
                      key={p.page_number}
                      onClick={() => onSelectPage(p.page_number)}
                      className={`group flex flex-col p-2 rounded-lg border transition cursor-pointer relative ${
                        isSelected
                          ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-950/30'
                          : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-850'
                      }`}
                    >
                      {/* Thumbnail frame simulation */}
                      <div className="aspect-[3/4] w-full bg-white rounded-sm shadow-xs p-1.5 flex flex-col justify-between overflow-hidden relative">
                        <div className="flex flex-col gap-1">
                          <div className="h-1.5 w-1/2 bg-zinc-300 rounded-xs" />
                          <div className="h-1 w-full bg-zinc-200 rounded-xs" />
                          <div className="h-1 w-5/6 bg-zinc-200 rounded-xs" />
                          <div className="h-1 w-3/4 bg-zinc-200 rounded-xs" />
                        </div>
                        <div className="flex justify-between items-center text-[7px] text-zinc-400">
                          <span>p.{p.page_number}</span>
                          {p.is_scanned && <Scan className="w-2.5 h-2.5 text-amber-500" />}
                        </div>
                      </div>

                      <div className="mt-1.5 flex items-center justify-between">
                        <span
                          className={`text-xs font-semibold ${
                            isSelected ? 'text-indigo-300' : 'text-zinc-400 group-hover:text-zinc-200'
                          }`}
                        >
                          Strana {p.page_number}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {p.text_blocks.length} bloků
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-zinc-500">
                Žádný dokument není otevřen
              </div>
            )}
          </div>
        )}

        {/* TAB 2: REVISION HISTORY */}
        {activeTab === 'history' && (
          <div className="flex flex-col gap-3">
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-1">
              Historie úprav ({revisions.length})
            </div>

            <div className="flex flex-col gap-2 relative before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-zinc-800">
              {revisions.map((rev) => {
                const isCurrent = rev.revision_number === currentRevision;
                return (
                  <div
                    key={rev.id}
                    onClick={() => onSelectRevision && onSelectRevision(rev.revision_number)}
                    className={`relative pl-7 p-2.5 rounded-lg border transition ${
                      isCurrent
                        ? 'bg-indigo-950/30 border-indigo-500/80 shadow-xs'
                        : 'bg-zinc-950/40 border-zinc-800/60 hover:bg-zinc-850 hover:border-zinc-700 cursor-pointer'
                    }`}
                  >
                    {/* Bullet marker */}
                    <div
                      className={`absolute left-2 top-3.5 w-2.5 h-2.5 rounded-full border-2 transition ${
                        isCurrent
                          ? 'bg-indigo-400 border-indigo-600 ring-4 ring-indigo-500/20'
                          : 'bg-zinc-700 border-zinc-900'
                      }`}
                    />

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-200">
                        Revize #{rev.revision_number}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {rev.timestamp}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-300 mt-1 line-clamp-2 leading-relaxed">
                      {rev.description}
                    </p>

                    <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-400 border-t border-zinc-800/60 pt-1.5">
                      <span>{rev.operations_count} {rev.operations_count === 1 ? 'operace' : 'operací'}</span>
                      {rev.modified_pages && rev.modified_pages.length > 0 && (
                        <span className="text-indigo-400">
                          Str: {rev.modified_pages.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: ELEMENT INSPECTOR */}
        {activeTab === 'inspector' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Prvky strany {currentPage} ({currentPageInfo?.text_blocks.length || 0})
              </span>
            </div>

            {/* Filter */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-400" />
              <input
                type="text"
                value={inspectorFilter}
                onChange={(e) => setInspectorFilter(e.target.value)}
                placeholder="Filtrovat textové bloky..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-8 pr-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="text-[10px] text-zinc-400 italic px-1 flex items-center gap-1">
              <MousePointerClick className="w-3 h-3 text-indigo-400 shrink-0" />
              <span>Kliknutím označíte element pro AI chat</span>
            </div>

            <div className="flex flex-col gap-1.5">
              {filteredBlocks.map((b) => {
                const isSelected = selectedElement?.id === b.id;
                return (
                  <div
                    key={b.id}
                    onClick={() => {
                      if (isSelected) {
                        onSelectElement(null);
                      } else {
                        onSelectElement({
                          id: b.id,
                          page: b.page,
                          text: b.text,
                          bbox: b.bbox,
                          fontSize: b.font_size,
                          fontName: b.font_name,
                          color: b.color,
                        });
                      }
                    }}
                    className={`p-2 rounded-md border text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-950/60 border-indigo-400 text-indigo-100 shadow-sm'
                        : 'bg-zinc-950/40 border-zinc-850 hover:bg-zinc-850 hover:border-zinc-700 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-xs font-medium line-clamp-2 leading-snug">
                        {b.text}
                      </span>
                      {isSelected && <Crosshair className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />}
                    </div>

                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-zinc-400 border-t border-zinc-800/40 pt-1">
                      <span className="font-mono">{b.font_size}pt • {b.font_name}</span>
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-zinc-700 inline-block shrink-0"
                        style={{ backgroundColor: b.color }}
                        title={b.color}
                      />
                    </div>
                  </div>
                );
              })}

              {filteredBlocks.length === 0 && (
                <div className="py-6 text-center text-xs text-zinc-500">
                  Žádné textové bloky neodpovídají filtru.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
