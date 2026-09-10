import React, { useState, useEffect, useRef } from 'react';
import { Lock, KeyRound, Eye, EyeOff, AlertCircle, Sparkles, X, ShieldCheck } from 'lucide-react';

interface PasswordModalProps {
  isOpen: boolean;
  filename: string;
  fileSizeBytes?: number;
  onUnlock: (password: string) => Promise<void>;
  onCancel: () => void;
  error?: string | null;
  isLoading?: boolean;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({
  isOpen,
  filename,
  fileSizeBytes,
  onUnlock,
  onCancel,
  error,
  isLoading = false,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setShowPassword(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || isLoading) return;
    await onUnlock(password);
  };

  const handleQuickFill = (pw: string) => {
    setPassword(pw);
    inputRef.current?.focus();
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top decorative gradient bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-indigo-500 to-purple-500" />

        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition cursor-pointer"
          title="Zavřít"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          {/* Header with Lock Icon */}
          <div className="flex items-center gap-3.5 mb-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Dokument je chráněn heslem</span>
              </h2>
              <p className="text-xs text-zinc-400 truncate max-w-[280px]" title={filename}>
                {filename} {fileSizeBytes ? `(${formatSize(fileSizeBytes)})` : ''}
              </p>
            </div>
          </div>

          <p className="text-xs text-zinc-300 mb-5 leading-relaxed">
            Tento PDF soubor je zašifrován. Pro otevření, zobrazení náhledu a provádění AI úprav zadejte prosím platné heslo k dokumentu.
          </p>

          {/* Quick test hint for sample file */}
          {filename.toLowerCase().includes('sample') && (
            <div className="mb-4 p-2.5 bg-indigo-950/40 border border-indigo-800/40 rounded-xl flex items-center justify-between text-xs text-indigo-300">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>Ukázkové heslo: <strong className="text-white font-mono">1234</strong></span>
              </span>
              <button
                type="button"
                onClick={() => handleQuickFill('1234')}
                className="px-2 py-0.5 bg-indigo-600/60 hover:bg-indigo-600 text-white rounded text-[11px] font-medium transition cursor-pointer"
              >
                Vložit
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-rose-950/50 border border-rose-800/60 rounded-xl flex items-start gap-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-300 mb-1.5 uppercase tracking-wider">
                Heslo k PDF souboru
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  ref={inputRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Zadejte heslo..."
                  disabled={isLoading}
                  className="w-full pl-9 pr-10 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono tracking-wide"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-white transition cursor-pointer"
                  title={showPassword ? 'Skrýt heslo' : 'Zobrazit heslo'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 hover:text-white rounded-xl text-xs font-medium transition cursor-pointer"
              >
                Zrušit
              </button>
              <button
                type="submit"
                disabled={!password.trim() || isLoading}
                className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-md"
              >
                {isLoading ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    <span>Ověřuji heslo...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Odemknout dokument</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
