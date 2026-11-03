import { Product } from '../../../lib/api';
import { getDB } from '../../../lib/db';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import { logAudit } from '../../../lib/audit';
import { useProductFilters } from './useProductFilters';
import { useProductPagination } from './useProductPagination';
import { useProductSelection } from './useProductSelection';
import { useQuickStock } from './useQuickStock';
import { useProductModals } from './useProductModals';
import { useProductsI18n } from '../../../i18n';

interface UseProductListProps {
  products: Product[];
  onDeleteSuccess: () => void;
  isFocusMode?: boolean;
}

export function useProductList({ products, onDeleteSuccess, isFocusMode = false }: UseProductListProps) {
  const { currentUser } = useAuth();
  const t = useProductsI18n();

  // 1. Filtering, Search & Sorting
  const filters = useProductFilters(products);

  // 2. Pagination (6 standard, 9 expanded)
  const pagination = useProductPagination(
    filters.filteredProducts, 
    [filters.debouncedSearchTerm, filters.showLowStockOnly, filters.selectedCategory, filters.sortBy],
    isFocusMode
  );

  // 3. Selection & Batch Actions
  const selection = useProductSelection({
    products,
    filteredProducts: filters.filteredProducts,
    onDeleteSuccess
  });

  // 4. Quick Inline Stock Adjustments
  const quickStock = useQuickStock({
    onSuccess: onDeleteSuccess
  });

  // 5. Modal states
  const modals = useProductModals();

  // Single Product Deletion handler
  const handleDelete = (product: Product) => {
    if (product.requires_verification === 1 || product.requires_verification === true) {
      toast.error(`Não é possível eliminar "${product.name}" enquanto requerer Verificação de Acolhimento. Desative a verificação no Restoque primeiro.`);
      return;
    }
    modals.setProductToDelete(product);
  };

  const confirmDeleteProduct = async (justification?: string) => {
    if (!modals.productToDelete) return;
    try {
      const db = await getDB();

      if (modals.productToDelete.requires_verification === 1 || modals.productToDelete.requires_verification === true) {
        toast.error(`Não é possível eliminar "${modals.productToDelete.name}" enquanto requerer Verificação. Desative a verificação no Restoque primeiro.`);
        modals.setProductToDelete(null);
        return;
      }

      await db.execute('DELETE FROM barcodes WHERE linked_product_id = ?', [modals.productToDelete.id]);
      await db.execute('DELETE FROM product_aliases WHERE product_id = ?', [modals.productToDelete.id]);
      await db.execute('UPDATE products SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP, barcode = NULL, updated_at = CURRENT_TIMESTAMP, sync_status = 0 WHERE id = ?', [modals.productToDelete.id]);
      
      const logDetails = `Deleted product ${modals.productToDelete.name} (Barcode: ${modals.productToDelete.barcode})${justification ? ` - Justificativa: ${justification}` : ''}`;
      await logAudit(currentUser?.id, 'PRODUCT_DELETED', logDetails);
      toast.success(`${modals.productToDelete.name}: ${t.productDeletedSuccess}`);
      modals.setProductToDelete(null);
      onDeleteSuccess();
    } catch (err) {
      console.error(err);
      toast.error(t.errorDeletingProduct);
    }
  };

  return {
    // Filters & Sorting
    searchTerm: filters.searchTerm,
    setSearchTerm: filters.setSearchTerm,
    showLowStockOnly: filters.showLowStockOnly,
    setShowLowStockOnly: filters.setShowLowStockOnly,
    showLockedOnly: filters.showLockedOnly,
    setShowLockedOnly: filters.setShowLockedOnly,
    selectedCategory: filters.selectedCategory,
    setSelectedCategory: filters.setSelectedCategory,
    sortBy: filters.sortBy,
    setSortBy: filters.setSortBy,
    globalLowStockThreshold: filters.globalLowStockThreshold,
    categories: filters.categories,
    filteredProducts: filters.filteredProducts,

    // Pagination
    paginatedProducts: pagination.paginatedProducts,
    currentPage: pagination.currentPage,
    setCurrentPage: pagination.setCurrentPage,
    totalPages: pagination.totalPages,
    itemsPerPage: pagination.itemsPerPage,

    // Selection & Bulk Actions
    selectedProductIds: selection.selectedProductIds,
    setSelectedProductIds: selection.setSelectedProductIds,
    isBulkDeleteConfirmOpen: selection.isBulkDeleteConfirmOpen,
    setIsBulkDeleteConfirmOpen: selection.setIsBulkDeleteConfirmOpen,
    toggleSelectAll: selection.toggleSelectAll,
    toggleSelectProduct: selection.toggleSelectProduct,
    exportSelectedPDF: selection.exportSelectedPDF,
    exportSelectedCSV: selection.exportSelectedCSV,
    deleteSelectedProducts: selection.deleteSelectedProducts,
    confirmBulkDeleteProducts: selection.confirmBulkDeleteProducts,

    // Quick Stock
    quickStockId: quickStock.quickStockId,
    setQuickStockId: quickStock.setQuickStockId,
    quickStockValue: quickStock.quickStockValue,
    setQuickStockValue: quickStock.setQuickStockValue,
    quickStockInputRef: quickStock.quickStockInputRef,
    submitQuickStock: quickStock.submitQuickStock,

    // Modals
    isBulkEditModalOpen: modals.isBulkEditModalOpen,
    setIsBulkEditModalOpen: modals.setIsBulkEditModalOpen,
    aliasModalProduct: modals.aliasModalProduct,
    setAliasModalProduct: modals.setAliasModalProduct,
    printModalProducts: modals.printModalProducts,
    setPrintModalProducts: modals.setPrintModalProducts,
    infoModalProduct: modals.infoModalProduct,
    setInfoModalProduct: modals.setInfoModalProduct,
    productToDelete: modals.productToDelete,
    setProductToDelete: modals.setProductToDelete,
    handleDelete,
    confirmDeleteProduct
  };
}
