import React from 'react';
import { useCustomersI18n } from '../../i18n';

interface ClientLedgerPaginationProps {
  totalPages: number;
  currentPage: number;
  setCurrentPage: (page: number | ((prev: number) => number)) => void;
  itemsPerPage: number;
  totalItems: number;
}

export const ClientLedgerPagination: React.FC<ClientLedgerPaginationProps> = ({
  totalPages,
  currentPage,
  setCurrentPage,
  itemsPerPage,
  totalItems,
}) => {
  const t = useCustomersI18n();

  return (
    <div className="border-t border-slate-150 dark:border-zinc-850 p-5 flex flex-col sm:flex-row justify-between items-center bg-slate-50/50 dark:bg-zinc-950/40 gap-4">
      <span className="text-xs text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider">
        {t.showing || 'A mostrar'} {((currentPage - 1) * itemsPerPage) + 1} {t.to || 'a'} {Math.min(currentPage * itemsPerPage, totalItems)} {t.of || 'de'} {totalItems} {t.records || 'registos'}
      </span>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider border border-slate-200 dark:border-zinc-855 bg-white dark:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-zinc-850 text-slate-600 dark:text-zinc-400 transition-all active:scale-95 duration-200"
        >
          {t.prev || 'Anterior'}
        </button>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i + 1)}
              className={`w-9 h-9 rounded-xl text-xs font-black transition-all duration-200 ${
                currentPage === i + 1 
                  ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/15'
                  : 'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-850'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <button
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className="px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider border border-slate-200 dark:border-zinc-855 bg-white dark:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-zinc-850 text-slate-600 dark:text-zinc-400 transition-all active:scale-95 duration-200"
        >
          {t.next || 'Seguinte'}
        </button>
      </div>
    </div>
  );
};

