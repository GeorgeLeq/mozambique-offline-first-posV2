/**
 * @file index.tsx
 * @description Main Numpad Login Screen with Collapsible Numpad & English Quick Access.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ThemeToggle } from '../ThemeToggle';
import { AmbientBackground } from '../AmbientBackground';
import { useNumpadAuth } from './hooks/useNumpadAuth';
import { useAdminRecovery } from './hooks/useAdminRecovery';
import { NumpadDisplay } from './components/NumpadDisplay';
import { NumpadGrid } from './components/NumpadGrid';
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
  const [showKeypad, setShowKeypad] = useState(false);

  const isGlobalLoading = isAuthLoading || isWipeLoading;

  // Auto-expand keypad if user starts typing digits
  useEffect(() => {
    if (pin.length > 0 && !showKeypad) {
      setShowKeypad(true);
    }
  }, [pin]);

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

  // 2. Standard PIN login screen with Collapsible Numpad and Quick Access
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-3 sm:p-4 font-sans select-none transition-colors duration-500 overflow-y-auto relative">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <AmbientBackground />

      <motion.div 
        initial={{ opacity: 0, y: 15, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md flex flex-col items-center relative z-10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-6 sm:p-8 rounded-[2.5rem] shadow-[0_8px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.4)] border border-white/80 dark:border-white/10 my-4"
      >
        <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />
        
        {/* SYCOMM Hero Brand, English Quick Access, Masked PIN Dots & Keypad Toggle */}
        <NumpadDisplay
          pin={pin}
          error={error}
          onQuickPin={(qpin) => handleLogin(qpin)}
          isLoading={isGlobalLoading}
          showKeypad={showKeypad}
          onToggleKeypad={() => setShowKeypad(prev => !prev)}
        />

        {/* Collapsible Tactile Retail POS Numpad Grid */}
        <AnimatePresence>
          {showKeypad && (
            <motion.div
              initial={{ height: 0, opacity: 0, scale: 0.95 }}
              animate={{ height: 'auto', opacity: 1, scale: 1 }}
              exit={{ height: 0, opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="w-full flex justify-center overflow-hidden"
            >
              <NumpadGrid
                onNumberClick={handleNumberClick}
                onClear={handleClear}
                onDelete={handleDelete}
                onSubmit={() => handleLogin(pin || '1234')}
                canSubmit={pin.length >= 4}
                isLoading={isGlobalLoading}
              />
            </motion.div>
          )}
        </AnimatePresence>

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
