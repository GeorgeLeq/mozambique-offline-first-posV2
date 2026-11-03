import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ShoppingCart, History, Maximize2, Minimize2, ClipboardList } from 'lucide-react';
import { SmartRestockList } from './SmartRestockList';
import { RestockHistory } from './RestockHistory';
import { ExpectedDeliveries } from './ExpectedDeliveries';
import { useAuth } from '../../contexts/AuthContext';
import { AmbientBackground } from '../AmbientBackground';
import { useI18n, getLanguage, LanguageCode } from '../../i18n';
import { useProductManagerAuth } from '../ProductManager/hooks/useProductManagerAuth';
import { AdminPinModal } from '../ProductManager/AdminPinModal';

export default function RestockManager({ onBack }: { onBack: () => void }) {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'list' | 'history' | 'expected'>('list');
  const [isFocusMode, setIsFocusMode] = useState(false);

  const [lang, setLang] = useState<LanguageCode>(getLanguage());
  const t = useI18n(lang);

  const {
    isAdminUnlocked,
    showPinModal,
    setShowPinModal,
    pinValue,
    handlePromptAdminPin,
    handleVerifyPin,
    handleKeypadPress,
    handleKeypadClear,
    handleKeypadBackspace
  } = useProductManagerAuth(currentUser, activeTab);

  useEffect(() => {
    const handleLocaleChange = () => setLang(getLanguage());
    window.addEventListener('locale-changed', handleLocaleChange);
    return () => window.removeEventListener('locale-changed', handleLocaleChange);
  }, []);

  const hasOrdersPermission = () => {
    if (currentUser?.role === 'Admin' || isAdminUnlocked) return true;
    if (currentUser?.permissions_json) {
      try {
        const parsed = JSON.parse(currentUser.permissions_json);
        const perms: string[] = Array.isArray(parsed) ? parsed : (parsed.permissions || []);
        if (perms.includes('orders') || perms.includes('restock')) return true;
      } catch (e) {}
    }
    return false;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col font-sans relative"
    >
      <AmbientBackground />

      {/* Floating Exit Focus Mode Button */}
      {isFocusMode && (
        <button
          onClick={() => setIsFocusMode(false)}
          className="fixed top-4 right-6 z-50 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-2xl cursor-pointer flex items-center gap-2 text-xs font-black uppercase tracking-wider transition-all border-0"
          title="Sair do Modo Foco"
        >
          <Minimize2 size={16} />
          <span>Sair do Modo Foco</span>
        </button>
      )}

      {/* Header (Hidden in Focus Mode) */}
      {!isFocusMode && (
        <div className="bg-white/60 dark:bg-zinc-900/60 backdrop-blur-3xl border-b border-slate-200/60 dark:border-white/10 sticky top-0 z-20 shadow-[0_4px_24px_rgba(0,0,0,0.02)] shrink-0 relative">
          <div className="max-w-[95%] xl:max-w-[98%] mx-auto px-4 md:px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <button 
                  onClick={onBack}
                  className="p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-zinc-800 shadow-xl dark:shadow-2xl shadow-slate-200/50 dark:shadow-black/50 transition-all text-slate-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:-translate-x-1 cursor-pointer"
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-zinc-100 uppercase">{t.restockTitle}</h1>
                  </div>
                  <p className="text-xs font-bold text-slate-500 dark:text-zinc-450 uppercase tracking-wider mt-0.5">{t.restockSubtitle}</p>
                </div>
              </div>

              {/* Main Header Focus Mode Toggle */}
              <button
                onClick={() => setIsFocusMode(true)}
                className="px-4 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-2xl text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                title="Expandir ecra e ocultar cabeçalho"
              >
                <Maximize2 size={16} />
                <span className="hidden sm:inline">Modo Foco</span>
              </button>
            </div>
            
            <div className="flex bg-slate-100/80 dark:bg-zinc-950/60 p-1 rounded-2xl border border-slate-200/40 dark:border-zinc-800/60 max-w-xl gap-1 relative z-10">
              <button
                onClick={() => setActiveTab('list')}
                className={`flex-1 px-4 py-2.5 rounded-xl font-extrabold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer select-none outline-none ${
                  activeTab === 'list' 
                    ? 'bg-white dark:bg-zinc-850 text-red-600 dark:text-red-400 shadow-[0_4px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.25)] border border-slate-100 dark:border-zinc-800/40' 
                    : 'text-slate-500 dark:text-zinc-450 hover:text-slate-800 dark:hover:text-zinc-200'
                }`}
              >
                <ShoppingCart size={14} />
                {t.shoppingListTab}
              </button>
              
              {(currentUser?.role === 'Admin' || hasOrdersPermission()) && (
                <button
                  onClick={() => setActiveTab('expected')}
                  className={`flex-1 px-4 py-2.5 rounded-xl font-extrabold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer select-none outline-none ${
                    activeTab === 'expected' 
                      ? 'bg-white dark:bg-zinc-850 text-red-600 dark:text-red-400 shadow-[0_4px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.25)] border border-slate-100 dark:border-zinc-800/40' 
                      : 'text-slate-500 dark:text-zinc-450 hover:text-slate-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <ClipboardList size={14} />
                  {t.ordersTab}
                </button>
              )}

              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 px-4 py-2.5 rounded-xl font-extrabold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer select-none outline-none ${
                  activeTab === 'history' 
                    ? 'bg-white dark:bg-zinc-850 text-red-600 dark:text-red-400 shadow-[0_4px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.25)] border border-slate-100 dark:border-zinc-800/40' 
                    : 'text-slate-500 dark:text-zinc-450 hover:text-slate-800 dark:hover:text-zinc-200'
                }`}
              >
                <History size={14} />
                {t.historyTab}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden relative flex flex-col">
        <AnimatePresence mode="wait">
          {activeTab === 'list' && (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex flex-col"
            >
              <SmartRestockList />
            </motion.div>
          )}
          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex flex-col"
            >
              <RestockHistory 
                isAdminUnlocked={isAdminUnlocked}
                onPromptAdminPin={handlePromptAdminPin}
              />
            </motion.div>
          )}
        
          {activeTab === 'expected' && (
            <motion.div
              key="expected"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex flex-col"
            >
              <ExpectedDeliveries 
                isAdminUnlocked={isAdminUnlocked}
                onPromptAdminPin={handlePromptAdminPin}
                isFocusMode={isFocusMode} 
                setIsFocusMode={setIsFocusMode} 
              />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Admin PIN Keypad Modal */}
      <AdminPinModal 
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        pinValue={pinValue}
        onKeypadPress={handleKeypadPress}
        onKeypadClear={handleKeypadClear}
        onKeypadBackspace={handleKeypadBackspace}
        onVerifyPin={handleVerifyPin}
      />
    </motion.div>
  );
}
