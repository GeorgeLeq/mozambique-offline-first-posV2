import { getDB } from '../db';
import { supabase, isSupabaseConfigured } from '../supabase';

export async function syncDebtsToCloud(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const db = await getDB();
    const settings = await db.select("SELECT value FROM settings WHERE key = 'shop_id'") as { value: string }[];
    let shopId = settings?.[0]?.value;
    if (!shopId && typeof localStorage !== 'undefined') {
      shopId = localStorage.getItem('shop_id') || '';
    }
    if (!shopId) {
      shopId = 'default-moz-shop-' + Math.random().toString(36).substring(2, 9);
      await db.execute('INSERT OR REPLACE INTO settings (key, value, sync_status) VALUES (?, ?, 1)', ['shop_id', shopId]);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('shop_id', shopId);
      }
      console.log('[Debts Sync] Auto-generated and saved missing shop_id:', shopId);
    }

    const unsynced = await db.select('SELECT * FROM debts WHERE sync_status = 0 LIMIT 50') as any[];
    if (!unsynced || unsynced.length === 0) return false;

    console.log(`[Debts Sync] Uploading batch of ${unsynced.length} local debts to Supabase...`);

    const payload = unsynced.map(d => ({
      id: d.id,
      shop_id: shopId,
      customer_name: d.customer_name,
      amount_mt: Number(d.amount_mt) || 0,
      status: d.status === 'paid' ? 'paid' : 'unpaid',
      is_deleted: d.is_deleted === 1,
      phone_number: d.phone_number || null,
      address: d.address || null,
      payment_method: d.payment_method || null,
      created_at: d.created_at,
      paid_at: d.paid_at || null,
      receipt_id: d.receipt_id || null,
      cashier_name: d.cashier_name || null,
      items_json: typeof d.items_json === 'string' ? d.items_json : (d.items_json ? JSON.stringify(d.items_json) : null)
    }));

    let { error } = await supabase.from('debts').upsert(payload, { onConflict: 'id' });
    if (error && (error.code === 'PGRST204' || error.message?.includes('is_deleted'))) {
      // Fallback: Supabase debts table does not have is_deleted column yet
      const fallbackPayload = payload.map(({ is_deleted, ...rest }) => rest);
      const res = await supabase.from('debts').upsert(fallbackPayload, { onConflict: 'id' });
      error = res.error;
    }
    if (error) {
      console.warn('[Debts Sync] Supabase upsert skipped (offline/unreachable):', error.message || error);
      return false;
    }

    // Atomic field-matching updates: only set sync_status = 1 if the record hasn't been locally modified during the network request
    for (const d of unsynced) {
      await db.execute(
        'UPDATE debts SET sync_status = 1 WHERE id = ? AND sync_status = 0 AND status = ? AND amount_mt = ?',
        [d.id, d.status, d.amount_mt]
      );
    }
    console.log(`[Debts Sync] Successfully synced batch of ${unsynced.length} debts to Supabase (verified atomically).`);

    const remaining = await db.select('SELECT id FROM debts WHERE sync_status = 0 LIMIT 1') as any[];
    return remaining.length > 0;
  } catch (error: any) {
    console.warn('[Debts Sync] Background debts sync skipped (offline or network error):', error?.message || error);
    return false;
  }
}

export async function syncDebtsFromCloud(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const db = await getDB();
    const settings = await db.select("SELECT value FROM settings WHERE key = 'shop_id'") as { value: string }[];
    let shopId = settings?.[0]?.value;
    if (!shopId && typeof localStorage !== 'undefined') {
      shopId = localStorage.getItem('shop_id') || '';
    }
    if (!shopId) return false;

    const lastPullSetting = await db.select(
      "SELECT value FROM settings WHERE key = 'last_pull_debts'"
    ) as { value: string }[];
    const lastPull = lastPullSetting.length > 0 ? lastPullSetting[0].value : '1970-01-01T00:00:00.000Z';
    const nextPullTime = new Date().toISOString();

    let cloudDebts: any[] | null = null;
    const dRes = await supabase
      .from('debts')
      .select('id, customer_name, amount_mt, status, is_deleted, phone_number, address, payment_method, cashier_name, items_json, created_at, paid_at, receipt_id')
      .eq('shop_id', shopId)
      .gt('created_at', lastPull)
      .order('created_at', { ascending: true })
      .limit(200);

    let dData: any[] | null = dRes.data;
    let error = dRes.error;

    if (error && (error.code === '42703' || error.message?.includes('is_deleted'))) {
      // Fallback: Supabase debts table does not have is_deleted column yet
      const fallback = await supabase
        .from('debts')
        .select('id, customer_name, amount_mt, status, phone_number, address, payment_method, cashier_name, items_json, created_at, paid_at, receipt_id')
        .eq('shop_id', shopId)
        .gt('created_at', lastPull)
        .order('created_at', { ascending: true })
        .limit(200);
      dData = fallback.data as any[];
      error = fallback.error;
    }

    if (error) {
      console.warn('[Debts Sync] Supabase select skipped (offline/unreachable):', error.message, error.details);
      return false;
    }
    cloudDebts = dData;
    if (!cloudDebts || cloudDebts.length === 0) {
      await db.execute(
        'INSERT OR REPLACE INTO settings (key, value, sync_status) VALUES (?, ?, 1)',
        ['last_pull_debts', nextPullTime]
      );
      return false;
    }

    let maxCreatedAt = lastPull;

    for (const d of cloudDebts) {
      if (d.created_at && d.created_at > maxCreatedAt) {
        maxCreatedAt = d.created_at;
      }

      // Protect unsynced local modifications from being overwritten by stale cloud data
      const local = await db.select('SELECT sync_status FROM debts WHERE id = ?', [d.id]) as any[];
      if (local && local.length > 0 && Number(local[0].sync_status) === 0) {
        console.log(`[Debts Sync] Skipping pull for debt ${d.id} - local changes pending upload.`);
        continue;
      }

      const itemsJsonStr = typeof d.items_json === 'string' ? d.items_json : (d.items_json ? JSON.stringify(d.items_json) : null);
      const isDeletedVal = d.is_deleted === true || d.is_deleted === 1 ? 1 : 0;

      await db.execute(
        'INSERT OR REPLACE INTO debts (id, customer_name, amount_mt, status, is_deleted, phone_number, address, payment_method, cashier_name, items_json, created_at, paid_at, receipt_id, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
        [
          d.id,
          d.customer_name,
          d.amount_mt,
          d.status,
          isDeletedVal,
          d.phone_number,
          d.address,
          d.payment_method,
          d.cashier_name,
          itemsJsonStr,
          d.created_at,
          d.paid_at,
          d.receipt_id
        ]
      );
    }
    await db.execute(
      'INSERT OR REPLACE INTO settings (key, value, sync_status) VALUES (?, ?, 1)',
      ['last_pull_debts', maxCreatedAt]
    );
    console.log(`[Debts Sync] Successfully pulled ${cloudDebts.length} new/updated debts from Supabase.`);
    return cloudDebts.length >= 200;
  } catch (error: any) {
    console.warn('[Debts Sync] Background debts pull skipped (offline or network error):', error?.message || error);
    return false;
  }
}

