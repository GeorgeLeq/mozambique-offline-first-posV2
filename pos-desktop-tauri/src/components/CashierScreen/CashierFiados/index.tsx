import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CashierFiadosModalProps } from './types';
import { useFiadosData } from './hooks/useFiadosData';
import { FiadosHeader } from './components/FiadosHeader';
import { FiadosToolbar } from './components/FiadosToolbar';
import { FiadosTable } from './components/FiadosTable';
import { FiadosSettlePanel } from './components/FiadosSettlePanel';
import { FiadosItemsModal } from './components/FiadosItemsModal';
import { ManualDebtModal } from '../../ClientManager/ManualDebtModal';

export function CashierFiadosModal({ isOpen, onClose, currentUser }: CashierFiadosModalProps) {
  const {
    loadDebts,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    selectedDebt,
    setSelectedDebt,
    isSettleOpen,
    setIsSettleOpen,
    settleAmount,
    setSettleAmount,
    settleMethod,
    setSettleMethod,
    isNewDebtOpen,
    setIsNewDebtOpen,
    isFullScreen,
    setIsFullScreen,
    itemsModalOpen,
    setItemsModalOpen,
    itemsModalDebt,
    handleOpenItemsModal,
    currentPage,
    setCurrentPage,
    pageSize,
    totalPages,
    filteredDebts,
    paginatedDebts,
    totalOutstandingBalance,
    isSubmitting,
    onConfirmSettle,
    handleSaveNewDebt,
  } = useFiadosData(isOpen, currentUser);

  return createPortal(
    <>
      <AnimatePresence>
        {isOpen && (
          <div key="cashier-fiados-modal-container" className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={onClose}
              className="absolute inset-0 bg-black/75 "
            />

            {/* Slide-over Drawer / Fullscreen Container */}
            <motion.div
              layout
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={{ 
                x: { type: 'spring', stiffness: 350, damping: 32, mass: 0.8 },
                layout: { type: 'spring', stiffness: 300, damping: 28, mass: 0.8 },
                opacity: { duration: 0.2 }
              }}
              className={`relative ${
                isFullScreen ? 'w-full max-w-full' : 'w-full sm:w-[680px] md:w-[840px] lg:w-[1020px] xl:w-[1180px]'
              } bg-white dark:bg-zinc-950 border-l border-slate-200 dark:border-zinc-900 shadow-2xl flex flex-col h-full z-10 text-slate-800 dark:text-white select-none overflow-hidden transition-colors duration-300`}
              id="cashier-fiados-drawer"
            >
              {/* Header */}
              <FiadosHeader
                totalCount={filteredDebts.length}
                totalOutstanding={totalOutstandingBalance}
                isFullScreen={isFullScreen}
                onRefresh={loadDebts}
                onNewDebt={() => setIsNewDebtOpen(true)}
                onToggleFullScreen={() => setIsFullScreen(!isFullScreen)}
                onClose={onClose}
              />

              {/* Toolbar: Search + Status Tabs */}
              <FiadosToolbar
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
              />

              {/* Body: Split View (Left Table of Debts + Right Direct Settle Panel) */}
              <div className="flex-1 flex overflow-hidden min-h-0">
                {/* Left Table Section (No scrollbar, pure pagination) */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden border-r border-slate-200 dark:border-zinc-900">
                  <FiadosTable
                    debts={paginatedDebts}
                    selectedDebt={selectedDebt}
                    onSelectDebt={(debt) => {
                      setSelectedDebt(debt);
                      setIsSettleOpen(true);
                    }}
                    onViewItems={handleOpenItemsModal}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalFilteredCount={filteredDebts.length}
                    onPageChange={setCurrentPage}
                  />
                </div>

                {/* Right Side: Settlement & Details Panel */}
                <FiadosSettlePanel
                  selectedDebt={selectedDebt}
                  isSettleOpen={isSettleOpen}
                  settleAmount={settleAmount}
                  setSettleAmount={setSettleAmount}
                  settleMethod={settleMethod}
                  setSettleMethod={setSettleMethod}
                  isSubmitting={isSubmitting}
                  onClosePanel={() => {
                    setSelectedDebt(null);
                    setIsSettleOpen(false);
                  }}
                  onConfirmSettle={onConfirmSettle}
                  onViewItems={handleOpenItemsModal}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Fiado Items Breakdown Modal (Option A - Dedicated Paginated Dialog) */}
      <FiadosItemsModal
        isOpen={itemsModalOpen}
        onClose={() => setItemsModalOpen(false)}
        debt={itemsModalDebt}
        currentUser={currentUser}
      />

      {/* Manual Debt Creation Modal */}
      <ManualDebtModal
        isOpen={isNewDebtOpen}
        onClose={() => setIsNewDebtOpen(false)}
        onSave={handleSaveNewDebt}
        editDebt={null}
      />
    </>,
    document.body
  );
}

export default CashierFiadosModal;
