/**
 * @file shiftManager.ts
 * @description Centralized shift management, reconciliation calculation, and closure logic.
 */

import { getDB } from '../db';
import { syncUsersToCloud } from '../syncEngine/users';

export interface ShiftStats {
  baseCash: number;
  cashSalesTotal: number;
  cashDebtPayments: number;
  mpesaSalesTotal: number;
  emolaSalesTotal: number;
  fiadoSalesTotal: number;
  mpesaDebtPayments: number;
  tillPayoutsTotal: number;
  tillPayoutsCount: number;
  scansCount: number;
  refundsTotal: number;
  refundsCashTotal: number;
  totalExpectedCash: number;
  shiftStart: string;
}

/**
 * Checks if a shift timestamp is considered stale (e.g. from a previous calendar day or > 14h ago)
 */
export function isShiftStale(shiftStartIso?: string | null): boolean {
  if (!shiftStartIso) return false;
  try {
    const startDate = new Date(shiftStartIso);
    if (isNaN(startDate.getTime())) return false;

    const now = new Date();

    const diffHours = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    if (diffHours >= 14) return true;

    // Different calendar date check (local timezone)
    const isDifferentDay = (
      startDate.getFullYear() !== now.getFullYear() ||
      startDate.getMonth() !== now.getMonth() ||
      startDate.getDate() !== now.getDate()
    );

    return isDifferentDay;
  } catch {
    return false;
  }
}

/**
 * Calculates current active shift metrics, physical cash in till, and discrepancies
 */
export async function calculateActiveShiftStats(currentUser: any): Promise<ShiftStats> {
  const db = await getDB();

  let shiftStart = currentUser?.current_shift_start || '';
  if (!shiftStart) {
    try {
      const ss: any[] = await db.select('SELECT value FROM settings WHERE key = "current_shift_start"');
      if (ss.length > 0 && ss[0]?.value) {
        shiftStart = ss[0].value;
      }
    } catch {}
  }

  let dateCondition = '1=1';
  if (shiftStart) {
    const formattedShiftStart = shiftStart.replace('T', ' ').substring(0, 19);
    dateCondition = `created_at >= '${formattedShiftStart}'`;
  }

  // 1. Sales
  const sales: any[] = await db.select(
    `SELECT total_mt, payment_method, payment_details FROM sales WHERE ${dateCondition}`
  );

  let cashSalesTotal = 0;
  let mpesaSalesTotal = 0;
  let emolaSalesTotal = 0;
  let fiadoSalesTotal = 0;

  for (const s of sales) {
    if ((s.total_mt || 0) > 0) {
      if (s.payment_method === 'cash') {
        cashSalesTotal += s.total_mt;
      } else if (s.payment_method === 'm-pesa' || s.payment_method === 'mpesa') {
        mpesaSalesTotal += s.total_mt;
      } else if (s.payment_method === 'e-mola' || s.payment_method === 'emola') {
        emolaSalesTotal += s.total_mt;
      } else if (s.payment_method === 'fiado') {
        fiadoSalesTotal += s.total_mt;
      } else if (s.payment_method === 'mixed') {
        try {
          if (s.payment_details) {
            const splits = JSON.parse(s.payment_details);
            const splitCash = parseFloat(splits.cash) || 0;
            const splitMpesa = parseFloat(splits.mpesa) || 0;
            const splitEmola = parseFloat(splits.emola) || 0;
            const splitTotal = splitCash + splitMpesa + splitEmola;
            if (splitTotal > 0) {
              cashSalesTotal += s.total_mt * (splitCash / splitTotal);
              mpesaSalesTotal += s.total_mt * (splitMpesa / splitTotal);
              emolaSalesTotal += s.total_mt * (splitEmola / splitTotal);
            } else {
              cashSalesTotal += s.total_mt;
            }
          } else {
            cashSalesTotal += s.total_mt;
          }
        } catch {
          cashSalesTotal += s.total_mt;
        }
      }
    }
  }

  // 2. Debt payments
  let cashDebtPayments = 0;
  let mpesaDebtPayments = 0;
  try {
    const debtPayments: any[] = await db.select(
      `SELECT amount_mt, payment_method FROM debt_payments WHERE ${dateCondition}`
    );
    for (const dp of debtPayments) {
      if (dp.payment_method === 'cash') {
        cashDebtPayments += dp.amount_mt || 0;
      } else {
        mpesaDebtPayments += dp.amount_mt || 0;
      }
    }
  } catch {}

  // 3. Till payouts
  let tillPayoutsTotal = 0;
  let tillPayoutsCount = 0;
  try {
    const payouts: any[] = await db.select(
      `SELECT amount_mt FROM till_payouts WHERE ${dateCondition}`
    );
    tillPayoutsTotal = payouts.reduce((acc, p) => acc + (p.amount_mt || 0), 0);
    tillPayoutsCount = payouts.length;
  } catch {}

  // 4. Refunds
  let refundsTotal = 0;
  let refundsCashTotal = 0;
  try {
    const refunds: any[] = await db.select(
      `SELECT refund_amount_mt, payment_method FROM refunds WHERE ${dateCondition}`
    );
    for (const r of refunds) {
      const amt = r.refund_amount_mt || 0;
      refundsTotal += amt;
      if (r.payment_method === 'cash') {
        refundsCashTotal -= amt;
      }
    }
  } catch {}

  // 5. Scans count
  let scansCount = 0;
  try {
    const items: any[] = await db.select(
      `SELECT SUM(quantity) as total_items FROM sale_items WHERE ${dateCondition}`
    );
    scansCount = items[0]?.total_items || 0;
  } catch {}

  // 6. Base cash
  let baseCash = currentUser?.current_shift_cash ?? 0;
  if (!baseCash && currentUser?.id) {
    try {
      const userShiftCashRow: any[] = await db.select(
        'SELECT value FROM settings WHERE key = ?',
        [`current_shift_cash_${currentUser.id}`]
      );
      if (userShiftCashRow.length > 0) {
        baseCash = parseFloat(userShiftCashRow[0].value) || 0;
      }
    } catch {}
  }
  if (!baseCash) {
    try {
      const settingsRow: any[] = await db.select('SELECT value FROM settings WHERE key = "base_cash"');
      if (settingsRow.length > 0) {
        baseCash = parseFloat(settingsRow[0].value) || 0;
      }
    } catch {}
  }

  const totalExpectedCash = baseCash + cashSalesTotal + cashDebtPayments - tillPayoutsTotal + refundsCashTotal;

  return {
    baseCash,
    cashSalesTotal,
    cashDebtPayments,
    mpesaSalesTotal,
    emolaSalesTotal,
    fiadoSalesTotal,
    mpesaDebtPayments,
    tillPayoutsTotal,
    tillPayoutsCount,
    scansCount,
    refundsTotal,
    refundsCashTotal,
    totalExpectedCash,
    shiftStart
  };
}

