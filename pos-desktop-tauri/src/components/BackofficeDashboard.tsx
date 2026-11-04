import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Users, Package, Barcode, UserCircle2, FileText, 
  Settings as SettingsIcon, LayoutDashboard, Sliders, RefreshCw, 
  Search, ChevronLeft, ChevronRight, LogOut, Wallet, ShieldCheck, Eye, Lock, Crown, Bot 
} from 'lucide-react';
import EmployeeManager from './employee';
import ProductManager from './ProductManager';
import BarcodeManager from './BarcodeManager';
import ClientManager from './ClientManager';
import ShiftReports from './ShiftReports';
import Settings from './Settings';
import AuditLogs from './AuditLogs';
import ScanHistoryManager from './ScanHistory';
import RestockManager from './RestockManager';
import { NotificationMenu } from './NotificationMenu';
import { motion, AnimatePresence } from 'motion/react';
import { ThemeToggle } from './ThemeToggle';
import { AmbientBackground } from './AmbientBackground';
import { InternetStatusBadge } from './InternetStatusBadge';
import { FullscreenButton } from './FullscreenButton';
import { FeatureGate, useSubscription } from '../subscription';

import { useAuth } from "../contexts/AuthContext";
import { useI18n } from '../i18n';
import MiniDashboard from './MiniDashboard';
import CashierControlManager from './CashierControlManager';
import { useShiftManagement } from './CashierScreen/hooks/useShiftManagement';
import { SmartExitModal } from './CashierScreen/SmartExitModal';
import { BlindCloseModal } from './CashierScreen/BlindCloseModal';

const menuItems = [
  { id: 'menu', label: 'Painel Principal', icon: LayoutDashboard, permission: 'dashboard' },
  { id: 'products', label: 'Produtos', icon: Package, permission: 'products' },
  { id: 'barcodes', label: 'Cód. de Barras', icon: Barcode, permission: 'barcodes' },
  { id: 'clients', label: 'Fiados & Clientes', icon: UserCircle2, permission: 'clients' },
  { id: 'restock', label: 'Reabastecimento', icon: RefreshCw, permission: 'restock' },
  { id: 'employees', label: 'Operadores', icon: Users, permission: 'employees', adminOnly: true },
  { id: 'caixas', label: 'Controle de Caixa', icon: Wallet, permission: 'employees', adminOnly: true },
  { id: 'reports', label: 'Fechos & Relatórios', icon: FileText, permission: 'reports' },
  { id: 'scans', label: 'Histórico de Leituras', icon: Search, permission: 'scans' },
  { id: 'audit', label: 'Auditoria', icon: Sliders, permission: 'audit' },
  { id: 'stock_checker', label: 'Consulta de Stock', icon: Eye, permission: 'stock_checker' },
];

