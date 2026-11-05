/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import CashierScreen from './components/CashierScreen';
import DeviceActivation from './components/DeviceActivation';
import NumpadLogin from './components/NumpadLogin';
import BackofficeDashboard from './components/BackofficeDashboard';
import { syncProductsAndDeliveriesToCloud, syncAllToCloud } from './lib/syncEngine';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './components/ThemeProvider';
import { 
  SubscriptionProvider, 
  useSubscription, 
  FeatureLockModal, 
  PaymentProofModal, 
  OfflineUnlockModal, 
  SubscriptionPage 
} from './subscription';
import { UpdateProvider } from './contexts/UpdateContext';
import UpdateHardBlockModal from './components/UpdateHardBlockModal';
import UpdateBanner from './components/UpdateBanner';
import { useWindowExitGuard } from './hooks/useWindowExitGuard';
import { ShiftExitGuardModal } from './components/CashierScreen/ShiftExitGuardModal';
import { StaleShiftRecoveryModal } from './components/CashierScreen/StaleShiftRecoveryModal';
import { BlindCloseModal } from './components/CashierScreen/BlindCloseModal';
import { isShiftStale, closeShiftRecord } from './lib/shift/shiftManager';
import { ErrorBoundary } from './components/ErrorBoundary';
import toast from 'react-hot-toast';

