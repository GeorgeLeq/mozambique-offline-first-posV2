/**
 * @file LlamaChatHeader.tsx
 * @description Top header component for LlamaChat Modal.
 */

import React from 'react';
import { ArrowLeft, Bot, Copy, Trash2, KeyRound, X } from 'lucide-react';
import { AiEngineStatus } from '../../../../lib/ai/unifiedAiClient';
import { ThemeToggle } from '../../../ThemeToggle';

interface LlamaChatHeaderProps {
  title: string;
  engineStatus: AiEngineStatus | null;
  pacing: 'fast' | 'balanced' | 'detailed';
  onClose: () => void;
  onOpenSettings: () => void;
  onCopyChat: () => void;
  onClearChat: () => void;
  onPacingChange: (pacing: 'fast' | 'balanced' | 'detailed') => void;
}

export const LlamaChatHeader: React.FC<LlamaChatHeaderProps> = ({
  title,
  engineStatus,
  pacing,
  onClose,
  onOpenSettings,
  onCopyChat,
  onClearChat,
  onPacingChange
}) => {
  return (
    <div className="px-5 sm:px-8 py-3.5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0 shadow-xs">
      <div className="flex items-center gap-3">
        <button
          onClick={onClose}
          className="p-2 -ml-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Exit Deep Dive View"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
          <Bot className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
              {title}
            </h2>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
              Meta Llama
            </span>

            <button
              type="button"
              onClick={onOpenSettings}
              className={`inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border cursor-pointer transition-all ${
                engineStatus?.isOnline
                  ? engineStatus.provider === 'baseten-muse'
                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/30 hover:bg-purple-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
              }`}
              title="Click to configure AI Engine (Local Ollama, Embedded GGUF, or Baseten Fallback)"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                engineStatus?.isOnline 
                  ? (engineStatus.provider === 'baseten-muse' ? 'bg-purple-500 animate-pulse' : 'bg-emerald-500 animate-pulse') 
                  : 'bg-rose-500'
              }`} />
              <span>
                {engineStatus?.isOnline 
                  ? (engineStatus.provider === 'baseten-muse' ? 'Muse Spark / ON' : 'Local AI / ON') 
                  : 'Local AI / OFF'}
              </span>
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 hidden sm:block">
            Pure Meta Llama Copilot for SYCOMM POS (Mozambique) • Live SQLite Telemetry
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onCopyChat}
          className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          title="Copy complete chat transcript to clipboard"
        >
          <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
          <span className="hidden sm:inline">Copy Chat</span>
        </button>

        <button
          onClick={onClearChat}
          className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 dark:bg-zinc-800 dark:hover:bg-rose-950/40 text-slate-600 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-300 border border-slate-200 dark:border-zinc-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          title="Clear chat and start fresh session"
        >
          <Trash2 className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
          <span className="hidden sm:inline">New Chat</span>
        </button>

        <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-zinc-800/90 border border-slate-200 dark:border-zinc-700/80 text-xs font-bold shadow-2xs">
          <button
            type="button"
            onClick={() => onPacingChange('fast')}
            className={`px-2 py-1 rounded-lg text-[11px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
              pacing === 'fast'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Fast Mode: Ultra-concise 1-2 sentence response"
          >
            <span>⚡ Fast</span>
          </button>

          <button
            type="button"
            onClick={() => onPacingChange('balanced')}
            className={`px-2 py-1 rounded-lg text-[11px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
              pacing === 'balanced'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Balanced Mode: Opening sentence + 2-3 concise bullet points"
          >
            <span>⚖️ Balanced</span>
          </button>

          <button
            type="button"
            onClick={() => onPacingChange('detailed')}
            className={`px-2 py-1 rounded-lg text-[11px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
              pacing === 'detailed'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Detailed Mode: Full in-depth multi-paragraph response"
          >
            <span>📝 Detailed</span>
          </button>
        </div>

        <div className="flex items-center">
          <ThemeToggle />
        </div>

        <button
          onClick={onOpenSettings}
          className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          title="Configure AI Deployment (Local Ollama, Embedded GGUF, or Groq)"
        >
          <KeyRound className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="hidden sm:inline">AI Settings</span>
        </button>

        <button
          onClick={onClose}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition-all cursor-pointer"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
