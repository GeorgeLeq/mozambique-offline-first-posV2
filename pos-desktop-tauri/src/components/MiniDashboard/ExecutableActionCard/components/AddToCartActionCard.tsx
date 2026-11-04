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
    availableProducts,
    handleAddToCart,
    handleUpdateItemQty,
    handleSelectItemProduct
  } = useAddToCartCard(props);

  const totalUnits = items.reduce((acc, it) => acc + (it.quantity || 1), 0);
  const totalSale = props.data.total_sale_mt ?? items.reduce((acc, it) => acc + ((it.unit_price_mt || 0) * (it.quantity || 1)), 0);
  const profit = props.data.profit_mt;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-emerald-200 dark:border-emerald-950 pb-2">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
          <ShoppingCart className="w-4 h-4" />
          <span>Meta Llama Agent: Stage POS Cart</span>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-emerald-500" />
          SQLite Grounded
        </span>
      </div>

      <div className="space-y-2">
        {items.map((item, idx) => {
          const matchedProd = availableProducts.find(p => p.id === item.product_id || p.name.toLowerCase() === item.product_name.toLowerCase());
          const currentStock = item.current_stock ?? matchedProd?.stock_quantity;

          return (
            <div
              key={idx}
              className="flex flex-col gap-2 p-3 rounded-xl bg-white dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-xs shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                {!isDone && availableProducts.length > 0 ? (
                  <div className="flex-1">
                    <label className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                      Catalog Product:
                    </label>
                    <select
                      value={item.product_id || matchedProd?.id || ''}
                      onChange={(e) => handleSelectItemProduct(idx, e.target.value)}
                      className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 dark:text-zinc-100 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                    >
                      {availableProducts.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {p.price_mt} MT ({p.stock_quantity ?? 0} in stock)
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      {item.product_name}
                    </span>
                    {item.unit_price_mt ? (
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
                        {item.unit_price_mt} MT each
                      </span>
                    ) : null}
                  </div>
                )}

                <div className="flex items-center gap-2 shrink-0">
                  {!isDone ? (
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-700/60 rounded-lg p-0.5 border border-slate-200 dark:border-zinc-600">
                      <button
                        type="button"
                        onClick={() => handleUpdateItemQty(idx, (item.quantity || 1) - 1)}
                        className="p-1 rounded text-slate-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 cursor-pointer"
                        title="Decrease quantity"
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
                        title="Increase quantity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <span className="font-bold font-mono px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs">
                      {item.quantity} un
                    </span>
                  )}
                </div>
              </div>

              {/* Subtotal & Stock indicator */}
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 dark:border-zinc-700/60 text-slate-500 dark:text-zinc-400">
                <span className="flex items-center gap-1">
                  Subtotal: <strong className="text-slate-800 dark:text-zinc-200 font-mono">{(item.quantity || 1) * (item.unit_price_mt || 0)} MT</strong>
                </span>
                {currentStock !== undefined && (
                  <span className={`font-mono text-[10px] font-semibold ${
                    currentStock <= 5 ? 'text-amber-500' : 'text-slate-400 dark:text-zinc-500'
                  }`}>
                    Shelf stock: {currentStock} un
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Financial Summary & Profit Bar */}
      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-600 dark:text-zinc-300">Total Venda:</span>
          <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono text-sm">
            {totalSale.toLocaleString()} MT
          </span>
        </div>
        {profit !== undefined && profit > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-[11px]">
            <span>Ganho:</span>
            <span>+{profit.toLocaleString()} MT</span>
          </div>
        )}
      </div>

      <div className="pt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-500 dark:text-zinc-400">
          {isDone
            ? autoSavedNotice
              ? '⚡ Automatically transferred to active POS cart & stock reduced.'
              : 'Items transferred to POS checkout & stock reduced.'
            : `${totalUnits} unit(s) ready for POS cart commit.`}
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
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-md cursor-pointer disabled:opacity-50 text-xs"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShoppingCart className="w-4 h-4" />
            )}
            <span>Confirm & Add to Cart</span>
          </button>
        )}
      </div>
    </div>
  );
};
