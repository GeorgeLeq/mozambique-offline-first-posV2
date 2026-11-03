import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { RecentSalesModalProps } from './types';
import { useRecentSales } from './hooks/useRecentSales';
import { RecentSalesHeader } from './components/RecentSalesHeader';
import { RecentSalesToolbar } from './components/RecentSalesToolbar';
import { RecentSalesTable } from './components/RecentSalesTable';
import { RecentSalesDetail } from './components/RecentSalesDetail';
import { RecentSalesRefundWizard } from './RefundWizard';
import { WhatsAppQRModal } from '../../WhatsAppQRModal';

export function RecentSalesModal({ isOpen, onClose }: RecentSalesModalProps) {
  const {
    sales,
    loading,
    isFullScreen,
    setIsFullScreen,
    selectedSale,
    setSelectedSale,
    copiedId,
    searchQuery,
    setSearchQuery,
    paymentFilter,
    setPaymentFilter,
    timeFilter,
    setTimeFilter,
    pruneOption,
    setPruneOption,
    currentPage,
    setCurrentPage,
    pageSize,
    totalPages,
    filteredSales,
    paginatedSales,
    whatsappModalOpen,
    setWhatsappModalOpen,
    whatsappUrl,
    wizardOpen,
    setWizardOpen,
    refundReceiptId,
    refundItem,
    loadSales,
    handleCopyId,
    handlePrint,
    handleShareWhatsApp,
    handleVoidItem,
    handlePruneSales
  } = useRecentSales(isOpen);

  return createPortal(
    <>
      <AnimatePresence>
        {isOpen && (
          <div key="recent-sales-modal-container" className="fixed inset-0 z-50 flex justify-end">
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
            >
              {/* Header */}
              <RecentSalesHeader
                totalCount={filteredSales.length}
                isFullScreen={isFullScreen}
                onToggleFullScreen={() => setIsFullScreen(!isFullScreen)}
                onClose={onClose}
              />

              {/* Toolbar (Search, Filter, Time, Prune) */}
              <RecentSalesToolbar
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                paymentFilter={paymentFilter}
                setPaymentFilter={setPaymentFilter}
                timeFilter={timeFilter}
                setTimeFilter={setTimeFilter}
                pruneOption={pruneOption}
                setPruneOption={setPruneOption}
                onPrune={handlePruneSales}
              />

              {/* Split Body: Table & Detail Preview */}
              <div className="flex-1 flex overflow-hidden min-h-0">
                {/* Left Table Section */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden border-r border-slate-200 dark:border-zinc-900">
                  <RecentSalesTable
                    sales={paginatedSales}
                    filteredCount={filteredSales.length}
                    loading={loading}
                    selectedSale={selectedSale}
                    copiedId={copiedId}
                    currentPage={currentPage}
                    pageSize={pageSize}
                    totalPages={totalPages}
                    onSelectSale={setSelectedSale}
                    onCopyId={handleCopyId}
                    onPrint={handlePrint}
                    onPageChange={setCurrentPage}
                  />
                </div>

                {/* Right Side: Selected Sale Detail & Action Panel */}
                <RecentSalesDetail
                  selectedSale={selectedSale}
                  onPrint={handlePrint}
                  onShareWhatsApp={handleShareWhatsApp}
                  onVoidItem={handleVoidItem}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Advanced Item Refund Wizard */}
      <RecentSalesRefundWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        refundItem={refundItem}
        refundReceiptId={refundReceiptId}
        onRefundComplete={loadSales}
      />

      {/* WhatsApp QR / Share Modal */}
      <WhatsAppQRModal 
        isOpen={whatsappModalOpen} 
        onClose={() => setWhatsappModalOpen(false)} 
        whatsappUrl={whatsappUrl} 
      />
    </>,
    document.body
  );
}

export default RecentSalesModal;
