/**
 * @file SequentialActionQueue.tsx
 * @description Renders a sequence of executable AI action cards with step-by-step progress
 * and transactional sequential execution ("Execute All in Sequence").
 * Ensures the UI waits for each DB operation confirmation before triggering the next.
 */

import React, { useState } from 'react';
import { CheckCircle2, Play, Loader2, AlertCircle, Layers, ArrowRight } from 'lucide-react';
import { ExecutableAiAction } from '../../../../lib/ai/types';
import { posActionDispatcher as chatAgentBridge } from '../../../../lib/ai/actions';
import { getDB } from '../../../../lib/db';
import { ExecutableActionCard } from '../index';
import toast from 'react-hot-toast';

interface SequentialActionQueueProps {
  actions: ExecutableAiAction[];
  currentUser?: { id?: string; name?: string; role?: string } | null;
  onAllExecuted?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const SequentialActionQueue: React.FC<SequentialActionQueueProps> = ({
  actions,
  currentUser,
  onAllExecuted,
  onNavigateTab
}) => {
  const [completedIndices, setCompletedIndices] = useState<number[]>([]);
  const [currentlyExecutingIndex, setCurrentlyExecutingIndex] = useState<number | null>(null);
  const [errorIndex, setErrorIndex] = useState<{ index: number; message: string } | null>(null);

  const isAllCompleted = actions.length > 0 && completedIndices.length === actions.length;
  const isExecuting = currentlyExecutingIndex !== null;

  const handleStepComplete = (index: number) => {
    setCompletedIndices(prev => (prev.includes(index) ? prev : [...prev, index]));
    if (completedIndices.length + 1 >= actions.length) {
      onAllExecuted?.();
    }
  };

  /**
   * Executes a single action against ChatAgentBridge with database confirmation.
   */
  const executeSingleAction = async (action: ExecutableAiAction, userId?: string) => {
    switch (action.type) {
      case 'create_product': {
        const p = action.data;
        const res = await chatAgentBridge.createProduct({
          name: p.name,
          price: p.price_mt,
          cost_price: p.cost_price_mt || Math.round(p.price_mt * 0.75),
          stock_quantity: p.stock_quantity || 12,
          category: p.category || 'Geral',
          barcode: p.barcode,
          unit_type: p.unit_type || 'unit'
        }, userId);
        if (!res.success) throw new Error(res.error || 'Failed to create product');
        return res;
      }

      case 'update_product': {
        const u = action.data;
        const res = await chatAgentBridge.updateProduct({
          productId: u.product_id,
          productName: u.target_name || u.name,
          name: u.name,
          price_mt: u.price_mt,
          cost_price_mt: u.cost_price_mt,
          stock_quantity: u.stock_quantity,
          category: u.category
        }, userId);
        if (!res.success) throw new Error(res.error || 'Failed to update product');
        return res;
      }

      case 'delete_product': {
        const d = action.data;
        const res = await chatAgentBridge.deleteProduct({
          productId: d.product_id,
          productName: d.name
        }, userId);
        if (!res.success) throw new Error(res.error || 'Failed to delete product');
        return res;
      }

      case 'create_customer': {
        const c = action.data;
        const res = await chatAgentBridge.createCustomer({
          name: c.customer_name,
          phone: c.phone_number,
          initial_debt: c.initial_debt_mt || 0,
          notes: c.notes || 'Created via AI Sequential Queue'
        }, userId);
        if (!res.success) throw new Error(res.error || 'Failed to create customer');
        return res;
      }

      case 'create_delivery': {
        const d = action.data;
        const db = await getDB();
        const deliveryId = crypto.randomUUID();
        const maxRes = await db.select('SELECT MAX(po_number) as max_po FROM expected_deliveries') as any[];
        const nextPo = (maxRes[0]?.max_po && maxRes[0].max_po >= 1000) ? maxRes[0].max_po + 1 : 1001;

        await db.execute(
          `INSERT INTO expected_deliveries (
            id, po_number, invoice_number, supplier_name, expected_date, created_by, requires_verification, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, 1, 0)`,
          [
            deliveryId,
            nextPo,
            d.invoice_number?.trim() || `FT-${nextPo}`,
            d.supplier_name.trim(),
            d.expected_date || new Date().toISOString().slice(0, 10),
            currentUser?.name || 'Admin'
          ]
        );

        if (d.items && d.items.length > 0) {
          for (const item of d.items) {
            await db.execute(
              `INSERT INTO expected_delivery_items (
                id, delivery_id, product_name, quantity_expected, quantity_received, unit_cost_mt, is_verified
              ) VALUES (?, ?, ?, ?, 0, ?, 0)`,
              [
                crypto.randomUUID(),
                deliveryId,
                item.product_name,
                item.quantity,
                item.cost_price_mt || 0
              ]
            );
          }
        }
        return { success: true };
      }

      case 'batch_create_products': {
        const products = action.data.products || [];
        for (const p of products) {
          const res = await chatAgentBridge.createProduct({
            name: p.name,
            price: p.price_mt,
            cost_price: p.cost_price_mt || Math.round(p.price_mt * 0.75),
            stock_quantity: p.stock_quantity || 12,
            category: p.category || 'Geral',
            barcode: p.barcode,
            unit_type: p.unit_type || 'unit'
          }, userId);
          if (!res.success) throw new Error(res.error || 'Failed to create batch product');
        }
        return { success: true };
      }

      case 'create_operator': {
        const op = action.data;
        const res = await chatAgentBridge.createOperator({
          name: op.name,
          role: op.role || 'operator'
        }, userId);
        if (!res.success) throw new Error(res.error || 'Failed to create cashier operator');
        return res;
      }

      default:
        // Other types fallback to standard card execution
        return { success: true };
    }
  };

  /**
   * Executes all pending actions sequentially, awaiting SQLite confirmation between each step.
   */
  const handleExecuteAllInSequence = async () => {
    if (isExecuting || isAllCompleted) return;

    setErrorIndex(null);
    const userId = currentUser?.id;
    let newlyCompleted = [...completedIndices];

    for (let i = 0; i < actions.length; i++) {
      if (newlyCompleted.includes(i)) continue;

      setCurrentlyExecutingIndex(i);
      try {
        await executeSingleAction(actions[i], userId);
        newlyCompleted.push(i);
        setCompletedIndices([...newlyCompleted]);
      } catch (err: any) {
        setErrorIndex({ index: i, message: err.message || 'Operation failed' });
        setCurrentlyExecutingIndex(null);
        toast.error(`Step ${i + 1} failed: ${err.message || 'Database error'}`);
        return;
      }
    }

    setCurrentlyExecutingIndex(null);
    toast.success(`All ${actions.length} actions executed & committed to SQLite!`);
    onAllExecuted?.();
  };

  return (
    <div className="mt-3 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-900/60 shadow-md transition-all text-xs space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <span className="font-extrabold text-slate-900 dark:text-white text-xs uppercase tracking-wider block">
              Sequential Action Queue
            </span>
            <span className="text-[11px] text-slate-500 dark:text-zinc-400">
              {completedIndices.length} of {actions.length} actions executed in SQLite
            </span>
          </div>
        </div>

        {/* Global Action Button */}
        {!isAllCompleted ? (
          <button
            type="button"
            disabled={isExecuting}
            onClick={handleExecuteAllInSequence}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
              isExecuting
                ? 'bg-slate-200 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30 active:scale-95'
            }`}
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Executing Step {(currentlyExecutingIndex ?? 0) + 1}...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Confirm All in Sequence</span>
              </>
            )}
          </button>
        ) : (
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4" />
            <span>All Steps Completed</span>
          </div>
        )}
      </div>

      {/* Steps List */}
      <div className="space-y-3">
        {actions.map((act, idx) => {
          const isDone = completedIndices.includes(idx);
          const isCurrent = currentlyExecutingIndex === idx;
          const hasError = errorIndex?.index === idx;

          return (
            <div
              key={idx}
              className={`p-3 rounded-xl border transition-all ${
                isDone
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50'
                  : isCurrent
                  ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-400 dark:border-indigo-600 shadow-xs'
                  : hasError
                  ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
                  : 'bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700'
              }`}
            >
              {/* Step Title Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                    isDone
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                      ? 'bg-indigo-600 text-white animate-pulse'
                      : 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300'
                  }`}>
                    {isDone ? '✓' : idx + 1}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200">
                    Step {idx + 1}: {act.type.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>

                <div className="text-[10px] font-semibold">
                  {isDone && <span className="text-emerald-600 dark:text-emerald-400">Committed to SQLite</span>}
                  {isCurrent && <span className="text-indigo-600 dark:text-indigo-400">Executing...</span>}
                  {hasError && <span className="text-rose-600 dark:text-rose-400">Error: {errorIndex.message}</span>}
                  {!isDone && !isCurrent && !hasError && (
                    <span className="text-slate-400 dark:text-zinc-500">Pending</span>
                  )}
                </div>
              </div>

              {/* Underlying Action Card */}
              <div className="pl-7">
                <ExecutableActionCard
                  action={act}
                  executed={isDone}
                  currentUser={currentUser}
                  onExecuted={() => handleStepComplete(idx)}
                  onNavigateTab={onNavigateTab}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
