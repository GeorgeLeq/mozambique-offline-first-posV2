/**
 * @file OperatorActionCard.tsx
 * @description UI presentation component for Operator and Cashier CRUD actions via AI.
 */

import React from 'react';
import { UserCheck, UserPlus, Edit3, Trash2, CheckCircle2, Save, Loader2, AlertTriangle, Shield } from 'lucide-react';
import { ExecutableAiAction } from '../../../../lib/ai/storeSentinelClient';
import { useOperatorCard } from '../hooks/useOperatorCard';

type OperatorAction = Extract<ExecutableAiAction, { type: 'create_operator' | 'update_operator' | 'delete_operator' }>;

interface OperatorActionCardProps {
  action: OperatorAction;
  executed?: boolean;
  autoSaveEnabled: boolean;
  currentUser?: { id?: string; name?: string; role?: string } | null;
  onExecuted: () => void;
}

export const OperatorActionCard: React.FC<OperatorActionCardProps> = (props) => {
  const { action } = props;
  const {
    isDone,
    isSubmitting,
    autoSavedNotice,
    opName,
    setOpName,
    opPin,
    setOpPin,
    opRole,
    setOpRole,
    opTerminal,
    setOpTerminal,
    opBlocked,
    setOpBlocked,
    handleSaveOperator
  } = useOperatorCard(props);

  const isDelete = action.type === 'delete_operator';
  const isUpdate = action.type === 'update_operator';

  if (isDelete) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-rose-200 dark:border-rose-950 pb-2">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold">
            <Trash2 className="w-4 h-4" />
            <span>Remove Operator from System</span>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            Critical Action
          </span>
        </div>

        <div className="p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs">
            <p className="font-bold text-slate-800 dark:text-zinc-200">
              Do you want to archive operator: <span className="text-rose-600 dark:text-rose-400 font-extrabold">{action.data.name}</span>?
            </p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              The operator will be deactivated in SQLite with session and audit records preserved.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-slate-400 dark:text-zinc-500">
            {isDone ? 'Operator deactivated in SQLite.' : 'Requires administrator confirmation.'}
          </span>

          {!isDone ? (
            <button
              onClick={() => handleSaveOperator(false)}
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
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold">
          {isUpdate ? <Edit3 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          <span>{isUpdate ? 'Update Operator / Cashier' : 'Operator / Cashier Register (SQLite)'}</span>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
          {isUpdate ? 'Modify' : 'New User'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            Operator Name
          </label>
          <input
            type="text"
            disabled={isDone}
            value={opName}
            onChange={e => setOpName(e.target.value)}
            placeholder="e.g. Maria Silva"
            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            PIN Code (4-6 Digits)
          </label>
          <input
            type="text"
            maxLength={6}
            disabled={isDone}
            value={opPin}
            onChange={e => setOpPin(e.target.value)}
            placeholder="1234"
            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-mono font-bold tracking-widest focus:ring-1 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            Role / Permission
          </label>
          <select
            disabled={isDone}
            value={opRole}
            onChange={e => setOpRole(e.target.value as any)}
            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
          >
            <option value="operator">Cashier / Operator</option>
            <option value="manager">Store Manager</option>
            <option value="admin">Administrator</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            Assigned Terminal
          </label>
          <input
            type="text"
            disabled={isDone}
            value={opTerminal}
            onChange={e => setOpTerminal(e.target.value)}
            placeholder="e.g. POS Master 1"
            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-indigo-500 outline-none"
          />
        </div>

        {isUpdate && (
          <div className="sm:col-span-2 flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="blockOperatorCheck"
              disabled={isDone}
              checked={opBlocked}
              onChange={e => setOpBlocked(e.target.checked)}
              className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
            />
            <label htmlFor="blockOperatorCheck" className="text-xs font-semibold text-rose-600 dark:text-rose-400 cursor-pointer">
              Block this operator from terminal access
            </label>
          </div>
        )}
      </div>

      <div className="pt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-500 dark:text-zinc-400">
          {isDone ? (autoSavedNotice ? '⚡ Auto-saved to local SQLite.' : 'Saved to SQLite successfully.') : 'Review details and confirm registration.'}
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
            onClick={() => handleSaveOperator(false)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isUpdate ? 'Update Operator' : 'Register Operator in SQLite'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
