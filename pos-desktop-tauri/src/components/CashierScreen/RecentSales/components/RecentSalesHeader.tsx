import React from 'react';
import { X, Receipt as ReceiptIcon, Maximize2, Minimize2 } from 'lucide-react';

interface RecentSalesHeaderProps {
  totalCount: number;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  onClose: () => void;
}

export function RecentSalesHeader({
  totalCount,
  isFullScreen,
  onToggleFullScreen,
  onClose,
}: RecentSalesHeaderProps) {
  return (
    <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-900 flex items-center justify-between bg-white/90 dark:bg-zinc-950/90  shrink-0 transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 rounded-xl">
          <ReceiptIcon size={18} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              AUDITORIA DE TALÕES
            </span>
            <span className="text-slate-300 dark:text-zinc-600">•</span>
            <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
              {totalCount} {totalCount === 1 ? 'Venda' : 'Vendas'}
            </span>
          </div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
            Vendas Recentes & Reimpressão
          </h2>
        </div>
      </div>

      {/* Header Controls (Expand & Close) */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleFullScreen}
          className="p-2 text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-xl transition-colors cursor-pointer"
          title={isFullScreen ? 'Restaurar Tamanho Reduzido' : 'Expandir para Ecrã Completo'}
        >
          {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
        <button
          onClick={onClose}
          className="p-2 text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-xl transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
