import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sliders, 
  TrendingUp, 
  ShieldCheck, 
  Package, 
  Sparkles, 
  Info, 
  Lock,
  Bell,
  BellRing,
  DollarSign,
  ShieldAlert,
  Receipt
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../i18n';

import FinancialCards from './FinancialCards';
import OperationsAndHealth from './OperationsAndHealth';
import StockAndMovers from './StockAndMovers';
import DashboardGuideModal from './DashboardGuideModal';
import { StoreSentinelBar } from './StoreSentinelBar';
import { useMiniDashboard } from './hooks/useMiniDashboard';

type DashboardTab = 'financials' | 'operations' | 'stock';

export default function MiniDashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { currentUser } = useAuth();
  const t = useI18n();
  const [activeTab, setActiveTab] = useState<DashboardTab>('financials');
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'financial' | 'security' | 'notifications'>('financial');
  
  const {
    todayRevenue,
    pendingDebts,
    expectedCash,
    mpesaRevenue,
    emolaRevenue,
    cashSalesTotal,
    baseCash,
    payoutsTotal,
    cashierBreakdown,
    voidCount,
    totalVoidAmount,
    manualDiscounts,
    cashierName,
    shopName,
    deadStockValue,
    worstDeadStockItem,
    lowStockItems,
    topMovers,
    pendingSync,
    cloudOnline,
    isSyncing,
    salesGoal,
    rotationSpeed,
    taxRate,
    maxDiscountCap,
    highValueThreshold,
    maxRefundLimit,
    notifRetentionDays,
    notificationPreferences,
    isSettingsOpen,
    setIsSettingsOpen,
    recentDebtors,
    totalStockQty,
    totalStockValue,
    totalStockCost,
    catalogValue,
    catalogCost,
    recentSpoiled,
    allProducts,
    handleUpdateBaseCash,
    handleUpdateSalesGoal,
    handleUpdateRotationSpeed,
    handleUpdateTaxRate,
    handleUpdateMaxDiscountCap,
    handleUpdateHighValueThreshold,
    handleUpdateMaxRefundLimit,
    handleUpdateNotifRetentionDays,
    handleUpdateNotificationPreferences,
    handleForceSync,
    handleLogSpoilage,
    formatCurrency
  } = useMiniDashboard();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t.goodMorning;
    if (hour < 18) return t.goodAfternoon;
    return t.goodEvening;
  };

  const tabsConfig = [
    {
      id: 'financials' as DashboardTab,
      label: t.tabFinancials,
      sublabel: t.tabFinancialsSub,
      icon: TrendingUp,
      badge: `${formatCurrency(todayRevenue)} MT`,
      badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
    },
    {
      id: 'operations' as DashboardTab,
      label: t.tabOperations,
      sublabel: t.tabOperationsSub,
      icon: ShieldCheck,
      badge: pendingSync === 0 ? t.synchronized : `${pendingSync} ${t.offlineCount}`,
      badgeColor: pendingSync === 0 
        ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' 
        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
    },
    {
      id: 'stock' as DashboardTab,
      label: t.tabStock,
      sublabel: t.tabStockSub,
      icon: Package,
      badge: `${lowStockItems.length} ${t.alertsCount}`,
      badgeColor: lowStockItems.length > 0 
        ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' 
        : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
    }
  ];

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col gap-4 relative z-10 p-1 min-h-0">
      
      {/* Compact Zero-Scroll Header Strip */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-900/10 via-violet-900/5 to-transparent dark:from-indigo-500/15 dark:via-purple-500/10 px-6 py-4 rounded-3xl border border-indigo-100 dark:border-indigo-500/20 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-600/20 shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <span>{t.posTerminalActive}</span>
                <span className="text-slate-300 dark:text-zinc-600">•</span>
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Lock size={10} />
                  <span>{t.encrypted}</span>
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <h2 className="text-xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">
                {getGreeting()}, {shopName}
              </h2>
              <button
                onClick={() => setIsGuideModalOpen(true)}
                title={t.guideTooltipMiniDashboard || t.guideTooltip}
                className="p-1.5 bg-white/80 hover:bg-white dark:bg-zinc-900/80 dark:hover:bg-zinc-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl border border-slate-200/60 dark:border-zinc-800 transition-all cursor-pointer shadow-xs"
              >
                <Info size={14} />
              </button>
            </div>
          </div>
        </div>
        
        <div className="relative z-10 flex items-center gap-2 self-end sm:self-center">
          <div className="px-3 py-1.5 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-zinc-800 text-xs font-mono font-bold text-slate-700 dark:text-zinc-300 shadow-xs">
            MZN (Metical)
          </div>
          {currentUser?.role === 'Admin' && (
            <button 
              onClick={() => setIsSettingsOpen(true)}
              title={t.quickSettingsTooltip}
              className="p-2 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md hover:bg-white dark:hover:bg-zinc-800 rounded-2xl border border-slate-200/60 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all shadow-xs cursor-pointer"
            >
              <Sliders size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Store Sentinel AI Assistant (Powered by Muse Spark & Muse Voice Transcribe) */}
      <StoreSentinelBar onNavigate={onNavigate} />

      {/* Zero-Scroll Tap Navigation Strip (Placed directly above the cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
        {tabsConfig.map((tab, idx) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`p-3.5 rounded-2xl border transition-all text-left flex items-center justify-between gap-3 cursor-pointer select-none relative overflow-hidden group ${
                isActive 
                  ? 'bg-white dark:bg-zinc-900 border-indigo-600 dark:border-indigo-500 shadow-md shadow-indigo-600/10 ring-2 ring-indigo-500/20' 
                  : 'bg-white/60 dark:bg-zinc-900/60 hover:bg-white dark:hover:bg-zinc-900 border-slate-200/80 dark:border-zinc-800/80 text-slate-600 dark:text-zinc-400'
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-600 dark:bg-indigo-500" />
              )}
              
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2 rounded-xl shrink-0 transition-colors ${
                  isActive 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                }`}>
                  <Icon size={18} />
                </div>
                <div className="min-w-0">
                  <span className={`block text-xs font-black uppercase tracking-wider truncate ${
                    isActive ? 'text-slate-900 dark:text-zinc-100' : 'text-slate-700 dark:text-zinc-300'
                  }`}>
                    {tab.label}
                  </span>
                  <span className="block text-[10px] text-slate-400 dark:text-zinc-500 font-medium truncate mt-0.5">
                    {tab.sublabel}
                  </span>
                </div>
              </div>

              <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border shrink-0 font-mono ${tab.badgeColor}`}>
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Tab Viewport Container (Zero-Scroll Dynamic Content) */}
      <div className="flex-1 min-h-0 flex flex-col justify-start">
        <AnimatePresence mode="wait">
          {activeTab === 'financials' && (
            <motion.div
              key="tab-financials"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="w-full"
            >
              <FinancialCards
                todayRevenue={todayRevenue}
                mpesaRevenue={mpesaRevenue}
                emolaRevenue={emolaRevenue}
                cashSalesTotal={cashSalesTotal}
                pendingDebts={pendingDebts}
                expectedCash={expectedCash}
                baseCash={baseCash}
                payoutsTotal={payoutsTotal}
                salesGoal={salesGoal}
                rotationSpeed={rotationSpeed}
                onNavigate={onNavigate}
                formatCurrency={formatCurrency}
                recentDebtors={recentDebtors}
                cashierBreakdown={cashierBreakdown}
              />
            </motion.div>
          )}

          {activeTab === 'operations' && (
            <motion.div
              key="tab-operations"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="w-full"
            >
              <OperationsAndHealth
                voidCount={voidCount}
                totalVoidAmount={totalVoidAmount}
                manualDiscounts={manualDiscounts}
                cashierName={cashierName}
                pendingSync={pendingSync}
                onNavigateToOperator={() => onNavigate('caixas')}
              />
            </motion.div>
          )}

          {activeTab === 'stock' && (
            <motion.div
              key="tab-stock"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="w-full"
            >
              <StockAndMovers
                lowStockItems={lowStockItems}
                topMovers={topMovers}
                totalStockQty={totalStockQty}
                totalStockValue={totalStockValue}
                totalStockCost={totalStockCost}
                catalogValue={catalogValue}
                catalogCost={catalogCost}
                recentSpoiled={recentSpoiled}
                allProducts={allProducts}
                deadStockValue={deadStockValue}
                worstDeadStockItem={worstDeadStockItem}
                onLogSpoilage={handleLogSpoilage}
                onNavigateToRestock={() => onNavigate('restock')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Info Guide Modal */}
      <DashboardGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
        initialPage={activeTab === 'financials' ? 0 : activeTab === 'operations' ? 1 : 2}
      />

      {/* Mini Settings Slide-Over Drawer Portaled directly to document.body */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isSettingsOpen && (
            <>
              {/* Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.55 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSettingsOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[99998]"
              />
              
              {/* Zero-Scroll Drawer Container */}
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 right-0 bottom-0 w-full sm:w-[420px] bg-white dark:bg-zinc-900 border-l border-slate-100 dark:border-zinc-800 shadow-2xl p-6 z-[99999] flex flex-col justify-between overflow-hidden"
              >
                <div className="flex flex-col h-full overflow-hidden">
                  {/* Drawer Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800 shrink-0 mb-4">
                    <div>
                      <h3 className="text-base font-black text-slate-800 dark:text-zinc-100 uppercase tracking-wide flex items-center gap-2">
                        <Sliders size={16} className="text-indigo-600" />
                        {t.quickSettingsTitle}
                      </h3>
                      <p className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 mt-0.5">{t.quickSettingsSub}</p>
                    </div>
                    <button 
                      onClick={() => setIsSettingsOpen(false)}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200 transition-all text-xs font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Zero-Scroll Category Tabs */}
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-zinc-800/60 rounded-2xl shrink-0 mb-4">
                    <button
                      onClick={() => setSettingsTab('financial')}
                      className={`py-2 px-1 text-[11px] font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        settingsTab === 'financial'
                          ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                      }`}
                    >
                      <DollarSign size={13} />
                      <span>{t.financialTab}</span>
                    </button>

                    <button
                      onClick={() => setSettingsTab('security')}
                      className={`py-2 px-1 text-[11px] font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        settingsTab === 'security'
                          ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-xs'
                          : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                      }`}
                    >
                      <ShieldAlert size={13} />
                      <span>{t.securityTab}</span>
                    </button>

                    <button
                      onClick={() => setSettingsTab('notifications')}
                      className={`py-2 px-1 text-[11px] font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        settingsTab === 'notifications'
                          ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                      }`}
                    >
                      <Bell size={13} />
                      <span>{t.alertsTab}</span>
                    </button>
                  </div>

                  {/* Tab Content Viewport (Fixed Height, No Page Scroll) */}
                  <div className="flex-1 overflow-hidden flex flex-col justify-start">
                    <AnimatePresence mode="wait">
                      {/* 1. FINANCIAL SETTINGS */}
                      {settingsTab === 'financial' && (
                        <motion.div
                          key="settings-financial"
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 8 }}
                          transition={{ duration: 0.15 }}
                          className="space-y-4"
                        >
                          {/* Fundo de Maneio Base */}
                          <div className="space-y-1.5 p-3.5 bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-slate-100 dark:border-zinc-800/80">
                            <label className="text-xs font-black text-slate-700 dark:text-zinc-300 uppercase tracking-wider block">
                              {t.baseFloatTitle}
                            </label>
                            <div className="flex items-center gap-2">
                              <input 
                                type="number"
                                defaultValue={baseCash}
                                onBlur={(e) => handleUpdateBaseCash(parseFloat(e.target.value) || 0)}
                                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 dark:text-zinc-200 focus:outline-hidden focus:border-indigo-500 transition-colors font-mono"
                              />
                              <span className="text-xs font-black text-slate-400 dark:text-zinc-500">MZN</span>
                            </div>
                            <p className="text-[10px] text-slate-400 dark:text-zinc-500 leading-tight">
                              {t.baseFloatDesc}
                            </p>
                          </div>

                          {/* Meta Diária */}
                          <div className="space-y-1.5 p-3.5 bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-slate-100 dark:border-zinc-800/80">
                            <label className="text-xs font-black text-slate-700 dark:text-zinc-300 uppercase tracking-wider block">
                              {t.dailySalesGoalTitle}
                            </label>
                            <div className="flex items-center gap-2">
                              <input 
                                type="number"
                                defaultValue={salesGoal}
                                onBlur={(e) => handleUpdateSalesGoal(parseFloat(e.target.value) || 0)}
                                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 dark:text-zinc-200 focus:outline-hidden focus:border-indigo-500 transition-colors font-mono"
                              />
                              <span className="text-xs font-black text-slate-400 dark:text-zinc-500">MZN</span>
                            </div>
                            <p className="text-[10px] text-slate-400 dark:text-zinc-500 leading-tight">
                              {t.dailySalesGoalDesc}
                            </p>
                          </div>

                          {/* Rotação e IVA */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1 p-3 bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-slate-100 dark:border-zinc-800/80">
                              <label className="text-[11px] font-black text-slate-700 dark:text-zinc-300 uppercase tracking-wider block">
                                {t.autoRotationLabel}
                              </label>
                              <div className="flex items-center gap-1.5">
                                <input 
                                  type="number"
                                  defaultValue={rotationSpeed}
                                  onBlur={(e) => handleUpdateRotationSpeed(parseInt(e.target.value, 10) || 0)}
                                  className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-zinc-200 focus:outline-hidden font-mono"
                                />
                                <span className="text-[10px] font-bold text-slate-400">{t.secondsUnit}</span>
                              </div>
                            </div>

                            <div className="space-y-1 p-3 bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-slate-100 dark:border-zinc-800/80">
                              <label className="text-[11px] font-black text-slate-700 dark:text-zinc-300 uppercase tracking-wider block">
                                {t.taxRateLabel}
                              </label>
                              <div className="flex items-center gap-1.5">
                                <input 
                                  type="number"
                                  defaultValue={taxRate}
                                  onBlur={(e) => handleUpdateTaxRate(parseFloat(e.target.value) || 0)}
                                  className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-zinc-200 focus:outline-hidden font-mono"
                                />
                                <span className="text-[10px] font-bold text-slate-400">%</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* 2. SECURITY & LIMITS SETTINGS */}
                      {settingsTab === 'security' && (
                        <motion.div
                          key="settings-security"
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 8 }}
                          transition={{ duration: 0.15 }}
                          className="space-y-3"
                        >
                          {/* Limite de Reembolso sem Alerta */}
                          <div className="space-y-1.5 p-3.5 bg-rose-50/50 dark:bg-rose-950/20 rounded-2xl border border-rose-100 dark:border-rose-900/40">
                            <div className="flex items-center gap-1.5">
                              <Receipt size={14} className="text-rose-600 dark:text-rose-400" />
                              <label className="text-xs font-black text-rose-900 dark:text-rose-300 uppercase tracking-wider block">
                                {t.refundAlertLimitTitle}
                              </label>
                            </div>
                            <div className="flex items-center gap-2">
                              <input 
                                type="number"
                                defaultValue={maxRefundLimit}
                                onBlur={(e) => handleUpdateMaxRefundLimit(parseFloat(e.target.value) || 0)}
                                className="w-full bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-800/60 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 dark:text-zinc-200 focus:outline-hidden focus:border-rose-500 transition-colors font-mono"
                              />
                              <span className="text-xs font-black text-rose-500 font-mono">MZN</span>
                            </div>
                            <p className="text-[10px] text-slate-500 dark:text-zinc-400 leading-tight">
                              {t.refundAlertLimitDesc}
                            </p>
                          </div>

                          {/* Alerta de Venda de Alto Valor */}
                          <div className="space-y-1.5 p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
                            <div className="flex items-center gap-1.5">
                              <DollarSign size={14} className="text-indigo-600 dark:text-indigo-400" />
                              <label className="text-xs font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-wider block">
                                {t.highValueSaleAlertTitle}
                              </label>
                            </div>
                            <div className="flex items-center gap-2">
                              <input 
                                type="number"
                                defaultValue={highValueThreshold}
                                onBlur={(e) => handleUpdateHighValueThreshold(parseFloat(e.target.value) || 0)}
                                className="w-full bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800/60 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 dark:text-zinc-200 focus:outline-hidden focus:border-indigo-500 transition-colors font-mono"
                              />
                              <span className="text-xs font-black text-indigo-500 font-mono">MZN</span>
                            </div>
                            <p className="text-[10px] text-slate-500 dark:text-zinc-400 leading-tight">
                              {t.highValueSaleAlertDesc}
                            </p>
                          </div>

                          {/* Teto Máximo de Desconto */}
                          <div className="space-y-1.5 p-3.5 bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-slate-100 dark:border-zinc-800/80">
                            <label className="text-xs font-black text-slate-700 dark:text-zinc-300 uppercase tracking-wider block">
                              {t.maxDiscountCapTitle}
                            </label>
                            <div className="flex items-center gap-2">
                              <input 
                                type="number"
                                defaultValue={maxDiscountCap}
                                onBlur={(e) => handleUpdateMaxDiscountCap(parseFloat(e.target.value) || 0)}
                                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 dark:text-zinc-200 focus:outline-hidden focus:border-indigo-500 transition-colors font-mono"
                              />
                              <span className="text-xs font-black text-slate-400 dark:text-zinc-500 font-mono">%</span>
                            </div>
                            <p className="text-[10px] text-slate-400 dark:text-zinc-500 leading-tight">
                              {t.maxDiscountCapDesc}
                            </p>
                          </div>
                        </motion.div>
                      )}

                      {/* 3. NOTIFICATION PREFERENCES */}
                      {settingsTab === 'notifications' && (
                        <motion.div
                          key="settings-notifications"
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 8 }}
                          transition={{ duration: 0.15 }}
                          className="space-y-3"
                        >
                          {/* Auto-Prune Retention Days */}
                          <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-wider block">
                                {t.autoPruneNotifsTitle}
                              </label>
                              <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                SQLite & Nuvem
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 dark:text-zinc-400 leading-tight">
                              {t.autoPruneNotifsDesc}
                            </p>
                            <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                              {[
                                { label: t.daysOpt15, value: 15 },
                                { label: t.daysOpt30, value: 30 },
                                { label: t.daysOpt90, value: 90 },
                                { label: t.never, value: 0 }
                              ].map(opt => (
                                <button
                                  key={opt.value}
                                  onClick={() => handleUpdateNotifRetentionDays(opt.value)}
                                  className={`py-1.5 px-1 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${notifRetentionDays === opt.value ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800 hover:border-indigo-400'}`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2 pt-1">
                            <label className="text-xs font-black text-slate-600 dark:text-zinc-400 uppercase tracking-wider block px-1">
                              {t.alertCategories}
                            </label>
                            {[
                              { id: 'low_stock', label: t.catLowStockTitle, desc: t.catLowStockDesc },
                              { id: 'voids', label: t.catVoidsTitle, desc: t.catVoidsDesc },
                              { id: 'shift_start', label: t.catShiftsTitle, desc: t.catShiftsDesc },
                              { id: 'high_value_sales', label: t.catHighValueTitle, desc: t.catHighValueDesc }
                            ].map((pref) => {
                              const isChecked = notificationPreferences.includes(pref.id);
                              return (
                                <label
                                  key={pref.id}
                                  className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-slate-100 dark:border-zinc-800/80 cursor-pointer hover:border-indigo-500/30 transition-all"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      const newPrefs = isChecked
                                        ? notificationPreferences.filter(p => p !== pref.id)
                                        : [...notificationPreferences, pref.id];
                                      handleUpdateNotificationPreferences(newPrefs);
                                    }}
                                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                  />
                                  <div className="flex-1">
                                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block">
                                      {pref.label}
                                    </span>
                                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 block leading-tight mt-0.5">
                                      {pref.desc}
                                    </span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Fixed Drawer Footer (Always visible without scroll) */}
                  <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 shrink-0 mt-3">
                    <button
                      onClick={() => setIsSettingsOpen(false)}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
                    >
                      {t.doneAndClose}
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
