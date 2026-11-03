import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ThemeToggle } from '../ThemeToggle';
import { AmbientBackground } from '../AmbientBackground';
import { useNumpadAuth } from './hooks/useNumpadAuth';
import { useAdminRecovery } from './hooks/useAdminRecovery';
import { NumpadDisplay } from './components/NumpadDisplay';
import { CashShiftModal } from './components/CashShiftModal';
import { AdminRecoveryModal } from './components/AdminRecoveryModal';
import { NumpadFooterActions } from './components/NumpadFooterActions';

export default function NumpadLogin() {
  const {
    pin,
    error,
    isLoading: isAuthLoading,
    handleNumberClick,
    handleDelete,
    handleClear,
    handleLogin,
    pendingUser,
    isCashPromptOpen,
    cashInputValue,
    setCashInputValue,
    handleConfirmCashShift,
    handleCancelCashShift
  } = useNumpadAuth();

  const recovery = useAdminRecovery();
  const [isWipeLoading, setIsWipeLoading] = useState(false);

  const isGlobalLoading = isAuthLoading || isWipeLoading;

  // 1. If Cash Shift is requested (Cashier login), show the cash float modal
  if (isCashPromptOpen && pendingUser) {
    return (
      <CashShiftModal
        pendingUser={pendingUser}
        cashInputValue={cashInputValue}
        onCashInputChange={setCashInputValue}
        onNumberClick={handleNumberClick}
        onClear={handleClear}
        onDelete={handleDelete}
        onConfirm={handleConfirmCashShift}
        onCancel={handleCancelCashShift}
      />
    );
  }

  // 2. Standard 6-digit PIN login screen
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 font-sans select-none transition-colors duration-500 overflow-hidden relative">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <AmbientBackground />

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md flex flex-col items-center relative z-10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-10 sm:p-12 rounded-[3.5rem] shadow-[0_8px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.4)] border border-white/80 dark:border-white/10"
      >
        <div className="absolute inset-0 rounded-[3.5rem] bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />
        
        {/* SYCOMM Hero Brand & Enter Button */}
        <NumpadDisplay
          pin={pin}
          error={error}
          onQuickPin={(qpin) => handleLogin(qpin)}
          isLoading={isGlobalLoading}
        />

        {/* Footer Links & Actions */}
        <NumpadFooterActions
          onOpenRecovery={() => recovery.setIsRecoveryOpen(true)}
          onSetIsLoading={setIsWipeLoading}
        />
      </motion.div>

      {/* Admin Cloud Recovery Modal */}
      <AdminRecoveryModal
        isOpen={recovery.isRecoveryOpen}
        onClose={() => recovery.setIsRecoveryOpen(false)}
        shopCode={recovery.recoveryShopCode}
        onShopCodeChange={recovery.setRecoveryShopCode}
        isRecovering={recovery.isRecovering}
        onRecover={recovery.handleRecoverAdminPin}
      />
    </div>
  );
}
