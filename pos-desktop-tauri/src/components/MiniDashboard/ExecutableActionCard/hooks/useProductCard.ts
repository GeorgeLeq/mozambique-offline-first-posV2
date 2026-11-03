/**
 * @file useProductCard.ts
 * @description Hook managing product creation form state, SQLite insertion, auto-save trigger, and undo.
 */

import { useState, useEffect } from 'react';
import { ExecutableAiAction } from '../../../../lib/ai/types';
import { getDB } from '../../../../lib/db';
import { logAudit } from '../../../../lib/audit';
import toast from 'react-hot-toast';
import { posActionDispatcher as chatAgentBridge } from '../../../../lib/ai/actions';

interface UseProductCardProps {
  data: Extract<ExecutableAiAction, { type: 'create_product' }>['data'];
  executed?: boolean;
  autoSaveEnabled: boolean;
  currentUser?: { id?: string; name?: string; role?: string } | null;
  onExecuted: () => void;
}

export function useProductCard({
  data,
  executed = false,
  autoSaveEnabled,
  currentUser,
  onExecuted
}: UseProductCardProps) {
  const [isDone, setIsDone] = useState(executed);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSavedNotice, setAutoSavedNotice] = useState(false);
  const [lastInsertedId, setLastInsertedId] = useState<string | null>(null);

  const [prodName, setProdName] = useState(data.name || '');
  const [prodPrice, setProdPrice] = useState(data.price_mt?.toString() || '50');
  const [prodCost, setProdCost] = useState(data.cost_price_mt?.toString() || '35');
  const [prodStock, setProdStock] = useState(data.stock_quantity?.toString() || '12');
  const [prodCategory, setProdCategory] = useState(data.category || 'Geral');
  const [prodUnitType, setProdUnitType] = useState(data.unit_type || 'unit');
  const [prodPackUnits, setProdPackUnits] = useState(data.pack_units?.toString() || '24');
  const [prodBarcode, setProdBarcode] = useState(data.barcode || '');

  // Auto-save on mount if enabled
  useEffect(() => {
    if (autoSaveEnabled && !executed && !isDone && !isSubmitting && prodName) {
      handleSaveProduct(true);
    }
  }, []);

  const handleSaveProduct = async (isAuto = false) => {
    if (!prodName.trim()) {
      if (!isAuto) toast.error('Product name is required');
      return;
    }
    const priceNum = parseFloat(prodPrice) || 0;
    const costNum = parseFloat(prodCost) || 0;
    const stockNum = parseFloat(prodStock) || 0;

    setIsSubmitting(true);
    try {
      const res = await chatAgentBridge.createProduct(
        {
          name: prodName.trim(),
          barcode: prodBarcode.trim() || undefined,
          category: prodCategory.trim() || 'Geral',
          unit_type: (prodUnitType as any) || 'unit',
          cost_price: costNum,
          price: priceNum,
          stock_quantity: stockNum
        },
        currentUser?.id || 'admin'
      );

      if (!res.success) {
        throw new Error(res.error || 'Failed to create product');
      }

      const newId = res.data?.id;
      setLastInsertedId(newId);
      setIsDone(true);
      if (isAuto) {
        setAutoSavedNotice(true);
        toast.success(`⚡ Auto-salvo via ChatAgentBridge: "${prodName}" (${stockNum} un)`, { icon: '🤖' });
      } else {
        toast.success(`Produto "${prodName}" salvo com sucesso!`);
      }
      onExecuted();
    } catch (err: any) {
      console.error('[useProductCard] Save product error:', err);
      if (!isAuto) toast.error(`Falha ao salvar produto: ${err.message || 'Código de barras duplicado'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUndoProduct = async () => {
    if (!lastInsertedId) return;
    try {
      const db = await getDB();
      await db.execute('DELETE FROM products WHERE id = ?', [lastInsertedId]);
      setIsDone(false);
      setAutoSavedNotice(false);
      setLastInsertedId(null);
      toast.success('Produto removido do SQLite. Pode editar e salvar novamente.');
    } catch (_err) {
      toast.error('Não foi possível desfazer a inserção.');
    }
  };

  return {
    isDone,
    isSubmitting,
    autoSavedNotice,
    lastInsertedId,
    prodName,
    setProdName,
    prodPrice,
    setProdPrice,
    prodCost,
    setProdCost,
    prodStock,
    setProdStock,
    prodCategory,
    setProdCategory,
    prodUnitType,
    setProdUnitType,
    prodBarcode,
    setProdBarcode,
    handleSaveProduct,
    handleUndoProduct
  };
}
