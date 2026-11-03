/**
 * @file DeliveryActionCard.tsx
 * @description Pure presentation component for delivery creation action card using useDeliveryCard hook.
 */

import React from 'react';
import { Truck, CheckCircle2, Save, Loader2 } from 'lucide-react';
import { ExecutableAiAction } from '../../../../lib/ai/storeSentinelClient';
import { useDeliveryCard } from '../hooks/useDeliveryCard';

interface DeliveryActionCardProps {
  data: Extract<ExecutableAiAction, { type: 'create_delivery' }>['data'];
  executed?: boolean;
  autoSaveEnabled: boolean;
  currentUser?: { id?: string; name?: string; role?: string } | null;
  onExecuted: () => void;
}

export const DeliveryActionCard: React.FC<DeliveryActionCardProps> = (props) => {
  const {
    isDone,
    isSubmitting,
    autoSavedNotice,
    supplierName,
    setSupplierName,
    invoiceNumber,
    setInvoiceNumber,
    expectedDate,
    setExpectedDate,
    handleSaveDelivery
  } = useDeliveryCard(props);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
          <Truck className="w-4 h-4" />
          <span>Drafted Restock Delivery (SQLite)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            Supplier Name
          </label>
          <input
            type="text"
            disabled={isDone}
            value={supplierName}
            onChange={e => setSupplierName(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-emerald-500 outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            Invoice / PO Number
          </label>
          <input
            type="text"
            disabled={isDone}
            placeholder="e.g. INV-2025/01"
            value={invoiceNumber}
            onChange={e => setInvoiceNumber(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-emerald-500 outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            Expected Delivery Date
          </label>
          <input
            type="date"
            disabled={isDone}
            value={expectedDate}
            onChange={e => setExpectedDate(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-emerald-500 outline-none"
          />
        </div>
      </div>

      <div className="pt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-500 dark:text-zinc-400">
          {isDone ? (autoSavedNotice ? '⚡ Auto-saved directly to local SQLite.' : 'Saved to local SQLite database.') : 'Review delivery before inserting.'}
        </span>

        {isDone ? (
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4" />
            <span>{autoSavedNotice ? 'Auto-saved to SQLite' : 'Saved to SQLite'}</span>
          </div>
        ) : (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSaveDelivery(false)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Create Restock Order in SQLite</span>
          </button>
        )}
      </div>
    </div>
  );
};
