import React from 'react';
import { Search, X, Calendar, BarChart3, ChevronUp, ChevronDown } from 'lucide-react';
import { AuditCategory, AuditDateRange } from '../types';
import { useAuditsI18n } from '../../../i18n';

interface AuditLogsToolbarProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  selectedCategory: AuditCategory;
  setSelectedCategory: (cat: AuditCategory) => void;
  dateRange: AuditDateRange;
  setDateRange: (range: AuditDateRange) => void;
  categoryCounts: Record<string, number>;
  showSummaryCards: boolean;
  onToggleSummaryCards: () => void;
}

export function AuditLogsToolbar({
  searchTerm,
  setSearchTerm,
  selectedCategory,
  setSelectedCategory,
  dateRange,
  setDateRange,
  categoryCounts,
  showSummaryCards,
  onToggleSummaryCards
}: AuditLogsToolbarProps) {
  const t = useAuditsI18n();

  const categories: AuditCategory[] = [
    'Todos',
    'Comandos IA & App Móvel',
    'Produtos',
    'Vendas',
    'Sessão / Login',
    'Operadores & Caixa',
    'Reabastecimento'
  ];

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
    <div className="px-4 sm:px-6 py-2.5 bg-slate-50/70 dark:bg-zinc-950/60 border-b border-slate-200/60 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
      <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
        
        {/* Segmented Category Filter Pills */}
        <div className="flex bg-slate-200/60 dark:bg-zinc-900 p-0.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 shrink-0 overflow-x-auto max-w-full">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              <span>{categoryLabelMap[cat]}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-zinc-700/60 font-semibold">
                {categoryCounts[cat] || 0}
              </span>
            </button>
          ))}
        </div>

        {/* Date Filter Dropdown */}
        <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 px-2.5 py-1 rounded-xl border border-slate-200/80 dark:border-zinc-800 shrink-0 shadow-2xs">
          <Calendar size={13} className="text-slate-400 dark:text-zinc-500 ml-0.5" />
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as AuditDateRange)}
            className="bg-transparent text-xs font-bold text-slate-700 dark:text-zinc-300 border-none outline-none cursor-pointer pr-1 py-0.5"
          >
            <option value="all" className="dark:bg-zinc-900">{t.dateAll || 'Todas as datas'}</option>
            <option value="today" className="dark:bg-zinc-900">{t.dateToday || 'Hoje'}</option>
            <option value="week" className="dark:bg-zinc-900">{t.dateWeek || 'Últimos 7 dias'}</option>
            <option value="month" className="dark:bg-zinc-900">{t.dateMonth || 'Últimos 30 dias'}</option>
          </select>
        </div>

        {/* Instant Toggle for Metric Cards (Option A without animation) */}
        <button
          type="button"
          onClick={onToggleSummaryCards}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-xs active:scale-95 shrink-0 ${
            showSummaryCards
              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200/80 dark:border-indigo-800/60'
              : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 border-slate-200/80 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800'
          }`}
          title={showSummaryCards ? (t.hideSummaryTooltip || 'Ocultar cartões de métricas') : (t.showSummaryTooltip || 'Mostrar cartões de métricas')}
        >
          <BarChart3 size={13} className={showSummaryCards ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
          <span>{showSummaryCards ? (t.hideSummary || 'Ocultar Resumo') : (t.showSummary || 'Mostrar Resumo')}</span>
          {showSummaryCards ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* Live Search Input */}
      <div className="relative w-full md:w-80 shrink-0">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t.searchPlaceholder || "Pesquisar ação, operador, ID..."}
          className="w-full pl-9 pr-8 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-800 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
