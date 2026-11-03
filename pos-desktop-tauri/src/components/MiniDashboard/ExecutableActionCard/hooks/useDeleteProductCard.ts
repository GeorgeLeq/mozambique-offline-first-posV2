/**
 * @file useDeleteProductCard.ts
 * @description Hook managing product deletion / archive state, ChatAgentBridge execution.
 */

import { useState } from 'react';
import { ExecutableAiAction } from '../../../../lib/ai/types';
import { posActionDispatcher as chatAgentBridge } from '../../../../lib/ai/actions';
import toast from 'react-hot-toast';

interface UseDeleteProductCardProps {
  data: Extract<ExecutableAiAction, { type: 'delete_product' }>['data'];
  executed?: boolean;
  currentUser?: { id?: string; name?: string; role?: string } | null;
  onExecuted: () => void;
}

export function useDeleteProductCard({
  data,
  executed = false,
  currentUser,
  onExecuted
}: UseDeleteProductCardProps) {
  const [isDone, setIsDone] = useState(executed);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDeleteProduct = async () => {
    setIsSubmitting(true);
    try {
      const res = await chatAgentBridge.deleteProduct(
        {
          productId: data.product_id,
          productName: data.name,
          reason: data.reason || 'Requested by operator via AI'
        },
        currentUser?.id || 'admin'
      );

      if (!res.success) {
        throw new Error(res.error || 'Falha ao remover produto');
      }

      setIsDone(true);
      toast.success(`Produto "${data.name}" removido do catálogo!`);
      onExecuted();
    } catch (err: any) {
      console.error('[useDeleteProductCard] Delete product error:', err);
      toast.error(`Erro: ${err.message || 'Falha ao remover'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isDone,
    isSubmitting,
    handleDeleteProduct
  };
}
