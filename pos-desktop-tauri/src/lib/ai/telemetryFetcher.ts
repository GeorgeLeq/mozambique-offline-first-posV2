/**
 * @file telemetryFetcher.ts
 * @description Queries local SQLite database to assemble real-time store telemetry snapshots.
 */

import { getDB } from '../db';
import { StoreTelemetrySnapshot } from './types';

/**
 * Gathers a live operational snapshot from the local SQLite database.
 */
export async function fetchStoreTelemetrySnapshot(): Promise<StoreTelemetrySnapshot> {
  const db = await getDB();
  const shopName = (typeof localStorage !== 'undefined' ? localStorage.getItem('shop_name') : null) || 'SYCOMM POS';

  // 1. Fetch Users
  let users: any[] = [];
  try {
    users = (await db.select('SELECT id, name, role, current_shift_start FROM users WHERE is_deleted = 0 OR is_deleted IS NULL')) as any[];
  } catch (err) {
    console.warn('[StoreSentinel] Failed to fetch users:', err);
  }

  // 2. Fetch Recent Audit Logs
  let recentAudits: any[] = [];
  try {
    recentAudits = (await db.select('SELECT id, user_id, user_name, action, details, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 25')) as any[];
  } catch (err) {
    console.warn('[StoreSentinel] Failed to fetch audit_logs:', err);
  }

  // 3. Fetch Scans & Sales for Operator Activity
  const scanStatsByUser: Array<{ user_id: string; user_name: string; scan_count: number; total_mt: number }> = [];
  try {
    const scans = (await db.select('SELECT user_id, COUNT(*) as count FROM scan_history GROUP BY user_id')) as any[];
    const salesByUser = (await db.select('SELECT user_id, SUM(total_mt) as total FROM sales GROUP BY user_id')) as any[];
    
    for (const u of users) {
      const uScans = scans.find((s: any) => s.user_id === u.id)?.count || 0;
      const uSales = salesByUser.find((s: any) => s.user_id === u.id)?.total || 0;
      scanStatsByUser.push({
        user_id: u.id,
        user_name: u.name,
        scan_count: uScans,
        total_mt: Number(uSales) || 0
      });
    }
  } catch (err) {
    console.warn('[StoreSentinel] Failed to aggregate operator scan stats:', err);
  }

  // 4. Fetch Today's Sales Totals & Payment Method Breakdown
  let todaySalesTotal = 0;
  let todaySalesCount = 0;
  const paymentMethodsBreakdown = { cash: 0, mpesa: 0, emola: 0, fiado: 0 };

  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    let todaySales = (await db.select(
      `SELECT total_mt, payment_method FROM sales WHERE (created_at LIKE ? OR date(created_at) = date('now')) AND (status = 'completed' OR status IS NULL)`,
      [`${todayStr}%`]
    )) as any[];

    // Fallback: If no date filter matched, fetch all recent completed sales
    if (!todaySales || todaySales.length === 0) {
      todaySales = (await db.select(
        `SELECT total_mt, payment_method FROM sales WHERE (status = 'completed' OR status IS NULL) ORDER BY created_at DESC LIMIT 100`
      )) as any[];
    }

    todaySalesCount = todaySales.length;
    for (const sale of todaySales) {
      const amt = Number(sale.total_mt) || 0;
      todaySalesTotal += amt;
      const pm = (sale.payment_method || 'cash').toLowerCase();
      if (pm.includes('mpesa') || pm.includes('m-pesa')) {
        paymentMethodsBreakdown.mpesa += amt;
      } else if (pm.includes('emola') || pm.includes('e-mola')) {
        paymentMethodsBreakdown.emola += amt;
      } else if (pm.includes('fiado')) {
        paymentMethodsBreakdown.fiado += amt;
      } else {
        paymentMethodsBreakdown.cash += amt;
      }
    }
  } catch (err) {
    console.warn('[StoreSentinel] Failed to fetch today sales:', err);
  }

  // 5. Fetch Recent Shift Reports / Discrepancies
  let recentShifts: any[] = [];
  try {
    recentShifts = (await db.select('SELECT id, user_name, opening_cash, closing_cash, discrepancy, status, closed_at FROM shift_reports ORDER BY closed_at DESC LIMIT 5')) as any[];
  } catch (err) {
    console.warn('[StoreSentinel] Failed to fetch shift reports:', err);
  }

  // 6. Fetch Recent Cash Payouts / Sangrias
  let recentPayouts: any[] = [];
  try {
    recentPayouts = (await db.select('SELECT id, amount, note, authorized_by, created_at FROM till_payouts ORDER BY created_at DESC LIMIT 5')) as any[];
  } catch (err) {
    console.warn('[StoreSentinel] Failed to fetch till payouts:', err);
  }

  // 7. Fetch Critical Low Stock Items
  let lowStockProducts: any[] = [];
  try {
    lowStockProducts = (await db.select(`
      SELECT id, name, stock_quantity, min_stock_alert, price_mt 
      FROM products 
      WHERE stock_quantity <= min_stock_alert AND (is_deleted = 0 OR is_deleted IS NULL)
      ORDER BY stock_quantity ASC 
      LIMIT 10
    `)) as any[];
  } catch (err) {
    console.warn('[StoreSentinel] Failed to fetch low stock products:', err);
  }

  // 8. Fetch Top Customers by Outstanding Debt
  let topCustomers: any[] = [];
  try {
    const debtRows = (await db.select(`
      SELECT customer_name, SUM(amount_mt) as total_debt, phone_number
      FROM debts
      GROUP BY customer_name
      ORDER BY total_debt DESC
      LIMIT 10
    `)) as any[];
    topCustomers = debtRows.map(r => ({
      customer_name: r.customer_name,
      total_debt: Number(r.total_debt) || 0,
      phone_number: r.phone_number
    }));
  } catch (err) {
    console.warn('[StoreSentinel] Failed to fetch debts/customers:', err);
  }

  // 9. Fetch Top Sold Products
  let topSoldProducts: any[] = [];
  try {
    const soldRows = (await db.select(`
      SELECT p.name, SUM(s.quantity) as qty_sold, SUM(s.total_mt) as revenue
      FROM sales s
      LEFT JOIN products p ON s.product_id = p.id
      GROUP BY s.product_id
      ORDER BY qty_sold DESC
      LIMIT 10
    `)) as any[];
    topSoldProducts = soldRows.map(r => ({
      name: r.name || 'Produto',
      qty_sold: Number(r.qty_sold) || 0,
      revenue: Number(r.revenue) || 0
    }));
  } catch (err) {
    console.warn('[StoreSentinel] Failed to fetch top sold products:', err);
  }

  // 10. Fetch All Active Products for Live Catalog Context
  let allProducts: any[] = [];
  try {
    const prodRows = (await db.select(`
      SELECT id, name, category, price_mt, stock_quantity, attributes, barcode
      FROM products
      WHERE (is_deleted = 0 OR is_deleted IS NULL)
      ORDER BY updated_at DESC, name ASC
      LIMIT 30
    `)) as any[];
    allProducts = (prodRows || []).map(r => {
      let unitType = 'unit';
      if (r.attributes) {
        try {
          const parsed = typeof r.attributes === 'string' ? JSON.parse(r.attributes) : r.attributes;
          if (parsed?.unit_type) unitType = parsed.unit_type;
        } catch {}
      }
      return {
        id: r.id,
        name: r.name,
        category: r.category || 'Geral',
        price_mt: Number(r.price_mt) || 0,
        stock_quantity: Number(r.stock_quantity) || 0,
        unit_type: unitType,
        barcode: r.barcode || ''
      };
    });
  } catch (err) {
    console.warn('[StoreSentinel] Failed to fetch all products for telemetry:', err);
  }

  // 11. Fetch Recent AI Command Logs
  let recentAiCommands: any[] = [];
  try {
    const aiRows = (await db.select('SELECT * FROM ai_command_logs ORDER BY created_at DESC LIMIT 25')) as any[];
    recentAiCommands = (aiRows || []).map((r: any) => {
      let args = r.tool_arguments;
      let res = r.tool_result;
      try { args = typeof r.tool_arguments === 'string' ? JSON.parse(r.tool_arguments) : r.tool_arguments; } catch {}
      try { res = typeof r.tool_result === 'string' ? JSON.parse(r.tool_result) : r.tool_result; } catch {}
      return {
        id: r.id,
        user_name: r.user_name || (r.device_origin === 'companion_app' ? 'App Móvel' : 'Operador'),
        device_origin: r.device_origin || 'desktop_pos',
        input_type: r.input_type || 'text',
        raw_input: r.raw_input || '',
        transcription: r.transcription || null,
        detected_intent: r.detected_intent || null,
        tool_called: r.tool_called || null,
        tool_arguments: args,
        tool_result: res,
        execution_status: r.execution_status || 'success',
        created_at: r.created_at || new Date().toISOString()
      };
    });
  } catch (err) {
    console.warn('[StoreSentinel] Failed to fetch ai_command_logs:', err);
  }

  // 12. Fetch Pending Expected Deliveries
  let pendingDeliveries: any[] = [];
  try {
    const delivs = (await db.select(`
      SELECT d.id, d.po_number, d.invoice_number, d.supplier_name, d.expected_date, d.status,
             COUNT(i.id) as items_count,
             COALESCE(SUM(i.expected_quantity), 0) as total_expected_quantity
      FROM expected_deliveries d
      LEFT JOIN expected_delivery_items i ON d.id = i.delivery_id
      WHERE d.status = 'pending' OR d.status IS NULL
      GROUP BY d.id
      ORDER BY d.created_at DESC
      LIMIT 10
    `)) as any[];
    pendingDeliveries = (delivs || []).map((d: any) => ({
      id: d.id,
      po_number: Number(d.po_number) || 1001,
      supplier_name: d.supplier_name || 'Fornecedor',
      expected_date: d.expected_date,
      status: d.status || 'pending',
      total_items: Number(d.items_count) || 0,
      total_quantity: Number(d.total_expected_quantity) || 0
    }));
  } catch (err) {
    console.warn('[StoreSentinel] Failed to fetch expected deliveries:', err);
  }

  // 13. Fetch Total Unique Customers Count
  let totalCustomersCount = 0;
  try {
    const custRes = (await db.select(`
      SELECT COUNT(DISTINCT name) as count FROM users WHERE role = 'customer' AND (is_deleted = 0 OR is_deleted IS NULL)
    `)) as any[];
    const countUsers = Number(custRes?.[0]?.count) || 0;
    const debtCustRes = (await db.select(`
      SELECT COUNT(DISTINCT customer_name) as count FROM debts
    `)) as any[];
    const countDebts = Number(debtCustRes?.[0]?.count) || 0;
    totalCustomersCount = Math.max(countUsers, countDebts);
  } catch (err) {
    console.warn('[StoreSentinel] Failed to fetch customer count:', err);
  }

  return {
    shopName,
    users,
    recentAudits,
    recentAiCommands,
    scanStatsByUser,
    recentShifts,
    recentPayouts: recentPayouts.map(p => ({
      ...p,
      amount: Number(p.amount ?? p.amount_mt) || 0
    })),
    lowStockProducts,
    topCustomers,
    topSoldProducts,
    allProducts,
    pendingDeliveries,
    totalCustomersCount,
    todaySalesTotal,
    todaySalesCount,
    paymentMethodsBreakdown,
  };
}
