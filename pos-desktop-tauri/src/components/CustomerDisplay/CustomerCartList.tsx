/**
 * @file CustomerCartList.tsx
 * @description Customer-facing live cart item list with real-time scan animation and totals in Meticais (MT).
 */

import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, Tag, CheckCircle2, Sparkles, Coins } from 'lucide-react';
import { CustomerCartItem, CustomerDisplayState } from '../../lib/customerDisplay/types';
import { formatCurrency } from '../../lib/utils';
import { useI18n } from '../../i18n';

interface CustomerCartListProps {
  state: CustomerDisplayState;
}

export function CustomerCartList({ state }: CustomerCartListProps) {
  const t = useI18n();
  const { cart, subtotal_mt, tax_mt, discount_mt, total_mt, status, amount_paid_mt, change_due_mt, last_scanned_id } = state;
  const listEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll as cashier scans items
  useEffect(() => {
    if (cart.length > 0) {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [cart.length, last_scanned_id]);

  const isCheckoutCompleted = status === 'sale_completed';
  const isPaymentProcessing = status === 'payment_processing';
  const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-xl overflow-hidden">
      {/* Top Cart Header */}
      <div className="px-6 py-4 bg-slate-50/80 dark:bg-zinc-950/60 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
            <ShoppingBag size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
              {t.yourItems || 'Os Seus Artigos'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
              {cart.length === 0 
                ? (t.waitingFirstItem || 'Aguardando o registo do primeiro artigo...')
                : `${totalItemCount} ${totalItemCount === 1 ? (t.itemsRegisteredSingular || 'artigo registado') : (t.itemsRegisteredPlural || 'artigos registados')}`
              }
            </p>
          </div>
        </div>

        {/* Live Status Pill */}
        <div className="flex items-center gap-2">
          {isCheckoutCompleted ? (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-bold border border-emerald-300 dark:border-emerald-800 animate-pulse">
              <CheckCircle2 size={14} /> {t.saleCompleted || 'Venda Concluída'}
            </span>
          ) : isPaymentProcessing ? (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded-full text-xs font-bold border border-amber-300 dark:border-amber-800">
              <Coins size={14} /> {t.paymentProcessing || 'Pagamento a Decorrer'}
            </span>
          ) : cart.length > 0 ? (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-bold border border-indigo-200 dark:border-zinc-700">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" /> {t.itemScanning || 'Em Registo'}
            </span>
          ) : (
            <span className="px-3 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 rounded-full text-xs font-medium">
              {t.cartIdle || 'Livre'}
            </span>
          )}
        </div>
      </div>

      {/* Cart Items Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 dark:text-zinc-500">
            <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-4 text-slate-300 dark:text-zinc-600">
              <ShoppingBag size={40} />
            </div>
            <h3 className="text-lg font-bold text-slate-700 dark:text-zinc-300 mb-1">
              {t.welcomeToCounter || 'Bem-vindo ao Balcão!'}
            </h3>
            <p className="text-sm max-w-xs text-slate-500 dark:text-zinc-400">
              {t.welcomeToCounterDesc || 'Os seus produtos e os preços em Meticais serão apresentados aqui à medida que o operador os regista.'}
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {cart.map((item, index) => {
              const isLatest = item.id === last_scanned_id || index === cart.length - 1;
              const hasDiscount = (item.original_price_mt && item.original_price_mt > item.price_mt) || (item.discount_value && item.discount_value > 0);

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 15, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                    isLatest
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-800 shadow-sm'
                      : 'bg-white dark:bg-zinc-950/40 border-slate-200 dark:border-zinc-800/80 hover:border-slate-300'
                  }`}
                >
                  {/* Left: Product Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-slate-900 dark:text-white truncate">
                        {item.name}
                      </h4>
                      {isLatest && (
                        <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-full tracking-wider animate-pulse">
                          {t.newScannedItem || 'Novo'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-zinc-400">
                      <span className="font-semibold text-slate-700 dark:text-zinc-300">
                        {item.quantity} × {formatCurrency(item.price_mt)}
                      </span>
                      {hasDiscount && (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                          <Tag size={12} /> {t.savingsApplied || 'Poupança aplicada'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Subtotal */}
                  <div className="text-right shrink-0">
                    <div className="text-lg font-black text-slate-900 dark:text-white font-mono">
                      {formatCurrency(item.subtotal_mt)}
                    </div>
                    {item.original_price_mt && item.original_price_mt > item.price_mt && (
                      <div className="text-xs line-through text-slate-400 dark:text-zinc-500 font-mono">
                        {formatCurrency(item.original_price_mt * item.quantity)}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={listEndRef} />
      </div>

      {/* Bottom Summary & Total Box */}
      <div className="p-6 bg-slate-50/90 dark:bg-zinc-950/80 border-t border-slate-200 dark:border-zinc-800">
        <div className="space-y-2 mb-4 text-sm">
          <div className="flex justify-between text-slate-500 dark:text-zinc-400 font-medium">
            <span>{t.subtotalLabel || 'Subtotal:'}</span>
            <span className="font-mono font-bold text-slate-700 dark:text-zinc-300">{formatCurrency(subtotal_mt)}</span>
          </div>

          {discount_mt > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
              <span className="flex items-center gap-1.5"><Sparkles size={14} /> {t.totalDiscountsLabel || 'Total de Descontos:'}</span>
              <span className="font-mono">-{formatCurrency(discount_mt)}</span>
            </div>
          )}

          {tax_mt > 0 && (
            <div className="flex justify-between text-slate-400 dark:text-zinc-500 text-xs">
              <span>{t.taxIncludedLabel || 'IVA Incluído (16%):'}</span>
              <span className="font-mono">{formatCurrency(tax_mt)}</span>
            </div>
          )}
        </div>

        {/* Big Total Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white shadow-xl flex items-center justify-between border border-indigo-700/40">
          <div>
            <span className="text-xs uppercase font-bold text-indigo-300 tracking-wider">
              {t.totalDueLabel || 'Total a Pagar'}
            </span>
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white mt-0.5">
              {formatCurrency(total_mt)}
            </div>
          </div>

          <div className="text-right">
            <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-semibold text-indigo-200">
              {t.currencyMeticais || 'Moeda: Meticais (MT)'}
            </span>
          </div>
        </div>

        {/* Change due pill if paid / finished */}
        {change_due_mt !== undefined && change_due_mt > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 flex items-center justify-between text-emerald-800 dark:text-emerald-300"
          >
            <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
              <Coins size={16} /> {t.changeDueLabel || 'Troco a Devolver:'}
            </span>
            <span className="text-xl font-black font-mono">
              {formatCurrency(change_due_mt)}
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
