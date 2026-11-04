/**
 * @file useAddToCartCard.ts
 * @description Hook managing agentic POS cart injection and real SQLite inventory decrement.
 */

import { useState, useEffect } from 'react';
import { ExecutableAiAction } from '../../../../lib/ai/storeSentinelClient';
import { getDB } from '../../../../lib/db';
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
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);

  // Fetch catalog from SQLite for product dropdown selector
  useEffect(() => {
    let isMounted = true;
    const fetchCatalog = async () => {
      try {
        const db = await getDB();
        const rows = (await db.select(
          'SELECT id, name, price_mt, cost_price_mt, stock_quantity FROM products WHERE is_deleted = 0 OR is_deleted IS NULL ORDER BY name ASC'
        )) as any[];
        if (isMounted) {
          setAvailableProducts(rows || []);
        }
      } catch (err) {
        console.warn('[useAddToCartCard] Failed to load catalog products:', err);
      }
    };

    fetchCatalog();
    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-execute on mount if auto-save is enabled
  useEffect(() => {
    if (autoSaveEnabled && !executed && !isDone && !isSubmitting && items.length > 0) {
      handleAddToCart(true);
    }
  }, []);

  const handleAddToCart = async (isAuto = false) => {
    if (!items || items.length === 0) {
      if (!isAuto) toast.error('No items to add to cart');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Immediately reduce stock quantity in local SQLite database
      const db = await getDB();
      for (const item of items) {
        const qty = Number(item.quantity) || 1;
        try {
          if (item.product_id) {
            await db.execute('UPDATE products SET stock_quantity = MAX(0, stock_quantity - ?) WHERE id = ?', [qty, item.product_id]);
          } else if (item.product_name) {
            await db.execute('UPDATE products SET stock_quantity = MAX(0, stock_quantity - ?) WHERE name LIKE ?', [qty, `%${item.product_name}%`]);
          }
        } catch (e) {
          console.warn('[useAddToCartCard] Stock reduction error:', e);
        }
      }

      // Notify other views that local SQLite products changed
      window.dispatchEvent(new CustomEvent('sycomm:products-updated'));

      // 2. Dispatch custom window event so CashierScreen can listen and populate cart
      window.dispatchEvent(
        new CustomEvent('sycomm:add-to-cart', {
          detail: {
            items,
            customer_name: data.customer_name,
            total_sale_mt: data.total_sale_mt,
            profit_mt: data.profit_mt,
            added_by: currentUser?.name || 'Store Sentinel AI'
          }
        })
      );

      // 3. Persist in localStorage for cross-tab or reload pickup
      try {
        const existingPending = JSON.parse(localStorage.getItem('smartpos_pending_cart_inject') || '[]');
        const updated = Array.isArray(existingPending) ? [...existingPending, ...items] : [...items];
        localStorage.setItem('smartpos_pending_cart_inject', JSON.stringify(updated));
      } catch (_e) {}

      setIsDone(true);
      if (isAuto) {
        setAutoSavedNotice(true);
        toast.success(`⚡ ${items.length} item(s) staged to POS cart & stock reduced!`, { icon: '🛒' });
      } else {
        toast.success(`${items.length} item(s) added to POS cart & stock reduced!`, { icon: '🛒' });
      }

      onExecuted();
    } catch (err: any) {
      console.error('[useAddToCartCard] Error injecting items to cart:', err);
      if (!isAuto) toast.error('Error adding items to cart');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateItemQty = (index: number, newQty: number) => {
    if (newQty <= 0) return;
    setItems(prev => prev.map((it, i) => i === index ? { ...it, quantity: newQty } : it));
  };

  const handleSelectItemProduct = (index: number, productId: string) => {
    const chosen = availableProducts.find(p => p.id === productId);
    if (!chosen) return;
    setItems(prev => prev.map((it, i) => {
      if (i === index) {
        return {
          ...it,
          product_id: chosen.id,
          product_name: chosen.name,
          unit_price_mt: Number(chosen.price_mt) || 0,
          cost_price_mt: Number(chosen.cost_price_mt) || 0,
          current_stock: Number(chosen.stock_quantity) || 0
        };
      }
      return it;
    }));
  };

  return {
    isDone,
    isSubmitting,
    autoSavedNotice,
    items,
    availableProducts,
    handleAddToCart,
    handleUpdateItemQty,
    handleSelectItemProduct
  };
}

