import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Server,
  Cpu,
  Sliders,
  FolderDown,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  Layers,
  Save,
} from 'lucide-react';
import { AppSettings } from '../types';
import { api } from '../lib/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  ollamaStatus: { online: boolean; version?: string; error?: string };
  onRefreshOllama: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  ollamaStatus,
  onRefreshOllama,
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [modelsList, setModelsList] = useState<Array<{ name: string; size?: number }>>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    setFormData(settings);
    if (isOpen) {
      loadModels();
    }
  }, [isOpen, settings]);

  const loadModels = async () => {
    setIsLoadingModels(true);
    try {
      const data = await api.getOllamaModels();
      setModelsList(data.models || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConn(true);
    setTestResult(null);
    try {
      const status = await api.getOllamaStatus();
      if (status.online) {
        setTestResult(`✓ Připojeno! Ollama v${status.version || '1.0'}`);
      } else {
        setTestResult(`✕ Nepřipojeno. Ujistěte se, že Ollama běží na ${formData.ollama_url}`);
      }
    } catch (e) {
      setTestResult(`✕ Chyba připojení: ${formData.ollama_url}`);
    } finally {
      setIsTestingConn(false);
      onRefreshOllama();
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none animate-in fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="h-14 border-b border-zinc-800 px-5 flex items-center justify-between bg-zinc-850">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Nastavení aplikace</h2>
              <p className="text-[10px] text-zinc-400">Lokální Ollama AI & PDF Engine</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar text-xs">
          {/* Section 1: Ollama Server */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-indigo-400" />
                <span>Ollama API URL</span>
              </label>

              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingConn}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-300 font-medium transition cursor-pointer border border-zinc-700"
              >
                <RefreshCw className={`w-3 h-3 ${isTestingConn ? 'animate-spin' : ''}`} />
                <span>Ověřit spojení</span>
              </button>
            </div>

            <input
              type="text"
              value={formData.ollama_url}
              onChange={(e) => setFormData({ ...formData, ollama_url: e.target.value })}
              placeholder="http://localhost:11434"
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 font-mono focus:outline-none focus:border-indigo-500"
            />

            {/* Test result status banner */}
            {testResult && (
              <div
                className={`p-2 rounded-lg text-[11px] font-medium border flex items-center gap-2 ${
                  testResult.startsWith('✓')
                    ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                    : 'bg-rose-950/60 border-rose-800 text-rose-300'
                }`}
              >
                {testResult.startsWith('✓') ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                )}
                <span>{testResult}</span>
              </div>
            )}
          </div>

          {/* Section 2: Model Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span>AI Model (Ollama)</span>
            </label>

            <div className="flex gap-2">
              <select
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 font-mono focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {modelsList.length > 0 ? (
                  modelsList.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="qwen2.5:latest">qwen2.5:latest (Doporučeno pro češtinu)</option>
                    <option value="llama3.1:latest">llama3.1:latest</option>
                    <option value="mistral:latest">mistral:latest</option>
                    <option value="deepseek-r1:latest">deepseek-r1:latest</option>
                  </>
                )}
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 italic">
              <Zap className="w-3 h-3 text-amber-400 shrink-0" />
              <span>Podporovány jsou libovolné modely nainstalované přes `ollama pull &lt;model&gt;`.</span>
            </div>
          </div>

          {/* Section 3: Temperature */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                <span>Teplota generování (Temperature)</span>
              </label>
              <span className="font-mono text-indigo-400 font-bold">{formData.temperature}</span>
            </div>

            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={formData.temperature}
              onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
              <span>0.0 (Přesné / Deterministické)</span>
              <span>1.0 (Kreativní)</span>
            </div>
          </div>

          {/* Section 4: Toggles */}
          <div className="space-y-3 pt-2 border-t border-zinc-800">
            {/* Auto apply */}
            <label className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 transition cursor-pointer">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-zinc-200">Auto Apply changes</span>
                <span className="text-[10px] text-zinc-400">Automaticky aplikovat jednoduché změny bez ručního potvrzení</span>
              </div>
              <input
                type="checkbox"
                checked={formData.auto_apply}
                onChange={(e) => setFormData({ ...formData, auto_apply: e.target.checked })}
                className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
              />
            </label>

            {/* Keep history */}
            <label className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 transition cursor-pointer">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-zinc-200">Uchovávat historii revizí</span>
                <span className="text-[10px] text-zinc-400">Každá úprava vytvoří novou neměnnou revizi (umožňuje Undo/Redo)</span>
              </div>
              <input
                type="checkbox"
                checked={formData.keep_revision_history}
                onChange={(e) => setFormData({ ...formData, keep_revision_history: e.target.checked })}
                className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
              />
            </label>
          </div>

          {/* Section 5: Output directory */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
              <FolderDown className="w-3.5 h-3.5 text-indigo-400" />
              <span>Výstupní složka (Output directory)</span>
            </label>
            <input
              type="text"
              value={formData.output_directory}
              onChange={(e) => setFormData({ ...formData, output_directory: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-medium transition cursor-pointer"
            >
              Zrušit
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold transition cursor-pointer shadow-sm shadow-indigo-900/30"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Uložit nastavení</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
