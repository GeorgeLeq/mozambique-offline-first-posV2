import React, { useState } from 'react';
import { RotateCcw, Pause, Play, Search, ArrowLeftRight, Wallet, Receipt, UserCheck, Info, Megaphone, Tv } from 'lucide-react';
import { InternetStatusBadge } from '../InternetStatusBadge';
import { FullscreenButton } from '../FullscreenButton';
import { CashierInfoModal } from './CashierInfoModal';
import { useI18n } from '../../i18n';

interface CashierHeaderProps {
  currentUser: any;
  isScanning: boolean;
  onOpenRecentSales: () => void;
  onOpenTillPayout: () => void;
  cartLength: number;
  onHoldCart: () => void;
  onResumeCart: () => void;
  suspendedCount: number;
  onOpenPriceCheck: () => void;
  onOpenFiados: () => void;
  isRefundMode: boolean;
  toggleRefundMode: () => void;
  announcementCount?: number;
  onOpenAnnouncements?: () => void;
  hasUrgentAnnouncement?: boolean;
  onOpenCustomerDisplay?: () => void;
  onTogglePiP?: () => void;
  isPiPOpen?: boolean;
}

export function CashierHeader({ 
  currentUser, 
  isScanning, 
  onOpenRecentSales, 
  onOpenTillPayout,
  cartLength,
  onHoldCart,
  onResumeCart,
  suspendedCount,
  onOpenPriceCheck,
  onOpenFiados,
  isRefundMode,
  toggleRefundMode,
  announcementCount = 0,
  onOpenAnnouncements,
  hasUrgentAnnouncement = false,
  onOpenCustomerDisplay,
  onTogglePiP,
  isPiPOpen = false
}: CashierHeaderProps) {
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const t = useI18n();

  const handleFiadosClick = () => {
    onOpenFiados();
  };

  return (
    <div className="px-4 py-2.5 bg-white/80 dark:bg-zinc-950/80 border-b border-slate-200/80 dark:border-zinc-900 flex flex-wrap justify-between items-center gap-3 shrink-0 select-none transition-colors duration-500">
      {/* Left: Terminal Title & Operator Pill */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <h1 className="text-base font-black tracking-tight text-slate-900 dark:text-white uppercase">{t.posTitle || 'Caixa PDV'}</h1>
          {/* Internet Connection Status Badge placed next to Caixa PDV */}
          <InternetStatusBadge />
        </div>

        {/* Operator Badge Pill */}
        <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300">
          <UserCheck size={13} className="text-indigo-600 dark:text-indigo-400" />
          <span className="text-slate-400 dark:text-zinc-500 font-normal">{t.operator || 'Operador:'}</span>
          <span className="font-bold text-slate-800 dark:text-zinc-100">{currentUser?.name || t.defaultCashier || 'Caixa'}</span>
        </div>

        {/* Scanner Activity Indicator Pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300" title={t.scannerTooltip || 'Estado do Leitor de Código de Barras'}>
          <span className="relative flex h-2 w-2">
            {isScanning ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-400 dark:bg-zinc-600"></span>
            )}
          </span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            {isScanning ? (t.scannerActive || 'Scanner Activo') : (t.scannerReady || 'Scanner Pronto')}
          </span>
        </div>

        {/* Info Guide Button */}
        <button
          onClick={() => setIsInfoModalOpen(true)}
          className="p-1.5 bg-slate-100 hover:bg-indigo-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 rounded-xl transition-colors cursor-pointer border border-slate-200/80 dark:border-zinc-800"
          title={t.guideTooltip || 'Guia & Instruções do Caixa'}
        >
          <Info size={13} />
        </button>

        {/* Fullscreen Zero-Bars F11 Button */}
        <FullscreenButton className="!p-1.5 !rounded-xl" />

        {/* Announcements Pill Trigger */}
        {onOpenAnnouncements && (
          <button
            onClick={onOpenAnnouncements}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              hasUrgentAnnouncement
                ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30 animate-pulse'
                : announcementCount > 0
                ? 'bg-indigo-50 dark:bg-zinc-900 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-zinc-800'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-800'
            }`}
            title={t.announcementsTooltip || 'Comunicados da Gerência'}
          >
            <Megaphone size={13} className={hasUrgentAnnouncement ? 'animate-bounce' : ''} />
            <span className="hidden md:inline">{t.announcements || 'Avisos'}</span>
            {announcementCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full font-mono text-[9px] font-black ${
                hasUrgentAnnouncement ? 'bg-white text-rose-600' : 'bg-indigo-600 text-white'
              }`}>
                {announcementCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Right: Uniform Navigation & Action Control Pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Hold Cart */}
        <button
          onClick={onHoldCart}
          disabled={cartLength === 0}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
            cartLength > 0 
              ? 'bg-amber-50 dark:bg-zinc-900 hover:bg-amber-100 dark:hover:bg-zinc-800 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-500/40 shadow-xs' 
              : 'bg-slate-100 dark:bg-zinc-950 text-slate-400 dark:text-zinc-600 border-slate-200 dark:border-zinc-900 cursor-not-allowed opacity-50'
          }`}
          title={t.holdCartTooltip || 'Suspender Venda Atual'}
        >
          <Pause size={13} />
          <span>{t.holdCart || 'Suspender'}</span>
        </button>

        {/* Resume Cart */}
        <button
          onClick={onResumeCart}
          disabled={suspendedCount === 0}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all relative cursor-pointer border ${
            suspendedCount > 0 
              ? 'bg-indigo-50 dark:bg-zinc-900 hover:bg-indigo-100 dark:hover:bg-zinc-800 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-500/40 shadow-xs' 
              : 'bg-slate-100 dark:bg-zinc-950 text-slate-400 dark:text-zinc-600 border-slate-200 dark:border-zinc-900 cursor-not-allowed opacity-50'
          }`}
          title={t.resumeCartTooltip || 'Retomar Venda Suspensa'}
        >
          <Play size={13} />
          <span>{t.resumeCart || 'Retomar'}</span>
          {suspendedCount > 0 && (
            <span className="bg-indigo-600 text-white font-mono font-bold text-[9px] px-1.5 py-0.2 rounded-full">
              {suspendedCount}
            </span>
          )}
        </button>

        <div className="w-px h-5 bg-slate-200 dark:bg-zinc-850 mx-0.5 hidden sm:block"></div>

        {/* Price Check Pill */}
        <button
          onClick={onOpenPriceCheck}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 dark:bg-zinc-900 hover:bg-cyan-100 dark:hover:bg-zinc-800 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-zinc-800 hover:border-cyan-400 dark:hover:border-cyan-500/40 rounded-xl transition-all font-bold text-xs cursor-pointer shadow-xs"
          title={t.priceCheckTooltip || 'Consultar Preço e Stock do Artigo'}
        >
          <Search size={13} />
          <span>{t.priceCheck || 'Preço'}</span>
        </button>

        {/* Fiados Pill */}
        <button
          onClick={handleFiadosClick}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-zinc-900 hover:bg-amber-100 dark:hover:bg-zinc-800 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-500/40 rounded-xl transition-all font-bold text-xs cursor-pointer shadow-xs"
          title={t.fiadosTooltip || 'Ver Contas Correntes e Livro de Fiados'}
        >
          <Receipt size={13} />
          <span>{t.fiados || 'Fiados'}</span>
        </button>

        {/* Refund Mode Pill */}
        <button
          onClick={toggleRefundMode}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all font-bold text-xs cursor-pointer border ${
            isRefundMode
              ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30 animate-pulse'
              : 'bg-rose-50 dark:bg-zinc-900 hover:bg-rose-100 dark:hover:bg-zinc-800 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-zinc-800 hover:border-rose-400 dark:hover:border-rose-500/40 shadow-xs'
          }`}
          title={t.refundModeTooltip || 'Ativar/Desativar Modo Devolução de Mercadoria'}
        >
          <ArrowLeftRight size={13} />
          <span>{isRefundMode ? (t.refundModeActive || 'Devolução Ativa') : (t.refundMode || 'Devolução')}</span>
        </button>

        <div className="w-px h-5 bg-slate-200 dark:bg-zinc-850 mx-0.5 hidden sm:block"></div>

        {/* Till Payout (Saída de Caixa) Pill */}
        <button
          onClick={onOpenTillPayout}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-zinc-900 hover:bg-rose-100 dark:hover:bg-zinc-800 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-zinc-800 hover:border-rose-400 dark:hover:border-rose-500/40 rounded-xl transition-all font-bold text-xs cursor-pointer shadow-xs"
          title={t.tillPayoutTooltip || 'Registar Saída de Dinheiro da Gaveta'}
        >
          <Wallet size={13} />
          <span>{t.tillPayout || 'Saída Caixa'}</span>
        </button>
        
        {/* Recent Sales History Pill */}
        <button
          onClick={onOpenRecentSales}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-zinc-900 hover:bg-indigo-100 dark:hover:bg-zinc-800 text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-white border border-indigo-200 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-500/40 rounded-xl transition-all font-bold text-xs cursor-pointer shadow-xs"
          title={t.recentSalesTooltip || 'Ver Histórico de Vendas Recentes'}
        >
          <RotateCcw size={13} />
          <span>{t.recentSalesHistory || 'Histórico'}</span>
        </button>

        <div className="w-px h-5 bg-slate-200 dark:bg-zinc-850 mx-0.5 hidden sm:block"></div>

        {/* Customer Display (2º Ecrã / PiP) Pill */}
        {onOpenCustomerDisplay && (
          <div className="flex items-center rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/70 dark:bg-zinc-900 p-0.5 shadow-xs">
            <button
              onClick={onOpenCustomerDisplay}
              className="flex items-center gap-1.5 px-2.5 py-1 text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-white font-bold text-xs cursor-pointer rounded-lg hover:bg-indigo-100 dark:hover:bg-zinc-800 transition-colors"
              title={t.customerDisplayTooltip || 'Abrir Ecrã do Cliente (Segunda Janela para Monitor 2)'}
            >
              <Tv size={13} className="text-indigo-600 dark:text-indigo-400" />
              <span>{t.customerDisplay || 'Ecrã Cliente'}</span>
            </button>
            {onTogglePiP && (
              <button
                onClick={onTogglePiP}
                className={`px-1.5 py-1 text-[10px] font-black uppercase rounded-md transition-colors cursor-pointer ${
                  isPiPOpen
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-indigo-500 dark:text-indigo-400 hover:bg-indigo-200/60 dark:hover:bg-zinc-800'
                }`}
                title={t.customerDisplayPiPTooltip || (isPiPOpen ? 'Fechar Prévia PiP' : 'Activar Miniatura PiP')}
              >
                {t.customerDisplayPiP || 'PiP'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Cashier Guide & Info Modal */}
      <CashierInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
      />
    </div>
  );
}
