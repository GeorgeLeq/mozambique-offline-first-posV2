/**
 * @file CustomerActionCard.tsx
 * @description UI presentation component for Customer and Fiado Debt CRUD actions via AI.
 */

import React from 'react';
import { UserPlus, Edit3, Trash2, CheckCircle2, Save, Loader2, AlertTriangle } from 'lucide-react';
import { ExecutableAiAction } from '../../../../lib/ai/storeSentinelClient';
import { useCustomerCard } from '../hooks/useCustomerCard';

type CustomerAction = Extract<ExecutableAiAction, { type: 'create_customer' | 'update_customer' | 'delete_customer' }>;

interface CustomerActionCardProps {
  action: CustomerAction;
  executed?: boolean;
  autoSaveEnabled: boolean;
  currentUser?: { id?: string; name?: string; role?: string } | null;
  onExecuted: () => void;
}

export const CustomerActionCard: React.FC<CustomerActionCardProps> = (props) => {
  const { action } = props;
  const {
    isDone,
    isSubmitting,
    autoSavedNotice,
    custName,
    setCustName,
    custPhone,
    setCustPhone,
    custAddress,
    setCustAddress,
    custDebt,
    setCustDebt,
    handleSaveCustomer
  } = useCustomerCard(props);

  const isDelete = action.type === 'delete_customer';
  const isUpdate = action.type === 'update_customer';

  if (isDelete) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-rose-200 dark:border-rose-950 pb-2">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold">
            <Trash2 className="w-4 h-4" />
            <span>Remove Customer from System</span>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            Critical Action
          </span>
        </div>

        <div className="p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs">
            <p className="font-bold text-slate-800 dark:text-zinc-200">
              Do you want to archive customer record: <span className="text-rose-600 dark:text-rose-400 font-extrabold">{action.data.customer_name}</span>?
            </p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              The customer will be archived in SQLite with debt ledger and payment history intact.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-slate-400 dark:text-zinc-500">
            {isDone ? 'Customer archived in SQLite.' : 'Requires operator confirmation.'}
          </span>

          {!isDone ? (
            <button
              onClick={() => handleSaveCustomer(false)}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
          {isUpdate ? <Edit3 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          <span>{isUpdate ? 'Update Customer Record' : 'Customer & Fiado Credit Register (SQLite)'}</span>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          {isUpdate ? 'Modify' : 'New Customer'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            Customer Name
          </label>
          <input
            type="text"
            disabled={isDone}
            value={custName}
            onChange={e => setCustName(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-amber-500 outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            Phone Contact
          </label>
          <input
            type="text"
            disabled={isDone}
            value={custPhone}
            onChange={e => setCustPhone(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-amber-500 outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            Address / Neighborhood
          </label>
          <input
            type="text"
            disabled={isDone}
            value={custAddress}
            onChange={e => setCustAddress(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-amber-500 outline-none"
          />
        </div>

        {!isUpdate && (
          <div>
            <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
              Initial Debt (Fiado MT)
            </label>
            <input
              type="number"
              disabled={isDone}
              value={custDebt}
              onChange={e => setCustDebt(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-mono font-bold focus:ring-1 focus:ring-amber-500 outline-none"
            />
          </div>
        )}
      </div>

      <div className="pt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-500 dark:text-zinc-400">
          {isDone ? (autoSavedNotice ? '⚡ Auto-saved to local SQLite.' : 'Saved to SQLite successfully.') : 'Review details and confirm.'}
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
            onClick={() => handleSaveCustomer(false)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isUpdate ? 'Update Customer' : 'Register Customer in SQLite'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
