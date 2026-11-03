/**
 * @file useUpdateProductCard.ts
 * @description Hook managing product update state, ChatAgentBridge execution, and auto-save.
 */

import { useState, useEffect } from 'react';
import { ExecutableAiAction } from '../../../../lib/ai/types';
import { posActionDispatcher as chatAgentBridge } from '../../../../lib/ai/actions';
import toast from 'react-hot-toast';

interface UseUpdateProductCardProps {
  data: Extract<ExecutableAiAction, { type: 'update_product' }>['data'];
  executed?: boolean;
  autoSaveEnabled: boolean;
  currentUser?: { id?: string; name?: string; role?: string } | null;
  onExecuted: () => void;
}

export function useUpdateProductCard({
  data,
  executed = false,
  autoSaveEnabled,
  currentUser,
  onExecuted
}: UseUpdateProductCardProps) {
  const [isDone, setIsDone] = useState(executed);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSavedNotice, setAutoSavedNotice] = useState(false);

  const [originalProductId] = useState(data.product_id);
  const [originalTargetName] = useState(data.target_name || data.name || '');

  const [prodName, setProdName] = useState(data.name || data.target_name || '');
  const [prodPrice, setProdPrice] = useState(data.price_mt !== undefined ? data.price_mt.toString() : '');
  const [prodCost, setProdCost] = useState(data.cost_price_mt !== undefined ? data.cost_price_mt.toString() : '');
  const [prodStock, setProdStock] = useState(data.stock_quantity !== undefined ? data.stock_quantity.toString() : '');
  const [prodCategory, setProdCategory] = useState(data.category || '');

  // Auto-save on mount if enabled
  useEffect(() => {
    if (autoSaveEnabled && !executed && !isDone && !isSubmitting && prodName) {
      handleUpdateProduct(true);
    }
  }, []);

  const handleUpdateProduct = async (isAuto = false) => {
    if (!prodName.trim() && !originalProductId && !originalTargetName) {
      if (!isAuto) toast.error('Nome do produto é obrigatório');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await chatAgentBridge.updateProduct(
        {
          productId: originalProductId,
          productName: originalTargetName || prodName.trim(),
          name: prodName.trim() || originalTargetName,
          price_mt: prodPrice ? parseFloat(prodPrice) : undefined,
          cost_price_mt: prodCost ? parseFloat(prodCost) : undefined,
          stock_quantity: prodStock ? parseFloat(prodStock) : undefined,
          category: prodCategory.trim() || undefined
        },
        currentUser?.id || 'admin'
      );

      if (!res.success) {
        throw new Error(res.error || 'Falha ao atualizar produto');
      }

      setIsDone(true);
      if (isAuto) {
        setAutoSavedNotice(true);
        toast.success(`⚡ Atualização auto-salva: "${prodName}"`, { icon: '🤖' });
      } else {
        toast.success(`Produto "${prodName}" atualizado com sucesso!`);
      }
      onExecuted();
    } catch (err: any) {
      console.error('[useUpdateProductCard] Update product error:', err);
      if (!isAuto) toast.error(`Erro: ${err.message || 'Falha ao atualizar'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isDone,
    isSubmitting,
    autoSavedNotice,
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
    handleUpdateProduct
  };
}
