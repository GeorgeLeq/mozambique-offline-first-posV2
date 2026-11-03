/**
 * @file DeleteProductActionCard.tsx
 * @description UI presentation component for confirming product deletion / removal via AI.
 */

import React from 'react';
import { Trash2, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { ExecutableAiAction } from '../../../../lib/ai/storeSentinelClient';
import { useDeleteProductCard } from '../hooks/useDeleteProductCard';

interface DeleteProductActionCardProps {
  data: Extract<ExecutableAiAction, { type: 'delete_product' }>['data'];
  executed?: boolean;
  currentUser?: { id?: string; name?: string; role?: string } | null;
  onExecuted: () => void;
}

export const DeleteProductActionCard: React.FC<DeleteProductActionCardProps> = (props) => {
  const { isDone, isSubmitting, handleDeleteProduct } = useDeleteProductCard(props);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-rose-200 dark:border-rose-950 pb-2">
        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold">
          <Trash2 className="w-4 h-4" />
          <span>Remove Product from Catalog</span>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
          Critical Action
        </span>
      </div>

      <div className="p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 flex-shrink-0" />
        <div className="text-xs">
          <p className="font-bold text-slate-800 dark:text-zinc-200">
            Do you want to remove product: <span className="text-rose-600 dark:text-rose-400 font-extrabold">{props.data.name}</span>?
          </p>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
            The item will be archived in SQLite with audit logs intact.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-slate-400 dark:text-zinc-500">
          {isDone ? 'Item removed successfully.' : 'Requires explicit operator confirmation.'}
        </span>

        {!isDone ? (
          <button
            onClick={handleDeleteProduct}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            <span>Confirm Removal</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold text-xs bg-rose-50 dark:bg-rose-950/60 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900">
            <CheckCircle2 className="w-4 h-4" />
            <span>Removed from SQLite</span>
          </div>
        )}
      </div>
    </div>
  );
};
