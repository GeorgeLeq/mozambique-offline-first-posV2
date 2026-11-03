import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, 
  Upload, 
  FileText, 
  FileDown, 
  Lock, 
  Unlock, 
  Plus,
  ClipboardList,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getDB } from '../../lib/db';
import { supabase } from '../../lib/supabase';
import { Product } from '../../lib/api';
import { useTableWatcher } from '../../lib/dbEvents';

import { ProductList } from './ProductList';
import { ProductForm } from './ProductForm';
import { BreakdownModal } from './BreakdownModal';
import { StockCheckerTab } from './StockCheckerTab';
import { ExpectedDeliveries } from '../RestockManager/ExpectedDeliveries';
import { RestockHistory } from '../RestockManager/RestockHistory';
import { useAuth } from '../../contexts/AuthContext';
import { AmbientBackground } from '../AmbientBackground';
import { ProductHeader } from './ProductHeader';
import { AdminPinModal } from './AdminPinModal';
import { useProductManagerAuth } from './hooks/useProductManagerAuth';
import { 
  exportProductsPDF, 
  exportProductsCSV, 
  downloadCSVTemplate, 
  importProductsCSV 
} from './utils/productExportImport';
import { useSubscription } from '../../subscription';
import { getProductCatalogUsage, ProductUsageSummary } from './services/productLimitService';
import { getExpectedDeliveryUsage, DeliveryUsageSummary } from '../RestockManager/services/deliveryLimitService';

interface ProductManagerProps {
  onBack: () => void;
  defaultTab?: 'checker' | 'inventory' | 'orders';
}

