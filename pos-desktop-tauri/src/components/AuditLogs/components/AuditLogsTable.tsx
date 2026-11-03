import React, { useRef } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  Cloud, 
  Database, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight,
  Eye,
  User as UserIcon,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { AuditLog, AuditCategory } from '../types';
import { getActionCategory } from '../hooks/useAuditLogs';
import { useAuditsI18n } from '../../../i18n';

// Sync dot indicator matching Gestão de Operadores and Controle de Caixa alignment
export function SyncDot({ status }: { status?: number }) {
  const t = useAuditsI18n();
  if (status === 0) {
    return (
      <span
        className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0 inline-block shadow-xs"
        title={t.syncPendingTooltip || "Registo local pendente de backup na nuvem"}
      />
    );
  }
  return (
    <span
      className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 shrink-0 inline-block opacity-75"
      title={t.syncCloudTooltip || "Sincronizado na nuvem / SQLite"}
    />
  );
}

const getCategoryBadgeStyle = (category: AuditCategory): { bg: string; text: string; border: string } => {
  switch (category) {
    case 'Produtos':
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/30',
        text: 'text-emerald-700 dark:text-emerald-400',
        border: 'border-emerald-200/60 dark:border-emerald-900/30'
      };
    case 'Vendas':
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/30',
        text: 'text-amber-700 dark:text-amber-400',
        border: 'border-amber-200/60 dark:border-amber-900/30'
      };
    case 'Sessão / Login':
      return {
        bg: 'bg-blue-50 dark:bg-blue-950/30',
        text: 'text-blue-700 dark:text-blue-400',
        border: 'border-blue-200/60 dark:border-blue-900/30'
      };
    case 'Operadores & Caixa':
      return {
        bg: 'bg-purple-50 dark:bg-purple-950/30',
        text: 'text-purple-700 dark:text-purple-400',
        border: 'border-purple-200/60 dark:border-purple-900/30'
      };
    case 'Reabastecimento':
      return {
        bg: 'bg-cyan-50 dark:bg-cyan-950/30',
        text: 'text-cyan-700 dark:text-cyan-400',
        border: 'border-cyan-200/60 dark:border-cyan-900/30'
      };
    case 'Comandos IA & App Móvel':
      return {
        bg: 'bg-indigo-50 dark:bg-indigo-950/40',
        text: 'text-indigo-700 dark:text-indigo-400',
        border: 'border-indigo-200/60 dark:border-indigo-900/40'
      };
    default:
      return {
        bg: 'bg-slate-50 dark:bg-zinc-800/40',
        text: 'text-slate-700 dark:text-zinc-300',
        border: 'border-slate-200/60 dark:border-zinc-700/40'
      };
  }
};

interface AuditLogsTableProps {
  logs: AuditLog[];
  loading: boolean;
  userMap: Record<string, string>;
  highlightedLogId: string | null;
  onSelectLog: (id: string) => void;
  onViewDetails: (log: AuditLog) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalFilteredCount: number;
  totalCount: number;
  searchTerm: string;
  selectedCategory: AuditCategory;
}