function AppContent() {
  const { isActivated, currentUser, logout } = useAuth();
  const { isSubscriptionPageOpen, closeSubscriptionPage } = useSubscription();
  const [showBackoffice, setShowBackoffice] = useState(false);

  // Shift Exit Guard & Stale Shift Recovery State
  const [isExitGuardModalOpen, setIsExitGuardModalOpen] = useState(false);
  const [isStaleShiftModalOpen, setIsStaleShiftModalOpen] = useState(false);
  const [isGlobalBlindCloseOpen, setIsGlobalBlindCloseOpen] = useState(false);
  const [closeAfterBlindClose, setCloseAfterBlindClose] = useState(false);
  const [staleShiftInfo, setStaleShiftInfo] = useState<{ startTime: string; baseCash: number }>({ startTime: '', baseCash: 0 });

  const { forceExitApp } = useWindowExitGuard({
    currentUser,
    onOpenExitGuardModal: () => setIsExitGuardModalOpen(true)
  });

  // Check for stale unclosed shift on login (e.g. overnight power cut recovery)
  useEffect(() => {
    if (currentUser?.current_shift_start) {
      if (isShiftStale(currentUser.current_shift_start)) {
        setStaleShiftInfo({
          startTime: currentUser.current_shift_start,
          baseCash: currentUser.current_shift_cash ?? 0
        });
        setIsStaleShiftModalOpen(true);
      }
    } else {
      setIsStaleShiftModalOpen(false);
    }
  }, [currentUser?.id, currentUser?.current_shift_start]);

  useEffect(() => {
    if (!isActivated || !currentUser) return;

    // Initial sync with 3s grace delay to let UI mount smoothly
    const initialSyncTimer = setTimeout(() => {
      syncAllToCloud();
    }, 3000);

    // Auto-sync interval: runs every 60s when online and document is visible
    const SYNC_INTERVAL_MS = 60000;
    const syncInterval = setInterval(() => {
      if (navigator.onLine && !document.hidden) {
        syncAllToCloud();
      }
    }, SYNC_INTERVAL_MS);

    // Trigger sync on Window Focus, Visibility Change, or Network Reconnection with 30s cooldown
    let lastFocusTime = Date.now();
    const FOCUS_COOLDOWN_MS = 30000;

    const handleWindowFocus = () => {
      if (document.hidden) return;
      const now = Date.now();
      if (now - lastFocusTime >= FOCUS_COOLDOWN_MS) {
        lastFocusTime = now;
        syncAllToCloud();
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('online', handleWindowFocus);
    document.addEventListener('visibilitychange', handleWindowFocus);

    return () => {
      clearTimeout(initialSyncTimer);
      clearInterval(syncInterval);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('online', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleWindowFocus);
    };
  }, []);

  // Set initial screen based on administrative permissions on login
  useEffect(() => {
    if (currentUser) {
      const hasBackofficeAccess = currentUser.role?.toLowerCase() === 'admin' || (() => {
        try {
          const perms = currentUser.permissions_json ? JSON.parse(currentUser.permissions_json) : [];
          return perms && perms.length > 0;
        } catch {
          return false;
        }
      })();

      if (hasBackofficeAccess) {
        setShowBackoffice(true);
      } else {
        setShowBackoffice(false);
      }
    } else {
      setShowBackoffice(false);
    }
  }, [currentUser]);

  if (isActivated === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white font-sans">
        <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-indigo-500 animate-spin"></div>
        </div>
        <span className="text-sm font-semibold tracking-wide text-slate-400">A iniciar base de dados...</span>
      </div>
    );
  }

  const isFirstBootComplete = typeof window !== 'undefined' && localStorage.getItem('pos_first_boot_complete') === 'true';

  if (!isActivated) {
    if (isFirstBootComplete) {
      return (
        <>
          <UpdateBanner />
          <NumpadLogin />
          <UpdateHardBlockModal />
        </>
      );
    }

    return (
      <>
        <UpdateBanner />
        <DeviceActivation />
        <UpdateHardBlockModal />
      </>
    );
  }

  if (!currentUser) {
    return (
      <>
        <UpdateBanner />
        <NumpadLogin />
        <UpdateHardBlockModal />
      </>
    );
  }

  const hasBackofficeAccess = currentUser.role?.toLowerCase() === 'admin' || (() => {
    try {
      const perms = currentUser.permissions_json ? JSON.parse(currentUser.permissions_json) : [];
      return perms && perms.length > 0;
    } catch {
      return false;
    }
  })();


  const handleConfirmCloseShift = async (reportedAmount: number, detailsJson?: string) => {
    try {
      await closeShiftRecord(currentUser, reportedAmount, detailsJson);
      toast.success('Turno fechado com sucesso.');
      setIsGlobalBlindCloseOpen(false);
      setIsExitGuardModalOpen(false);
      setIsStaleShiftModalOpen(false);

      if (closeAfterBlindClose) {
        setCloseAfterBlindClose(false);
        await forceExitApp();
      } else {
        logout();
      }
    } catch (err) {
      console.error('Failed to close shift from global guard:', err);
      toast.error('Erro ao fechar turno');
    }
  };

  const screen = (showBackoffice && hasBackofficeAccess)
    ? <BackofficeDashboard onBack={() => setShowBackoffice(false)} />
    : <CashierScreen onOpenBackoffice={() => setShowBackoffice(true)} />;

  return (
    <>
      <UpdateBanner />
      {screen}
      <FeatureLockModal />
      <PaymentProofModal />
      <OfflineUnlockModal />
      <UpdateHardBlockModal />

      {/* Global Shift Exit Guard (Intercepts Windows 'X', Alt+F4) */}
      <ShiftExitGuardModal
        isOpen={isExitGuardModalOpen}
        onClose={() => setIsExitGuardModalOpen(false)}
        currentUser={currentUser}
        onTriggerCloseShift={() => {
          setIsExitGuardModalOpen(false);
          setCloseAfterBlindClose(true);
          setIsGlobalBlindCloseOpen(true);
        }}
        onForceExitApproved={() => {
          setIsExitGuardModalOpen(false);
          forceExitApp();
        }}
      />

      {/* Startup Stale-Shift Recovery Guard (Power Cuts & Sudden Shutdowns) */}
      <StaleShiftRecoveryModal
        isOpen={isStaleShiftModalOpen}
        onClose={() => setIsStaleShiftModalOpen(false)}
        shiftStartTime={staleShiftInfo.startTime}
        baseCash={staleShiftInfo.baseCash}
        currentUser={currentUser}
        onTriggerCloseShift={() => {
          setIsStaleShiftModalOpen(false);
          setCloseAfterBlindClose(false);
          setIsGlobalBlindCloseOpen(true);
        }}
        onContinueCurrentShiftApproved={() => {
          setIsStaleShiftModalOpen(false);
        }}
      />

      {/* Global Blind Close Modal for Exit / Stale Recovery flows */}
      <BlindCloseModal
        isOpen={isGlobalBlindCloseOpen}
        onClose={() => {
          setIsGlobalBlindCloseOpen(false);
          setCloseAfterBlindClose(false);
        }}
        onConfirmClose={handleConfirmCloseShift}
      />
    </>
  );
}

import { Toaster } from 'react-hot-toast';
import { CustomerDisplayView } from './components/CustomerDisplay/CustomerDisplayView';

export default function App() {
  const isCustomerDisplay = typeof window !== 'undefined' && 
    (window.location.search.includes('window=customer-display') || window.location.hash.includes('customer-display'));

  if (isCustomerDisplay) {
    return (
      <ThemeProvider defaultTheme="light">
        <CustomerDisplayView />
        <Toaster position="top-right" />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider defaultTheme="light">
      <AuthProvider>
        <SubscriptionProvider>
          <UpdateProvider>
            <ErrorBoundary>
              <AppContent />
            </ErrorBoundary>
            <Toaster 
              position="top-right" 
              toastOptions={{
                style: {
                  background: '#18181b',
                  color: '#fff',
                  border: '1px solid #27272a',
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
                  borderRadius: '16px',
                  fontFamily: 'inherit',
                  fontWeight: 500,
                  fontSize: '14px',
                  letterSpacing: '-0.01em',
                  padding: '12px 20px',
                },
                success: {
                  style: {
                    background: '#059669',
                    color: '#ffffff',
                    border: '1px solid #047857',
                    boxShadow: '0 20px 40px -10px rgba(5,150,105,0.4)',
                  },
                  iconTheme: {
                    primary: '#ffffff',
                    secondary: '#059669',
                  },
                },
                error: {
                  style: {
                    background: '#e11d48',
                    color: '#ffffff',
                    border: '1px solid #be123c',
                    boxShadow: '0 20px 40px -10px rgba(225,29,72,0.4)',
                  },
                  iconTheme: {
                    primary: '#ffffff',
                    secondary: '#e11d48',
                  },
                },
              }}
            />
          </UpdateProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
