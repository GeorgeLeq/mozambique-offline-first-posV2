/**
 * @file aiCommandLogger.ts
 * @description Unified AI Command & Voice Transcribe Audit Logger for Desktop POS and Companion App.
 * 
 * Supports Meta Developer Hackathon Features 1 & 3:
 * - Muse Spark 1.3 (Agentic Engine & Tool Calling)
 * - Muse Voice Transcribe (Audio-to-Text)
 * 
 * Records every voice and text interaction, detected intent, tool arguments,
 * and execution status into local SQLite with offline-first guarantees and
 * bidirectional synchronization with Supabase.
 */

import { getDB } from '../db';
import { logAudit } from '../audit';

export interface AiCommandLogRecord {
  id: string;
  shop_id: string | null;
  user_id: string | null;
  user_name: string;
  device_origin: 'desktop_pos' | 'companion_app' | 'customer_display';
  input_type: 'voice' | 'text';
  raw_input: string;
  transcription: string | null;
  detected_intent: string | null;
  tool_called: string | null;
  tool_arguments: Record<string, any> | string | null;
  tool_result: Record<string, any> | string | null;
  execution_status: 'success' | 'failed' | 'pending' | 'queued_offline' | 'cancelled' | 'undone';
  client_timestamp: string;
  created_at: string;
  synced_at: string | null;
  sync_status: number;
}

/**
 * Inserts an AI command (voice or text) into local SQLite and mirrors critical actions in audit_logs.
 */
