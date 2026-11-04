/**
 * @file jitToolExecutor.ts
 * @description Raw SQLite JIT query execution for Lane 3 POS Operations.
 * Runs fast local queries directly against the SQLite database with zero tool bloat.
 * Grounded in local shop tables: products, debts, expected_deliveries, users, shift_reports, scan_history.
 */

import { getDB } from '../../../db';
import { PosJitToolSelection } from './jitToolSelector';

/**
 * Builds aggregated debtor summary from debt records.
 */
export function buildCustomerSummary(rows: Array<Record<string, any>> = []) {
  const entries = Array.isArray(rows) ? rows.filter(Boolean) : [];
  const byCustomer = new Map<string, number>();
  const debtEntries: Array<{ customer_name: string; total_debt: number }> = [];

  for (const row of entries) {
    const customerName = String(row.customer_name ?? row.name ?? '').trim();
    if (!customerName) continue;

    const amount = Number(row.amount_mt ?? row.total_debt ?? row.total ?? 0) || 0;
    const running = byCustomer.get(customerName) || 0;
    byCustomer.set(customerName, running + amount);
    debtEntries.push({ customer_name: customerName, total_debt: amount });
  }

  const topDebtors = Array.from(byCustomer.entries())
    .map(([customer_name, total_debt]) => ({ customer_name, total_debt }))
    .sort((a, b) => b.total_debt - a.total_debt)
    .slice(0, 5)
    .map(d => `${d.customer_name}: ${Number(d.total_debt) || 0} MT`);

  return {
    totalCustomers: byCustomer.size,
    debtorCount: debtEntries.length,
    topDebtors
  };
}

/**
 * Builds expected deliveries summary from delivery rows.
 */
export function buildDeliverySummary(rows: Array<Record<string, any>> = []) {
  const deliveries = Array.isArray(rows) ? rows.filter(Boolean) : [];

  const normalizedDeliveries = deliveries.map(row => {
    const supplierName = String(row.supplier_name ?? row.name ?? 'Fornecedor').trim() || 'Fornecedor';
    const quantity = Number(row.total_expected_quantity ?? row.expected_quantity ?? row.quantity ?? 0) || 0;
    const expectedDate = row.expected_date || row.date || 'Em breve';

    return {
      supplier_name: supplierName,
      expected_date: expectedDate,
      total_expected_quantity: quantity,
    };
  });

  const totalExpectedUnits = normalizedDeliveries.reduce((sum, item) => sum + (Number(item.total_expected_quantity) || 0), 0);

  return {
    pendingDeliveriesCount: normalizedDeliveries.length,
    totalExpectedUnits,
    deliveries: normalizedDeliveries.slice(0, 5).map(item => `${item.supplier_name} (${item.expected_date || 'Em breve'}${item.total_expected_quantity ? `, ${item.total_expected_quantity} un` : ''})`)
  };
}

/**
 * Executes the selected JIT tool directly on local SQLite.
 */