export default function BackofficeDashboard({ onBack }: { onBack: () => void }) {
  const { currentUser, logout } = useAuth();
  const t = useI18n();
  const { isFeatureUnlocked, openSubscriptionPage, isProActive, openFeatureLockModal } = useSubscription();
  const [isSmartExitOpen, setIsSmartExitOpen] = useState(false);
  const [isBlindCloseModalOpen, setIsBlindCloseModalOpen] = useState(false);
  const [targetScanUser, setTargetScanUser] = useState<{id: string, name: string} | null>(null);

  const { dailyTotal, shiftStats, handleCloseShift } = useShiftManagement(
    currentUser,
    [],
    isBlindCloseModalOpen,
    false,
    setIsBlindCloseModalOpen,
    logout
  );

  const [activeTab, setActiveTab] = useState<'menu' | 'employees' | 'products' | 'barcodes' | 'clients' | 'reports' | 'settings' | 'audit' | 'scans' | 'restock' | 'caixas' | 'stock_checker'>(() => {
    if (currentUser?.role?.toLowerCase() === 'admin') return 'menu';
    try {
      const perms = currentUser?.permissions_json ? JSON.parse(currentUser.permissions_json) : [];
      if (perms.includes('dashboard')) return 'menu';
      // Find the first tab they have permission for
      const allowed = menuItems.find(item => {
        if (item.adminOnly) return false;
        if (item.permission && perms.includes(item.permission)) return true;
        return false;
      });
      return (allowed?.id || 'menu') as any;
    } catch {
      return 'menu';
    }
  });
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('backoffice_sidebar_collapsed') === 'true';
  });
  const [isSidebarVisible, setIsSidebarVisible] = useState(() => {
    return localStorage.getItem('backoffice_sidebar_visible') !== 'false';
  });

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('backoffice_sidebar_collapsed', String(next));
      return next;
    });
  };

  const toggleSidebarVisibility = () => {
    setIsSidebarVisible(prev => {
      const next = !prev;
      localStorage.setItem('backoffice_sidebar_visible', String(next));
      return next;
    });
  };

  const hasPermission = (page: string) => {
    if (currentUser?.role?.toLowerCase() === 'admin') return true;
    try {
      const perms = currentUser?.permissions_json ? JSON.parse(currentUser.permissions_json) : [];
      return perms.includes(page);
    } catch {
      return false;
    }
  };

  const [returnToAiChat, setReturnToAiChat] = useState(false);

  useEffect(() => {
    const handleAiNav = () => setReturnToAiChat(true);
    window.addEventListener('ai-navigated-shortcut', handleAiNav);
    return () => window.removeEventListener('ai-navigated-shortcut', handleAiNav);
  }, []);

  const handleSubViewBack = () => {
    setActiveTab('menu');
    if (returnToAiChat) {
      setReturnToAiChat(false);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('open-muse-agent-chat'));
      }, 100);
    }
  };

  const allowedItems = menuItems.filter(item => {
    if (item.adminOnly && currentUser?.role?.toLowerCase() !== 'admin') return false;
    if (item.permission && !hasPermission(item.permission)) return false;
    return true;
  });

  const renderContent = () => {
    if (activeTab === 'employees') {
      return <EmployeeManager onBack={handleSubViewBack} />;
    }
    if (activeTab === 'caixas') {
      return <CashierControlManager onBack={handleSubViewBack} />;
    }
    if (activeTab === 'products') {
      return <ProductManager onBack={handleSubViewBack} defaultTab="inventory" />;
    }
    if (activeTab === 'barcodes') {
      return <BarcodeManager onBack={handleSubViewBack} />;
    }
    if (activeTab === 'clients') {
      return <ClientManager onBack={handleSubViewBack} />;
    }
    if (activeTab === 'reports') {
      return (
        <ShiftReports 
          onBack={handleSubViewBack}
          onOpenScans={hasPermission('scans') ? (userId, userName) => {
            if (!isFeatureUnlocked('advanced_audits')) {
              openFeatureLockModal(
                'advanced_audits',
                'Auditoria Avançada de Leituras (Anti-Furto)',
                'O histórico minucioso de cada código de barras bipado por operador e timestamps de venda faz parte do módulo de Auditoria Avançada. Atualize para blindar o seu negócio contra quebras de caixa.'
              );
              return;
            }
            if (userId && userName) setTargetScanUser({ id: userId, name: userName });
            setActiveTab('scans');
          } : undefined}
        />
      );
    }
    if (activeTab === 'settings') {
      return <Settings onBack={handleSubViewBack} />;
    }
    if (activeTab === 'audit') {
      return <AuditLogs onBack={handleSubViewBack} />;
    }
    if (activeTab === 'scans') {
      return (
        <FeatureGate
          feature="advanced_audits"
          title="Auditoria Avançada de Leituras (Anti-Furto)"
          description="O histórico minucioso de cada código de barras bipado por operador, timestamps de venda e auditoria de sangrias faz parte dos planos Pro e Enterprise ou do módulo independente de Auditoria. Desbloqueie o módulo para blindar o seu negócio contra quebras de caixa."
        >
          <ScanHistoryManager onBack={() => {
            setTargetScanUser(null);
            handleSubViewBack();
          }} initialUser={targetScanUser} />
        </FeatureGate>
      );
    }
    if (activeTab === 'restock') {
      return <ProductManager onBack={handleSubViewBack} defaultTab="orders" />;
    }
    if (activeTab === 'stock_checker') {
      return <ProductManager onBack={handleSubViewBack} defaultTab="checker" />;
    }

    return (
      <motion.div 
        key="menu"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="h-screen flex flex-col p-6 font-sans select-none transition-colors duration-500 overflow-y-auto lg:overflow-hidden relative"
      >
        <div className="absolute top-6 right-6 z-50 flex items-center gap-3">
          <button
            onClick={toggleSidebarVisibility}
            className={`flex items-center gap-1.5 py-2 px-3.5 rounded-2xl border transition-all text-xs font-black uppercase tracking-wider shadow-sm cursor-pointer select-none outline-none ${
              !isSidebarVisible 
                ? 'bg-red-600 border-red-500 text-white shadow-md shadow-red-600/25' 
                : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-850'
            }`}
            title={t.focusModeTooltip}
          >
            <Sliders size={13} className={!isSidebarVisible ? 'text-white animate-pulse' : 'text-slate-400'} />
            <span>{t.focusMode.replace('{{status}}', !isSidebarVisible ? 'ON' : 'OFF')}</span>
          </button>
          
          <button
            onClick={() => setActiveTab('settings')}
            className="flex items-center gap-1.5 py-2 px-3.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:border-indigo-500/30 transition-all text-xs font-black text-slate-700 dark:text-zinc-300 cursor-pointer"
            title={t.managementTooltip}
          >
            <SettingsIcon size={13} className="text-indigo-500 stroke-[2.5]" />
            <span>{t.managementBtn}</span>
          </button>

          <NotificationMenu onNavigate={(tab) => setActiveTab(tab as any)} />
          <ThemeToggle />
        </div>

        <AmbientBackground />

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-4 mt-2 max-w-7xl w-full mx-auto relative z-10 gap-4 flex-wrap sm:flex-nowrap shrink-0"
        >
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2.5 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-zinc-800 shadow-lg dark:shadow-xl shadow-slate-200/50 dark:shadow-black/50 transition-all text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:-translate-x-1 cursor-pointer"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">{t.dashboardTitle}</h1>
                <InternetStatusBadge />
                <FullscreenButton />
              </div>
              <p className="text-slate-500 dark:text-zinc-400 font-medium text-xs mt-0.5">{t.dashboardSubtitle}</p>
            </div>
          </div>
        </motion.div>

        <MiniDashboard onNavigate={(tab) => setActiveTab(tab as any)} />
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 transition-colors duration-500 overflow-hidden relative">
      {/* Universal Collapsible Sidebar */}
      <div 
        className={`shrink-0 h-screen bg-white/90 dark:bg-zinc-900/90 backdrop-blur-3xl border-r border-slate-200/60 dark:border-zinc-800/65 flex flex-col justify-between transition-all duration-300 relative z-30 shadow-[4px_0_24px_rgba(0,0,0,0.03)] ${
          !isSidebarVisible 
            ? 'w-0 overflow-hidden border-r-0 opacity-0 pointer-events-none -translate-x-full' 
            : isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto hide-scrollbar p-4">
          {/* Brand Logo Header with elegant Opera Mini crimson accent */}
          <div className="flex items-center gap-3 px-2 py-4 mb-6 border-b border-slate-100 dark:border-zinc-800/60">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white font-black text-xl shadow-[0_4px_12px_rgba(239,68,68,0.3)] shrink-0 select-none animate-pulse">
              O
            </div>
            {!isCollapsed && (
              <div className="min-w-0 select-none">
                <span className="block text-[11px] font-black uppercase tracking-widest text-red-600 dark:text-red-400">
                  MozPOS Gestão
                </span>
                <span className="block text-[10px] font-bold text-slate-450 dark:text-zinc-500 truncate">
                  {currentUser?.name || 'Administrador'}
                </span>
              </div>
            )}
          </div>

          {/* Redesigned Navigation Items */}
          <nav className="space-y-1.5">
            {allowedItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isLocked = item.id === 'scans' && !isFeatureUnlocked('advanced_audits');
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'scans' && !isFeatureUnlocked('advanced_audits')) {
                      openFeatureLockModal(
                        'advanced_audits',
                        'Auditoria Avançada de Leituras (Anti-Furto)',
                        'O acesso ao histórico detalhado de bips e produtos por operador requer o plano Pro ou módulo de Auditoria Avançada.'
                      );
                      return;
                    }
                    setActiveTab(item.id as any);
                  }}
                  className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl transition-all font-extrabold text-[11px] uppercase tracking-wider cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-500/25 scale-[1.02] border-0'
                      : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100/60 dark:hover:bg-zinc-800/40 hover:text-slate-900 dark:hover:text-zinc-100 hover:translate-x-1'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon size={16} className={`shrink-0 transition-colors ${isActive ? 'text-white' : 'text-slate-450 dark:text-zinc-500'}`} />
                  {!isCollapsed && (
                    <div className="flex-1 flex items-center justify-between min-w-0">
                      <span className="truncate">{item.label}</span>
                      {isLocked && (
                        <span className="p-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 shrink-0 ml-1">
                          <Lock size={10} />
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Operations */}
        <div className="p-4 border-t border-slate-100 dark:border-zinc-850 space-y-2 shrink-0">

          {/* Quick Focus Mode Toggler */}
          <button
            onClick={toggleSidebarVisibility}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-dashed text-slate-450 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 font-black text-[9px] uppercase tracking-widest transition-all ${
              isCollapsed ? 'justify-center border-slate-200 dark:border-zinc-800' : 'border-slate-200 dark:border-zinc-800'
            }`}
            title={isCollapsed ? 'Activar Modo Foco' : undefined}
          >
            <Sliders size={14} className="shrink-0" />
            {!isCollapsed && <span className="truncate">Modo Foco (Ocultar)</span>}
          </button>

          {/* Quick Settings Button */}
          {hasPermission('settings') && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all font-extrabold text-[11px] uppercase tracking-wider cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-500/25 border-0 scale-[1.02]'
                  : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100/60 dark:hover:bg-zinc-800/40 hover:text-slate-900 dark:hover:text-zinc-100'
              } ${isCollapsed ? 'justify-center' : ''}`}
              title={isCollapsed ? 'Configurações' : undefined}
            >
              <SettingsIcon size={16} className={`shrink-0 transition-colors ${activeTab === 'settings' ? 'text-white' : 'text-slate-450 dark:text-zinc-500'}`} />
              {!isCollapsed && <span className="truncate">Configurações</span>}
            </button>
          )}

          {/* Voltar ao Caixa button */}
          <button
            onClick={onBack}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold text-xs transition-all ${
              isCollapsed ? 'justify-center' : ''
            }`}
            title={isCollapsed ? 'Voltar ao Caixa' : undefined}
          >
            <ArrowLeft size={16} className="shrink-0 text-slate-400 dark:text-zinc-500" />
            {!isCollapsed && <span className="truncate">Voltar ao Caixa</span>}
          </button>

          {/* Sair do Sistema (Terminar Sessão) button */}
          <button
            onClick={() => {
              setIsSmartExitOpen(true);
            }}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-500 dark:text-zinc-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-450 font-bold text-xs transition-all ${
              isCollapsed ? 'justify-center' : ''
            }`}
            title={isCollapsed ? 'Terminar Sessão' : undefined}
          >
            <LogOut size={16} className="shrink-0 text-slate-400 dark:text-zinc-500" />
            {!isCollapsed && <span className="truncate">Terminar Sessão</span>}
          </button>

          {/* Collapse/Expand Toggle button */}
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center p-2 rounded-xl bg-slate-50 dark:bg-zinc-800/30 text-slate-450 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all cursor-pointer border border-slate-100 dark:border-zinc-800/50"
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 h-screen overflow-auto relative flex flex-col">
        <AnimatePresence mode="wait">
          {renderContent()}
        </AnimatePresence>

        {/* Floating Sidebar Restore Action Button - ONLY appears if Sidebar is completely hidden */}
        {!isSidebarVisible && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            whileHover={{ scale: 1.05 }}
            onClick={toggleSidebarVisibility}
            className="fixed bottom-6 left-6 z-50 px-5 py-3.5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-2xl shadow-[0_8px_32px_rgba(220,38,38,0.35)] transition-all flex items-center gap-2 font-black text-[10px] uppercase tracking-widest cursor-pointer border border-red-500 hover:from-red-700 hover:to-rose-700 select-none outline-none"
            title="Sair do Modo Foco (Mostrar Barra)"
          >
            <ChevronRight size={15} className="stroke-[3] animate-pulse" />
            <span>Mostrar Barra</span>
          </motion.button>
        )}

        {/* Floating Return to AI Chat Button */}
        {returnToAiChat && activeTab !== 'menu' && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            whileHover={{ scale: 1.05 }}
            onClick={handleSubViewBack}
            className="fixed top-5 right-20 z-[9999] px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-2xl shadow-xl shadow-indigo-600/30 transition-all flex items-center gap-2 font-extrabold text-xs cursor-pointer border border-indigo-500 hover:from-indigo-500 hover:to-indigo-600 select-none outline-none animate-bounce"
            title="Click to return directly to Store Sentinel AI Chat"
          >
            <Bot className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>Return to AI Chat 💬</span>
          </motion.button>
        )}
      </div>

      {/* Smart Exit Interceptor Prompt */}
      <SmartExitModal
        isOpen={isSmartExitOpen}
        onClose={() => setIsSmartExitOpen(false)}
        currentUser={currentUser}
        shiftStats={shiftStats}
        dailyTotal={dailyTotal}
        onTriggerCloseShift={() => setIsBlindCloseModalOpen(true)}
        onJustExit={logout}
      />

      {/* Blind Close Modal */}
      <BlindCloseModal
        isOpen={isBlindCloseModalOpen}
        onClose={() => setIsBlindCloseModalOpen(false)}
        onConfirmClose={handleCloseShift}
      />
    </div>
  );
}
