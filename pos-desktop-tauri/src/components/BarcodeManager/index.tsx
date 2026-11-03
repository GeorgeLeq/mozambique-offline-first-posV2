import React, { useState, useEffect, useMemo } from 'react';
import { getDB } from '../../lib/db';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { sanitizeString, sanitizeNumeric } from '../../lib/security/sanitizer';
import { BarcodeRecord } from './types';
import { generateEAN13, generateVariableEAN13, printBarcodeSheet } from './utils';
import { GenerateModal } from './GenerateModal';
import { EditModal } from './EditModal';
import { DetailsModal } from './DetailsModal';
import { BarcodeHeader } from './BarcodeHeader';
import { BarcodeTable } from './BarcodeTable';
import { DeleteConfirmModal } from '../RestockManager/DeleteConfirmModal';
import { BarcodeGuideModal } from './BarcodeGuideModal';
import { useSubscription } from '../../subscription';
import { 
  getBarcodeUsageSummary, 
  checkBarcodeLimit, 
  BarcodeUsageSummary 
} from './services/barcodeLimitService';
import { useTableWatcher } from '../../lib/dbEvents';
import { syncBarcodeUsageToCloud } from '../../lib/syncEngine/heartbeat';
import { downloadPNG } from './utils';
import { useI18n } from '../../i18n';

