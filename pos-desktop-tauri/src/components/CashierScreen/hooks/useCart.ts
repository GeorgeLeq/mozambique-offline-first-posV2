import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { logAudit } from '../../../lib/audit';
import { getDB } from '../../../lib/db';

export interface CartItem {
  id: string;
  name: string;
  barcode?: string;
  price_mt: number; // This is the active unit price (after promotions or manual discounts)
  price?: number; // legacy/compatibility
  original_price_mt?: number; // The standard baseline price from products table
  promo_active?: boolean | number;
  promo_price_mt?: number;
  quantity: number;
  discount_type?: 'none' | 'percent' | 'value';
  discount_value?: number;
  authorized_by?: string;
  stock_quantity?: number;
  min_stock_alert?: number;
  attributes?: string;
  is_fractional?: boolean | number;
}

export function useCart(currentUser: any) {
  const [cart, setCart] = useState<CartItem[]>([]);

  // Listen for agentic AI cart additions from Meta Llama
  useEffect(() => {
    const handleAddFromAi = async (e: Event) => {
      const customEvent = e as CustomEvent<{ items: Array<{ product_name: string; quantity: number; unit_price_mt?: number }> }>;
      if (!customEvent.detail || !Array.isArray(customEvent.detail.items)) return;

      try {
        const db = await getDB();
        for (const item of customEvent.detail.items) {
          const rows: any[] = await db.select(
            'SELECT id, name, price_mt, barcode, stock_quantity, promo_active, promo_price_mt FROM products WHERE LOWER(name) LIKE ? AND (is_deleted = 0 OR is_deleted IS NULL) LIMIT 1',
            [`%${item.product_name.toLowerCase().trim()}%`]
          );
          const product = rows && rows.length > 0 ? rows[0] : null;

          const effectiveId = product?.id || crypto.randomUUID();
          const effectiveName = product?.name || item.product_name;
          const effectivePrice = item.unit_price_mt || product?.price_mt || 50;

          setCart(prev => {
            const existing = prev.find(i => i.id === effectiveId);
            if (existing) {
              return prev.map(i => i.id === effectiveId ? { ...i, quantity: i.quantity + (item.quantity || 1) } : i);
            }
            return [...prev, {
              id: effectiveId,
              name: effectiveName,
              barcode: product?.barcode || '',
              price_mt: effectivePrice,
              original_price_mt: effectivePrice,
              quantity: item.quantity || 1,
              stock_quantity: product?.stock_quantity ?? 999
            }];
          });
        }
      } catch (err) {
        console.warn('[useCart] Failed to resolve product from AI add_to_cart:', err);
      }
    };

    window.addEventListener('sycomm:add-to-cart', handleAddFromAi);
    return () => window.removeEventListener('sycomm:add-to-cart', handleAddFromAi);
  }, []);

  const updateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity === 0) {
      removeItem(id);
      return;
    }
    
    // Check stock if increasing quantity
    const item = cart.find(i => i.id === id);
    if (item && newQuantity > item.quantity) {
      const stock = parseFloat(item.stock_quantity as any) || 0;
      const allowNegative = localStorage.getItem('allow_negative_stock') === '1';
      if (newQuantity > stock && !allowNegative) {
        toast.error(`⚠️ Stock Esgotado! Apenas ${stock} unidades de "${item.name}" estão disponíveis.`, {
          id: `out-of-stock-${item.id}`
        });
        return;
      }
    }

    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: newQuantity } : item))
    );
  };

  const removeItem = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const applyDiscount = async (id: string) => {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    
    // Log the audit event for 100% discount
    await logAudit(currentUser?.id, 'DISCOUNT_APPLIED', `Applied 100% discount to ${item.name} in cart`);
    
    setCart((prev) =>
      prev.map((i) => (i.id === id ? { 
        ...i, 
        original_price_mt: i.original_price_mt || i.price_mt,
        price_mt: 0,
        discount_type: 'percent',
        discount_value: 100
      } : i))
    );
    toast.success('Aplicado desconto de 100%');
  };

  const applyManualDiscount = async (
    itemId: string,
    discountType: 'none' | 'percent' | 'value',
    discountValue: number,
    authorizedBy?: string
  ) => {
    const item = cart.find(i => i.id === itemId);
    if (!item) return;

    // Log audit event for custom discounts
    const description = discountType === 'none' 
      ? `Removed manual discount from ${item.name}`
      : `Applied ${discountValue}${discountType === 'percent' ? '%' : ' MT'} manual discount to ${item.name}${authorizedBy ? ` (Authorized by ${authorizedBy})` : ''}`;
    
    await logAudit(currentUser?.id, 'DISCOUNT_APPLIED', description);

    // If authorized by an administrator, log a high-risk manager alert notification
    if (authorizedBy && discountType !== 'none') {
      try {
        const db = await getDB();
        const notifPrefsRow: any[] = await db.select("SELECT value FROM settings WHERE key = 'notification_preferences'");
        const prefs = notifPrefsRow[0]?.value ? notifPrefsRow[0].value.split(',') : [];

        if (prefs.includes('large_discounts')) {
          const notifId = crypto.randomUUID();
          await db.execute(`
            INSERT INTO notifications (id, type, title, message, is_read, action_url, sync_status)
            VALUES (?, ?, ?, ?, 0, ?, 0)
          `, [
            notifId,
            'HIGH_DISCOUNT',
            'Desconto Autorizado',
            `Desconto de ${discountValue}${discountType === 'percent' ? '%' : ' MT'} aplicado ao artigo "${item.name}" (Subtotal: ${(item.original_price_mt || item.price_mt) * item.quantity} MT), autorizado pelo gestor: ${authorizedBy}.`,
            'audit'
          ]);
        }
      } catch (err) {
        console.warn('Failed to log high discount alert notification:', err);
      }
    }

    setCart((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;

        const basePrice = i.original_price_mt || i.price_mt;
        let finalPrice = basePrice;

        if (discountType === 'percent') {
          finalPrice = Math.max(0, basePrice - (basePrice * discountValue) / 100);
        } else if (discountType === 'value') {
          finalPrice = Math.max(0, basePrice - discountValue);
        }

        return {
          ...i,
          original_price_mt: basePrice,
          price_mt: finalPrice,
          discount_type: discountType,
          discount_value: discountValue,
          authorized_by: authorizedBy
        };
      })
    );
  };

  const clearCart = () => setCart([]);

  return {
    cart,
    setCart,
    updateQuantity,
    removeItem,
    applyDiscount,
    applyManualDiscount,
    clearCart
  };
}
