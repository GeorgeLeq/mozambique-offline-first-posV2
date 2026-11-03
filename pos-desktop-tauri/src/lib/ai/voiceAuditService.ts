/**
 * @file voiceAuditService.ts
 * @description Offline-First Voice Telemetry & Store-and-Forward Service.
 * Writes encrypted voice logs to local SQLite first (offline authoritative),
 * then coordinates background synchronization to Supabase when connectivity is available.
 */

import { getDB } from '../db';
import { encryptVoicePayload } from '../security/voiceEncryption';
import { syncVoiceAuditsToCloud } from '../syncEngine/voiceAudits';

export interface VoiceAuditRecord {
  id: string;
  shop_id?: string;
  shift_id?: string | null;
  cashier_id?: string | null;
  cashier_name?: string;
  feature_context: 'cash_up' | 'petty_cash' | 'pos_search' | 'generic';
  transcribed_text: string;
  parsed_entities?: Record<string, any> | null;
  audio_duration_seconds?: number;
  confidence_score?: number;
  encrypted_payload?: string | null;
  is_mock?: boolean;
  is_offline?: boolean;
  sync_status?: number; // 0 = unsynced local queue, 1 = synced to cloud
  created_at?: string;
}

/**
 * Persists an audio interaction locally with AES-256-GCM encryption
 * to guarantee offline data resilience and fraud audit trails.
 */
export async function logVoiceInteraction(params: {
  shiftId?: string | null;
  cashierId?: string | null;
  cashierName?: string;
  featureContext: 'cash_up' | 'petty_cash' | 'pos_search' | 'generic';
  transcribedText: string;
  parsedEntities?: Record<string, any>;
  audioDurationSeconds?: number;
  confidenceScore?: number;
  isMock?: boolean;
  isOffline?: boolean;
}): Promise<VoiceAuditRecord | null> {
  try {
    const db = await getDB();
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    // 1. Resolve local shop identifier
    let shopId = 'local-terminal';
    try {
      const settings = (await db.select("SELECT value FROM settings WHERE key = 'shop_id'")) as { value: string }[];
      if (settings && settings.length > 0 && settings[0].value) {
        shopId = settings[0].value;
      }
    } catch {}

    const isOfflineMode = params.isOffline ?? (!navigator.onLine);

    // 2. Encrypt sensitive audio entities and transcript payload using AES-GCM
    const sensitiveData = {
      id,
      shopId,
      shiftId: params.shiftId,
      cashierId: params.cashierId,
      cashierName: params.cashierName || 'Caixa',
      featureContext: params.featureContext,
      transcribedText: params.transcribedText,
      parsedEntities: params.parsedEntities || {},
      audioDurationSeconds: params.audioDurationSeconds || 0,
      confidenceScore: params.confidenceScore ?? 0.95,
      recordedAt: createdAt,
      deviceOnline: !isOfflineMode,
    };

    const encryptedPayload = await encryptVoicePayload(sensitiveData);

    const parsedEntitiesJson = params.parsedEntities ? JSON.stringify(params.parsedEntities) : '{}';

    // 3. Write directly into SQLite local authoritative queue (sync_status = 0)
    await db.execute(
      `INSERT INTO ai_voice_audit_logs (
        id, shop_id, shift_id, cashier_id, cashier_name, feature_context,
        transcribed_text, parsed_entities, audio_duration_seconds, confidence_score,
        encrypted_payload, is_mock, is_offline, sync_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        id,
        shopId,
        params.shiftId || null,
        params.cashierId || null,
        params.cashierName || 'Caixa',
        params.featureContext,
        params.transcribedText,
        parsedEntitiesJson,
        params.audioDurationSeconds || 0,
        params.confidenceScore ?? 0.95,
        encryptedPayload,
        params.isMock ? 1 : 0,
        isOfflineMode ? 1 : 0,
        createdAt,
      ]
    );

    const record: VoiceAuditRecord = {
      id,
      shop_id: shopId,
      shift_id: params.shiftId,
      cashier_id: params.cashierId,
      cashier_name: params.cashierName || 'Caixa',
      feature_context: params.featureContext,
      transcribed_text: params.transcribedText,
      parsed_entities: params.parsedEntities,
      audio_duration_seconds: params.audioDurationSeconds || 0,
      confidence_score: params.confidenceScore ?? 0.95,
      encrypted_payload: encryptedPayload,
      is_mock: params.isMock,
      is_offline: isOfflineMode,
      sync_status: 0,
      created_at: createdAt,
    };

    // 4. Dispatch browser/webview event so UI listeners can display live status
    window.dispatchEvent(
      new CustomEvent('ai_voice_audit_logged', {
        detail: record,
      })
    );

    // 5. Opportunistically trigger background forward if online
    if (navigator.onLine) {
      syncVoiceAuditsToCloud().catch((err) => {
        console.log('[VoiceAuditService] Cloud forward scheduled for next batch cycle.', err);
      });
    }

    return record;
  } catch (error) {
    console.error('[VoiceAuditService] Failed to record voice audit log:', error);
    return null;
  }
}

/**
 * Counts how many encrypted voice records are currently held in the local SQLite queue
 */
export async function getPendingVoiceAuditsCount(): Promise<number> {
  try {
    const db = await getDB();
    const rows = (await db.select('SELECT id FROM ai_voice_audit_logs WHERE sync_status = 0')) as any[];
    return rows?.length || 0;
  } catch {
    return 0;
  }
}

/**
 * Retrieves recent voice audit records for audit trails and terminal diagnostics
 */
export async function getRecentVoiceAudits(limit: number = 20): Promise<VoiceAuditRecord[]> {
  try {
    const db = await getDB();
    const rows = (await db.select(
      `SELECT * FROM ai_voice_audit_logs ORDER BY created_at DESC LIMIT ${limit}`
    )) as any[];

    return (rows || []).map((row) => ({
      ...row,
      parsed_entities: typeof row.parsed_entities === 'string' ? JSON.parse(row.parsed_entities || '{}') : row.parsed_entities,
      is_mock: row.is_mock === 1 || row.is_mock === true,
      is_offline: row.is_offline === 1 || row.is_offline === true,
    }));
  } catch (error) {
    console.error('[VoiceAuditService] Failed to load recent voice audits:', error);
    return [];
  }
}
