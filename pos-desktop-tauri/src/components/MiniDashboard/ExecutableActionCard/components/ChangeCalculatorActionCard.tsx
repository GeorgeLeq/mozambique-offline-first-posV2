/**
 * @file ChangeCalculatorActionCard.tsx
 * @description UI presentation component for agentic Mozambique Meticais change calculation.
 */

import React from 'react';
import { Coins, CheckCircle2, Banknote, Sparkles } from 'lucide-react';
import { ExecutableAiAction } from '../../../../lib/ai/storeSentinelClient';

interface ChangeCalculatorActionCardProps {
  data: Extract<ExecutableAiAction, { type: 'calculate_change' }>['data'];
  executed?: boolean;
  currentUser?: { id?: string; name?: string; role?: string } | null;
  onExecuted?: () => void;
}

export const ChangeCalculatorActionCard: React.FC<ChangeCalculatorActionCardProps> = ({ data }) => {
  const { total_due_mt, amount_tendered_mt, change_due_mt } = data;

  // Compute Mozambique Meticais banknote denominations
  const computeDenominations = (amount: number) => {
    let rem = amount;
    const denoms: Array<{ note: number; count: number }> = [];
    const notes = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];
    for (const n of notes) {
      if (rem >= n) {
        const count = Math.floor(rem / n);
        rem %= n;
        denoms.push({ note: n, count });
      }
    }
    return denoms;
  };

  const denominations = computeDenominations(change_due_mt);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-indigo-200 dark:border-indigo-950 pb-2">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold">
          <Coins className="w-4 h-4" />
          <span>Meta Llama Agent: Change Calculator (MT)</span>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-indigo-500" />
          Tool Calling
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Sale Total</span>
          <span className="text-base font-extrabold font-mono text-slate-800 dark:text-zinc-100">
            {total_due_mt} MT
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Tendered</span>
          <span className="text-base font-extrabold font-mono text-indigo-600 dark:text-indigo-400">
            {amount_tendered_mt} MT
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
          <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block mb-0.5">Change Due</span>
          <span className="text-base font-black font-mono text-emerald-700 dark:text-emerald-300">
            {change_due_mt} MT
          </span>
        </div>
      </div>

      {denominations.length > 0 && (
        <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700">
          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-400 block mb-1.5 flex items-center gap-1">
            <Banknote className="w-3 h-3" />
            Suggested Meticais Denominations:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {denominations.map((d, i) => (
              <span
                key={i}
                className="px-2 py-1 rounded-lg bg-white dark:bg-zinc-700 text-[11px] font-mono font-bold text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-600 shadow-2xs"
              >
                {d.count}x {d.note} MT
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
