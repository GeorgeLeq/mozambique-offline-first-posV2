/**
 * @file NumpadGrid.tsx
 * @description Tactile Retail POS Numpad Grid.
 * Features realistic mechanical depth, alpha labels, crisp tactile feedback,
 * and high-visibility touch targets for high-volume cashier terminals.
 */

import React from 'react';
import { Delete, ArrowRight, RotateCcw } from 'lucide-react';

interface NumpadGridProps {
  onNumberClick: (num: string) => void;
  onClear: () => void;
  onDelete: () => void;
  onSubmit?: () => void;
  canSubmit?: boolean;
  isLoading?: boolean;
}

const NUMPAD_KEYS = [
  { num: '1', letters: '' },
  { num: '2', letters: 'ABC' },
  { num: '3', letters: 'DEF' },
  { num: '4', letters: 'GHI' },
  { num: '5', letters: 'JKL' },
  { num: '6', letters: 'MNO' },
  { num: '7', letters: 'PQRS' },
  { num: '8', letters: 'TUV' },
  { num: '9', letters: 'WXYZ' },
];

export function NumpadGrid({
  onNumberClick,
  onClear,
  onDelete,
  onSubmit,
  canSubmit = false,
  isLoading = false
}: NumpadGridProps) {
  return (
    <div className="w-full max-w-[310px] flex flex-col gap-3">
      {/* 3x3 Digit Grid */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {NUMPAD_KEYS.map(({ num, letters }) => (
          <button
            key={num}
            type="button"
            onClick={() => onNumberClick(num)}
            className="group relative h-16 sm:h-17 rounded-2xl bg-white dark:bg-zinc-800/90 hover:bg-slate-50 dark:hover:bg-zinc-700/80 active:scale-95 border border-slate-200/90 dark:border-zinc-700/80 hover:border-indigo-400 dark:hover:border-indigo-500 shadow-xs hover:shadow-md transition-all duration-150 flex flex-col items-center justify-center cursor-pointer select-none"
          >
            <span className="text-2xl font-black text-slate-800 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-none">
              {num}
            </span>
            {letters && (
              <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 tracking-widest mt-1 uppercase leading-none">
                {letters}
              </span>
            )}
          </button>
        ))}

        {/* Clear Key */}
        <button
          type="button"
          onClick={onClear}
          className="h-16 sm:h-17 rounded-2xl bg-slate-100/90 dark:bg-zinc-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 active:scale-95 border border-slate-200/80 dark:border-zinc-800 hover:border-rose-300 dark:hover:border-rose-900/60 text-slate-600 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 shadow-2xs transition-all duration-150 flex flex-col items-center justify-center cursor-pointer select-none"
          title="Clear PIN (Esc)"
        >
          <RotateCcw className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-extrabold uppercase tracking-wider">Limpar</span>
        </button>

        {/* Zero Key */}
        <button
          type="button"
          onClick={() => onNumberClick('0')}
          className="group relative h-16 sm:h-17 rounded-2xl bg-white dark:bg-zinc-800/90 hover:bg-slate-50 dark:hover:bg-zinc-700/80 active:scale-95 border border-slate-200/90 dark:border-zinc-700/80 hover:border-indigo-400 dark:hover:border-indigo-500 shadow-xs hover:shadow-md transition-all duration-150 flex flex-col items-center justify-center cursor-pointer select-none"
        >
          <span className="text-2xl font-black text-slate-800 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-none">
            0
          </span>
          <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 tracking-widest mt-1 uppercase leading-none">
            +
          </span>
        </button>

        {/* Backspace Key */}
        <button
          type="button"
          onClick={onDelete}
          className="h-16 sm:h-17 rounded-2xl bg-slate-100/90 dark:bg-zinc-900/60 hover:bg-amber-50 dark:hover:bg-amber-950/40 active:scale-95 border border-slate-200/80 dark:border-zinc-800 hover:border-amber-300 dark:hover:border-amber-900/60 text-slate-600 hover:text-amber-600 dark:text-zinc-400 dark:hover:text-amber-400 shadow-2xs transition-all duration-150 flex flex-col items-center justify-center cursor-pointer select-none"
          title="Delete digit (Backspace)"
        >
          <Delete className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-extrabold uppercase tracking-wider">Apagar</span>
        </button>
      </div>

      {/* Primary Submit Button */}
      {onSubmit && (
        <button
          type="button"
          disabled={isLoading}
          onClick={onSubmit}
          className={`w-full py-3.5 px-5 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer shadow-md ${
            canSubmit
              ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 text-white shadow-indigo-600/30 hover:scale-[1.01] active:scale-95'
              : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700/80 border border-slate-200 dark:border-zinc-700'
          }`}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              <span>A autenticar...</span>
            </div>
          ) : (
            <>
              <span>Entrar no Sistema</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
