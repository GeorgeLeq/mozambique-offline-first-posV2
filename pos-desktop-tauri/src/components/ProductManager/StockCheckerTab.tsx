import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Product } from '../../lib/api';
import { Search, Package, Hash, Tag, RefreshCw, Eye, Layers, ClipboardList, Maximize2, Minimize2, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { sanitizeString } from '../../lib/security/sanitizer';
import { useI18n, getLanguage, LanguageCode } from '../../i18n';
import { SyncDot } from './ProductList/ProductTable';
import { OvershadowSearchPill } from '../common/OvershadowSearchPill';

interface StockCheckerTabProps {
  products: Product[];
  isLoading?: boolean;
  onRefresh?: () => void;
  isFocusMode?: boolean;
  onToggleFocusMode?: () => void;
  activeTab?: 'checker' | 'inventory' | 'orders';
  onSelectTab?: (tab: 'checker' | 'inventory' | 'orders') => void;
}

export function StockCheckerTab({ 
  products, 
  isLoading = false, 
  onRefresh,
  isFocusMode = false,
  onToggleFocusMode,
  activeTab = 'checker',
  onSelectTab
}: StockCheckerTabProps) {
  const [lang, setLang] = useState<LanguageCode>(getLanguage());
  const t = useI18n(lang);

  useEffect(() => {
    const handleLocaleChange = () => setLang(getLanguage());
    window.addEventListener('locale-changed', handleLocaleChange);
    return () => window.removeEventListener('locale-changed', handleLocaleChange);
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  const toggleHighlightId = (id: string) => {
    setHighlightedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoryScrollRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      categoryScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    searchInputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (!activeEl || (activeEl.tagName !== 'INPUT' && activeEl.tagName !== 'TEXTAREA')) {
        if ((e.key >= '0' && e.key <= '9') || (e.code >= 'Numpad0' && e.code <= 'Numpad9')) {
          searchInputRef.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [currentPage, setCurrentPage] = useState(1);
  // Fit 10 products cleanly in Normal mode, and 12 products (+2) in Expansion mode without vertical cutoff
  const itemsPerPage = isFocusMode ? 12 : 10;

  const categories = useMemo(() => {
    const list = new Set<string>();
    products.forEach(p => {
      if (p.category) list.add(p.category);
    });
    return ['All', ...Array.from(list).sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
      const term = sanitizeString(searchTerm).toLowerCase().trim();
      if (!term) return matchesCategory;

      const matchesName = product.name?.toLowerCase().includes(term);
      const matchesBarcode = product.barcode?.toLowerCase().includes(term);
      
      return matchesCategory && (matchesName || matchesBarcode);
    });
  }, [products, searchTerm, selectedCategory]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-950 overflow-hidden">
      
      {/* Top Inline Filter Bar */}
      <div className={`border-b border-slate-200/60 dark:border-white/10 bg-white dark:bg-zinc-950 flex items-center justify-between gap-3 shrink-0 relative ${
        isFocusMode ? 'px-4 py-2 w-full flex-row' : 'px-6 py-4 flex-col md:flex-row gap-4'
      }`}>
        
        {/* In Focus/Expansion mode: inline tab switcher for instant navigation */}
        {isFocusMode && onSelectTab && (
          <div className="bg-slate-100 dark:bg-zinc-900 p-0.5 rounded-xl border border-slate-200/60 dark:border-white/10 flex gap-0.5 shadow-inner shrink-0">
            <button
              onClick={() => onSelectTab('checker')}
              className={`px-3 py-1 rounded-lg font-bold text-[11px] tracking-wide transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'checker'
                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/40 dark:border-white/5'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
              }`}
            >
              <Eye size={12} />
              {t.stockCheckerTab || 'Consulta Rápida'}
            </button>
            <button
              onClick={() => onSelectTab('inventory')}
              className={`px-3 py-1 rounded-lg font-bold text-[11px] tracking-wide transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'inventory'
                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/40 dark:border-white/5'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
              }`}
            >
              <Layers size={12} />
              {t.productListTab || 'Inventário'}
            </button>
            <button
              onClick={() => onSelectTab('orders')}
              className={`px-3 py-1 rounded-lg font-bold text-[11px] tracking-wide transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/40 dark:border-white/5'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
              }`}
            >
              <ClipboardList size={12} />
              {t.ordersTab || 'Encomendas'}
            </button>
          </div>
        )}

        {/* Category Pills with Scroll Navigation */}
        <div className={`relative flex items-center gap-1.5 overflow-hidden ${
          isFocusMode ? 'flex-1 max-w-xl' : 'w-full md:w-auto'
        }`}>
          <button
            onClick={() => scrollCategories('left')}
            className="p-1.5 rounded-full bg-slate-100 dark:bg-zinc-900 text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 shrink-0 cursor-pointer hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors"
            title="Ver categorias anteriores"
          >
            <ChevronLeft size={14} />
          </button>

          <div 
            ref={categoryScrollRef}
            className="flex items-center gap-2 overflow-x-auto w-full md:w-auto py-0.5 hide-scrollbar scroll-smooth"
          >
            <button
              onClick={() => setSelectedCategory('All')}
              className={`rounded-full font-bold tracking-wide transition-all shrink-0 cursor-pointer ${
                isFocusMode ? 'px-3 py-1 text-[11px]' : 'px-4 py-1.5 text-xs'
              } ${
                selectedCategory === 'All'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800'
              }`}
            >
              {t.allCategories} ({products.length})
            </button>

            {categories.filter(c => c !== 'All').map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full font-bold tracking-wide transition-all shrink-0 cursor-pointer ${
                  isFocusMode ? 'px-3 py-1 text-[11px]' : 'px-4 py-1.5 text-xs'
                } ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <button
            onClick={() => scrollCategories('right')}
            className="p-1.5 rounded-full bg-slate-100 dark:bg-zinc-900 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 shrink-0 cursor-pointer hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors"
            title="Ver mais categorias"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Search Bar, Refresh & Focus Mode Toggle */}
        <div className={`flex items-center gap-2 justify-end shrink-0 ${
          isFocusMode ? 'w-auto' : 'w-full md:w-auto'
        }`}>
          {/* Overshadowing Search Pill */}
          <OvershadowSearchPill
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={t.stockSearchPlaceholder}
            isFocusMode={isFocusMode}
            resultsCount={filteredProducts.length}
          />

          {onRefresh && (
            <button
              onClick={onRefresh}
              className={`bg-slate-100/80 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-slate-600 dark:text-zinc-300 transition-all cursor-pointer shrink-0 flex items-center justify-center ${
                isFocusMode ? 'p-1.5' : 'p-2'
              }`}
              title={t.refreshList}
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin text-indigo-600" : ""} />
            </button>
          )}
            {onToggleFocusMode && (
              <button
                onClick={onToggleFocusMode}
                className={`rounded-xl border transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                  isFocusMode ? 'p-1.5' : 'p-2'
                } ${
                  isFocusMode
                    ? 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-700'
                    : 'bg-slate-100/80 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 border-slate-200/60 dark:border-white/10 text-slate-600 dark:text-zinc-400'
                }`}
                title={isFocusMode ? "Sair do Modo Expansão" : "Ativar Modo Expansão"}
              >
                {isFocusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            )}
          </div>
        </div>

      {/* Main Table Container */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {isLoading && products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 gap-3 text-slate-400">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
            <p className="text-xs font-bold">{t.syncing}...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400 dark:text-zinc-500">
            <div className="w-16 h-16 bg-slate-50 dark:bg-zinc-900 rounded-2xl flex items-center justify-center mb-3 border border-slate-200/60 dark:border-white/5">
              <Package size={32} className="text-slate-400" />
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">{t.noProductsFound}</p>
            <p className="text-xs text-slate-400 mt-0.5">{t.searchPrompts}</p>
          </div>
        ) : (
          <div className="w-full flex-1 min-h-0 relative overflow-y-auto overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-zinc-900 shadow-xs">
                <tr className="border-b border-slate-200/60 dark:border-white/10 text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  <th className="py-2 px-1 w-7 text-center">
                    <span className="sr-only">Sync</span>
                  </th>
                  <th className="py-2 px-4 font-bold">{t.productName}</th>
                  <th className="py-2 px-4 font-bold">{t.barcode}</th>
                  <th className="py-2 px-4 font-bold">Tag / {t.category}</th>
                  <th className="py-2 px-4 font-bold">{t.price}</th>
                  <th className="py-2 px-4 font-bold text-right">{t.stock}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                <AnimatePresence>
                  {paginatedProducts.map((product) => {
                    const stock = product.stock_quantity || 0;
                    const minAlert = product.min_stock_alert ?? 5;
                    const isLowStock = !product.is_fractional && stock <= minAlert;
                    const isHighlighted = highlightedIds.has(product.id);

                    return (
                      <motion.tr 
                        key={product.id}
                        onClick={() => toggleHighlightId(product.id)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={`transition-all cursor-pointer ${
                          isHighlighted 
                            ? 'bg-indigo-100/90 dark:bg-indigo-950/70 ring-2 ring-indigo-500 shadow-md scale-[1.01]' 
                            : 'hover:bg-slate-50/80 dark:hover:bg-zinc-900/40'
                        }`}
                      >
                        {/* Sync Status Dot (Far Left) */}
                        <td className="py-2 px-1 text-center w-7" onClick={(e) => e.stopPropagation()}>
                          <SyncDot status={product.sync_status} />
                        </td>

                        <td className="py-2 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200/60 dark:border-white/10 flex items-center justify-center shrink-0">
                              {product.image_url ? (
                                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-xl" />
                              ) : (
                                <Package size={15} className="text-slate-400" />
                              )}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 dark:text-zinc-100 text-sm flex items-center gap-1.5">
                                <span>{product.name}</span>
                              </span>
                              {Boolean(product.is_fractional) && (
                                <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-extrabold uppercase">
                                  {t.fractionalTag}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-2 px-4 font-mono font-medium text-slate-600 dark:text-zinc-400">
                          <div className="flex items-center gap-1.5">
                            <Hash size={13} className="text-slate-400" />
                            <span>{product.barcode}</span>
                          </div>
                        </td>

                        <td className="py-2 px-4">
                          {product.category ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 font-semibold text-[11px]">
                              <Tag size={12} className="text-indigo-500" />
                              {product.category}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        <td className="py-2 px-4 font-mono font-bold text-slate-900 dark:text-zinc-100 text-sm">
                          {product.promo_active && product.promo_price_mt !== undefined && product.promo_price_mt !== null ? (
                            <div className="flex items-center gap-2">
                              <span className="text-amber-600 dark:text-amber-400">{product.promo_price_mt.toFixed(2)} MT</span>
                              <span className="text-xs line-through text-slate-400 font-normal">{product.price_mt.toFixed(2)} MT</span>
                            </div>
                          ) : (
                            <span>{product.price_mt.toFixed(2)} MT</span>
                          )}
                        </td>

                        <td className="py-2 px-4 text-right">
                          <span className={`font-mono font-bold px-3 py-1 rounded-xl text-xs inline-flex items-center gap-1.5 ${
                            isLowStock
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              : 'bg-slate-100 dark:bg-zinc-900 text-slate-800 dark:text-zinc-200'
                          }`}>
                            {isLowStock && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
                            {stock} {product.is_fractional ? 'kg' : 'un'}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {(totalPages > 1 || products.length > 0) && (
        <div className="px-6 py-2.5 border-t border-slate-200/60 dark:border-white/10 bg-white dark:bg-zinc-950 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-500 font-medium">
            Mostrando página <strong className="text-slate-900 dark:text-zinc-100">{currentPage}</strong> de {totalPages} ({filteredProducts.length} produtos)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-all cursor-pointer font-bold"
            >
              Anterior
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-all cursor-pointer font-bold"
            >
              Próximo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
