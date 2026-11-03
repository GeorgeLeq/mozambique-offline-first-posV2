/**
 * @file aiCommandLogs.ts
 * @description Sync Engine module for AI Command Logs & Muse Spark Agentic Actions.
 * 
 * Provides bidirectional sync:
 * 1. Pushes local desktop voice/text commands and tool invocations to Supabase.
 * 2. Pulls companion app commands executed by the shop owner/manager on mobile,
 *    updating local audit trails and reflecting stock changes in local SQLite.
 */

import { getDB } from '../db';
import { supabase, isSupabaseConfigured } from '../supabase';

export async function syncAiCommandLogsToCloud(): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const db = await getDB();
    const settings = (await db.select("SELECT value FROM settings WHERE key = 'shop_id'")) as { value: string }[];
    const shopId = settings?.[0]?.value || null;

    // Pull unsynced local commands
    const unsynced = (await db.select(
      `SELECT * FROM ai_command_logs 
       WHERE sync_status = 0 AND (device_origin = 'desktop_pos' OR device_origin IS NULL)
       ORDER BY created_at ASC LIMIT 30`
    )) as any[];

    if (!unsynced || unsynced.length === 0) {
      return false;
    }

    console.log(`[AI Command Sync] Uploading ${unsynced.length} AI command logs to Supabase...`);

    const payload = unsynced.map((log) => {
      let toolArgs: any = null;
      let toolRes: any = null;

      try {
        toolArgs = typeof log.tool_arguments === 'string' ? JSON.parse(log.tool_arguments) : log.tool_arguments;
      } catch {
        toolArgs = log.tool_arguments;
      }

      try {
        toolRes = typeof log.tool_result === 'string' ? JSON.parse(log.tool_result) : log.tool_result;
      } catch {
        toolRes = log.tool_result;
      }

      return {
        id: log.id,
        shop_id: log.shop_id || shopId,
        user_id: log.user_id || null,
        input_type: log.input_type || 'text',
        raw_input: log.raw_input || '',
        transcription: log.transcription || null,
        detected_intent: log.detected_intent || null,
        tool_called: log.tool_called || null,
        tool_arguments: toolArgs,
        tool_result: toolRes,
        execution_status: log.execution_status || 'success',
        client_timestamp: log.client_timestamp || log.created_at || new Date().toISOString(),
        created_at: log.created_at || new Date().toISOString(),
        synced_at: new Date().toISOString(),
      };
    });

    const { error } = await supabase.from('ai_command_logs').upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('[AI Command Sync] Supabase upsert error:', error.message);
      if (error.code === '42P01') {
        // Table doesn't exist yet on remote Supabase instance
        console.warn('[AI Command Sync] Remote ai_command_logs table not created yet on Supabase.');
        return false;
      }
      throw error;
    }

    // Mark as synced locally
    const syncedIds = unsynced.map((s) => s.id);
    const placeholders = syncedIds.map(() => '?').join(',');
    await db.execute(
      `UPDATE ai_command_logs SET sync_status = 1, synced_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
      syncedIds
    );

    console.log(`[AI Command Sync] Successfully uploaded batch of ${syncedIds.length} logs.`);

    // Check if more remain in queue
    const remaining = (await db.select(
      "SELECT id FROM ai_command_logs WHERE sync_status = 0 AND (device_origin = 'desktop_pos' OR device_origin IS NULL) LIMIT 1"
    )) as any[];

    return remaining.length > 0;
  } catch (error) {
    console.warn('[AI Command Sync] Background push failed (will retry):', error);
    return false;
  }
}

/**
 * Pulls AI commands registered by the Mobile Companion App or other terminals from Supabase into local SQLite.
 * Keeps the desktop POS informed of actions taken on the go.
 */
export async function syncAiCommandLogsFromCloud(): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const db = await getDB();
    const settings = (await db.select("SELECT value FROM settings WHERE key = 'shop_id'")) as { value: string }[];
    const shopId = settings?.[0]?.value || null;

    if (!shopId) {
      return false;
    }

    // Pull recent command logs from Supabase
    const { data, error } = await supabase
      .from('ai_command_logs')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      if (error.code === '42P01') return false;
      console.warn('[AI Command Sync] Error fetching remote ai_command_logs:', error.message);
      return false;
    }

    if (!data || data.length === 0) {
      return false;
    }

    // Check which IDs already exist in local SQLite
    const remoteIds = data.map((d: any) => d.id);
    const placeholders = remoteIds.map(() => '?').join(',');
    const existingRows = (await db.select(
      `SELECT id FROM ai_command_logs WHERE id IN (${placeholders})`,
      remoteIds
    )) as { id: string }[];
    const existingIdSet = new Set(existingRows.map((r) => r.id));

    let newCount = 0;

    for (const remoteLog of data) {
      if (!existingIdSet.has(remoteLog.id)) {
        const toolArgsStr = typeof remoteLog.tool_arguments === 'object' && remoteLog.tool_arguments !== null
          ? JSON.stringify(remoteLog.tool_arguments)
          : (remoteLog.tool_arguments ? String(remoteLog.tool_arguments) : null);

        const toolResStr = typeof remoteLog.tool_result === 'object' && remoteLog.tool_result !== null
          ? JSON.stringify(remoteLog.tool_result)
          : (remoteLog.tool_result ? String(remoteLog.tool_result) : null);

        await db.execute(
          `INSERT OR REPLACE INTO ai_command_logs (
            id, shop_id, user_id, user_name, device_origin, input_type,
            raw_input, transcription, detected_intent, tool_called,
            tool_arguments, tool_result, execution_status, client_timestamp,
            created_at, synced_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            remoteLog.id,
            remoteLog.shop_id,
            remoteLog.user_id || null,
            remoteLog.user_name || 'App Móvel (Boss on the Go)',
            'companion_app',
            remoteLog.input_type || 'text',
            remoteLog.raw_input || '',
            remoteLog.transcription || null,
            remoteLog.detected_intent || null,
            remoteLog.tool_called || null,
            toolArgsStr,
            toolResStr,
            remoteLog.execution_status || 'success',
            remoteLog.client_timestamp || remoteLog.created_at,
            remoteLog.created_at,
            new Date().toISOString(),
          ]
        );

        // If the companion app executed voice stock deduction, apply it to local products catalog
        if (
          remoteLog.tool_called === 'execute_voice_stock_deduction' &&
          remoteLog.execution_status === 'success' &&
          remoteLog.tool_arguments
        ) {
          try {
            const args = typeof remoteLog.tool_arguments === 'string'
              ? JSON.parse(remoteLog.tool_arguments)
              : remoteLog.tool_arguments;
            const productId = args.product_id;
            const quantity = Number(args.quantity) || 0;

            if (productId && quantity > 0) {
              await db.execute(
                'UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [quantity, productId]
              );
              console.log(`[AI Command Sync] Reflected companion app stock deduction locally for product ${productId} (-${quantity})`);
            }
          } catch (err) {
            console.warn('[AI Command Sync] Failed to reflect stock change from remote log:', err);
          }
        }

        newCount++;
      }
    }

    if (newCount > 0) {
      console.log(`[AI Command Sync] Downloaded ${newCount} new AI command logs from Companion App.`);
    }

    return newCount > 0;
  } catch (error) {
    console.warn('[AI Command Sync] Background pull failed (will retry):', error);
    return false;
  }
}
