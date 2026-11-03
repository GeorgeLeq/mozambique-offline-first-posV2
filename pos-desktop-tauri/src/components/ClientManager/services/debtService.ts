import { getDB } from '../../../lib/db';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { sanitizeString, sanitizeNumeric } from '../../../lib/security/sanitizer';
import { DebtRecord } from '../types';

export interface SettleResult {
  paymentId: string;
  receiptId: string;
  now: string;
  cleanPaymentMethod: string;
  cashier: string;
  paidNum: number;
  isFullyPaid: boolean;
  newHistoryItem: any;
}

export async function settleDebtInDB(
  selectedDebt: DebtRecord,
  targetAmountStr: string,
  targetMethodStr: string,
  currentUser: any
): Promise<SettleResult> {
  const t0 = performance.now();
  console.log('[debtService] settleDebtInDB: START');
  const paidNum = sanitizeNumeric(targetAmountStr, 0);
  if (paidNum <= 0) {
    throw new Error('Informe um valor válido');
  }

  const db = await getDB();
  const tDb = performance.now();
  console.log(`[debtService] getDB resolved in ${(tDb - t0).toFixed(2)}ms`);

  const now = new Date().toISOString();
  const paymentId = crypto.randomUUID();
  const receiptId = crypto.randomUUID();
  const cleanPaymentMethod = sanitizeString(targetMethodStr || 'cash');
  const cashier = sanitizeString(currentUser?.name || 'Caixa');

  console.log('[debtService] Inserting payment log into debt_payments...');
  try {
    await db.execute(
      'INSERT INTO debt_payments (id, debt_id, amount_paid_mt, payment_method, receipt_id, cashier_name, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [paymentId, selectedDebt.id, paidNum, cleanPaymentMethod, receiptId, cashier, 0]
    );
  } catch (insertErr) {
    console.warn('[debtService] Standard insert failed, trying with amount_mt fallback:', insertErr);
    try {
      await db.execute(
        'INSERT INTO debt_payments (id, debt_id, amount_mt, amount_paid_mt, payment_method, receipt_id, cashier_name, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [paymentId, selectedDebt.id, paidNum, paidNum, cleanPaymentMethod, receiptId, cashier, 0]
      );
    } catch (insertErr2) {
      console.warn('[debtService] Both inserts failed, trying minimal insert:', insertErr2);
      await db.execute(
        'INSERT INTO debt_payments (id, debt_id, amount_mt, payment_method, sync_status) VALUES (?, ?, ?, ?, ?)',
        [paymentId, selectedDebt.id, paidNum, cleanPaymentMethod, 0]
      );
    }
  }
  const tInsert = performance.now();
  console.log(`[debtService] debt_payments INSERT finished in ${(tInsert - tDb).toFixed(2)}ms`);

  const isFullyPaid = paidNum >= selectedDebt.amount_mt;
  if (isFullyPaid) {
    console.log('[debtService] Fully paying debt in DB...');
    try {
      await db.execute('UPDATE debts SET status = ?, amount_mt = 0, paid_at = ?, payment_method = ?, sync_status = 0 WHERE id = ?', ['paid', now, cleanPaymentMethod, selectedDebt.id]);
    } catch (updateErr) {
      console.warn('[debtService] Extended UPDATE debts failed, trying fallback update:', updateErr);
      await db.execute('UPDATE debts SET status = ?, amount_mt = 0, sync_status = 0 WHERE id = ?', ['paid', selectedDebt.id]);
    }
  } else {
    console.log('[debtService] Partially paying debt in DB...');
    await db.execute('UPDATE debts SET amount_mt = amount_mt - ?, sync_status = 0 WHERE id = ?', [paidNum, selectedDebt.id]);
  }
  const tUpdate = performance.now();
  console.log(`[debtService] debts UPDATE finished in ${(tUpdate - tInsert).toFixed(2)}ms (Total settle time: ${(tUpdate - t0).toFixed(2)}ms)`);

  const newHistoryItem = {
    id: paymentId,
    debt_id: selectedDebt.id,
    amount_mt: paidNum,
    amount_paid_mt: paidNum,
    payment_method: cleanPaymentMethod,
    receipt_id: receiptId,
    cashier_name: cashier,
    created_at: now
  };

  return {
    paymentId,
    receiptId,
    now,
    cleanPaymentMethod,
    cashier,
    paidNum,
    isFullyPaid,
    newHistoryItem
  };
}

