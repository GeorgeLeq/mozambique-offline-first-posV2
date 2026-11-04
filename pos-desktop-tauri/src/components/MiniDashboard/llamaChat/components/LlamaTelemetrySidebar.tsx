/**
 * @file LlamaTelemetrySidebar.tsx
 * @description Left telemetry sidebar component showing store metrics & Sentinel Profiler.
 */

import React from 'react';
import { RefreshCw, TrendingUp, AlertTriangle, Users } from 'lucide-react';
import { StoreTelemetrySnapshot } from '../../../../lib/ai/storeSentinelClient';
import { useStoreSentinelProfiler, SENTINEL_GEARS } from '../../../../lib/ai/unified/profilerStore';

interface LlamaTelemetrySidebarProps {
  telemetry: StoreTelemetrySnapshot | null;
  onRefreshTelemetry: () => void;
}

export const LlamaTelemetrySidebar: React.FC<LlamaTelemetrySidebarProps> = ({
  telemetry,
  onRefreshTelemetry
}) => {
  const profiler = useStoreSentinelProfiler();

  return (
    <div className="w-80 bg-slate-100/70 dark:bg-zinc-900/40 border-r border-slate-200 dark:border-zinc-800 p-5 overflow-y-auto hidden md:flex flex-col gap-4 text-xs shrink-0 transition-colors">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800">
        <span className="font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wider text-[11px]">
          Live SQLite Telemetry
        </span>
        <button 
          onClick={onRefreshTelemetry}
          className="text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Refresh local database snapshot"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Store Sentinel Profiler Card */}
      <div className="p-4 rounded-2xl bg-zinc-900 text-white border-2 border-indigo-500 shadow-lg space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-800">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full shrink-0 animate-ping" style={{ backgroundColor: profiler.gearInfo?.color || '#10b981' }} />
            <span className="font-black text-xs text-indigo-400 uppercase tracking-wider truncate">
              Store Sentinel Profiler
            </span>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-indigo-950 text-indigo-300 border border-indigo-800 shrink-0">
            {profiler.latestMetrics?.isOnlineFallback ? 'Cloud Fallback' : 'Local 1B'}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
          <div className="flex items-center justify-between text-xs font-black">
            <span style={{ color: profiler.gearInfo?.color || '#10b981' }}>
              {profiler.gearInfo?.name || 'Lane 3: POS Operations'}
            </span>
            <span className="font-mono text-emerald-400 text-[10px]">
              ⚡ {profiler.latestMetrics?.evalDuration || `${profiler.latestMetrics?.latencyMs || 20}ms`}
            </span>
          </div>
          <p className="text-[10px] text-zinc-400 mt-1 line-clamp-1 font-medium">
            {profiler.gearInfo?.tagline || 'Exact Stock, Fiado & Cash Register in SQLite'}
          </p>
        </div>

        <div>
          <div className="text-[10px] text-zinc-400 font-extrabold mb-1.5 uppercase tracking-wider">
            Dynamic Lane Gears
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {([1, 2, 3, 4] as const).map(gearNum => {
              const gearObj = SENTINEL_GEARS[gearNum];
              const isActive = profiler.activeGear === gearNum;
              return (
                <div
                  key={gearNum}
                  className={`px-2 py-1.5 rounded-xl text-[10px] font-black transition-all border flex items-center justify-between ${
                    isActive
                      ? `${gearObj.badgeBg} ${gearObj.badgeText} ${gearObj.badgeBorder} ring-2 ring-indigo-500/40 scale-[1.02] shadow-sm`
                      : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/60 opacity-80'
                  }`}
                >
                  <span>{gearObj.shortCode}</span>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
          <div className="p-2 rounded-xl bg-zinc-800/80 text-zinc-300 border border-zinc-700/80">
            <div className="text-[9px] text-zinc-400 font-bold uppercase">PROMPT</div>
            <div className="font-black text-white text-xs mt-0.5">
              {profiler.latestMetrics?.promptTokens ?? 0} t
            </div>
          </div>
          <div className="p-2 rounded-xl bg-zinc-800/80 text-zinc-300 border border-zinc-700/80">
            <div className="text-[9px] text-zinc-400 font-bold uppercase">GENERATED</div>
            <div className="font-black text-white text-xs mt-0.5">
              {profiler.latestMetrics?.generatedTokens ?? 0} t
            </div>
          </div>
        </div>

        <div className="text-[10px] text-zinc-400 font-mono truncate pt-1 border-t border-zinc-800">
          Model: <strong className="text-zinc-200">{profiler.latestMetrics?.model || 'pos-parser'}</strong>
        </div>
      </div>

      {telemetry && (
        <>
          <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
            <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="font-semibold">Today's Sales</span>
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
              {telemetry.todaySalesTotal.toLocaleString()} MT
            </div>
            <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 font-medium">
              {telemetry.todaySalesCount} invoices issued
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
            <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="font-semibold">Critical Stock Items</span>
            </div>
            <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
              {telemetry.lowStockProducts.length} items
            </div>
            {telemetry.lowStockProducts.length > 0 && (
              <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 truncate">
                e.g. {telemetry.lowStockProducts[0].name}
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
            <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 mb-1">
              <Users className="w-4 h-4 text-indigo-500" />
              <span className="font-semibold">Active Operators</span>
            </div>
            <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
              {telemetry.users.length} users
            </div>
          </div>
        </>
      )}
    </div>
  );
};
