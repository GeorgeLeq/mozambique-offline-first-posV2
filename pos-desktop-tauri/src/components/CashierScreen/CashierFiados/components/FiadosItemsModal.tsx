import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  X, 
  Printer, 
  Calendar, 
  User, 
  Receipt,
  ChevronLeft,
  ChevronRight,
  PackageCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getDB } from '../../../../lib/db';
import { formatCurrency } from '../../../../lib/utils';
import { spoolJob } from '../../../../lib/printSpooler';
import { DebtRecord } from '../../../ClientManager/types';
import { FiadoItemDetail } from '../types';

interface FiadosItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  debt: DebtRecord | null;
  currentUser: any;
}

export function FiadosItemsModal({
  isOpen,
  onClose,
  debt,
  currentUser,
}: FiadosItemsModalProps) {
  const [items, setItems] = useState<FiadoItemDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Load items from SQLite based on receipt_id or items_json or sale_id
  useEffect(() => {
    async function loadFiadoItems() {
      if (!debt) {
        setItems([]);
        return;
      }

      setLoading(true);
      setCurrentPage(1);

      try {
        // 1. Check if debt has items_json
        if (debt.items_json) {
          try {
            const parsed = JSON.parse(debt.items_json);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const mapped: FiadoItemDetail[] = parsed.map((it: any, idx: number) => ({
                id: it.id || it.product_id || idx,
                product_id: it.product_id,
                product_name: it.product_name || it.name || 'Artigo sem descrição',
                barcode: it.barcode || '',
                quantity: Number(it.quantity) || 1,
                price: Number(it.price) || (Number(it.total_mt || it.total) / (Number(it.quantity) || 1)),
                total_mt: Number(it.total_mt || it.total) || 0,
              }));
              setItems(mapped);
              setLoading(false);
              return;
            }
          } catch (e) {
            console.warn('Failed to parse items_json:', e);
          }
        }

        // 2. Query sales table
        const db = await getDB();
        const saleKey = debt.receipt_id || debt.id;

        const salesRows = await db.select(
          `SELECT s.*, p.name as product_name, p.barcode as product_barcode
           FROM sales s
           LEFT JOIN products p ON s.product_id = p.id
           WHERE s.receipt_id = ? OR s.id = ?
           ORDER BY s.id ASC`,
          [saleKey, saleKey]
        ) as any[];

        if (salesRows && salesRows.length > 0) {
          const mapped: FiadoItemDetail[] = salesRows.map(row => {
            const qty = Math.abs(Number(row.quantity) || 1);
            const total = Math.abs(Number(row.total_mt) || 0);
            const unitPrice = Number(row.price) || (total / (qty || 1));
            return {
              id: row.id,
              product_id: row.product_id,
              product_name: row.product_name || 'Artigo sem descrição',
              barcode: row.product_barcode || '',
              quantity: qty,
              price: unitPrice,
              total_mt: total,
            };
          });
          setItems(mapped);
        } else {
          // If no specific multi-item sales rows found
          setItems([
            {
              id: debt.id,
              product_name: 'Crédito em Conta Corrente',
              quantity: 1,
              price: Number(debt.amount_mt) || 0,
              total_mt: Number(debt.amount_mt) || 0,
            }
          ]);
        }
      } catch (err) {
        console.error('Error loading fiado items:', err);
        setItems([
          {
            id: debt.id,
            product_name: 'Crédito em Conta Corrente',
            quantity: 1,
            price: Number(debt.amount_mt) || 0,
            total_mt: Number(debt.amount_mt) || 0,
          }
        ]);
      } finally {
        setLoading(false);
      }
    }

    if (isOpen && debt) {
      loadFiadoItems();
    } else {
      setItems([]);
    }
  }, [isOpen, debt]);

  // Pagination calculations (No scroll, strictly page buttons)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  const totalCalculatedValue = useMemo(() => {
    return items.reduce((sum, item) => sum + item.total_mt, 0);
  }, [items]);

  // Thermal reprint of fiado items voucher
  const handlePrintFiadoVoucher = () => {
    if (!debt) return;
    try {
      const receiptData = {
        shopName: localStorage.getItem('receipt_header_title') || 'SmartPOS',
        receiptId: `FIADO-${String(debt.id).substring(0, 8).toUpperCase()}`,
        date: debt.created_at,
        cashierName: debt.cashier_name || currentUser?.name || 'Caixa',
        customerName: debt.customer_name,
        customerPhone: debt.phone_number || '',
        items: items.map(i => ({
          name: i.product_name,
          quantity: i.quantity,
          price: i.price,
          total: i.total_mt
        })),
        totalDue: totalCalculatedValue || debt.amount_mt,
        paymentMethod: 'FIADO (CRÉDITO)',
        status: debt.status === 'paid' ? 'LIQUIDADO / PAGO' : 'PENDENTE DE PAGAMENTO'
      };
      spoolJob(`Comprovativo Fiado - ${debt.customer_name}`, 'receipt', receiptData);
      toast.success('Comprovativo enviado para a impressora!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao imprimir comprovativo');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && debt && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/85  animate-fade-in">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="w-full max-w-xl bg-white dark:bg-zinc-950 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-white select-none transition-colors"
            id="fiados-items-modal"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-900 flex items-center justify-between bg-slate-50 dark:bg-zinc-950/90 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 rounded-xl">
                  <ShoppingBag size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      DETALHES DO FIADO
                    </span>
                    <span className="text-slate-300 dark:text-zinc-600">•</span>
                    <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
                      {items.length} {items.length === 1 ? 'Artigo' : 'Artigos'}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                    Artigos de {debt.customer_name}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintFiadoVoucher}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-indigo-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  title="Imprimir Comprovativo de Artigos"
                  id="print-fiado-items-btn"
                >
                  <Printer size={13} />
                  <span>Imprimir</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-xl transition-colors cursor-pointer"
                  id="close-fiado-items-btn"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Meta Info Bar */}
            <div className="grid grid-cols-3 gap-2 px-6 py-3 bg-slate-50/80 dark:bg-zinc-900/40 border-b border-slate-200 dark:border-zinc-900 text-xs shrink-0">
              <div>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold block">Data Registo</span>
                <span className="text-slate-700 dark:text-zinc-300 font-mono flex items-center gap-1 mt-0.5">
                  <Calendar size={11} className="text-indigo-500 dark:text-indigo-400" />
                  {new Date(debt.created_at).toLocaleDateString('pt-MZ')}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold block">Atendido por</span>
                <span className="text-slate-700 dark:text-zinc-300 flex items-center gap-1 mt-0.5 truncate">
                  <User size={11} className="text-indigo-500 dark:text-indigo-400" />
                  {debt.cashier_name || 'Caixa'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold block">Valor Original</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-mono font-black text-sm block mt-0.5">
                  {formatCurrency(debt.amount_mt)} MT
                </span>
              </div>
            </div>

            {/* Non-scrolling Paginated Table */}
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-3 pb-2.5 border-b border-slate-200 dark:border-zinc-900 text-[10px] font-bold text-slate-400 dark:text-zinc-400 uppercase tracking-wider select-none">
                  <div className="col-span-6">Artigo / Produto</div>
                  <div className="col-span-2 text-center">Qtd</div>
                  <div className="col-span-2 text-right">P. Unitário</div>
                  <div className="col-span-2 text-right">Subtotal</div>
                </div>

                {/* Table Rows (Fixed slots without scrollbar) */}
                <div className="divide-y divide-slate-100 dark:divide-zinc-900/60 min-h-[220px]">
                  {loading ? (
                    <div className="flex items-center justify-center h-[220px] text-slate-400 dark:text-zinc-500 text-xs font-bold">
                      A carregar artigos...
                    </div>
                  ) : paginatedItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[220px] text-slate-400 dark:text-zinc-500 text-xs">
                      <Receipt size={24} className="mb-1 text-slate-400 dark:text-zinc-600" />
                      Nenhum item associado.
                    </div>
                  ) : (
                    paginatedItems.map((item, idx) => (
                      <div key={item.id || idx} className="grid grid-cols-12 gap-3 items-center py-2.5 text-xs">
                        <div className="col-span-6 min-w-0">
                          <div className="font-bold text-slate-800 dark:text-zinc-200 truncate">{item.product_name}</div>
                          {item.barcode && (
                            <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">{item.barcode}</span>
                          )}
                        </div>
                        <div className="col-span-2 text-center font-mono font-bold text-slate-700 dark:text-zinc-300">
                          {item.quantity}x
                        </div>
                        <div className="col-span-2 text-right font-mono text-slate-500 dark:text-zinc-400">
                          {formatCurrency(item.price)}
                        </div>
                        <div className="col-span-2 text-right font-mono font-black text-indigo-600 dark:text-indigo-400">
                          {formatCurrency(item.total_mt)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Fixed Pagination Controls (No scroll) */}
              <div className="pt-4 border-t border-slate-200 dark:border-zinc-900 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 shrink-0">
                <div className="flex items-center gap-1.5">
                  <PackageCheck size={14} className="text-emerald-500 dark:text-emerald-400" />
                  <span>
                    Artigos <span className="font-bold text-slate-800 dark:text-zinc-200">{(currentPage - 1) * pageSize + 1}</span> a <span className="font-bold text-slate-800 dark:text-zinc-200">{Math.min(currentPage * pageSize, items.length)}</span> de <span className="font-bold text-slate-800 dark:text-zinc-200">{items.length}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1 || loading}
                    className="p-1.5 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-850 rounded-lg text-slate-700 dark:text-zinc-300 disabled:opacity-30 cursor-pointer transition-colors"
                    id="prev-fiado-items-page-btn"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="font-mono font-bold px-2 text-slate-800 dark:text-zinc-200">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages || loading}
                    className="p-1.5 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-850 rounded-lg text-slate-700 dark:text-zinc-300 disabled:opacity-30 cursor-pointer transition-colors"
                    id="next-fiado-items-page-btn"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Footer Summary */}
            <div className="px-6 py-3.5 bg-slate-50 dark:bg-zinc-900/60 border-t border-slate-200 dark:border-zinc-900 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Estado:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  debt.status === 'paid'
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                    : 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20'
                }`}>
                  {debt.status === 'paid' ? 'Pago / Liquidado' : 'Em Aberto (Fiado)'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase">Total Geral:</span>
                <span className="text-base font-black font-mono text-indigo-600 dark:text-indigo-400">
                  {formatCurrency(totalCalculatedValue || debt.amount_mt)} MT
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
