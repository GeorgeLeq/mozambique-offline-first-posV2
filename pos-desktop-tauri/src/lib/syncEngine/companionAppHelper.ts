/**
 * Companion App Database Helper (Online-First)
 * This script is designed for the 'Boss on the Go' companion mobile app.
 * It provides modular functions to insert and update debts and debt payments
 * directly in Supabase.
 * 
 * Since the Companion App is Online-First, these operations are performed
 * directly on Supabase, and will be automatically synchronized back to the POS
 * devices in the shop during their background sync intervals.
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for the companion app
// Note: Replace these with your actual Supabase URL and Anon Key in your companion app configuration.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface CompanionDebt {
  id: string; // UUID
  shop_id: string; // UUID of the shop
  customer_name: string;
  amount_mt: number;
  status: 'pending' | 'paid' | 'partial';
  phone_number?: string;
  address?: string;
  payment_method?: string;
  items_json?: string; // JSON string representing cart items
  receipt_id?: string;
  created_at?: string;
  paid_at?: string;
}

export interface CompanionDebtPayment {
  id: string; // UUID
  shop_id: string; // UUID of the shop
  debt_id: string; // UUID of the linked debt
  amount_mt: number;
  payment_method: string;
  receipt_id?: string;
  created_at?: string;
}

/**
 * Inserts a new debt or updates an existing debt in Supabase.
 * Useful for the Boss to register a custom customer debt on the go.
 */
