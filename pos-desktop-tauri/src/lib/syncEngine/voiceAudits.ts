/**
 * @file voiceAudits.ts
 * @description Sync Engine module for AI Voice Transcribe & Audit Logs.
 * Forwards locally recorded, encrypted voice interactions from SQLite to Supabase cloud replica.
 */

import { getDB } from '../db';
import { supabase, isSupabaseConfigured } from '../supabase';

export async function syncVoiceAuditsToCloud(): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const db = await getDB();
    const settings = (await db.select("SELECT value FROM settings WHERE key = 'shop_id'")) as { value: string }[];
    const shopId = settings?.[0]?.value || null;

    // Pull un-forwarded encrypted voice interactions from SQLite
    const unsynced = (await db.select(
      'SELECT * FROM ai_voice_audit_logs WHERE sync_status = 0 ORDER BY created_at ASC LIMIT 30'
    )) as any[];

    if (!unsynced || unsynced.length === 0) {
      return false;
    }

    console.log(`[Voice Audits Sync] Forwarding ${unsynced.length} voice records to Supabase...`);

    const payload = unsynced.map((log) => {
      let parsedEntities = {};
      try {
        parsedEntities = typeof log.parsed_entities === 'string'
          ? JSON.parse(log.parsed_entities)
          : (log.parsed_entities || {});
      } catch {
        parsedEntities = {};
      }

      return {
        id: log.id,
        organization_id: shopId,
        shift_id: log.shift_id || null,
        cashier_id: log.cashier_id || null,
        cashier_name: log.cashier_name || 'Caixa',
        feature_context: log.feature_context || 'generic',
        transcribed_text: log.transcribed_text || '',
        parsed_entities: parsedEntities,
        audio_duration_seconds: Number(log.audio_duration_seconds || 0),
        confidence_score: Number(log.confidence_score || 0.95),
        is_mock: Boolean(log.is_mock === 1 || log.is_mock === true),
        created_at: log.created_at || new Date().toISOString(),
      };
    });

    let { error } = await supabase.from('ai_voice_audit_logs').upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('[Voice Audits Sync] Supabase upsert error:', error.message);
      // Fallback: If organization_id does not match UUID or table not created yet, retry minimal columns
      if (error.code === '42P01') {
        // Table doesn't exist yet on remote Supabase instance
        console.warn('[Voice Audits Sync] Remote ai_voice_audit_logs table not created yet on Supabase.');
        return false;
      }
      throw error;
    }

    // Mark successfully forwarded in local SQLite
    const syncedIds = unsynced.map((s) => s.id);
    const placeholders = syncedIds.map(() => '?').join(',');
    await db.execute(
      `UPDATE ai_voice_audit_logs SET sync_status = 1 WHERE id IN (${placeholders})`,
      syncedIds
    );

    console.log(`[Voice Audits Sync] Successfully forwarded batch of ${syncedIds.length} voice logs.`);

    // Check if more remain in queue
    const remaining = (await db.select(
      'SELECT id FROM ai_voice_audit_logs WHERE sync_status = 0 LIMIT 1'
    )) as any[];

    return remaining.length > 0;
  } catch (error) {
    console.warn('[Voice Audits Sync] Background forward cycle failed (will retry next interval):', error);
    return false;
  }
}

/**
 * Voice audit logs are terminal telemetry and fraud audit records.
 * Terminals push their encrypted logs up to the cloud backoffice,
 * but do not pull external terminal logs into local SQLite.
 */
export async function syncVoiceAuditsFromCloud(): Promise<boolean> {
  return false;
}
