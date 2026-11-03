/**
 * @file WebSearchActionCard.tsx
 * @description Pure presentation component for web market insights card using useWebSearchCard hook.
 */

import React from 'react';
import { Globe, Search, Loader2 } from 'lucide-react';
import { useWebSearchCard } from '../hooks/useWebSearchCard';

interface WebSearchActionCardProps {
  query: string;
}

export const WebSearchActionCard: React.FC<WebSearchActionCardProps> = ({ query }) => {
  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchResults,
    handlePerformWebSearch
  } = useWebSearchCard(query);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
        <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-bold">
          <Globe className="w-4 h-4" />
          <span>Mozambique Web & Market Insights</span>
        </div>
        <button
          onClick={handlePerformWebSearch}
          disabled={isSearching}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 font-bold text-[11px] border border-cyan-500/30 transition-all cursor-pointer"
        >
          {isSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
          <span>{isSearching ? 'Searching...' : 'Refresh Insights'}</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search wholesale prices, suppliers, or product trends..."
          className="flex-1 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white text-xs font-medium focus:ring-1 focus:ring-cyan-500 outline-none"
        />
      </div>

      {isSearching && (
        <div className="py-4 text-center text-slate-500 dark:text-zinc-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
          <span>Scanning retail pricing indices & web resources...</span>
        </div>
      )}

      {!isSearching && searchResults.length > 0 && (
        <div className="space-y-2">
          {searchResults.map((res, idx) => (
            <div 
              key={idx}
              className="p-3 rounded-xl bg-white dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 space-y-1 shadow-2xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-900 dark:text-white text-xs">
                  {res.title}
                </span>
                <span className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md">
                  {res.source}
                </span>
              </div>
              <p className="text-slate-600 dark:text-zinc-300 text-[11px] leading-relaxed">
                {res.snippet}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
