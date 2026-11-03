/**
 * @file CustomerDisplayView.tsx
 * @description Standalone Customer-Facing Display View for Tauri v2 Secondary Screen, HDMI, or Fullscreen.
 * 
 * Strict Instructions:
 * 1. Engine Badge: ONLY show "Llama 3.2 1B" if using 1B, and "Muse Spark" if using spark.
 * 2. Content: Shows the Promotional Hero Banner (with offline local image persistence),
 *    Current Stock Available (live SQLite stock with Meticais prices),
 *    and FAQ Questions for retail customers (payments, delivery, fiado).
 * 3. Supports Fullscreen mode (huge, filling entire monitor).
 */

import React, { useState, useEffect } from 'react';
import { CustomerCartList } from './CustomerCartList';
import { CustomerPromoCarousel } from './CustomerPromoCarousel';
import { CurrentStockView } from './CurrentStockView';
import { CustomerFaqView } from './CustomerFaqView';
import { CustomerDisplayState } from '../../lib/customerDisplay/types';
import { 
  getCustomerDisplayCurrentState, 
  subscribeToCustomerDisplay 
} from '../../lib/customerDisplay/customerDisplayBus';
import { 
  getActiveAiProvider, 
  checkAiEngineStatus 
} from '../../lib/ai/unifiedAiClient';
import { Store, User, Clock, Maximize2, Minimize2, Tv, Sparkles, Cpu } from 'lucide-react';
import { useI18n, SUPPORTED_LANGUAGES, getLanguage, setLanguage } from '../../i18n';

export function CustomerDisplayView() {
  const t = useI18n();
  const [state, setState] = useState<CustomerDisplayState>(getCustomerDisplayCurrentState());
  const [time, setTime] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeEngineName, setActiveEngineName] = useState<'Llama 3.2 1B' | 'Muse Spark'>('Llama 3.2 1B');

  // Strict Engine Badge Resolution: ONLY "Llama 3.2 1B" or "Muse Spark"
  const updateEngineBadge = () => {
    const provider = getActiveAiProvider();
    if (provider === 'baseten-muse') {
      setActiveEngineName('Muse Spark');
    } else {
      setActiveEngineName('Llama 3.2 1B');
    }
  };

  useEffect(() => {
    updateEngineBadge();
    window.addEventListener('ai-provider-changed', updateEngineBadge);
    window.addEventListener('ai-config-changed', updateEngineBadge);
    window.addEventListener('storage', updateEngineBadge);
    return () => {
      window.removeEventListener('ai-provider-changed', updateEngineBadge);
      window.removeEventListener('ai-config-changed', updateEngineBadge);
      window.removeEventListener('storage', updateEngineBadge);
    };
  }, []);

  // Synchronize cart state with cashier via customerDisplayBus
  useEffect(() => {
    setState(getCustomerDisplayCurrentState());
    const unsubscribe = subscribeToCustomerDisplay((updatedState) => {
      setState(updatedState);
    });
    return () => unsubscribe();
  }, []);

  // Live Digital Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('pt-MZ', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fullscreen handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const hasActiveCart = state.cart && state.cart.length > 0;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col p-4 md:p-6 font-sans select-none overflow-x-hidden">
      {/* Top Header Bar */}
      <header 
        data-tauri-drag-region
        className="mb-4 px-6 py-3.5 bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-md flex flex-wrap items-center justify-between gap-4 cursor-default"
      >
        {/* Shop & Brand Info */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
            <Store size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                {state.shop_name || 'SYCOMM POS Retail'}
              </h1>
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 text-xs font-bold border border-indigo-200 dark:border-indigo-800">
                <Tv size={13} /> {t.customerDisplay || 'Customer Display'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
              Moçambique • Sistema Balcão POS
            </p>
          </div>
        </div>

        {/* Center / Right Metadata */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* STRICT AI ENGINE BADGE: Strictly "Llama 3.2 1B" or "Muse Spark" */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-zinc-800 dark:to-zinc-800/80 border border-indigo-200 dark:border-indigo-900 shadow-2xs">
            <Cpu size={15} className="text-indigo-600 dark:text-indigo-400" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500">
                AI Engine:
              </span>
              <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                {activeEngineName}
              </span>
            </div>
            <span className={`w-2 h-2 rounded-full ${
              activeEngineName === 'Muse Spark' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
            }`} />
          </div>

          {/* 4-Language Switcher */}
          <div className="flex items-center bg-slate-100 dark:bg-zinc-800/80 rounded-2xl p-0.5 border border-slate-200 dark:border-zinc-700">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = getLanguage() === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={`px-2 py-1 text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title={lang.name}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.code.toUpperCase()}</span>
                </button>
              );
            })}
          </div>

          {/* Operator Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 rounded-2xl text-xs font-semibold text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
            <User size={14} className="text-indigo-600 dark:text-indigo-400" />
            <span className="text-slate-400 dark:text-zinc-500">{t.operator || 'Caixa:'}</span>
            <span className="font-bold text-slate-900 dark:text-white">{state.cashier_name || 'Caixa 01'}</span>
          </div>

          {/* Clock */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 rounded-2xl text-xs font-mono font-bold text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700">
            <Clock size={14} className="text-slate-400" />
            <span>{time || '--:--:--'}</span>
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer shadow-md shadow-indigo-600/20"
            title={isFullscreen ? 'Sair de Ecrã Completo' : 'Ecrã Completo (Monitor Inteiro)'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 flex flex-col gap-5 min-h-0">
        {/* Top: Promotional Hero Banner (Downloaded/Saved local image persists offline) */}
        <section className="shrink-0">
          <CustomerPromoCarousel />
        </section>

        {/* Content Section:
            If active cart is being scanned at checkout, split into:
            - Left: Live Cart (7 cols)
            - Right: Stock Available & FAQ tabs (5 cols)
            If no active cart (idle), full view of Stock Available & FAQ questions!
        */}
        {hasActiveCart ? (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0">
            {/* Left 7 Cols: Live Cart & Bill Totals */}
            <div className="lg:col-span-7 h-full flex flex-col min-h-[450px]">
              <CustomerCartList state={state} />
            </div>

            {/* Right 5 Cols: Current Stock Available & FAQ */}
            <div className="lg:col-span-5 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
              <CurrentStockView />
              <CustomerFaqView />
            </div>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0">
            {/* 7 Cols: Current Stock Available */}
            <div className="lg:col-span-7 h-full flex flex-col min-h-[450px]">
              <CurrentStockView />
            </div>

            {/* 5 Cols: FAQ Questions */}
            <div className="lg:col-span-5 h-full flex flex-col min-h-[450px]">
              <CustomerFaqView />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default CustomerDisplayView;
