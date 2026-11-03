/**
 * @file UpdateProductActionCard.tsx
 * @description UI presentation component for reviewing and updating a product via AI.
 */

import React from 'react';
import { Edit3, CheckCircle2, Save, Loader2 } from 'lucide-react';
import { ExecutableAiAction } from '../../../../lib/ai/storeSentinelClient';
import { useUpdateProductCard } from '../hooks/useUpdateProductCard';

interface UpdateProductActionCardProps {
  data: Extract<ExecutableAiAction, { type: 'update_product' }>['data'];
  executed?: boolean;
  autoSaveEnabled: boolean;
  currentUser?: { id?: string; name?: string; role?: string } | null;
  onExecuted: () => void;
}

export const UpdateProductActionCard: React.FC<UpdateProductActionCardProps> = (props) => {
  const {
    isDone,
    isSubmitting,
    autoSavedNotice,
    prodName,
    setProdName,
    prodPrice,
    setProdPrice,
    prodCost,
    setProdCost,
    prodStock,
    setProdStock,
    prodCategory,
    setProdCategory,
    handleUpdateProduct
  } = useUpdateProductCard(props);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
          <Edit3 className="w-4 h-4" />
          <span>Update Product (SQLite)</span>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          Modify
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            Product Name
          </label>
          <input
            type="text"
            disabled={isDone}
            value={prodName}
            onChange={e => setProdName(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-amber-500 outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            Category
          </label>
          <input
            type="text"
            disabled={isDone}
            value={prodCategory}
            onChange={e => setProdCategory(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-amber-500 outline-none"
            placeholder="Keep current if empty"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            New Price (MT)
          </label>
          <input
            type="number"
            disabled={isDone}
            value={prodPrice}
            onChange={e => setProdPrice(e.target.value)}
            placeholder="Current price"
            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-mono font-bold focus:ring-1 focus:ring-amber-500 outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            Cost Price (MT)
          </label>
          <input
            type="number"
            disabled={isDone}
            value={prodCost}
            onChange={e => setProdCost(e.target.value)}
            placeholder="Current cost"
            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-mono focus:ring-1 focus:ring-amber-500 outline-none"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            New Stock Quantity
          </label>
          <input
            type="number"
            disabled={isDone}
            value={prodStock}
            onChange={e => setProdStock(e.target.value)}
            placeholder="Current stock"
            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-mono focus:ring-1 focus:ring-amber-500 outline-none"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        {autoSavedNotice ? (
          <span className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Auto-updated in SQLite via ChatAgentBridge!
          </span>
        ) : (
          <span className="text-[10px] text-slate-400 dark:text-zinc-500">
            {isDone ? 'Changes saved in SQLite.' : 'Review new values and confirm.'}
          </span>
        )}

        {!isDone ? (
          <button
            onClick={() => handleUpdateProduct(false)}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Update Product</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-4 h-4" />
            <span>Updated Successfully</span>
          </div>
        )}
      </div>
    </div>
  );
};
