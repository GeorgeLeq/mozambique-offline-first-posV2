/**
 * @file useAddToCartCard.ts
 * @description Hook managing agentic POS cart injection via Meta Llama tool calling.
 */

import { useState, useEffect } from 'react';
import { ExecutableAiAction } from '../../../../lib/ai/storeSentinelClient';
import toast from 'react-hot-toast';

interface UseAddToCartCardProps {
  data: Extract<ExecutableAiAction, { type: 'add_to_cart' }>['data'];
  executed?: boolean;
  autoSaveEnabled: boolean;
  currentUser?: { id?: string; name?: string; role?: string } | null;
  onExecuted: () => void;
  onNavigateTab?: (tab: string) => void;
}

export function useAddToCartCard({
  data,
  executed = false,
  autoSaveEnabled,
  currentUser,
  onExecuted,
  onNavigateTab
}: UseAddToCartCardProps) {
  const [isDone, setIsDone] = useState(executed);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSavedNotice, setAutoSavedNotice] = useState(false);

  const [items, setItems] = useState(data.items || []);

  // Auto-execute on mount if auto-save is enabled
  useEffect(() => {
    if (autoSaveEnabled && !executed && !isDone && !isSubmitting && items.length > 0) {
      handleAddToCart(true);
    }
  }, []);

  const handleAddToCart = (isAuto = false) => {
    if (!items || items.length === 0) {
      if (!isAuto) toast.error('Nenhum item para adicionar ao carrinho');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Dispatch custom window event so CashierScreen can listen and populate cart
      window.dispatchEvent(
        new CustomEvent('sycomm:add-to-cart', {
          detail: {
            items,
            customer_name: data.customer_name,
            added_by: currentUser?.name || 'Store Sentinel AI'
          }
        })
      );

      // 2. Persist in localStorage for cross-tab or reload pickup
      try {
        const existingPending = JSON.parse(localStorage.getItem('smartpos_pending_cart_inject') || '[]');
        const updated = Array.isArray(existingPending) ? [...existingPending, ...items] : [...items];
        localStorage.setItem('smartpos_pending_cart_inject', JSON.stringify(updated));
      } catch (_e) {}

      setIsDone(true);
      if (isAuto) {
        setAutoSavedNotice(true);
        toast.success(`⚡ ${items.length} item(ns) adicionado(s) ao carrinho via Meta Llama!`, { icon: '🛒' });
      } else {
        toast.success(`${items.length} item(ns) enviado(s) para o carrinho do POS!`, { icon: '🛒' });
      }

      onExecuted();
    } catch (err: any) {
      console.error('[useAddToCartCard] Error injecting items to cart:', err);
      if (!isAuto) toast.error('Erro ao adicionar itens ao carrinho');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateItemQty = (index: number, newQty: number) => {
    if (newQty <= 0) return;
    setItems(prev => prev.map((it, i) => i === index ? { ...it, quantity: newQty } : it));
  };

  return {
    isDone,
    isSubmitting,
    autoSavedNotice,
    items,
    handleAddToCart,
    handleUpdateItemQty
  };
}