export async function upsertDebt(debt: CompanionDebt) {
  try {
    const payload = {
      id: debt.id || crypto.randomUUID(),
      shop_id: debt.shop_id,
      customer_name: debt.customer_name,
      amount_mt: debt.amount_mt,
      status: debt.status,
      phone_number: debt.phone_number || null,
      address: debt.address || null,
      payment_method: debt.payment_method || null,
      items_json: debt.items_json || null,
      receipt_id: debt.receipt_id || null,
      created_at: debt.created_at || new Date().toISOString(),
      paid_at: debt.paid_at || null,
    };

    const { data, error } = await supabase
      .from('debts')
      .upsert(payload, { onConflict: 'id' })
      .select();

    if (error) {
      console.error('Failed to upsert debt in Supabase:', error.message);
      throw error;
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error in upsertDebt:', error);
    return { success: false, error };
  }
}

/**
 * Registers a payment towards an existing debt, and updates the debt's remaining balance/status.
 * Designed for the Boss to receive payments on the go and have it instantly updated.
 */
export async function recordDebtPayment(payment: CompanionDebtPayment) {
  try {
    const paidAmount = Number(payment.amount_mt);

    // 1. Insert the payment record
    const paymentPayload = {
      id: payment.id || crypto.randomUUID(),
      shop_id: payment.shop_id,
      debt_id: payment.debt_id,
      amount_mt: paidAmount,
      payment_method: payment.payment_method,
      receipt_id: payment.receipt_id || null,
      created_at: payment.created_at || new Date().toISOString(),
    };

    const { data: paymentData, error: paymentError } = await supabase
      .from('debt_payments')
      .insert([paymentPayload])
      .select();

    if (paymentError) {
      console.error('Failed to insert debt payment in Supabase:', paymentError.message);
      throw paymentError;
    }

    // 2. Fetch current debt to calculate new remaining amount
    const { data: debtData, error: debtFetchError } = await supabase
      .from('debts')
      .select('*')
      .eq('id', payment.debt_id)
      .single();

    if (debtFetchError) {
      console.error('Failed to fetch debt details for recalculation:', debtFetchError.message);
      throw debtFetchError;
    }

    const currentDebt = debtData as CompanionDebt;
    const currentRemaining = Number(currentDebt.amount_mt);

    // 3. Subtract payment amount to get the new remaining balance
    // In our POS architecture, debts.amount_mt represents the remaining outstanding balance (Falta Pagar)
    const newRemainingAmount = Math.max(0, currentRemaining - paidAmount);

    // 4. Calculate status based on remaining balance
    // It remains 'unpaid' when there is still money outstanding, which allows the POS to render it as 'Parcial'
    // It becomes 'paid' only when the balance reaches zero
    let newStatus: 'paid' | 'unpaid' = 'unpaid';
    let paidAt: string | null = null;

    if (newRemainingAmount <= 0.01) {
      newStatus = 'paid';
      paidAt = new Date().toISOString();
    }

    // 5. Update the debt in Supabase with the decremented amount and correct status
    const { data: updatedDebt, error: debtUpdateError } = await supabase
      .from('debts')
      .update({ 
        amount_mt: newRemainingAmount, 
        status: newStatus, 
        paid_at: paidAt 
      })
      .eq('id', payment.debt_id)
      .select();

    if (debtUpdateError) {
      console.error('Failed to update debt details in Supabase:', debtUpdateError.message);
      throw debtUpdateError;
    }

    return {
      success: true,
      payment: paymentData[0],
      debt: updatedDebt[0],
      previousRemaining: currentRemaining,
      newRemaining: newRemainingAmount,
      status: newStatus
    };
  } catch (error) {
    console.error('Error in recordDebtPayment:', error);
    return { success: false, error };
  }
}

/**
 * Logs an AI command issued from the Companion App (Voice or Text) directly to Supabase.
 * Will be pulled down to the Desktop POS during the next sync cycle.
 */
export async function logCompanionAiCommand(params: {
  shop_id: string;
  user_id?: string | null;
  input_type: 'voice' | 'text';
  raw_input: string;
  transcription?: string | null;
  detected_intent?: string | null;
  tool_called?: string | null;
  tool_arguments?: Record<string, any> | null;
  tool_result?: Record<string, any> | null;
  execution_status?: 'success' | 'failed' | 'pending' | 'queued_offline' | 'cancelled' | 'undone';
}) {
  try {
    const payload = {
      id: crypto.randomUUID(),
      shop_id: params.shop_id,
      user_id: params.user_id || null,
      input_type: params.input_type,
      raw_input: params.raw_input,
      transcription: params.transcription || (params.input_type === 'text' ? params.raw_input : null),
      detected_intent: params.detected_intent || null,
      tool_called: params.tool_called || null,
      tool_arguments: params.tool_arguments || null,
      tool_result: params.tool_result || null,
      execution_status: params.execution_status || 'success',
      client_timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
      synced_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('ai_command_logs').insert(payload).select();
    if (error) {
      console.warn('Failed to insert companion ai_command_log:', error.message);
      return { success: false, error };
    }
    return { success: true, data: data?.[0] };
  } catch (err) {
    console.error('Error in logCompanionAiCommand:', err);
    return { success: false, error: err };
  }
}

/**
 * Executes atomic voice stock deduction via Supabase RPC function.
 * Automatically decrements inventory and logs the action into ai_command_logs.
 */
export async function executeVoiceStockDeductionViaSupabase(params: {
  shop_id: string;
  product_id: string;
  quantity: number;
  reason?: string;
  user_id?: string | null;
  raw_input?: string;
}) {
  try {
    const { data: rpcResult, error: rpcError } = await supabase.rpc('execute_voice_stock_deduction', {
      p_shop_id: params.shop_id,
      p_product_id: params.product_id,
      p_quantity: params.quantity,
      p_reason: params.reason || 'Muse Voice Companion App deduction'
    });

    if (rpcError) {
      console.error('RPC execute_voice_stock_deduction error:', rpcError.message);
      return { success: false, error: rpcError };
    }

    // Record in ai_command_logs
    await logCompanionAiCommand({
      shop_id: params.shop_id,
      user_id: params.user_id,
      input_type: 'voice',
      raw_input: params.raw_input || `Deduzir ${params.quantity} unidades do produto ${params.product_id}`,
      detected_intent: 'STOCK_DEDUCT',
      tool_called: 'execute_voice_stock_deduction',
      tool_arguments: {
        product_id: params.product_id,
        quantity: params.quantity,
        reason: params.reason
      },
      tool_result: rpcResult,
      execution_status: rpcResult?.success ? 'success' : 'failed'
    });

    return { success: true, result: rpcResult };
  } catch (err) {
    console.error('Error in executeVoiceStockDeductionViaSupabase:', err);
    return { success: false, error: err };
  }
}

/**
 * Reverts atomic voice stock deduction via Supabase RPC function.
 */
export async function undoVoiceStockDeductionViaSupabase(params: {
  shop_id: string;
  product_id: string;
  quantity: number;
  command_log_id?: string;
}) {
  try {
    const { data: rpcResult, error: rpcError } = await supabase.rpc('undo_voice_stock_deduction', {
      p_shop_id: params.shop_id,
      p_product_id: params.product_id,
      p_quantity: params.quantity
    });

    if (rpcError) {
      console.error('RPC undo_voice_stock_deduction error:', rpcError.message);
      return { success: false, error: rpcError };
    }

    if (params.command_log_id) {
      await supabase
        .from('ai_command_logs')
        .update({ execution_status: 'undone' })
        .eq('id', params.command_log_id);
    }

    return { success: true, result: rpcResult };
  } catch (err) {
    console.error('Error in undoVoiceStockDeductionViaSupabase:', err);
    return { success: false, error: err };
  }
}

