/**
 * @file ProductActionCard.tsx
 * @description Pure presentation component for product action card using useProductCard hook.
 */

import React from 'react';
import { Package, CheckCircle2, Save, Loader2 } from 'lucide-react';
import { ExecutableAiAction } from '../../../../lib/ai/storeSentinelClient';
import { useProductCard } from '../hooks/useProductCard';

interface ProductActionCardProps {
  data: Extract<ExecutableAiAction, { type: 'create_product' }>['data'];
  executed?: boolean;
  autoSaveEnabled: boolean;
  currentUser?: { id?: string; name?: string; role?: string } | null;
  onExecuted: () => void;
}

export const ProductActionCard: React.FC<ProductActionCardProps> = (props) => {
  const {
    isDone,
    isSubmitting,
    autoSavedNotice,
    lastInsertedId,
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
    prodUnitType,
    prodBarcode,
    setProdBarcode,
    handleSaveProduct,
    handleUndoProduct
  } = useProductCard(props);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold">
          <Package className="w-4 h-4" />
          <span>Drafted Product (SQLite Ready)</span>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
          {prodUnitType === 'box' ? 'Box' : prodUnitType === 'pack' ? 'Pack' : prodUnitType === 'bulk' ? 'Bulk (Kg)' : 'Unit (ea)'}
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
            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-indigo-500 outline-none"
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
            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            Selling Price (MT)
          </label>
          <input
            type="number"
            disabled={isDone}
            value={prodPrice}
            onChange={e => setProdPrice(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-mono font-bold focus:ring-1 focus:ring-indigo-500 outline-none"
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
            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-mono font-bold focus:ring-1 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            Initial Stock Quantity
          </label>
          <input
            type="number"
            disabled={isDone}
            value={prodStock}
            onChange={e => setProdStock(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-mono font-bold focus:ring-1 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            Barcode (Optional)
          </label>
          <input
            type="text"
            disabled={isDone}
            placeholder="Auto-generated if empty"
            value={prodBarcode}
            onChange={e => setProdBarcode(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-mono text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>

      <div className="pt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-500 dark:text-zinc-400">
          {isDone ? (autoSavedNotice ? '⚡ Auto-saved directly to local SQLite.' : 'Saved to local SQLite database.') : 'Review details before inserting.'}
        </span>

        {isDone ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
              <span>{autoSavedNotice ? 'Auto-saved to SQLite' : 'Saved to SQLite'}</span>
            </div>
            {lastInsertedId && (
              <button
                type="button"
                onClick={handleUndoProduct}
                className="text-[11px] text-slate-500 dark:text-zinc-400 hover:text-rose-600 underline cursor-pointer"
              >
                Undo
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSaveProduct(false)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Product to SQLite</span>
          </button>
        )}
      </div>
    </div>
  );
};