export default function BarcodeManager({ onBack }: { onBack: () => void }) {
  const t = useI18n();
  const { openFeatureLockModal } = useSubscription();
  const [barcodes, setBarcodes] = useState<BarcodeRecord[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [barcodeUsage, setBarcodeUsage] = useState<BarcodeUsageSummary | null>(null);
  const [selectedBarcodes, setSelectedBarcodes] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'available' | 'used'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateCount, setGenerateCount] = useState('10');
  const [genShopName, setGenShopName] = useState(localStorage.getItem('receipt_header_title') || '');
  const [genItemName, setGenItemName] = useState('');
  const [genPrice, setGenPrice] = useState('');
  const [genAttributes, setGenAttributes] = useState('');
  const [genLinkedProductId, setGenLinkedProductId] = useState('');
  const [encodeVariablePrice, setEncodeVariablePrice] = useState(false);
  
  const [editingBarcode, setEditingBarcode] = useState<BarcodeRecord | null>(null);
  const [editShopName, setEditShopName] = useState('');
  const [editItemName, setEditItemName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editAttributes, setEditAttributes] = useState('');

  const [selectedBarcodeForDetails, setSelectedBarcodeForDetails] = useState<BarcodeRecord | null>(null);
  const [highlightedBarcode, setHighlightedBarcode] = useState<string | null>(null);

  const [barcodeToDelete, setBarcodeToDelete] = useState<string | null>(null);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);

  const handleOpenUpgradeModal = () => {
    openFeatureLockModal(
      'unlimited_barcodes',
      t.quotaLockTitle,
      t.quotaLockMsg
    );
  };

  const loadBarcodes = async (isInitial = false) => {
    try {
      if (isInitial || barcodes.length === 0) {
        setIsLoading(true);
      }
      const db = await getDB();
      const isTauri = typeof window !== 'undefined' && 
        ('__TAURI_INTERNALS__' in window || '__TAURI__' in window || '__TAURI_METADATA__' in window);
      
      let [allBarcodes, allProducts, usageSummary] = await Promise.all([
        db.select('SELECT * FROM barcodes ORDER BY created_at DESC') as Promise<BarcodeRecord[]>,
        db.select('SELECT id, name, price_mt, barcode FROM products ORDER BY name ASC') as Promise<any[]>,
        getBarcodeUsageSummary()
      ]);

      // If in browser mode and local storage is empty, fallback to live Supabase query
      if (!isTauri && (!allBarcodes || allBarcodes.length === 0)) {
        try {
          const shopIdSetting = await db.select("SELECT value FROM settings WHERE key = 'shop_id'").catch(() => []);
          const shopId = shopIdSetting?.[0]?.value;
          if (shopId) {
            const { data: cloudBarcodes } = await supabase.from('barcodes').select('*').eq('shop_id', shopId).order('created_at', { ascending: false });
            if (cloudBarcodes && cloudBarcodes.length > 0) {
              allBarcodes = cloudBarcodes as any[];
            }
          }
        } catch (_e) {}
      }

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

      setBarcodes(allBarcodes || []);
      setProducts(allProducts || []);
      setBarcodeUsage(usageSummary);
    } catch (err) {
      console.error('Failed to load barcodes:', err);
      toast.error(t.errorLoadingBarcodes);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBarcodes(true);

    const handleSubscriptionRefresh = () => {
      loadBarcodes(false);
    };

    window.addEventListener('subscription-entitlements-updated', handleSubscriptionRefresh);
    window.addEventListener('subscription-plans-updated', handleSubscriptionRefresh);

    return () => {
      window.removeEventListener('subscription-entitlements-updated', handleSubscriptionRefresh);
      window.removeEventListener('subscription-plans-updated', handleSubscriptionRefresh);
    };
  }, []);

  // Reset page to 1 whenever search query or status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchTerm]);

  useTableWatcher('barcodes', () => loadBarcodes(false));

  const handleGenerate = async () => {
    const count = parseInt(generateCount);
    if (isNaN(count) || count <= 0) {
      toast.error(t.invalidQuantity);
      return;
    }

    // Check plan quota limits before generation
    const limitCheck = await checkBarcodeLimit(count);
    if (!limitCheck.allowed) {
      toast.error(limitCheck.message, { duration: 5000 });
      handleOpenUpgradeModal();
      return;
    }
    
    const cleanShopName = sanitizeString(genShopName);
    const cleanItemName = sanitizeString(genItemName);
    const cleanAttributes = sanitizeString(genAttributes);
    const parsedPrice = genPrice ? sanitizeNumeric(genPrice, 0) : null;

    setIsGenerating(true);
    setShowGenerateModal(false);
    try {
      const db = await getDB();
      // Barcodes are permanent - no artificial 24h expiration
      const expiresAt = '2099-12-31T23:59:59.999Z';
      
      let lastGeneratedBarcode = '';
      for (let i = 0; i < count; i++) {
        let newBarcode = '';
        if (encodeVariablePrice && parsedPrice) {
          let itemCodeStr = undefined;
          if (genLinkedProductId) {
             const linked = products.find(p => p.id === genLinkedProductId);
             if (linked && linked.barcode && linked.barcode.length === 5) {
                itemCodeStr = linked.barcode;
             }
          }
          newBarcode = generateVariableEAN13(parsedPrice, false, itemCodeStr);
        } else {
          newBarcode = generateEAN13();
        }
        lastGeneratedBarcode = newBarcode;
        
        await db.execute(
          "INSERT INTO barcodes (barcode, status, expires_at, shop_name, item_name, price_mt, attributes, linked_product_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
             newBarcode, 
             (genLinkedProductId && i === count - 1) ? 'used' : 'available',
             expiresAt, 
             cleanShopName || null, 
             cleanItemName || null, 
             parsedPrice, 
             cleanAttributes || null,
             genLinkedProductId || null
          ]
        );
      }

      // If linked to a product, inject barcode directly onto the product table!
      if (genLinkedProductId && lastGeneratedBarcode) {
        await db.execute(
          "UPDATE products SET barcode = ?, updated_at = CURRENT_TIMESTAMP, sync_status = 0 WHERE id = ?",
          [lastGeneratedBarcode, genLinkedProductId]
        );
        toast.success(t.barcodeInjectedSuccess.replace('{code}', lastGeneratedBarcode));
      } else {
        toast.success(t.barcodesGeneratedSuccess.replace('{count}', count.toString()));
      }
      
      await loadBarcodes();
    } catch (err) {
      console.error('Failed to generate barcodes:', err);
      toast.error(t.errorGeneratingBarcodes);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateBarcode = async () => {
    if (!editingBarcode) return;
    try {
      const db = await getDB();
      const cleanShop = sanitizeString(editShopName);
      const cleanItem = sanitizeString(editItemName);
      const cleanAttrs = sanitizeString(editAttributes);
      const parsedPrice = editPrice ? sanitizeNumeric(editPrice, 0) : null;

      await db.execute(
        "UPDATE barcodes SET shop_name = ?, item_name = ?, price_mt = ?, attributes = ? WHERE barcode = ?",
        [cleanShop, cleanItem, parsedPrice, cleanAttrs || null, editingBarcode.barcode]
      );
      await loadBarcodes();
      toast.success(t.barcodeUpdatedSuccess);
      setEditingBarcode(null);
    } catch (err) {
      console.error('Failed to update barcode:', err);
      toast.error(t.errorUpdatingBarcode);
    }
  };

  const handleDeleteBarcode = (barcode: string) => {
    setBarcodeToDelete(barcode);
  };

  const confirmDeleteBarcode = async () => {
    if (!barcodeToDelete) return;
    try {
      const db = await getDB();
      await db.execute("DELETE FROM barcodes WHERE barcode = ?", [barcodeToDelete]);
      await loadBarcodes();
      toast.success(t.barcodeDeletedSuccess);
      setBarcodeToDelete(null);
    } catch (err) {
      console.error('Failed to delete barcode:', err);
      toast.error(t.errorDeletingBarcode);
    }
  };

  const handleSaveBarcode = async (barcode: string) => {
    try {
      const db = await getDB();
      const futureDate = new Date('2099-12-31T23:59:59.000Z').toISOString();
      await db.execute(
        "UPDATE barcodes SET expires_at = ? WHERE barcode = ?",
        [futureDate, barcode]
      );
      await loadBarcodes();
      toast.success(t.barcodeSavedPermanently.replace('{code}', barcode));
    } catch (err) {
      console.error('Failed to save barcode:', err);
      toast.error(t.errorSavingBarcode);
    }
  };

  const handleBulkSave = async () => {
    if (selectedBarcodes.size === 0) return;
    try {
      const db = await getDB();
      const futureDate = new Date('2099-12-31T23:59:59.000Z').toISOString();
      for (const barcode of selectedBarcodes) {
        await db.execute("UPDATE barcodes SET expires_at = ? WHERE barcode = ?", [futureDate, barcode]);
      }
      await loadBarcodes();
      toast.success(t.bulkSavedSuccess.replace('{count}', selectedBarcodes.size.toString()));
      setSelectedBarcodes(new Set());
    } catch (err) {
      console.error('Bulk save failed', err);
      toast.error(t.errorBulkSaving);
    }
  };

  const handleBulkDownload = () => {
    if (selectedBarcodes.size === 0) return;
    const selectedList = barcodes.filter(b => selectedBarcodes.has(b.barcode));
    selectedList.forEach(b => {
      downloadPNG(b.barcode, b);
    });
    toast.success(t.downloadingCount.replace('{count}', selectedList.length.toString()));
  };

  const handleBulkDelete = () => {
    if (selectedBarcodes.size === 0) return;
    setIsBulkDeleteConfirmOpen(true);
  };

  const confirmBulkDeleteBarcodes = async () => {
    if (selectedBarcodes.size === 0) return;
    try {
      const db = await getDB();
      for (const barcode of selectedBarcodes) {
        await db.execute("DELETE FROM barcodes WHERE barcode = ?", [barcode]);
      }
      await loadBarcodes();
      toast.success(t.bulkDeletedSuccess.replace('{count}', selectedBarcodes.size.toString()));
      setSelectedBarcodes(new Set());
      setIsBulkDeleteConfirmOpen(false);
    } catch (err) {
      console.error('Bulk delete failed', err);
      toast.error(t.errorBulkDeleting);
    }
  };

  const toggleSelection = (barcode: string) => {
    const next = new Set(selectedBarcodes);
    if (next.has(barcode)) {
      next.delete(barcode);
    } else {
      next.add(barcode);
    }
    setSelectedBarcodes(next);
  };

  const toggleSelectAll = () => {
    if (selectedBarcodes.size === filteredBarcodes.length && filteredBarcodes.length > 0) {
      setSelectedBarcodes(new Set());
    } else {
      setSelectedBarcodes(new Set(filteredBarcodes.map(b => b.barcode)));
    }
  };

  const availableCount = useMemo(() => {
    return barcodes.filter(b => b.status === 'available').length;
  }, [barcodes]);

  const usedCount = useMemo(() => {
    return barcodes.filter(b => b.status === 'used').length;
  }, [barcodes]);

  const filteredBarcodes = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    return barcodes.filter(b => {
      if (filter === 'available' && b.status !== 'available') return false;
      if (filter === 'used' && b.status !== 'used') return false;
      if (query) {
        const matchCode = b.barcode.toLowerCase().includes(query);
        const matchItem = (b.item_name || '').toLowerCase().includes(query);
        const matchShop = (b.shop_name || '').toLowerCase().includes(query);
        if (!matchCode && !matchItem && !matchShop) return false;
      }
      return true;
    });
  }, [barcodes, filter, searchTerm]);

  const totalPages = Math.ceil(filteredBarcodes.length / pageSize) || 1;
  const paginatedBarcodes = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBarcodes.slice(start, start + pageSize);
  }, [filteredBarcodes, currentPage, pageSize]);

  return (
    <div className="flex-1 flex flex-col h-screen w-full relative overflow-hidden bg-[#fbfbfd] dark:bg-zinc-950 text-slate-800 dark:text-zinc-100">
      {/* Single Unified Edge-to-Edge Topbar Header */}
      <BarcodeHeader 
        onBack={onBack}
        filteredBarcodes={filteredBarcodes}
        isGenerating={isGenerating}
        isLoading={isLoading}
        onRefresh={() => loadBarcodes(true)}
        onPrintSheet={() => printBarcodeSheet(filteredBarcodes)}
        onOpenGenerateModal={() => setShowGenerateModal(true)}
        onOpenGuideModal={() => setIsGuideOpen(true)}
        usage={barcodeUsage}
        onOpenUpgradeModal={handleOpenUpgradeModal}
      />

      {/* Main Full-Screen Table View with Integrated Toolbar (No Double Header) */}
      <main className="flex-1 relative flex flex-col overflow-hidden w-full h-full">
        <BarcodeTable 
          isLoading={isLoading}
          filteredBarcodes={filteredBarcodes}
          paginatedBarcodes={paginatedBarcodes}
          selectedBarcodes={selectedBarcodes}
          highlightedBarcode={highlightedBarcode}
          setHighlightedBarcode={setHighlightedBarcode}
          toggleSelectAll={toggleSelectAll}
          toggleSelection={toggleSelection}
          setSelectedBarcodeForDetails={setSelectedBarcodeForDetails}
          handleSaveBarcode={handleSaveBarcode}
          setEditingBarcode={setEditingBarcode}
          setEditShopName={setEditShopName}
          setEditItemName={setEditItemName}
          setEditPrice={setEditPrice}
          setEditAttributes={setEditAttributes}
          handleDeleteBarcode={handleDeleteBarcode}
          currentPage={currentPage}
          pageSize={pageSize}
          totalPages={totalPages}
          setCurrentPage={setCurrentPage}
          filter={filter}
          setFilter={setFilter}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          totalBarcodesCount={barcodes.length}
          availableBarcodesCount={availableCount}
          usedBarcodesCount={usedCount}
          handleBulkDownload={handleBulkDownload}
          handleBulkDelete={handleBulkDelete}
        />
      </main>
      
      <GenerateModal 
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onGenerate={handleGenerate}
        generateCount={generateCount}
        setGenerateCount={setGenerateCount}
        shopName={genShopName}
        setShopName={setGenShopName}
        itemName={genItemName}
        setItemName={setGenItemName}
        price={genPrice}
        setPrice={setGenPrice}
        attributes={genAttributes}
        setAttributes={setGenAttributes}
        products={products}
        linkedProductId={genLinkedProductId}
        setLinkedProductId={setGenLinkedProductId}
        encodeVariablePrice={encodeVariablePrice}
        setEncodeVariablePrice={setEncodeVariablePrice}
        usage={barcodeUsage}
      />

      <EditModal 
        editingBarcode={editingBarcode}
        onClose={() => setEditingBarcode(null)}
        onSave={handleUpdateBarcode}
        editShopName={editShopName}
        setEditShopName={setEditShopName}
        editItemName={editItemName}
        setEditItemName={setEditItemName}
        editPrice={editPrice}
        setEditPrice={setEditPrice}
        editAttributes={editAttributes}
        setEditAttributes={setEditAttributes}
      />

      <DetailsModal 
        barcodeRecord={selectedBarcodeForDetails}
        onClose={() => setSelectedBarcodeForDetails(null)}
        onSave={(bc) => handleSaveBarcode(bc)}
        onEdit={(b) => {
          setSelectedBarcodeForDetails(null);
          setEditingBarcode(b);
          setEditShopName(b.shop_name || '');
          setEditItemName(b.item_name || '');
          setEditPrice(b.price_mt?.toString() || '');
          setEditAttributes(b.attributes || '');
        }}
      />

      {barcodeToDelete && (
        <DeleteConfirmModal
          title={t.deleteBarcodeTitle}
          message={t.deleteBarcodeMsg.replace('{code}', barcodeToDelete)}
          onConfirm={confirmDeleteBarcode}
          onClose={() => setBarcodeToDelete(null)}
        />
      )}

      {isBulkDeleteConfirmOpen && (
        <DeleteConfirmModal
          title={t.bulkDeleteTitle}
          message={t.bulkDeleteMsg.replace('{count}', selectedBarcodes.size.toString())}
          onConfirm={confirmBulkDeleteBarcodes}
          onClose={() => setIsBulkDeleteConfirmOpen(false)}
        />
      )}

      <BarcodeGuideModal 
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
}