/**
 * Seals the shift report in SQLite, cleans up shift settings and user records,
 * and pushes the updated user state to Supabase cloud.
 */
export async function closeShiftRecord(
  currentUser: any,
  reportedAmount: number,
  detailsJson?: string,
  precalculatedStats?: ShiftStats
): Promise<{ reportId: string; difference: number }> {
  const db = await getDB();
  const stats = precalculatedStats || (await calculateActiveShiftStats(currentUser));

  const expectedAmount = stats.totalExpectedCash;
  const difference = reportedAmount - expectedAmount;
  const reportId = crypto.randomUUID();

  const fullDetails = {
    stats,
    breakdown: detailsJson ? JSON.parse(detailsJson) : null
  };

  await db.execute(
    `INSERT INTO shift_reports (
       id, user_id, user_name, opening_cash, closing_cash, expected_cash, discrepancy,
       total_sales, total_cash_sales, total_pos_sales, total_mkesh_sales, status,
       details_json, closed_at, sync_status
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'closed', ?, CURRENT_TIMESTAMP, 0)`,
    [
      reportId,
      currentUser?.id || 'unknown',
      currentUser?.name || 'Sistema',
      stats.baseCash,
      reportedAmount,
      expectedAmount,
      difference,
      stats.cashSalesTotal + stats.mpesaSalesTotal + stats.emolaSalesTotal + stats.fiadoSalesTotal,
      stats.cashSalesTotal + stats.cashDebtPayments,
      0,
      stats.mpesaSalesTotal + stats.emolaSalesTotal + stats.mpesaDebtPayments,
      JSON.stringify(fullDetails)
    ]
  );

  // Check notification preferences
  try {
    const notifPrefsRow: any[] = await db.select("SELECT value FROM settings WHERE key = 'notification_preferences'");
    const prefs = notifPrefsRow[0]?.value ? notifPrefsRow[0].value.split(',') : [];

    if (prefs.includes('shift_start') || prefs.includes('shift_close')) {
      const notifId = crypto.randomUUID();
      await db.execute(
        `INSERT INTO notifications (id, type, title, message, is_read, action_url, sync_status)
         VALUES (?, 'SHIFT_CLOSED', 'Turno Fechado', ?, 0, 'reports', 0)`,
        [
          notifId,
          `O operador ${currentUser?.name || 'Desconhecido'} fechou o turno. Diferença de caixa: ${difference > 0 ? '+' : ''}${difference} MT.`
        ]
      );
    }
  } catch {}

  // Clear local shift state
  await db.execute('DELETE FROM settings WHERE key = "current_shift_start"');
  if (currentUser?.id) {
    await db.execute('DELETE FROM settings WHERE key = ?', [`current_shift_start_${currentUser.id}`]);
    await db.execute('DELETE FROM settings WHERE key = ?', [`current_shift_cash_${currentUser.id}`]);

    await db.execute(
      'UPDATE users SET current_shift_start = NULL, current_shift_cash = NULL, sync_status = 0 WHERE id = ?',
      [currentUser.id]
    );

    // Push updated user state immediately to the cloud
    await syncUsersToCloud().catch(err => console.warn('[ShiftManager] Instant cloud sync failed:', err));
  }

  return { reportId, difference };
}
