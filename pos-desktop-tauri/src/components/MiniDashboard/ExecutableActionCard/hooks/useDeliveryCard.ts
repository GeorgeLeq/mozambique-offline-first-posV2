/**
 * @file useDeliveryCard.ts
 * @description Hook managing delivery creation form state, PO calculation, and SQLite insertion.
 */

import { useState, useEffect } from 'react';
import { ExecutableAiAction } from '../../../../lib/ai/storeSentinelClient';
import { getDB } from '../../../../lib/db';
import { logAudit } from '../../../../lib/audit';
import toast from 'react-hot-toast';

interface UseDeliveryCardProps {
  data: Extract<ExecutableAiAction, { type: 'create_delivery' }>['data'];
  executed?: boolean;
  autoSaveEnabled: boolean;
  currentUser?: { id?: string; name?: string; role?: string } | null;
  onExecuted: () => void;
}

export function useDeliveryCard({
  data,
  executed = false,
  autoSaveEnabled,
  currentUser,
  onExecuted
}: UseDeliveryCardProps) {
  const [isDone, setIsDone] = useState(executed);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSavedNotice, setAutoSavedNotice] = useState(false);

  const [supplierName, setSupplierName] = useState(data.supplier_name || '');
  const [invoiceNumber, setInvoiceNumber] = useState(data.invoice_number || '');
  const [expectedDate, setExpectedDate] = useState(data.expected_date || new Date().toISOString().slice(0, 10));

  // Auto-save on mount if enabled
  useEffect(() => {
    if (autoSaveEnabled && !executed && !isDone && !isSubmitting && supplierName) {
      handleSaveDelivery(true);
    }
  }, []);

  const handleSaveDelivery = async (isAuto = false) => {
    if (!supplierName.trim()) {
      if (!isAuto) toast.error('Supplier name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const db = await getDB();
      const deliveryId = crypto.randomUUID();

      const maxRes = await db.select('SELECT MAX(po_number) as max_po FROM expected_deliveries') as any[];
      const nextPo = (maxRes[0]?.max_po && maxRes[0].max_po >= 1000) ? maxRes[0].max_po + 1 : 1001;

      await db.execute(
        `INSERT INTO expected_deliveries (
          id, po_number, invoice_number, supplier_name, expected_date, created_by, requires_verification, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, 1, 0)`,
        [
          deliveryId,
          nextPo,
          invoiceNumber.trim() || `FT-${nextPo}`,
          supplierName.trim(),
          expectedDate,
          currentUser?.name || 'Admin'
        ]
      );

      const items = data.items || [];
      if (items.length > 0) {
        for (const item of items) {
          const itemId = crypto.randomUUID();
          await db.execute(
            `INSERT INTO expected_delivery_items (
              id, delivery_id, name, expected_quantity, received_quantity, cost_price_mt, status, sync_status
            ) VALUES (?, ?, ?, ?, 0, ?, 'pending', 0)`,
            [
              itemId,
              deliveryId,
              item.product_name,
              item.quantity || 1,
              item.cost_price_mt || 0
            ]
          );
        }
      }

      await logAudit(
        currentUser?.id || 'admin',
        'DELIVERY_CREATED_BY_AI',
        JSON.stringify({
          deliveryId,
          po_number: nextPo,
          supplier: supplierName.trim()
        })
      );

      setIsDone(true);
      if (isAuto) {
        setAutoSavedNotice(true);
        toast.success(`⚡ Auto-salvo no SQLite: Encomenda PO #${nextPo}`, { icon: '🤖' });
      } else {
        toast.success(`Encomenda PO #${nextPo} criada com sucesso no SQLite!`);
      }
      onExecuted();
    } catch (err: any) {
      console.error('[useDeliveryCard] Save delivery error:', err);
      if (!isAuto) toast.error(`Falha ao criar encomenda: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isDone,
    isSubmitting,
    autoSavedNotice,
    supplierName,
    setSupplierName,
    invoiceNumber,
    setInvoiceNumber,
    expectedDate,
    setExpectedDate,
    handleSaveDelivery
  };
}
