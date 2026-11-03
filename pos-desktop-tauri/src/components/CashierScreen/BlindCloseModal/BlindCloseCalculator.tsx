import React from 'react';
import { FileText, Coins, Sparkles } from 'lucide-react';
import { formatCurrency } from '../../../lib/utils';
import { Denomination } from './BlindCloseTypes';
import { useI18n } from '../../../i18n';
import { VoiceInputButton } from '../../common/VoiceInputButton';
import { ParsedCashUpResult } from '../../../lib/ai/voiceIntentParser';
import { isMuseOnline } from '../../../lib/ai/museClient';

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
  onVoiceCounts?: (parsedCounts: Record<number, number>, summaryText?: string) => void;
  voiceSummary?: string | null;
  cashierId?: string | null;
  cashierName?: string;
  shiftId?: string | null;
}

export const BlindCloseCalculator: React.FC<BlindCloseCalculatorProps> = ({
  counts,
  onCountChange,
  calculatedTotal,
  onClear,
  onVoiceCounts,
  voiceSummary,
  cashierId,
  cashierName,
  shiftId,
}) => {
  const { pos: t, common: commonT } = useI18n();
  const [isOnline, setIsOnline] = React.useState(() => isMuseOnline());

  React.useEffect(() => {
    const updateStatus = () => setIsOnline(isMuseOnline());
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    window.addEventListener('muse-api-key-changed', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      window.removeEventListener('muse-api-key-changed', updateStatus);
    };
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Muse Voice Transcribe Instant Cash-Up Bar */}
      <div className="bg-gradient-to-r from-indigo-50/90 via-purple-50/60 to-indigo-50/90 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-indigo-950/40 p-3.5 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/60 mb-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-indigo-600 text-white shadow-2xs">
              <Sparkles size={14} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-900 dark:text-zinc-100 uppercase tracking-wider block">
                  Contagem por Voz (Muse AI)
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                  isOnline 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800' 
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-800'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  <span>{isOnline ? 'MUSE Transcribe Online' : 'Offline'}</span>
                </span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                Dite as notas/moedas (Ex: "10 notas de mil, 5 de quinhentos e 20 moedas de cinco")
              </span>
            </div>
          </div>
          <VoiceInputButton
            mode="cash_up"
            size="sm"
            label="Ditar Contagem"
            cashierId={cashierId}
            cashierName={cashierName}
            shiftId={shiftId}
            onParsedCashUp={(res) => onVoiceCounts?.(res.counts, res.matchedPhrases.join(', '))}
          />
        </div>
        {voiceSummary && (
          <div className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Reconhecido: {voiceSummary}</span>
          </div>
        )}
      </div>

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