export function AuditLogsTable({
  logs,
  loading,
  userMap,
  highlightedLogId,
  onSelectLog,
  onViewDetails,
  currentPage,
  totalPages,
  onPageChange,
  totalFilteredCount,
  totalCount,
  searchTerm,
  selectedCategory
}: AuditLogsTableProps) {
  const t = useAuditsI18n();
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const handleRowClick = (log: AuditLog) => {
    onSelectLog(log.id);
  };

  const categoryLabelMap: Record<AuditCategory, string> = {
    'Todos': t.catAll || 'Todos',
    'Comandos IA & App Móvel': 'IA & App Móvel',
    'Produtos': t.catProducts || 'Produtos',
    'Vendas': t.catSales || 'Vendas',
    'Sessão / Login': t.catSessionLogin || 'Sessão / Login',
    'Operadores & Caixa': t.catOperatorsCashier || 'Operadores & Caixa',
    'Reabastecimento': t.catRestock || 'Reabastecimento',
    'Geral': t.catGeneral || 'Geral'
  };

  return (
    <div className="flex-1 bg-white dark:bg-zinc-900 flex flex-col overflow-hidden w-full h-full">
      {/* Table Body Container */}
      <div 
        id="audit-table-container" 
        ref={tableContainerRef} 
        className="flex-1 overflow-y-auto"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400 dark:text-zinc-500">
            <RefreshCw className="animate-spin text-indigo-500 mb-3" size={32} />
            <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">{t.loadingLogs || "A carregar registos de auditoria..."}</p>
          </div>
        ) : totalFilteredCount === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400 dark:text-zinc-500">
            <div className="w-16 h-16 bg-slate-50 dark:bg-zinc-900 rounded-2xl flex items-center justify-center mb-3 border border-slate-200/60 dark:border-white/5">
              <ShieldAlert size={32} className="text-slate-400 dark:text-zinc-500 opacity-60" />
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">
              {searchTerm || selectedCategory !== 'Todos'
                ? (t.noLogsFiltered || 'Nenhum registo encontrado com os filtros aplicados')
                : (t.noLogsSystem || 'Nenhum registo de auditoria no sistema')}
            </p>
            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
              {t.adjustSearchHint || "Tente redefinir os filtros ou alterar os termos da pesquisa."}
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-zinc-900 text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider sticky top-0 z-10">
                <th className="py-3.5 px-6">{t.thLogAction || "Registo / Ação"}</th>
                <th className="py-3.5 px-6">{t.thOperator || "Operador"}</th>
                <th className="py-3.5 px-6">{t.thCategory || "Categoria"}</th>
                <th className="py-3.5 px-6">{t.thOperationDetails || "Detalhes da Operação"}</th>
                <th className="py-3.5 px-6">{t.thDateTime || "Data & Hora"}</th>
                <th className="py-3.5 px-6 text-center">{t.thCloudStatus || "Status Nuvem"}</th>
                <th className="py-3.5 px-6 text-right">{t.thActions || "Ações"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {logs.map((log) => {
                const pageCategory = getActionCategory(log.action);
                const badge = getCategoryBadgeStyle(pageCategory);
                const userName = log.user_name || userMap[log.user_id] || log.user_id || (t.systemOperator || 'Sistema');
                const isHighlighted = highlightedLogId === log.id;

                return (
                  <tr
                    key={log.id}
                    onClick={() => handleRowClick(log)}
                    className={`transition-all duration-150 h-[68px] cursor-pointer group select-none ${
                      isHighlighted
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-l-4 border-l-indigo-600 dark:border-l-indigo-400 font-semibold shadow-2xs'
                        : 'hover:bg-slate-50/70 dark:hover:bg-zinc-800/30'
                    }`}
                  >
                    {/* Registo / ID with SyncDot positioned to the LEFT */}
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-3">
                        <SyncDot status={log.sync_status} />
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold shrink-0 border transition-all ${
                          isHighlighted 
                            ? 'bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500 shadow-xs' 
                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200/60 dark:border-white/5 group-hover:border-indigo-200 dark:group-hover:border-indigo-800'
                        }`}>
                          <ShieldCheck size={16} className={isHighlighted ? 'text-white' : 'text-indigo-500'} />
                        </div>
                        <div className="min-w-0">
                          <div className={`font-bold text-sm truncate max-w-[200px] ${
                            isHighlighted ? 'text-indigo-950 dark:text-indigo-200' : 'text-slate-900 dark:text-zinc-100'
                          }`}>
                            {log.action}
                          </div>
                          <div className="text-[10.5px] font-mono text-slate-400 dark:text-zinc-500">
                            ID: {log.id ? log.id.substring(0, 8) : '---'}...
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Operador Column */}
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 font-bold text-[10px] flex items-center justify-center border border-indigo-200/50 dark:border-indigo-800/40 shrink-0">
                          {userName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-xs text-slate-800 dark:text-zinc-200 block truncate max-w-[130px]">
                            {userName}
                          </span>
                          {log.user_id && log.user_id !== 'system' && (
                            <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                              {log.user_id.substring(0, 8)}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Categoria Badge */}
                    <td className="py-3.5 px-6">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wide uppercase border ${badge.bg} ${badge.text} ${badge.border}`}>
                        {categoryLabelMap[pageCategory] || pageCategory}
                      </span>
                    </td>

                    {/* Detalhes da Operação */}
                    <td className="py-3.5 px-6">
                      <p className="text-xs text-slate-600 dark:text-zinc-300 line-clamp-2 max-w-[320px] font-medium leading-relaxed">
                        {log.details || 'Sem detalhes adicionais.'}
                      </p>
                    </td>

                    {/* Data & Hora Monospace */}
                    <td className="py-3.5 px-6 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400 font-mono">
                        <Clock size={12} className="text-slate-400 dark:text-zinc-500 shrink-0" />
                        <span>{new Date(log.created_at).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      </div>
                    </td>

                    {/* Status Cloud Column */}
                    <td className="py-3.5 px-6 text-center whitespace-nowrap">
                      {log.sync_status === 1 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                          <Cloud size={11} /> {t.syncedCloudLabel || "Sincronizado na nuvem"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200/60 dark:border-zinc-700/40">
                          <Database size={11} /> {t.storedSqliteLabel || "Armazenado no SQLite"}
                        </span>
                      )}
                    </td>

                    {/* Ações */}
                    <td className="py-3.5 px-6 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectLog(log.id);
                          onViewDetails(log);
                        }}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 flex items-center gap-1.5 ml-auto ${
                          isHighlighted
                            ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                            : 'border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`}
                        title={t.viewDetailsTooltip || "Ver detalhes do registo de auditoria"}
                      >
                        <Eye size={12} />
                        <span>{t.modalDetailTitle ? t.modalDetailTitle.split(' ')[0] + ' ' + (t.modalDetailTitle.split(' ')[1] || '') : 'Ver Detalhes'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer Pagination Controls */}
      <footer className="px-6 py-3 bg-white dark:bg-zinc-900 border-t border-slate-200/60 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
        <div className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
          {t.paginationShowing || "A mostrar"} <strong className="text-slate-800 dark:text-zinc-200">{totalFilteredCount > 0 ? (currentPage - 1) * 12 + 1 : 0}</strong> {t.paginationTo || "a"}{' '}
          <strong className="text-slate-800 dark:text-zinc-200">{Math.min(currentPage * 12, totalFilteredCount)}</strong> {t.paginationOf || "de"}{' '}
          <strong className="text-slate-800 dark:text-zinc-200">{totalFilteredCount}</strong> {t.paginationRecords || "registos"}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onPageChange(Math.max(1, currentPage - 1));
                if (tableContainerRef.current) tableContainerRef.current.scrollTop = 0;
              }}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-xs font-bold shadow-xs cursor-pointer"
            >
              {t.prevBtn || "Anterior"}
            </button>
            <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 px-2 font-mono">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => {
                onPageChange(Math.min(totalPages, currentPage + 1));
                if (tableContainerRef.current) tableContainerRef.current.scrollTop = 0;
              }}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-xs font-bold shadow-xs cursor-pointer"
            >
              {t.nextBtn || "Seguinte"}
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}
