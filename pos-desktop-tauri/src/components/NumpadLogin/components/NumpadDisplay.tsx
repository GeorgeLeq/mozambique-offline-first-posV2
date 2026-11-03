import React from 'react';
import { ShieldCheck, ArrowRight, Sparkles, Wifi } from 'lucide-react';

interface NumpadDisplayProps {
  pin: string;
  error: boolean;
  onQuickPin?: (pin: string) => void;
  isLoading?: boolean;
}

export function NumpadDisplay({ error, onQuickPin, isLoading }: NumpadDisplayProps) {
  return (
    <>
      <div className="w-20 h-20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg border border-slate-100/50 dark:border-white/5 rounded-[2rem] flex items-center justify-center mb-5 shadow-xl dark:shadow-2xl shadow-indigo-500/10 dark:shadow-black/50 relative">
        <div className="absolute inset-0 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-[2rem] blur-xl" />
        <ShieldCheck className="w-10 h-10 text-indigo-600 dark:text-indigo-400 relative z-10" strokeWidth={1.5} />
      </div>
      
      <h1 className="text-3xl font-extrabold mb-1 tracking-tight text-slate-800 dark:text-zinc-100 text-center">
        Welcome To SYCOMM
      </h1>
      <p className="text-slate-500 dark:text-zinc-400 mb-5 font-medium text-xs sm:text-sm text-center max-w-[300px]">
        Retail Point of Sale &amp; Inventory Intelligence
      </p>

      {/* Offline Judge Access Badge */}
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-6">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>100% Offline SQLite • Judge Access</span>
      </div>

      {/* Prominent Direct Enter Button */}
      {onQuickPin && (
        <button
          type="button"
          disabled={isLoading}
          onClick={() => onQuickPin('1234')}
          className="w-full max-w-[300px] mb-2 py-4 px-6 bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 text-white font-extrabold rounded-2xl shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-3 transition-all duration-300 hover:scale-[1.02] active:scale-95 cursor-pointer text-base disabled:opacity-60"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              <span>Entering...</span>
            </div>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-amber-300" />
              <span>Enter SYCOMM</span>
              <ArrowRight className="w-5 h-5 text-indigo-200" />
            </>
          )}
        </button>
      )}

      {error && (
        <p className="text-rose-500 text-xs font-semibold mt-2 animate-bounce">
          Authentication failed. Retrying...
        </p>
      )}
    </>
  );
}
