import React from 'react';
import { FileText, Coins, Sparkles } from 'lucide-react';
import { formatCurrency } from '../../../lib/utils';
import { Denomination } from './BlindCloseTypes';
import { useI18n } from '../../../i18n';

const NOTES: Denomination[] = [
  { value: 1000, label: '1000 MT', color: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' },
  { value: 500, label: '500 MT', color: 'border-orange-500/20 bg-orange-500/5 text-orange-600 dark:text-orange-400' },
  { value: 200, label: '200 MT', color: 'border-blue-500/20 bg-blue-500/5 text-blue-600 dark:text-blue-400' },
  { value: 100, label: '100 MT', color: 'border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400' },
  { value: 50, label: '50 MT', color: 'border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-500' },
  { value: 20, label: '20 MT', color: 'border-purple-500/20 bg-purple-500/5 text-purple-600 dark:text-purple-400' },
];

const COINS: Denomination[] = [
  { value: 10, label: '10 MT', color: 'border-zinc-300 dark:border-zinc-700 bg-zinc-500/5 text-zinc-650 dark:text-zinc-400' },
  { value: 5, label: '5 MT', color: 'border-zinc-300 dark:border-zinc-700 bg-zinc-500/5 text-zinc-650 dark:text-zinc-400' },
  { value: 2, label: '2 MT', color: 'border-zinc-300 dark:border-zinc-700 bg-zinc-500/5 text-zinc-650 dark:text-zinc-400' },
  { value: 1, label: '1 MT', color: 'border-zinc-300 dark:border-zinc-700 bg-zinc-500/5 text-zinc-650 dark:text-zinc-400' },
  { value: 0.5, label: '50 Cent', color: 'border-zinc-300 dark:border-zinc-700 bg-zinc-500/5 text-zinc-500 dark:text-zinc-450' }
];

interface BlindCloseCalculatorProps {
  counts: Record<number, number>;
  onCountChange: (val: number, countStr: string) => void;
  calculatedTotal: number;
  onClear: () => void;
}

export const BlindCloseCalculator: React.FC<BlindCloseCalculatorProps> = ({
  counts,
  onCountChange,
  calculatedTotal,
  onClear,
}) => {
  const { pos: t, common: commonT } = useI18n();

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Muse Voice Transcribe Instant Cash-Up Bar */}


      {/* Split Side-by-Side: Notas vs Moedas */}
      <div className="overflow-y-auto max-h-[420px] pr-2 space-y-6 hide-scrollbar border-t border-b border-slate-100 dark:border-white/5 py-4 flex-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          
          {/* Notas Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1.5 mb-2 pl-1">
              <FileText size={12} className="text-emerald-500" />
              {t.banknotes || 'Notas (Cédulas)'}
            </h4>
            <div className="space-y-2.5">
              {NOTES.map((d) => (
                <div 
                  key={d.value} 
                  className="bg-slate-50/40 dark:bg-zinc-950/20 border border-slate-150/70 dark:border-zinc-850 p-3 rounded-2xl flex flex-col justify-between gap-2.5 hover:border-indigo-500/20 transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider border ${d.color}`}>
                      {d.label}
                    </span>
                    <span className="text-[10px] font-black font-mono text-slate-500 dark:text-zinc-400">
                      {formatCurrency(d.value * (counts[d.value] || 0))}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onCountChange(d.value, String(Math.max(0, (counts[d.value] || 0) - 1)))}
                      className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-855 border border-slate-200 dark:border-zinc-750 flex items-center justify-center text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 active:scale-90 transition-all font-black text-sm shrink-0"
                    >
                      -
                    </button>
                    
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={counts[d.value] || ''}
                      onChange={(e) => onCountChange(d.value, e.target.value)}
                      className="flex-1 w-full text-center font-bold text-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-lg py-1 focus:ring-1 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                      placeholder="0"
                    />
                    
                    <button
                      type="button"
                      onClick={() => onCountChange(d.value, String((counts[d.value] || 0) + 1))}
                      className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-855 border border-slate-200 dark:border-zinc-750 flex items-center justify-center text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 active:scale-90 transition-all font-black text-sm shrink-0"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Moedas Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1.5 mb-2 pl-1">
              <Coins size={12} className="text-amber-500" />
              {t.coins || 'Moedas'}
            </h4>
            <div className="space-y-2.5">
              {COINS.map((d) => (
                <div 
                  key={d.value} 
                  className="bg-slate-50/40 dark:bg-zinc-950/20 border border-slate-150/70 dark:border-zinc-850 p-3 rounded-2xl flex flex-col justify-between gap-2.5 hover:border-indigo-500/20 transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider border ${d.color}`}>
                      {d.label}
                    </span>
                    <span className="text-[10px] font-black font-mono text-slate-500 dark:text-zinc-400">
                      {formatCurrency(d.value * (counts[d.value] || 0))}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onCountChange(d.value, String(Math.max(0, (counts[d.value] || 0) - 1)))}
                      className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-855 border border-slate-200 dark:border-zinc-750 flex items-center justify-center text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 active:scale-90 transition-all font-black text-sm shrink-0"
                    >
                      -
                    </button>
                    
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={counts[d.value] || ''}
                      onChange={(e) => onCountChange(d.value, e.target.value)}
                      className="flex-1 w-full text-center font-bold text-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-lg py-1 focus:ring-1 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                      placeholder="0"
                    />
                    
                    <button
                      type="button"
                      onClick={() => onCountChange(d.value, String((counts[d.value] || 0) + 1))}
                      className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-855 border border-slate-200 dark:border-zinc-750 flex items-center justify-center text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 active:scale-90 transition-all font-black text-sm shrink-0"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Calculator Summary Strip */}
      <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-2xl border border-slate-150 dark:border-white/5 flex justify-between items-center mt-3 shadow-inner">
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">
            {t.calculatedTotal || 'Total Calculado'}
          </span>
          <span className="text-xl font-black text-slate-900 dark:text-zinc-100 font-mono leading-none mt-1">{formatCurrency(calculatedTotal)}</span>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 px-3.5 py-2 rounded-xl transition-all border border-rose-100 dark:border-rose-500/10"
        >
          {t.clear || commonT.clear || 'Limpar'}
        </button>
      </div>
    </div>
  );
};
