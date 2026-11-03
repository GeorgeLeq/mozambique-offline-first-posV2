import { getDB } from '../db';
import { supabase, isSupabaseConfigured } from '../supabase';
import { syncSubscriptionsFromCloud } from './subscriptions';
import { getHardwareFingerprint } from '../../subscription/cryptoLicense';

export async function checkDeviceHeartbeat(): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;

  try {
    const db = await getDB();
    
    const settings = await db.select(
      "SELECT key, value FROM settings WHERE key IN ('shop_id', 'device_id', 'shop_name')"
    ) as { key: string, value: string }[];
    
    const shopId = settings.find(s => s.key === 'shop_id')?.value;
    const deviceId = settings.find(s => s.key === 'device_id')?.value;
    const shopName = settings.find(s => s.key === 'shop_name')?.value || 'Caixa Principal';

    // If not activated yet, nothing to check
    if (!shopId || !deviceId) {
      return true; 
    }

    let deviceActive = true;
    const hwFingerprint = getHardwareFingerprint();

    try {
      const { data, error } = await supabase
        .from('devices')
        .select('id, is_active')
        .eq('id', deviceId)
        .maybeSingle();

      if (!error && data) {
        if (data.is_active === false) {
          console.error("SECURITY ALERT: Device deactivated from Command Central. Wiping local data.");
          await db.execute("DELETE FROM settings");
          await db.execute("DELETE FROM users");
          await db.execute("DELETE FROM products");
          await db.execute("DELETE FROM sales");
          window.dispatchEvent(new CustomEvent('device-deactivated'));
          return false;
        } else {
          await supabase
            .from('devices')
            .update({ 
              last_seen_at: new Date().toISOString(),
              hardware_fingerprint: hwFingerprint
            })
            .eq('id', deviceId);
        }
      } else if (!data) {
        try {
          await supabase.from('devices').upsert({
            id: deviceId,
            shop_id: shopId,
            name: shopName ? `${shopName} - Caixa` : 'Caixa Principal',
            hardware_fingerprint: hwFingerprint,
            is_active: true,
            last_seen_at: new Date().toISOString()
          }, { onConflict: 'id' });
        } catch (_upsertErr) {}
      }
    } catch (deviceErr) {
      console.warn('[Heartbeat] Devices check bypassed safely:', deviceErr);
    }

    // Approach A: Synchronize local barcode aggregate usage to Supabase shops table
    // Allows Command Central to track barcode usage without storing every sticker in the cloud
    try {
      const barcodeRes = await db.select('SELECT COUNT(*) as count FROM barcodes') as { count: number }[];
      const localBarcodeCount = barcodeRes?.[0]?.count ?? 0;
      
      await supabase
        .from('shops')
        .update({
          barcode_count: localBarcodeCount,
          last_barcode_sync_at: new Date().toISOString()
        })
        .eq('id', shopId);
    } catch (bcErr) {
      // Non-blocking if offline or column doesn't exist yet
      console.warn('[Heartbeat] Barcode count sync warning:', bcErr);
    }

    // Synchronize local active user aggregate count to Supabase shops table
    try {
      const userRes = await db.select('SELECT COUNT(*) as count FROM users WHERE is_deleted = 0 OR is_deleted IS NULL') as { count: number }[];
      const localUserCount = userRes?.[0]?.count ?? 0;
      
      await supabase
        .from('shops')
        .update({
          user_count: localUserCount,
          last_user_sync_at: new Date().toISOString()
        })
        .eq('id', shopId);
    } catch (uErr) {
      console.warn('[Heartbeat] User count sync warning:', uErr);
    }

    // Fast-track subscription entitlements check on heartbeat
    syncSubscriptionsFromCloud().catch(err => {
      console.warn('[Heartbeat] Quick subscription check warning:', err);
    });

    return true;
  } catch (error) {
    console.warn('Heartbeat check failed (offline).', error);
    return true; // Fail open for offline-first
  }
}

/**
 * Trigger an immediate background push of the barcode count to Supabase
 * Called after generating, editing, or deleting barcodes locally.
 */
export async function syncBarcodeUsageToCloud(): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    const db = await getDB();
    const settings = await db.select(
      "SELECT key, value FROM settings WHERE key = 'shop_id'"
    ) as { key: string, value: string }[];
    
    const shopId = settings.find(s => s.key === 'shop_id')?.value;
    if (!shopId) return;

    const barcodeRes = await db.select('SELECT COUNT(*) as count FROM barcodes') as { count: number }[];
    const localBarcodeCount = barcodeRes?.[0]?.count ?? 0;

    await supabase
      .from('shops')
      .update({
        barcode_count: localBarcodeCount,
        last_barcode_sync_at: new Date().toISOString()
      })
      .eq('id', shopId);
  } catch (err) {
    // Non-blocking
    console.warn('[syncBarcodeUsageToCloud] Failed to sync count to Supabase:', err);
  }
}

/**
 * Trigger an immediate background push of the user / operator count to Supabase
 * Called after creating, editing, or deleting users locally.
 */
export async function syncUserUsageToCloud(): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    const db = await getDB();
    const settings = await db.select(
      "SELECT key, value FROM settings WHERE key = 'shop_id'"
    ) as { key: string, value: string }[];
    
    const shopId = settings.find(s => s.key === 'shop_id')?.value;
    if (!shopId) return;

    const userRes = await db.select('SELECT COUNT(*) as count FROM users WHERE is_deleted = 0 OR is_deleted IS NULL') as { count: number }[];
    const localUserCount = userRes?.[0]?.count ?? 0;

    await supabase
      .from('shops')
      .update({
        user_count: localUserCount,
        last_user_sync_at: new Date().toISOString()
      })
      .eq('id', shopId);
  } catch (err) {
    // Non-blocking
    console.warn('[syncUserUsageToCloud] Failed to sync count to Supabase:', err);
  }
}