export async function executeJitTool(tool: PosJitToolSelection, operatorName: string): Promise<Record<string, any>> {
  const db = await getDB();

  switch (tool.name) {
    case 'fetch_inventory': {
      const isLowStock = tool.params.filter === 'low_stock';
      let rawProds: any[] = [];
      try {
        rawProds = (await db.select('SELECT id, name, price_mt, stock_quantity, is_deleted FROM products')) as any[];
      } catch (_) {}

      const activeProds = Array.isArray(rawProds)
        ? rawProds.filter(p => p && (p.is_deleted === 0 || p.is_deleted === '0' || !p.is_deleted || p.is_deleted === null))
        : [];

      const totalProducts = activeProds.length;
      const totalUnits = activeProds.reduce((sum, p) => sum + (Number(p.stock_quantity) || 0), 0);

      const sorted = [...activeProds].sort((a, b) => (Number(b.stock_quantity) || 0) - (Number(a.stock_quantity) || 0));
      const sampleList = isLowStock
        ? sorted.filter(p => (Number(p.stock_quantity) || 0) <= 10).slice(0, 5)
        : sorted.slice(0, 5);

      const sampleItems = sampleList.map(i => `${i.name || 'Produto'}: ${i.stock_quantity ?? 0} un (${Number(i.price_mt) || 0} MT)`);

      return {
        metric: isLowStock ? 'low_stock_inventory' : 'current_inventory',
        totalProducts,
        totalUnits,
        sampleItems
      };
    }

    case 'fetch_customers': {
      let rawDebts: any[] = [];
      try {
        rawDebts = (await db.select(
          `SELECT customer_name, SUM(amount_mt) as total_debt, MAX(phone_number) as phone_number, MAX(address) as address
           FROM debts
           WHERE status IN ('unpaid', 'partial', 'pending') OR status IS NULL
           GROUP BY customer_name
           ORDER BY total_debt DESC LIMIT 20`
        )) as any[];
      } catch (_) {}

      const activeDebts = Array.isArray(rawDebts) ? rawDebts.filter(d => d && d.customer_name) : [];
      const summary = buildCustomerSummary(activeDebts);

      return {
        metric: 'customer_metrics',
        totalCustomers: summary.totalCustomers,
        debtorCount: summary.debtorCount,
        topDebtors: summary.topDebtors
      };
    }

    case 'fetch_shifts': {
      let shiftRows: any[] = [];
      try {
        shiftRows = (await db.select("SELECT * FROM shift_reports WHERE status = 'open'")) as any[];
      } catch (_) {}

      let userRows: any[] = [];
      try {
        userRows = (await db.select("SELECT id, name, role, terminal_name FROM users WHERE (is_deleted = 0 OR is_deleted IS NULL)")) as any[];
      } catch (_) {}

      const activeShift = Array.isArray(shiftRows) ? shiftRows[0] : null;
      const activeCashierName = activeShift?.user_name || activeShift?.cashier_name || null;
      const registeredOperatorsList = Array.isArray(userRows) && userRows.length > 0
        ? userRows.map(u => `${u.name} (${u.role || 'operator'})`)
        : [operatorName];

      return {
        metric: 'shift_and_login_status',
        currentUserLoggedIn: operatorName,
        hasActiveShift: Boolean(activeShift),
        activeCashierName,
        openedAt: activeShift?.opened_at || null,
        currentCashMt: activeShift?.current_cash || activeShift?.opening_cash || 0,
        registeredOperators: registeredOperatorsList
      };
    }

    case 'fetch_shift_reports': {
      let shifts: any[] = [];
      try {
        shifts = (await db.select(`
          SELECT id, user_id, user_name, opening_cash, closing_cash, expected_cash,
                 discrepancy, total_sales, total_cash_sales, status, opened_at, closed_at, details_json
          FROM shift_reports
          ORDER BY opened_at DESC
          LIMIT 10
        `)) as any[];
      } catch (_) {}

      const shiftList = Array.isArray(shifts) ? shifts : [];

      // Identify discrepancies / shortages (e.g. João Cossa -3,200 MT theft/quebra de caixa)
      const discrepancies = shiftList
        .filter(s => Number(s.discrepancy || 0) !== 0)
        .map(s => {
          let parsedDetails: any = {};
          try {
            if (s.details_json) parsedDetails = JSON.parse(s.details_json);
          } catch (_) {}
          return {
            id: s.id,
            cashier: s.user_name || 'Desconhecido',
            discrepancy_mt: Number(s.discrepancy),
            expected_cash_mt: Number(s.expected_cash || 0),
            closing_cash_mt: Number(s.closing_cash || 0),
            status: s.status,
            date: s.closed_at || s.opened_at,
            audit_flag: parsedDetails.audit_flag || (Number(s.discrepancy) < 0 ? 'Falta / Quebra de caixa não justificada' : 'Excedente de caixa')
          };
        });

      const openShifts = shiftList.filter(s => s.status === 'open').map(s => ({
        id: s.id,
        cashier: s.user_name || 'Operador',
        opening_cash_mt: Number(s.opening_cash || 0),
        total_sales_mt: Number(s.total_sales || 0),
        opened_at: s.opened_at
      }));

      const closedShifts = shiftList.filter(s => s.status === 'closed').map(s => ({
        id: s.id,
        cashier: s.user_name || 'Operador',
        closing_cash_mt: Number(s.closing_cash || 0),
        expected_cash_mt: Number(s.expected_cash || 0),
        discrepancy_mt: Number(s.discrepancy || 0),
        total_sales_mt: Number(s.total_sales || 0),
        closed_at: s.closed_at
      }));

      return {
        metric: 'shift_reports_audit',
        totalReports: shiftList.length,
        openShifts,
        closedShifts,
        discrepancies,
        hasShortageOrTheft: discrepancies.some(d => d.discrepancy_mt < 0)
      };
    }

    case 'fetch_scan_history': {
      let scans: any[] = [];
      try {
        scans = (await db.select(`
          SELECT s.id, s.barcode, s.product_name, s.user_id, s.shift_id,
                 s.quantity, s.unit_price, s.total_mt, s.terminal_name, s.created_at,
                 u.name as cashier_name
          FROM scan_history s
          LEFT JOIN users u ON u.id = s.user_id
          ORDER BY s.created_at DESC
          LIMIT 15
        `)) as any[];
      } catch (_) {}

      const scanList = Array.isArray(scans) ? scans : [];

      const formattedScans = scanList.map(s => ({
        id: s.id,
        barcode: s.barcode,
        product_name: s.product_name,
        cashier: s.cashier_name || s.user_id,
        quantity: Number(s.quantity || 1),
        unit_price_mt: Number(s.unit_price || 0),
        total_mt: Number(s.total_mt || 0),
        terminal: s.terminal_name || 'Caixa',
        time: s.created_at
      }));

      return {
        metric: 'scan_history_audit',
        totalScans: scanList.length,
        scans: formattedScans
      };
    }

    case 'fetch_deliveries': {
      let rows: any[] = [];
      try {
        rows = (await db.select(`
          SELECT d.id, d.supplier_name, d.expected_date,
                 COALESCE(SUM(i.expected_quantity), 0) as total_expected_quantity
          FROM expected_deliveries d
          LEFT JOIN expected_delivery_items i ON i.delivery_id = d.id
          WHERE d.status = 'pending' OR d.status IS NULL
          GROUP BY d.id, d.supplier_name, d.expected_date
          ORDER BY d.expected_date ASC, d.created_at DESC
        `)) as any[];
      } catch (_) {}

      const summary = buildDeliverySummary(rows);

      return {
        metric: 'expected_deliveries',
        pendingDeliveriesCount: summary.pendingDeliveriesCount,
        totalExpectedUnits: summary.totalExpectedUnits,
        deliveries: summary.deliveries
      };
    }

    case 'fetch_store_overview': {
      let inventoryRows: any[] = [];
      try {
        inventoryRows = (await db.select('SELECT stock_quantity, is_deleted FROM products WHERE (is_deleted = 0 OR is_deleted IS NULL)')) as any[];
      } catch (_) {}

      const activeProds = Array.isArray(inventoryRows) ? inventoryRows.filter(p => p) : [];

      let customerRows: any[] = [];
      try {
        customerRows = (await db.select('SELECT DISTINCT customer_name FROM debts WHERE customer_name IS NOT NULL AND customer_name <> ""')) as any[];
      } catch (_) {}

      let deliveryRows: any[] = [];
      try {
        deliveryRows = (await db.select(`
          SELECT d.id, COALESCE(SUM(i.expected_quantity), 0) as total_expected_quantity
          FROM expected_deliveries d
          LEFT JOIN expected_delivery_items i ON i.delivery_id = d.id
          WHERE d.status = 'pending' OR d.status IS NULL
          GROUP BY d.id
        `)) as any[];
      } catch (_) {}

      const totalCustomers = Array.isArray(customerRows) ? customerRows.length : 0;
      const pendingDeliveries = Array.isArray(deliveryRows) ? deliveryRows.length : 0;
      const totalExpectedUnits = (Array.isArray(deliveryRows) ? deliveryRows : []).reduce((sum, row) => sum + (Number(row.total_expected_quantity) || 0), 0);

      return {
        metric: 'store_overview',
        totalProducts: activeProds.length,
        totalUnits: activeProds.reduce((sum, p) => sum + (Number(p.stock_quantity) || 0), 0),
        totalCustomers,
        currentUserLoggedIn: operatorName,
        activeCashier: operatorName,
        pendingDeliveries,
        totalExpectedUnits
      };
    }
  }
}