export async function saveManualDebtInDB(
  debtData: Partial<DebtRecord> & { isEdit?: boolean },
  currentUser: any
): Promise<{ isUpdate: boolean; cleanCustomer: string; cleanPhone: string; cleanAddress: string; cleanAmount: number; itemsJson: any; cashier: string; newRecord?: DebtRecord }> {
  const t0 = performance.now();
  console.log('[debtService] saveManualDebtInDB: START with debtData:', debtData);

  const cleanCustomer = sanitizeString(debtData.customer_name);
  const cleanPhone = sanitizeString(debtData.phone_number);
  const cleanAddress = sanitizeString(debtData.address);
  const cleanAmount = sanitizeNumeric(debtData.amount_mt, 0);
  const itemsJson = typeof debtData.items_json === 'string'
    ? debtData.items_json
    : (debtData.items_json ? JSON.stringify(debtData.items_json) : null);
  const cashier = currentUser?.name || 'Caixa';

  const isUpdate = Boolean(debtData.isEdit);
  const newId = debtData.id || crypto.randomUUID();
  const receiptId = debtData.receipt_id || crypto.randomUUID();
  const now = debtData.created_at || new Date().toISOString();

  try {
    const db = await getDB();
    const tDb = performance.now();
    console.log(`[debtService] getDB resolved in ${(tDb - t0).toFixed(2)}ms`);

    if (isUpdate && debtData.id) {
      console.log('[debtService] Updating debt in DB:', debtData.id);

      // 1. Fetch old debt data before updating to calculate stock difference
      let oldItems: any[] = [];
      try {
        const oldDebtRows = await db.select('SELECT items_json FROM debts WHERE id = ?', [debtData.id]) as { items_json?: string }[];
        if (oldDebtRows && oldDebtRows.length > 0 && oldDebtRows[0].items_json) {
          let raw = oldDebtRows[0].items_json;
          if (typeof raw === 'string' && raw.includes('\\"')) {
            raw = raw.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          }
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) oldItems = parsed;
        }
      } catch (err) {
        console.warn('[debtService] Could not retrieve previous items_json for stock adjustment:', err);
      }

      // 2. Perform DB update for the debt
      await db.execute(
        'INSERT OR REPLACE INTO debts (id, customer_name, amount_mt, status, phone_number, address, payment_method, cashier_name, items_json, created_at, paid_at, receipt_id, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          debtData.id,
          cleanCustomer,
          cleanAmount,
          debtData.status || 'unpaid',
          cleanPhone,
          cleanAddress,
          debtData.payment_method || null,
          cashier,
          itemsJson,
          now,
          debtData.paid_at || null,
          receiptId,
          0
        ]
      );
      console.log(`[debtService] UPDATE/REPLACE execute finished in ${(performance.now() - tDb).toFixed(2)}ms`);

      // 3. Reconcile stock delta between old items and new items
      const touchedProductIds = new Set<string>();
      try {
        let newItems: any[] = [];
        if (itemsJson) {
          let rawNew = itemsJson;
          if (typeof rawNew === 'string' && rawNew.includes('\\"')) {
            rawNew = rawNew.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          }
          const parsedNew = JSON.parse(rawNew);
          if (Array.isArray(parsedNew)) newItems = parsedNew;
        }

        // Map old quantities
        const oldQtyMap = new Map<string, number>();
        for (const it of oldItems) {
          if (it.id && it.id !== 'manual') {
            const q = Number(it.quantity) || 0;
            oldQtyMap.set(it.id, (oldQtyMap.get(it.id) || 0) + q);
            touchedProductIds.add(it.id);
          }
        }

        // Map new quantities
        const newQtyMap = new Map<string, number>();
        for (const it of newItems) {
          if (it.id && it.id !== 'manual') {
            const q = Number(it.quantity) || 0;
            newQtyMap.set(it.id, (newQtyMap.get(it.id) || 0) + q);
            touchedProductIds.add(it.id);
          }
        }

        // Apply net delta: netDelta = (newQty - oldQty)
        // If netDelta > 0: reduce stock by netDelta
        // If netDelta < 0: restore stock by Math.abs(netDelta)
        for (const prodId of touchedProductIds) {
          const oldQ = oldQtyMap.get(prodId) || 0;
          const newQ = newQtyMap.get(prodId) || 0;
          const netDelta = newQ - oldQ;

          if (netDelta > 0) {
            console.log(`[debtService] Edit debt: reducing stock for product ${prodId} by delta: ${netDelta}`);
            await db.execute(
              'UPDATE products SET stock_quantity = MAX(0, stock_quantity - ?), updated_at = CURRENT_TIMESTAMP, sync_status = 0 WHERE id = ?',
              [netDelta, prodId]
            );
          } else if (netDelta < 0) {
            const restoreQty = Math.abs(netDelta);
            console.log(`[debtService] Edit debt: restoring stock for product ${prodId} by delta: ${restoreQty}`);
            await db.execute(
              'UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = CURRENT_TIMESTAMP, sync_status = 0 WHERE id = ?',
              [restoreQty, prodId]
            );
          }
        }

        // Trigger products cloud sync if any products were touched
        if (touchedProductIds.size > 0) {
          import('../../../lib/syncEngine/products').then(({ syncProductsToCloud }) => {
            syncProductsToCloud().catch(e => console.warn('[debtService] Products sync failed:', e));
          }).catch(() => {});
        }
      } catch (stockErr) {
        console.warn('[debtService] Error updating product stock on edit debt:', stockErr);
      }

      return { isUpdate: true, cleanCustomer, cleanPhone, cleanAddress, cleanAmount, itemsJson, cashier };
    } else {
      console.log('[debtService] Inserting new debt into DB using INSERT OR REPLACE:', newId, { cleanCustomer, cleanAmount, now });
      await db.execute(
        `INSERT OR REPLACE INTO debts (id, customer_name, amount_mt, status, phone_number, address, created_at, receipt_id, cashier_name, items_json, sync_status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId, cleanCustomer, cleanAmount, 'unpaid', cleanPhone, cleanAddress, now, receiptId, cashier, itemsJson, 0]
      );
      console.log(`[debtService] INSERT OR REPLACE execute finished successfully in ${(performance.now() - tDb).toFixed(2)}ms for debt id: ${newId}`);

      // Reduce stock for selected catalog products
      if (itemsJson) {
        try {
          let rawItems = itemsJson;
          if (typeof rawItems === 'string' && rawItems.includes('\\"')) {
            rawItems = rawItems.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          }
          const parsedItems = JSON.parse(rawItems);
          if (Array.isArray(parsedItems)) {
            let hasUpdatedProducts = false;
            for (const item of parsedItems) {
              const itemQty = Number(item.quantity) || 0;
              if (item.id && item.id !== 'manual' && itemQty > 0) {
                console.log(`[debtService] Reducing stock for product ${item.id} by ${itemQty}`);
                await db.execute(
                  'UPDATE products SET stock_quantity = MAX(0, stock_quantity - ?), updated_at = CURRENT_TIMESTAMP, sync_status = 0 WHERE id = ?',
                  [itemQty, item.id]
                );
                hasUpdatedProducts = true;
              }
            }

            // Trigger cloud sync for products so Supabase & local DB reflect the reduction
            if (hasUpdatedProducts) {
              import('../../../lib/syncEngine/products').then(({ syncProductsToCloud }) => {
                syncProductsToCloud().catch(e => console.warn('[debtService] Products sync failed:', e));
              }).catch(() => {});
            }
          }
        } catch (parseErr) {
          console.warn('[debtService] Failed to parse items_json for stock reduction:', parseErr);
        }
      }

      const newRecord: DebtRecord = {
        id: newId,
        customer_name: cleanCustomer,
        amount_mt: cleanAmount,
        original_amount: cleanAmount,
        total_paid: 0,
        status: 'unpaid',
        phone_number: cleanPhone || null,
        address: cleanAddress || null,
        payment_method: null,
        paid_at: null,
        created_at: now,
        receipt_id: receiptId,
        cashier_name: cashier,
        items_json: itemsJson,
        sync_status: 0,
        payment_history: []
      };

      return { isUpdate: false, cleanCustomer, cleanPhone, cleanAddress, cleanAmount, itemsJson, cashier, newRecord };
    }
  } catch (err) {
    console.error('[debtService] saveManualDebtInDB CRITICAL ERROR:', err);
    throw err;
  }
}

export async function softDeleteDebtInDB(debtId: string): Promise<void> {
  const db = await getDB();
  const now = new Date().toISOString();
  await db.execute('UPDATE debts SET is_deleted = 1, deleted_at = ?, sync_status = 0 WHERE id = ?', [now, debtId]);
}

export async function restoreDebtInDB(debtId: string): Promise<void> {
  const db = await getDB();
  await db.execute('UPDATE debts SET is_deleted = 0, deleted_at = NULL, sync_status = 0 WHERE id = ?', [debtId]);
}

export async function deleteDebtFromDB(debtId: string): Promise<void> {
  const db = await getDB();
  await db.execute('DELETE FROM debt_payments WHERE debt_id = ?', [debtId]);
  await db.execute('DELETE FROM debts WHERE id = ?', [debtId]);

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('debt_payments').delete().eq('debt_id', debtId);
      await supabase.from('debts').delete().eq('id', debtId);
    } catch (err) {
      console.warn('[debtService] Failed to delete debt from Supabase:', err);
    }
  }
}

export async function checkFiadosLimit(newCustomerName: string): Promise<{ allowed: boolean, limit: number, current: number }> {
  try {
    const db = await getDB();
    
    // 1. Get current limit. Check feature_entitlements for 'client_debts' plan_tier
    // Or we could have saved max_fiado_customers in settings. 
    // Wait, let's query the subscription_plans table joined with feature_entitlements!
    // But since `plan_tier` in `feature_entitlements` might not strictly match `subscription_plans.id` (e.g. 'pro' vs 'plan_fiados_monthly'),
    // Let's see if we saved the active plan ID somewhere. We can query `subscription_plans` and get the maximum `max_fiado_customers` 
    // for plans that are active for this shop. But we don't store shop active plan locally yet.
    // Let's just use feature_entitlements.plan_tier for now, mapping 'free' => 20, 'pro' => 200, 'enterprise' => -1.
    // AND if `subscription_plans` exists, we can try to look it up.

    const entRows = await db.select(
      "SELECT plan_tier, is_unlocked FROM feature_entitlements WHERE feature_key = 'client_debts'"
    ) as any[];

    // Check shop-level settings override first (synced from Supabase)
    let shopOverrideLimit: number | null = null;
    let shopPlanId: string | null = null;
    let shopPlanTier: string | null = null;

    try {
      const settingRows = await db.select(
        "SELECT key, value FROM settings WHERE key IN ('max_fiado_customers', 'fiado_limit', 'subscription_plan_id', 'plan_id', 'plan_tier')"
      ) as { key: string; value: string }[];
      for (const r of settingRows || []) {
        if ((r.key === 'max_fiado_customers' || r.key === 'fiado_limit') && r.value !== undefined && r.value !== null && r.value !== '') {
          const val = parseInt(r.value, 10);
          if (!isNaN(val)) {
            shopOverrideLimit = val;
          }
        } else if (r.key === 'subscription_plan_id' || r.key === 'plan_id') {
          shopPlanId = r.value ? r.value.toLowerCase() : null;
        } else if (r.key === 'plan_tier') {
          shopPlanTier = r.value ? r.value.toLowerCase() : null;
        }
      }
    } catch (e) {
      // ignore
    }

    const isPaidPlanFromSettings = (
      (shopPlanId && shopPlanId !== 'plan_free' && shopPlanId !== 'free') ||
      (shopPlanTier && shopPlanTier !== 'free')
    );

    let limit: number;

    if (shopOverrideLimit !== null) {
      limit = shopOverrideLimit;
    } else {
      const tier = entRows?.[0]?.plan_tier?.toLowerCase() || shopPlanTier || shopPlanId || 'free';
      const isUnlocked = Boolean(entRows?.[0]?.is_unlocked);

      if ((isUnlocked && tier !== 'free') || isPaidPlanFromSettings) {
        // Paid Pro or Enterprise unlock
        limit = 200;
        
        // Try to dynamically override limit from subscription_plans matching their tier
        try {
          const planRows = await db.select("SELECT max_fiado_customers FROM subscription_plans WHERE id = ? OR LOWER(id) = ? OR LOWER(id) = ?", [entRows?.[0]?.plan_tier, tier, shopPlanId]) as any[];
          if (planRows && planRows.length > 0 && planRows[0].max_fiado_customers !== null) {
            limit = planRows[0].max_fiado_customers;
          } else {
            // Fallback for legacy generic tier names
            if (tier === 'enterprise' || tier === 'lifetime' || tier === 'custom' || tier === 'plan_pro_annual' || tier === 'annual') limit = -1;
            else if (tier === 'pro') {
              const fallbackRows = await db.select("SELECT max_fiado_customers FROM subscription_plans WHERE id = 'plan_fiados_monthly'") as any[];
              if (fallbackRows && fallbackRows.length > 0 && fallbackRows[0].max_fiado_customers !== null) {
                limit = fallbackRows[0].max_fiado_customers;
              }
            }
          }
        } catch(e) {
          if (tier === 'enterprise' || tier === 'lifetime' || tier === 'custom' || tier === 'plan_pro_annual' || tier === 'annual') limit = -1;
        }
      } else {
        // Explicit free tier from plans or default to 20
        try {
          const freePlanRows = await db.select("SELECT max_fiado_customers FROM subscription_plans WHERE id = 'plan_free' OR price_mt = 0") as any[];
          if (freePlanRows && freePlanRows.length > 0 && freePlanRows[0].max_fiado_customers !== null) {
            limit = freePlanRows[0].max_fiado_customers;
          } else {
            limit = 20;
          }
        } catch (e) {
          limit = 20;
        }
      }
    }

    // Ensure hackathon quota is at least 500
    if (limit !== -1 && limit < 500) {
      limit = 500;
    }

    // Unlimited
    if (limit === -1) {
      return { allowed: true, limit, current: 0 };
    }

    // 2. Count distinct customers with unpaid debts
    const countRows = await db.select(`
      SELECT COUNT(DISTINCT LOWER(TRIM(customer_name))) as total
      FROM debts
      WHERE status = 'unpaid' AND amount_mt > 0
    `) as { total: number }[];
    
    const currentCustomers = countRows?.[0]?.total || 0;

    // 3. Is the new customer already in the list?
    const existingCheck = await db.select(`
      SELECT COUNT(*) as is_existing
      FROM debts
      WHERE status = 'unpaid' AND amount_mt > 0 AND LOWER(TRIM(customer_name)) = LOWER(TRIM(?))
    `, [newCustomerName]) as { is_existing: number }[];

    const isExisting = (existingCheck?.[0]?.is_existing || 0) > 0;

    if (isExisting) {
      // Adding debt to an already existing unpaid customer doesn't increase unique count
      return { allowed: true, limit, current: currentCustomers };
    }

    return { 
      allowed: currentCustomers < limit,
      limit,
      current: currentCustomers
    };
  } catch (err) {
    console.error('[debtService] checkFiadosLimit error:', err);
    return { allowed: true, limit: 500, current: 0 }; // fail-safe open
  }
}

export async function getFiadosUsage(): Promise<{ current: number, limit: number, isAtLimit: boolean, isUnlimited: boolean }> {
  try {
    const res = await checkFiadosLimit('');
    return {
      current: res.current,
      limit: res.limit,
      isAtLimit: !res.allowed && res.limit !== -1,
      isUnlimited: res.limit === -1
    };
  } catch(e) {
    return { current: 0, limit: 500, isAtLimit: false, isUnlimited: false };
  }
}
