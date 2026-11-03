/**
 * @file CurrentStockView.tsx
 * @description In-Store Public Catalog showing Current Stock Available for retail customers.
 * 
 * Offline-First:
 * Reads directly from local SQLite database (zero cloud delays).
 * Strips internal cost prices or supplier data for 100% public safety.
 */

import React, { useState, useEffect } from 'react';
import { Package, Search, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { getDB } from '../../lib/db';
import { formatCurrency } from '../../lib/utils';
import { useI18n } from '../../i18n';

interface StockProduct {
  id: string;
  name: string;
  category: string;
  price_mt: number;
  stock_quantity: number;
  min_stock_alert: number;
}

export function CurrentStockView() {
  const t = useI18n();
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadStock = async () => {
    setIsLoading(true);
    try {
      const db = await getDB();
      const rows = (await db.select(`
        SELECT id, name, category, price_mt, stock_quantity, min_stock_alert 
        FROM products 
        WHERE (is_active = 1 OR is_active IS NULL) AND (is_deleted = 0 OR is_deleted IS NULL)
        ORDER BY stock_quantity DESC
        LIMIT 60
      `)) as any[];

      const mapped: StockProduct[] = (rows || []).map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category || 'Geral',
        price_mt: Number(r.price_mt) || 0,
        stock_quantity: Number(r.stock_quantity) || 0,
        min_stock_alert: Number(r.min_stock_alert) || 5
      }));

      setProducts(mapped);

      // Extract unique categories
      const cats = Array.from(new Set(mapped.map((p) => p.category))).filter(Boolean);
      setCategories(cats);
    } catch (e) {
      console.warn('[CurrentStockView] Error reading stock:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStock();
    // Refresh stock every 15 seconds or on custom event
    const interval = setInterval(loadStock, 15000);
    window.addEventListener('db-sync-complete', loadStock);
    return () => {
      clearInterval(interval);
      window.removeEventListener('db-sync-complete', loadStock);
    };
  }, []);

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      search === '' ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === 'ALL' || p.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="flex flex-col bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-md p-5 h-full overflow-hidden">
      {/* Title & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold border border-indigo-200 dark:border-indigo-800">
            <Package size={18} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              Stock Disponível na Loja
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                {products.length} artigos
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Preços em Meticais (MT) e existências em prateleira
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[200px] flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar produto ou marca..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-slate-400"
          />
        </div>
      </div>

      {/* Category Pills */}
      {categories.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2.5 mb-2 shrink-0 custom-scrollbar">
          <button
            onClick={() => setCategoryFilter('ALL')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              categoryFilter === 'ALL'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'
            }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                categoryFilter === cat
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Stock Grid List */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
        {filteredProducts.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-xs text-center">
            <Package size={28} className="mb-2 opacity-50" />
            <p>Nenhum produto encontrado com este filtro.</p>
          </div>
        ) : (
          filteredProducts.map((p) => {
            const isLowStock = p.stock_quantity <= p.min_stock_alert && p.stock_quantity > 0;
            const isOutOfStock = p.stock_quantity <= 0;

            return (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 dark:bg-zinc-800/50 dark:hover:bg-zinc-800 transition-colors border border-slate-200/60 dark:border-zinc-800"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                      {p.name}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 px-2 py-0.5 rounded-md bg-white dark:bg-zinc-700/60 border border-slate-200 dark:border-zinc-700">
                      {p.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs">
                    {isOutOfStock ? (
                      <span className="flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400 text-[11px]">
                        <AlertCircle size={12} /> Esgotado
                      </span>
                    ) : isLowStock ? (
                      <span className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 text-[11px]">
                        <AlertCircle size={12} /> Últimas unidades ({p.stock_quantity} unids)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                        <CheckCircle size={12} /> Em stock ({p.stock_quantity} unids)
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-base font-black font-mono text-indigo-600 dark:text-indigo-400">
                    {formatCurrency(p.price_mt)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
