/**
 * @file AddToCartActionCard.tsx
 * @description UI presentation component for agentic POS cart injection.
 */

import React from 'react';
import { ShoppingCart, CheckCircle2, Plus, Minus, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { ExecutableAiAction } from '../../../../lib/ai/storeSentinelClient';
import { useAddToCartCard } from '../hooks/useAddToCartCard';

interface AddToCartActionCardProps {
  data: Extract<ExecutableAiAction, { type: 'add_to_cart' }>['data'];
  executed?: boolean;
  autoSaveEnabled: boolean;
  currentUser?: { id?: string; name?: string; role?: string } | null;
  onExecuted: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const AddToCartActionCard: React.FC<AddToCartActionCardProps> = (props) => {
  const {
    isDone,
    isSubmitting,
    autoSavedNotice,
    items,
    handleAddToCart,
    handleUpdateItemQty
  } = useAddToCartCard(props);

  const totalUnits = items.reduce((acc, it) => acc + (it.quantity || 1), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-emerald-200 dark:border-emerald-950 pb-2">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
          <ShoppingCart className="w-4 h-4" />
          <span>Meta Llama Agent: Stage POS Cart</span>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-emerald-500" />
          Tool Calling
        </span>
      </div>

      <div className="space-y-2">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-xs shadow-sm"
          >
            <div className="flex flex-col">
              <span className="font-bold text-slate-900 dark:text-white">
                {item.product_name}
              </span>
              {item.unit_price_mt ? (
                <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
                  {item.unit_price_mt} MT each
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              {!isDone ? (
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-700/60 rounded-lg p-0.5 border border-slate-200 dark:border-zinc-600">
                  <button
                    type="button"
                    onClick={() => handleUpdateItemQty(idx, (item.quantity || 1) - 1)}
                    className="p-1 rounded text-slate-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="px-2 font-bold font-mono text-slate-800 dark:text-zinc-100 text-xs">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUpdateItemQty(idx, (item.quantity || 1) + 1)}
                    className="p-1 rounded text-slate-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <span className="font-bold font-mono px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs">
                  {item.quantity} units
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-500 dark:text-zinc-400">
          {isDone
            ? autoSavedNotice
              ? '⚡ Automatically added to active cart.'
              : 'Items transferred to checkout.'
            : `${totalUnits} unit(s) ready for checkout.`}
        </span>

        {isDone ? (
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4" />
            <span>Added to POS</span>
          </div>
        ) : (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleAddToCart(false)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShoppingCart className="w-4 h-4" />
            )}
            <span>Add to Cart</span>
          </button>
        )}
      </div>
    </div>
  );
};