export default function ProductManager({ onBack, defaultTab = 'checker' }: ProductManagerProps) {
  const { currentUser } = useAuth();
  const { openFeatureLockModal } = useSubscription();
  const [products, setProducts] = useState<Product[]>([]);
  const [productUsage, setProductUsage] = useState<ProductUsageSummary | null>(null);
  const [deliveryUsage, setDeliveryUsage] = useState<DeliveryUsageSummary | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [availableBarcodes, setAvailableBarcodes] = useState<string[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [isFocusMode, setIsFocusMode] = useState(() => {
    return localStorage.getItem('products_focus_mode') === 'true';
  });

  const toggleFocusMode = () => {
    setIsFocusMode(prev => {
      const next = !prev;
      localStorage.setItem('products_focus_mode', String(next));
      return next;
    });
  };

  // Sub-tabs
  const [activeTab, setActiveTab] = useState<'checker' | 'inventory' | 'orders'>(defaultTab);
  const [orderSubTab, setOrderSubTab] = useState<'pending' | 'history'>('pending');

  const {
    isAdminUnlocked,
    showPinModal,
    setShowPinModal,
    pinValue,
    handleLockSession,
    handlePromptAdminPin,
    handleVerifyPin,
    handleKeypadPress,
    handleKeypadClear,
    handleKeypadBackspace,
    checkIsOrdersUnlocked,
    checkIsProductsUnlocked
  } = useProductManagerAuth(currentUser, activeTab);

  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  const [breakdownSource, setBreakdownSource] = useState<Product | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProducts = async (silent: boolean = false) => {
    try {
      if (!silent) {
        setIsProductsLoading(true);
      }
      const db = await getDB();
      const isTauri = typeof window !== 'undefined' && 
        ('__TAURI_INTERNALS__' in window || '__TAURI__' in window || '__TAURI_METADATA__' in window);

      let allProducts = await db.select('SELECT * FROM products WHERE is_deleted IS NULL OR is_deleted = 0 ORDER BY name ASC') as Product[];

      if (!isTauri && (!allProducts || allProducts.length === 0)) {
        try {
          const shopIdSetting = await db.select("SELECT value FROM settings WHERE key = 'shop_id'").catch(() => []);
          const shopId = shopIdSetting?.[0]?.value;
          if (shopId) {
            const { data: cloudProds } = await supabase.from('products').select('*').eq('shop_id', shopId).order('name', { ascending: true });
            if (cloudProds && cloudProds.length > 0) {
              allProducts = cloudProds as any[];
            }
          }
        } catch (_e) {}
      }

      setProducts(allProducts || []);

      const available = await db.select("SELECT barcode FROM barcodes WHERE status = 'available' LIMIT 100") as {barcode: string}[];
      setAvailableBarcodes((available || []).map(a => a.barcode));

      // Refresh catalog quota usage & delivery quota usage
      const [usageStats, delivStats] = await Promise.all([
        getProductCatalogUsage(),
        getExpectedDeliveryUsage()
      ]);
      setProductUsage(usageStats);
      setDeliveryUsage(delivStats);
    } catch (err) {
      console.error('Failed to load products', err);
    } finally {
      if (!silent) {
        setIsProductsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadProducts(false);
    console.log('[DEBUG] ProductManager Mounted with active tab:', activeTab);

    const handleSubscriptionRefresh = () => {
      loadProducts(true);
    };

    window.addEventListener('subscription-entitlements-updated', handleSubscriptionRefresh);
    window.addEventListener('subscription-plans-updated', handleSubscriptionRefresh);

    return () => {
      window.removeEventListener('subscription-entitlements-updated', handleSubscriptionRefresh);
      window.removeEventListener('subscription-plans-updated', handleSubscriptionRefresh);
    };
  }, []);

  useTableWatcher('products', () => loadProducts(true));
  useTableWatcher('barcodes', () => loadProducts(true));
  useTableWatcher('expected_deliveries', () => loadProducts(true));

  const handleOpenUpgradeModal = () => {
    openFeatureLockModal(
      'unlimited_products',
      'Limite do Catálogo de Produtos',
      'Atingiu a capacidade máxima de produtos do Plano Grátis (50 produtos). Atualize para o Plano Pro para cadastrar e gerir produtos ilimitados.'
    );
  };

  const handleOpenDeliveryUpgradeModal = () => {
    openFeatureLockModal(
      'expected_deliveries',
      'Limite de Encomendas Previstas',
      'Atingiu a capacidade máxima de encomendas do Plano Grátis (50 encomendas). Atualize para o Plano Pro para cadastrar e gerir encomendas ilimitadas.'
    );
  };

  const handleTabChange = (tab: 'checker' | 'inventory' | 'orders') => {
    if (tab === 'orders') {
      if (!checkIsOrdersUnlocked()) {
        handlePromptAdminPin(() => {
          setActiveTab('orders');
          setIsAdding(false);
        }, 'orders');
        return;
      }
    } else if (tab === 'inventory') {
      if (!checkIsProductsUnlocked()) {
        handlePromptAdminPin(() => {
          setActiveTab('inventory');
          setIsAdding(false);
        }, 'products');
        return;
      }
    }
    setActiveTab(tab);
    setIsAdding(false);
  };

  const handleStartEdit = (product: Product) => {
    if (!checkIsProductsUnlocked()) {
      handlePromptAdminPin(() => {
        setEditingProduct(product);
        setIsAdding(true);
      }, 'products');
    } else {
      setEditingProduct(product);
      setIsAdding(true);
    }
  };

  const handleOpenBreakdown = (product: Product) => {
    if (!checkIsProductsUnlocked()) {
      handlePromptAdminPin(() => {
        setBreakdownSource(product);
        setIsBreakdownOpen(true);
      }, 'products');
    } else {
      setBreakdownSource(product);
      setIsBreakdownOpen(true);
    }
  };

  const handleCloseBreakdown = () => {
    setIsBreakdownOpen(false);
  };

  const handleBreakdownSuccess = () => {
    setIsBreakdownOpen(false);
    loadProducts();
  };

  return (
    <div className="flex-1 flex flex-col h-screen relative overflow-hidden bg-[#fbfbfd] dark:bg-zinc-950 text-slate-800 dark:text-zinc-100">
      <AmbientBackground />

      {!isFocusMode && (
        <ProductHeader 
          onBack={onBack}
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          setIsAdding={setIsAdding}
          isAdminUnlocked={isAdminUnlocked}
          onLockSession={handleLockSession}
          onPromptAdminPin={() => handlePromptAdminPin(() => {})}
          onExportPDF={() => exportProductsPDF(products, isAdminUnlocked)}
          onExportCSV={() => exportProductsCSV(products, isAdminUnlocked)}
          onImportCSV={() => fileInputRef.current?.click()}
          onDownloadTemplate={downloadCSVTemplate}
          usage={productUsage}
          deliveryUsage={deliveryUsage}
          onOpenUpgradeModal={handleOpenUpgradeModal}
          onOpenDeliveryUpgradeModal={handleOpenDeliveryUpgradeModal}
        />
      )}

      {/* Hidden file input for CSV Import */}
      <input 
        type="file" 
        accept=".csv" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={(e) => importProductsCSV(e, loadProducts, handleOpenUpgradeModal)} 
      />

      {/* Main Content Area - Immersive Edge-to-Edge */}
      <div className="flex-1 relative z-10 flex overflow-hidden">
        <AnimatePresence mode="wait">
          {/* TAB 1: Stock Checker */}
          {activeTab === 'checker' && (
            <motion.div
              key="checker-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <StockCheckerTab 
                products={products} 
                isLoading={isProductsLoading} 
                onRefresh={loadProducts} 
                isFocusMode={isFocusMode}
                onToggleFocusMode={toggleFocusMode}
                activeTab={activeTab}
                onSelectTab={handleTabChange}
              />
            </motion.div>
          )}

          {/* TAB 2: Product Inventory List */}
          {activeTab === 'inventory' && (
            <motion.div
              key="inventory-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${
                isFocusMode ? 'p-0 gap-0' : 'px-4 py-3 gap-3'
              }`}
            >
              {/* Main Catalog Listing - Edge to Edge Immersive */}
              <div className={`flex-1 overflow-hidden flex relative ${
                isFocusMode
                  ? 'bg-white dark:bg-zinc-950 border-0 rounded-none shadow-none'
                  : 'bg-white/80 dark:bg-zinc-900/85 rounded-xl shadow-sm border border-slate-200/60 dark:border-white/10'
              }`}>
                <ProductList 
                  products={products} 
                  isAdding={isAdding} 
                  onOpenBreakdown={handleOpenBreakdown}
                  onStartEdit={handleStartEdit}
                  onDeleteSuccess={() => loadProducts()}
                  readOnly={false}
                  isAdminUnlocked={isAdminUnlocked}
                  onPromptAdminPin={handlePromptAdminPin}
                  isLoading={isProductsLoading}
                  onRefresh={loadProducts}
                  isFocusMode={isFocusMode}
                  onToggleFocusMode={toggleFocusMode}
                  activeTab={activeTab}
                  onSelectTab={handleTabChange}
                />

                <AnimatePresence>
                  {isAdding && (
                    <ProductForm 
                      editingProduct={editingProduct}
                      availableBarcodes={availableBarcodes}
                      onSave={() => {
                        loadProducts();
                        setIsAdding(false);
                        setEditingProduct(null);
                      }}
                      onCancel={() => {
                        setIsAdding(false);
                        setEditingProduct(null);
                      }}
                    />
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* TAB 3: Encomendas / PO & Receção */}
          {activeTab === 'orders' && (
            <motion.div
              key="orders-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${
                isFocusMode ? 'p-0 gap-0' : 'px-4 py-3 gap-3'
              }`}
            >
              <div className={`flex-1 overflow-hidden flex relative ${
                isFocusMode
                  ? 'bg-white dark:bg-zinc-950 border-0 rounded-none shadow-none'
                  : 'bg-white/80 dark:bg-zinc-900/85 rounded-xl shadow-sm border border-slate-200/60 dark:border-white/10'
              }`}>
                <AnimatePresence mode="wait">
                  {orderSubTab === 'pending' ? (
                    <motion.div
                      key="po-pending"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.15 }}
                      className="flex-1 flex flex-col overflow-hidden"
                    >
                      <ExpectedDeliveries 
                        isAdminUnlocked={isAdminUnlocked}
                        onPromptAdminPin={handlePromptAdminPin}
                        isFocusMode={isFocusMode}
                        setIsFocusMode={toggleFocusMode}
                        activeTab={activeTab}
                        onSelectTab={handleTabChange}
                        orderSubTab={orderSubTab}
                        onSelectOrderSubTab={setOrderSubTab}
                        deliveryUsage={deliveryUsage}
                        onOpenDeliveryUpgradeModal={handleOpenDeliveryUpgradeModal}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="po-history"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15 }}
                      className="flex-1 flex flex-col overflow-hidden"
                    >
                      <RestockHistory 
                        isAdminUnlocked={isAdminUnlocked}
                        onPromptAdminPin={handlePromptAdminPin}
                        orderSubTab={orderSubTab}
                        onSelectOrderSubTab={setOrderSubTab}
                        isFocusMode={isFocusMode}
                        onToggleFocusMode={toggleFocusMode}
                        activeTab={activeTab}
                        onSelectTab={handleTabChange}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Breakdown Modal */}
      <AnimatePresence>
        {isBreakdownOpen && breakdownSource && (
          <BreakdownModal 
            isOpen={isBreakdownOpen}
            onClose={handleCloseBreakdown}
            breakdownSource={breakdownSource}
            products={products}
            onSuccess={handleBreakdownSuccess}
          />
        )}
      </AnimatePresence>

      {/* Admin PIN Modal */}
      <AdminPinModal 
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        pinValue={pinValue}
        onKeypadPress={handleKeypadPress}
        onKeypadClear={handleKeypadClear}
        onKeypadBackspace={handleKeypadBackspace}
        onVerifyPin={handleVerifyPin}
      />
    </div>
  );
}
