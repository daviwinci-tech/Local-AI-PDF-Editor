import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  Check,
  X,
  Crosshair,
  ArrowRight,
  ShieldAlert,
  Trash2,
  ImagePlus,
  PlusCircle,
  Clock,
  CheckCircle2,
  FileEdit,
  Zap,
} from 'lucide-react';
import { ChatMessage, PDFOperation, SelectedElement } from '../types';

interface AIChatProps {
  messages: ChatMessage[];
  onSendMessage: (prompt: string) => void;
  isLoading: boolean;
  selectedElement: SelectedElement | null;
  onClearSelectedElement: () => void;
  onApplyOperations: (operations: PDFOperation[], messageId: string) => void;
  onCancelOperations: (messageId: string) => void;
  activeModel: string;
  isApplying: boolean;
}

export const AIChat: React.FC<AIChatProps> = ({
  messages,
  onSendMessage,
  isLoading,
  selectedElement,
  onClearSelectedElement,
  onApplyOperations,
  onCancelOperations,
  activeModel,
  isApplying,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading || isApplying) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const quickPrompts = [
    'Změň datum 1. 9. 2026 na 10. 9. 2026',
    'Změň Hello World na Hello David',
    'Změň jméno ve všech výskytech',
    'Začerň IČO a důvěrný údaj',
    'Odstraň zkušební odstavec',
    'Přidej logo do pravého horního rohu',
  ];

  return (
    <aside className="w-80 lg:w-96 border-l border-zinc-800 bg-zinc-900/95 flex flex-col select-none shrink-0 z-20 overflow-hidden">
      {/* Chat Header */}
      <div className="h-14 border-b border-zinc-800 px-4 flex items-center justify-between bg-zinc-900 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Bot className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              AI PDF Assistant
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">
              Model: {activeModel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/60">
          <Zap className="w-3 h-3" />
          <span>Připraven</span>
        </div>
      </div>

      {/* Selected Element Floating Banner */}
      {selectedElement && (
        <div className="bg-indigo-950/80 border-b border-indigo-800/70 p-2.5 flex items-center justify-between text-xs text-indigo-200">
          <div className="flex items-center gap-2 min-w-0">
            <Crosshair className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-indigo-300 block font-semibold">Vybraný element (Strana {selectedElement.page}):</span>
              <span className="font-mono text-white text-xs truncate block">"{selectedElement.text}"</span>
            </div>
          </div>
          <button
            onClick={onClearSelectedElement}
            className="p-1 hover:bg-indigo-900 text-indigo-300 hover:text-white rounded transition cursor-pointer shrink-0 ml-2"
            title="Zrušit výběr"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 custom-scrollbar">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              {/* Sender info */}
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-zinc-400 font-mono">
                {isUser ? (
                  <>
                    <span>Vy</span>
                    <User className="w-2.5 h-2.5" />
                  </>
                ) : (
                  <>
                    <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                    <span>AI Assistant ({msg.model_used || activeModel})</span>
                  </>
                )}
                <span>• {msg.timestamp}</span>
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[92%] rounded-xl p-3 text-xs leading-relaxed ${
                  isUser
                    ? 'bg-indigo-600 text-white rounded-br-xs shadow-sm'
                    : 'bg-zinc-800/90 text-zinc-100 rounded-bl-xs border border-zinc-700/60 shadow-sm'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {/* Proposed Operations Review Card */}
                {msg.operations && msg.operations.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-zinc-700/60 flex flex-col gap-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1">
                      <FileEdit className="w-3 h-3" />
                      <span>Navržené změny ({msg.operations.length})</span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {msg.operations.map((op, idx) => (
                        <div
                          key={idx}
                          className="bg-zinc-900/90 border border-zinc-700/80 rounded-lg p-2 flex flex-col gap-1 text-[11px]"
                        >
                          <div className="flex items-center justify-between">
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[9px] uppercase">
                              {op.type}
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              Strana {op.page || 1}
                            </span>
                          </div>

                          {/* Diff Details */}
                          {op.old_text && op.new_text && (
                            <div className="flex items-center gap-1.5 font-mono text-zinc-200 mt-0.5 bg-zinc-950/60 p-1.5 rounded">
                              <span className="line-through text-rose-400 truncate max-w-[100px]">{op.old_text}</span>
                              <ArrowRight className="w-3 h-3 text-zinc-400 shrink-0" />
                              <span className="text-emerald-400 font-semibold truncate max-w-[120px]">{op.new_text}</span>
                            </div>
                          )}

                          {op.type === 'redact' && (
                            <div className="text-amber-300 text-[10px] flex items-center gap-1 mt-0.5">
                              <ShieldAlert className="w-3 h-3" />
                              <span>Začernění: {op.old_text || 'vybraná oblast'}</span>
                            </div>
                          )}

                          {op.type === 'delete_text' && (
                            <div className="text-rose-300 text-[10px] flex items-center gap-1 mt-0.5">
                              <Trash2 className="w-3 h-3" />
                              <span>Odstranění: {op.old_text || 'vybraný odstavec'}</span>
                            </div>
                          )}

                          {op.type === 'add_image' && (
                            <div className="text-indigo-300 text-[10px] flex items-center gap-1 mt-0.5">
                              <ImagePlus className="w-3 h-3" />
                              <span>Vložení loga ({op.image_position || 'top-right'})</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Action buttons if still pending review */}
                    {msg.status === 'pending_review' ? (
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => onApplyOperations(msg.operations!, msg.id)}
                          disabled={isApplying}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-md text-xs font-semibold transition cursor-pointer shadow-sm disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isApplying ? 'Aplikuji...' : 'Použít změny'}</span>
                        </button>

                        <button
                          onClick={() => onCancelOperations(msg.id)}
                          disabled={isApplying}
                          className="flex items-center justify-center p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-md transition cursor-pointer border border-zinc-700 disabled:opacity-50"
                          title="Zrušit"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Změny aplikovány do PDF revize</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 p-3 bg-zinc-800/60 rounded-xl border border-zinc-700/60 text-xs text-zinc-300 w-fit animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
            <span>AI analyzuje požadavek a vytváří plán úprav...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts Pills */}
      <div className="p-2 border-t border-zinc-800/80 bg-zinc-900/60 flex flex-col gap-1.5">
        <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider px-1">
          Rychlé příklady:
        </div>
        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto custom-scrollbar">
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => onSendMessage(p)}
              disabled={isLoading || isApplying}
              className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800/80 hover:bg-indigo-950/80 hover:text-indigo-200 text-zinc-300 border border-zinc-700/60 hover:border-indigo-600/50 transition cursor-pointer text-left truncate max-w-full"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-zinc-800 bg-zinc-900 shrink-0">
        <div className="relative flex items-end bg-zinc-950 border border-zinc-700/80 focus-within:border-indigo-500 rounded-xl p-1.5 transition shadow-inner">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedElement
                ? `Např: Změň tohle na...`
                : `Např: Změň datum 1. 9. 2026 na 10. 9. 2026...`
            }
            rows={2}
            className="w-full bg-transparent resize-none text-xs text-zinc-100 placeholder-zinc-400 focus:outline-none px-2 py-1 max-h-24 custom-scrollbar"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isLoading || isApplying}
            className="p-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg transition cursor-pointer shrink-0 ml-1 shadow-sm"
            title="Odeslat příkaz (Enter)"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </aside>
  );
};
