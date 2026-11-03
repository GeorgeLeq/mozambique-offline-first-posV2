import { getDB } from '../db';
import { supabase } from '../supabase';

export async function syncEmergencyTokensToCloud(): Promise<boolean> {
  try {
    const db = await getDB();
    const settings = await db.select("SELECT value FROM settings WHERE key = 'shop_id'") as { value: string }[];
    if (!settings || settings.length === 0) return false;
    const shopId = settings[0].value;

    // Ensure sync_status column exists in SQLite emergency_tokens table
    try {
      await db.execute('ALTER TABLE emergency_tokens ADD COLUMN sync_status INTEGER DEFAULT 0;');
    } catch {}

    // Get unsynced tokens in batches
    const unsynced = await db.select('SELECT * FROM emergency_tokens WHERE sync_status = 0 OR sync_status IS NULL LIMIT 50') as any[];
    if (!unsynced || unsynced.length === 0) return false;

    console.log(`[Emergency Tokens Sync] Uploading batch of ${unsynced.length} records...`);

    const payload = unsynced.map(t => ({
      id: t.token || t.id,
      token: t.token || t.code || t.id,
      shop_id: shopId,
      code: t.token || t.code || t.id,
      cashier_id: t.used_by || t.cashier_id || '',
      is_used: t.used === 1 || t.is_used === true || t.is_used === '1',
      used_amount: t.used_amount || 0,
      used_for: t.used_for || '',
      created_at: t.created_at || new Date().toISOString(),
      expires_at: t.expires_at || null,
      used_at: t.used_at || null
    }));

    const { error } = await supabase.from('emergency_tokens').upsert(payload, { onConflict: 'token' });
    if (error) {
      // Fallback try onConflict 'id'
      await supabase.from('emergency_tokens').upsert(payload, { onConflict: 'id' });
    }

    const syncedTokens = unsynced.map(t => t.token || t.id);
    const placeholders = syncedTokens.map(() => '?').join(',');
    
    await db.execute(
      `UPDATE emergency_tokens SET sync_status = 1 WHERE token IN (${placeholders}) OR id IN (${placeholders})`, 
      [...syncedTokens, ...syncedTokens]
    );

    // Clean up expired or used tokens locally
    try {
      await db.execute("DELETE FROM emergency_tokens WHERE datetime(expires_at) < datetime('now') OR is_used = 1");
    } catch {}

    // Check if more remain
    const remaining = await db.select('SELECT token FROM emergency_tokens WHERE sync_status = 0 OR sync_status IS NULL LIMIT 1') as any[];
    return remaining.length > 0;
  } catch (error) {
    console.warn('Background emergency tokens sync failed.', error);
    return false;
  }
}

export async function syncEmergencyTokensFromCloud(): Promise<boolean> {
  try {
    const db = await getDB();
    const settings = await db.select("SELECT value FROM settings WHERE key = 'shop_id'") as { value: string }[];
    if (!settings || settings.length === 0) return false;
    const shopId = settings[0].value;

    const lastPullSetting = await db.select(
      "SELECT value FROM settings WHERE key = 'last_pull_emergency_tokens'"
    ) as { value: string }[];
    const lastPull = lastPullSetting.length > 0 ? lastPullSetting[0].value : '1970-01-01T00:00:00.000Z';
    const nextPullTime = new Date().toISOString();

    let cloudTokens: any[] | null = null;
    const tRes = await supabase
      .from('emergency_tokens')
      .select('id, token, code, cashier_id, is_used, used_by, used_amount, used_for, created_at, expires_at, used_at')
      .eq('shop_id', shopId)
      .gt('created_at', lastPull)
      .order('created_at', { ascending: true })
      .limit(100);

    let data: any[] | null = tRes.data;
    let error = tRes.error;

    if (error && (error.code === '42703' || error.message?.includes('token') || error.message?.includes('used_by') || error.message?.includes('cashier_id') || error.message?.includes('expires_at'))) {
      // Fallback 1: Try without token / used_by / cashier_id
      let fallback: any = await supabase
        .from('emergency_tokens')
        .select('id, code, created_at, expires_at, used_at')
        .eq('shop_id', shopId)
        .gt('created_at', lastPull)
        .order('created_at', { ascending: true })
        .limit(100);

      if (fallback.error && (fallback.error.code === '42703' || fallback.error.message?.includes('expires_at'))) {
        // Fallback 2: Supabase also does not have expires_at column yet
        fallback = await supabase
          .from('emergency_tokens')
          .select('id, code, created_at, used_at')
          .eq('shop_id', shopId)
          .gt('created_at', lastPull)
          .order('created_at', { ascending: true })
          .limit(100);
      }

      data = fallback.data as any[];
      error = fallback.error;
    }

    if (error) throw error;
    cloudTokens = data;
    if (!cloudTokens || cloudTokens.length === 0) {
      await db.execute(
        'INSERT OR REPLACE INTO settings (key, value, sync_status) VALUES (?, ?, 1)',
        ['last_pull_emergency_tokens', nextPullTime]
      );
      return false;
    }

    let maxCreatedAt = lastPull;

    for (const t of cloudTokens) {
      if (t.created_at && t.created_at > maxCreatedAt) {
        maxCreatedAt = t.created_at;
      }
      await db.execute(
        `INSERT OR REPLACE INTO emergency_tokens (
          id, token, code, cashier_id, used, is_used, used_by, used_amount, used_for, created_at, expires_at, used_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          t.id || t.token,
          t.token || t.code || t.id,
          t.code || t.token,
          t.cashier_id || t.used_by || '',
          t.is_used ? 1 : 0,
          t.is_used ? 1 : 0,
          t.cashier_id || t.used_by || '',
          t.used_amount || 0,
          t.used_for || '',
          t.created_at || new Date().toISOString(),
          t.expires_at || null,
          t.used_at || null
        ]
      );
    }
    await db.execute(
      'INSERT OR REPLACE INTO settings (key, value, sync_status) VALUES (?, ?, 1)',
      ['last_pull_emergency_tokens', maxCreatedAt]
    );
    console.log(`Successfully pulled ${cloudTokens.length} emergency tokens from Supabase.`);
    return cloudTokens.length >= 100;
  } catch (error) {
    console.warn('Background emergency tokens pull failed.', error);
    return false;
  }
}
