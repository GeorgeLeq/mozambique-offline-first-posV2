import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RecentSalesRefundWizardProps } from './types';
import { useRefundWizard } from './hooks/useRefundWizard';
import { RefundWizardHeader } from './components/RefundWizardHeader';
import { PINStep } from './components/PINStep';
import { ConditionStep } from './components/ConditionStep';
import { ReversalStep } from './components/ReversalStep';

export function RecentSalesRefundWizard({
  isOpen,
  onClose,
  refundItem,
  refundReceiptId,
  onRefundComplete,
}: RecentSalesRefundWizardProps) {
  const {
    wizardStep,
    setWizardStep,
    managerPin,
    setManagerPin,
    authorizedManager,
    pinError,
    setPinError,
    itemCondition,
    setItemCondition,
    refundTimeLimit,
    refundMethod,
    daysSinceSale,
    isTimeLimitExceeded,
    handlePinSubmit,
    handleClose,
    handleFinalizeRefund,
  } = useRefundWizard({
    isOpen,
    refundItem,
    refundReceiptId,
    onClose,
    onRefundComplete,
  });

  return (
    <AnimatePresence>
      {isOpen && refundItem && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85  animate-fade-in">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-md bg-white dark:bg-zinc-950 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] border border-slate-100 dark:border-white/10 p-6 flex flex-col gap-6 overflow-hidden"
            id="refund-wizard-container"
          >
            {/* Header / Progress bar */}
            <RefundWizardHeader wizardStep={wizardStep} onClose={handleClose} />

            {/* Step 1: PIN Verification */}
            {wizardStep === 'pin' && (
              <PINStep
                refundItem={refundItem}
                refundReceiptId={refundReceiptId}
                isTimeLimitExceeded={isTimeLimitExceeded}
                daysSinceSale={daysSinceSale}
                refundTimeLimit={Number(refundTimeLimit)}
                managerPin={managerPin}
                setManagerPin={setManagerPin}
                pinError={pinError}
                setPinError={setPinError}
                handlePinSubmit={handlePinSubmit}
              />
            )}

            {/* Step 2: Product Condition Selection */}
            {wizardStep === 'condition' && authorizedManager && (
              <ConditionStep
                authorizedManager={authorizedManager}
                refundItem={refundItem}
                setItemCondition={setItemCondition}
                setWizardStep={setWizardStep}
              />
            )}

            {/* Step 3: Cash/Method Reversal & Confirmation */}
            {wizardStep === 'reversal' && authorizedManager && itemCondition && (
              <ReversalStep
                refundItem={refundItem}
                authorizedManager={authorizedManager}
                itemCondition={itemCondition}
                refundMethod={refundMethod}
                handleFinalizeRefund={handleFinalizeRefund}
                setWizardStep={setWizardStep}
              />
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default RecentSalesRefundWizard;