export async function logAiCommand(
  entry: Partial<AiCommandLogRecord>
): Promise<AiCommandLogRecord> {
  const db = await getDB();
  const id = entry.id || crypto.randomUUID();
  const shopId = entry.shop_id || localStorage.getItem('shop_id') || null;
  
  // Extract active cashier/user name and id from local session
  let activeUserId = entry.user_id || null;
  let activeUserName = entry.user_name || 'Operador';
  
  if (!activeUserId) {
    try {
      const activeUserJson = localStorage.getItem('active_user') || localStorage.getItem('pos_current_user');
      if (activeUserJson) {
        const parsed = JSON.parse(activeUserJson);
        activeUserId = parsed.id || null;
        activeUserName = parsed.name || activeUserName;
      }
    } catch {}
  }

  const deviceOrigin = entry.device_origin || 'desktop_pos';
  const inputType = entry.input_type || 'text';
  const rawInput = entry.raw_input || entry.transcription || '';
  const transcription = entry.transcription || (inputType === 'text' ? rawInput : null);
  const detectedIntent = entry.detected_intent || null;
  const toolCalled = entry.tool_called || null;

  const toolArgumentsStr = typeof entry.tool_arguments === 'object' && entry.tool_arguments !== null
    ? JSON.stringify(entry.tool_arguments)
    : (entry.tool_arguments ? String(entry.tool_arguments) : null);

  const toolResultStr = typeof entry.tool_result === 'object' && entry.tool_result !== null
    ? JSON.stringify(entry.tool_result)
    : (entry.tool_result ? String(entry.tool_result) : null);

  const executionStatus = entry.execution_status || 'success';
  const clientTimestamp = entry.client_timestamp || new Date().toISOString();
  const createdAt = entry.created_at || clientTimestamp;
  const syncedAt = entry.synced_at || null;
  const syncStatus = entry.sync_status ?? 0;

  const record: AiCommandLogRecord = {
    id,
    shop_id: shopId,
    user_id: activeUserId,
    user_name: activeUserName,
    device_origin: deviceOrigin,
    input_type: inputType,
    raw_input: rawInput,
    transcription,
    detected_intent: detectedIntent,
    tool_called: toolCalled,
    tool_arguments: entry.tool_arguments || null,
    tool_result: entry.tool_result || null,
    execution_status: executionStatus,
    client_timestamp: clientTimestamp,
    created_at: createdAt,
    synced_at: syncedAt,
    sync_status: syncStatus,
  };

  try {
    await db.execute(
      `INSERT INTO ai_command_logs (
        id, shop_id, user_id, user_name, device_origin, input_type,
        raw_input, transcription, detected_intent, tool_called,
        tool_arguments, tool_result, execution_status, client_timestamp,
        created_at, synced_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        shopId,
        activeUserId,
        activeUserName,
        deviceOrigin,
        inputType,
        rawInput,
        transcription,
        detectedIntent,
        toolCalled,
        toolArgumentsStr,
        toolResultStr,
        executionStatus,
        clientTimestamp,
        createdAt,
        syncedAt,
        syncStatus,
      ]
    );

    // If an action affected stock, price, or data modification, log to immutable audit ledger
    if (toolCalled) {
      const actionTitle = `MUSE_AI_${toolCalled.toUpperCase()}`;
      const actionDetails = `[${deviceOrigin === 'companion_app' ? 'App Móvel' : 'POS Balcão'}] ${inputType === 'voice' ? 'Voz' : 'Texto'}: "${rawInput}". Executado: ${toolCalled}. Resultado: ${executionStatus}`;
      await logAudit(activeUserId || undefined, actionTitle, actionDetails).catch((e) => {
        console.warn('[AiCommandLogger] Audit log mirror failed:', e);
      });
    }

    console.log(`[AiCommandLogger] Recorded AI command log: ${id} (${inputType} -> ${toolCalled || 'query'})`);
  } catch (error) {
    console.error('[AiCommandLogger] Failed to write ai_command_log:', error);
  }

  return record;
}

/**
 * Fetches recent AI command logs from local SQLite database.
 */
export async function fetchAiCommandLogs(options?: {
  limit?: number;
  origin?: 'desktop_pos' | 'companion_app' | 'all';
  search?: string;
}): Promise<AiCommandLogRecord[]> {
  const db = await getDB();
  const limit = options?.limit || 50;

  try {
    let query = 'SELECT * FROM ai_command_logs';
    const conditions: string[] = [];
    const values: any[] = [];

    if (options?.origin && options.origin !== 'all') {
      conditions.push('device_origin = ?');
      values.push(options.origin);
    }

    if (options?.search && options.search.trim() !== '') {
      conditions.push('(raw_input LIKE ? OR transcription LIKE ? OR user_name LIKE ? OR tool_called LIKE ?)');
      const term = `%${options.search.trim()}%`;
      values.push(term, term, term, term);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY created_at DESC LIMIT ${limit}`;

    const rows = (await db.select(query, values)) as any[];

    return rows.map((r) => {
      let args: any = null;
      let result: any = null;
      try {
        args = typeof r.tool_arguments === 'string' ? JSON.parse(r.tool_arguments) : r.tool_arguments;
      } catch {
        args = r.tool_arguments;
      }
      try {
        result = typeof r.tool_result === 'string' ? JSON.parse(r.tool_result) : r.tool_result;
      } catch {
        result = r.tool_result;
      }

      return {
        id: r.id,
        shop_id: r.shop_id || null,
        user_id: r.user_id || null,
        user_name: r.user_name || 'Operador',
        device_origin: r.device_origin || 'desktop_pos',
        input_type: r.input_type || 'text',
        raw_input: r.raw_input || '',
        transcription: r.transcription || null,
        detected_intent: r.detected_intent || null,
        tool_called: r.tool_called || null,
        tool_arguments: args,
        tool_result: result,
        execution_status: r.execution_status || 'success',
        client_timestamp: r.client_timestamp || r.created_at,
        created_at: r.created_at,
        synced_at: r.synced_at || null,
        sync_status: r.sync_status ?? 0,
      };
    });
  } catch (error) {
    console.warn('[AiCommandLogger] Failed to fetch ai_command_logs:', error);
    return [];
  }
}

/**
 * Reverts an AI command locally in SQLite if applicable (e.g. stock deduction undo).
 */
export async function undoAiCommand(id: string): Promise<{ success: boolean; message: string }> {
  const db = await getDB();

  try {
    const logs = (await db.select('SELECT * FROM ai_command_logs WHERE id = ?', [id])) as any[];
    if (!logs || logs.length === 0) {
      return { success: false, message: 'Registo de comando não encontrado.' };
    }

    const log = logs[0];
    if (log.execution_status === 'undone') {
      return { success: false, message: 'Este comando já foi revertido anteriormente.' };
    }

    // Handle stock deduction reversion
    if (log.tool_called === 'execute_voice_stock_deduction') {
      let args: any = {};
      try {
        args = typeof log.tool_arguments === 'string' ? JSON.parse(log.tool_arguments) : log.tool_arguments;
      } catch {}

      const productId = args?.product_id;
      const quantity = Number(args?.quantity) || 0;

      if (productId && quantity > 0) {
        // Restore stock in local SQLite products table
        await db.execute(
          'UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = CURRENT_TIMESTAMP, sync_status = 0 WHERE id = ?',
          [quantity, productId]
        );

        // Mark command as undone
        await db.execute("UPDATE ai_command_logs SET execution_status = 'undone', sync_status = 0 WHERE id = ?", [id]);

        await logAudit(
          log.user_id || undefined,
          'MUSE_AI_UNDO_STOCK_DEDUCTION',
          `Revertido comando AI ${id}: Restauradas ${quantity} unidades para o produto ${productId}`
        );

        return {
          success: true,
          message: `Acção revertida com sucesso. ${quantity} unidades repostas no inventário local.`,
        };
      }
    }

    // Default undo marking
    await db.execute("UPDATE ai_command_logs SET execution_status = 'undone', sync_status = 0 WHERE id = ?", [id]);
    return { success: true, message: 'Comando marcado como revertido no sistema.' };
  } catch (error: any) {
    console.error('[AiCommandLogger] Failed to undo AI command:', error);
    return { success: false, message: error.message || 'Erro ao reverter comando.' };
  }
}

/**
 * Offline-First local equivalent of execute_voice_stock_deduction.
 * Updates local SQLite products immediately and logs the action into ai_command_logs.
 */
export async function executeLocalVoiceStockDeduction(params: {
  shopId?: string;
  productId: string;
  quantity: number;
  reason?: string;
  rawInput?: string;
  inputType?: 'voice' | 'text';
  userName?: string;
}): Promise<{
  success: boolean;
  product_id?: string;
  product_name?: string;
  previous_stock?: number;
  deducted_quantity?: number;
  new_stock?: number;
  unit_price_mt?: number;
  estimated_total_mt?: number;
  error?: string;
}> {
  const db = await getDB();

  try {
    const products = (await db.select('SELECT id, name, price_mt, stock_quantity FROM products WHERE id = ?', [
      params.productId,
    ])) as any[];

    if (!products || products.length === 0) {
      return { success: false, error: 'Produto não encontrado no catálogo local.' };
    }

    const prod = products[0];
    const previousStock = Number(prod.stock_quantity) || 0;
    const priceMt = Number(prod.price_mt) || 0;
    const newStock = previousStock - params.quantity;

    // Deduct stock in SQLite
    await db.execute(
      'UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP, sync_status = 0 WHERE id = ?',
      [newStock, params.productId]
    );

    const resultPayload = {
      success: true,
      product_id: params.productId,
      product_name: prod.name,
      previous_stock: previousStock,
      deducted_quantity: params.quantity,
      new_stock: newStock,
      unit_price_mt: priceMt,
      estimated_total_mt: priceMt * params.quantity,
    };

    // Log to ai_command_logs
    await logAiCommand({
      input_type: params.inputType || 'voice',
      raw_input: params.rawInput || `Deduzir ${params.quantity}x ${prod.name}`,
      transcription: params.rawInput || null,
      detected_intent: 'STOCK_DEDUCT',
      tool_called: 'execute_voice_stock_deduction',
      tool_arguments: {
        product_id: params.productId,
        product_name: prod.name,
        quantity: params.quantity,
        reason: params.reason || 'Muse Voice POS sale',
      },
      tool_result: resultPayload,
      execution_status: 'success',
      user_name: params.userName || 'Operador',
    });

    return resultPayload;
  } catch (error: any) {
    console.error('[AiCommandLogger] Local voice stock deduction error:', error);
    return { success: false, error: error.message || 'Falha ao deduzir stock localmente.' };
  }
}
