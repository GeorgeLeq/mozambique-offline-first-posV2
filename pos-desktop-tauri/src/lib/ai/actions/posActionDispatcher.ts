/**
 * @file posActionDispatcher.ts
 * @description Single unified database action bridge for SYCOMM POS.
 * Directly executes POS mutations and queries on local SQLite (getDB())
 * with zero redundant wrappers, audit logging, and offline-first safety.
 */

import { getDB } from '../../db';
import { logAudit } from '../../audit';

export interface ActionResponse<T = any> {
  success: boolean;
  action: string;
  data?: T;
  error?: string;
  message?: string;
}

export interface ProductInput {
  id?: string;
  productId?: string;
  name: string;
  productName?: string;
  barcode?: string;
  price?: number;
  price_mt?: number;
  cost_price?: number;
  cost_price_mt?: number;
  stock_quantity?: number;
  quantity?: number;
  stock?: number;
  category?: string;
  unit_type?: string;
  unitType?: string;
  unit_volume?: number;
  min_stock_alert?: number;
  image_url?: string;
}

export interface CustomerInput {
  id?: string;
  customerId?: string;
  name: string;
  customer_name?: string;
  customerName?: string;
  phone?: string;
  phone_number?: string;
  address?: string;
  credit_limit?: number;
  initial_debt?: number;
  initial_debt_mt?: number;
  notes?: string;
}

export interface OperatorInput {
  id?: string;
  userId?: string;
  name: string;
  userName?: string;
  role?: string;
  pin?: string;
  active?: boolean;
  terminal_name?: string;
  is_blocked?: boolean;
}

export interface ShiftSummaryData {
  hasActiveShift: boolean;
  shiftId?: string;
  openedAt?: string;
  cashierName?: string;
  openingFloat?: number;
  currentCash?: number;
  totalTransactions?: number;
}

export class PosActionDispatcher {
  private static instance: PosActionDispatcher;

  private constructor() {}

  public static getInstance(): PosActionDispatcher {
    if (!PosActionDispatcher.instance) {
      PosActionDispatcher.instance = new PosActionDispatcher();
    }
    return PosActionDispatcher.instance;
  }

  // =========================================================================
  // PRODUCT OPERATIONS
  // =========================================================================

  public async createProduct(input: ProductInput, userId: string = 'system_ai'): Promise<ActionResponse> {
    try {
      const db = await getDB();
      const name = input.name.trim();
      if (!name) {
        return { success: false, action: 'createProduct', error: 'Product name is required' };
      }

      const id = input.id || crypto.randomUUID();
      const barcode = input.barcode ? input.barcode.trim() : null;
      const price = Math.max(0, Number(input.price) || 0);
      const costPrice = Math.max(0, Number(input.cost_price) || 0);
      const stock = Math.max(0, Number(input.stock_quantity) || 0);
      const category = input.category ? input.category.trim() : 'Geral';
      const now = new Date().toISOString();

      // Check duplicate barcode if provided
      if (barcode) {
        const existing = (await db.select('SELECT id, name FROM products WHERE barcode = ? LIMIT 1', [barcode])) as any[];
        if (existing.length > 0) {
          return { success: false, action: 'createProduct', error: `Barcode already belongs to "${existing[0].name}"` };
        }
      }

      await db.execute(
        `INSERT INTO products (id, name, barcode, price_mt, cost_price_mt, stock_quantity, category, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, barcode, price, costPrice, stock, category, now, now]
      );

      try {
        await logAudit(userId, 'CREATE_PRODUCT', `AI created product "${name}" at ${price} MT (${stock} units)`);
      } catch (_) {}

      return {
        success: true,
        action: 'createProduct',
        data: { id, name, barcode, price, costPrice, stock_quantity: stock, category },
        message: `Product "${name}" successfully registered at ${price} MT.`
      };
    } catch (err: any) {
      return { success: false, action: 'createProduct', error: err.message || 'Database insert failed' };
    }
  }

  public async updateProduct(input: Partial<ProductInput> & { id?: string; productId?: string; name?: string; productName?: string }, userId: string = 'system_ai'): Promise<ActionResponse> {
    try {
      const db = await getDB();
      let targetId = input.productId || input.id;
      const searchName = input.productName || input.name;

      if (!targetId && searchName) {
        const rows = (await db.select('SELECT id FROM products WHERE name LIKE ? LIMIT 1', [`%${searchName.trim()}%`])) as any[];
        if (rows.length > 0) targetId = rows[0].id;
      }

      if (!targetId) {
        return { success: false, action: 'updateProduct', error: 'Target product not found for update' };
      }

      const updates: string[] = [];
      const values: any[] = [];

      if (input.name) {
        updates.push('name = ?');
        values.push(input.name.trim());
      }
      const priceVal = input.price !== undefined ? input.price : input.price_mt;
      if (priceVal !== undefined) {
        updates.push('price_mt = ?');
        values.push(Math.max(0, Number(priceVal)));
      }
      const costVal = input.cost_price !== undefined ? input.cost_price : input.cost_price_mt;
      if (costVal !== undefined) {
        updates.push('cost_price_mt = ?');
        values.push(Math.max(0, Number(costVal)));
      }
      const stockVal = input.stock_quantity !== undefined ? input.stock_quantity : (input.quantity ?? input.stock);
      if (stockVal !== undefined) {
        updates.push('stock_quantity = ?');
        values.push(Math.max(0, Number(stockVal)));
      }
      if (input.category) {
        updates.push('category = ?');
        values.push(input.category.trim());
      }

      if (updates.length === 0) {
        return { success: false, action: 'updateProduct', error: 'No fields provided to update' };
      }

      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(targetId);

      await db.execute(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, values);

      try {
        await logAudit(userId, 'UPDATE_PRODUCT', `AI updated product ${targetId}`);
      } catch (_) {}

      return { success: true, action: 'updateProduct', message: 'Product updated successfully' };
    } catch (err: any) {
      return { success: false, action: 'updateProduct', error: err.message };
    }
  }

  public async deleteProduct(idOrInput: string | { productId?: string; id?: string; productName?: string; name?: string; reason?: string }, userId: string = 'system_ai'): Promise<ActionResponse> {
    try {
      const db = await getDB();
      const rawTarget = typeof idOrInput === 'string' ? idOrInput : (idOrInput.productId || idOrInput.id || idOrInput.productName || idOrInput.name || '');

      const rows = (await db.select('SELECT id, name FROM products WHERE id = ? OR name LIKE ? LIMIT 1', [rawTarget, `%${rawTarget}%`])) as any[];
      if (rows.length === 0) {
        return { success: false, action: 'deleteProduct', error: `Product "${rawTarget}" not found` };
      }
      const targetId = rows[0].id;
      const targetName = rows[0].name;

      await db.execute('DELETE FROM products WHERE id = ?', [targetId]);

      try {
        await logAudit(userId, 'DELETE_PRODUCT', `AI deleted product "${targetName}" (${targetId})`);
      } catch (_) {}

      return { success: true, action: 'deleteProduct', message: `Product "${targetName}" removed from catalog` };
    } catch (err: any) {
      return { success: false, action: 'deleteProduct', error: err.message };
    }
  }

  // =========================================================================
  // CUSTOMER OPERATIONS
  // =========================================================================

  public async createCustomer(input: CustomerInput, userId: string = 'system_ai'): Promise<ActionResponse> {
    try {
      const db = await getDB();
      const name = input.name.trim();
      if (!name) {
        return { success: false, action: 'createCustomer', error: 'Customer name is required' };
      }

      const id = input.id || crypto.randomUUID();
      const phone = input.phone ? input.phone.trim() : null;
      const address = input.address ? input.address.trim() : null;
      const creditLimit = Math.max(0, Number(input.credit_limit) || 0);
      const notes = input.notes ? input.notes.trim() : null;
      const now = new Date().toISOString();

      await db.execute(
        `INSERT INTO customers (id, name, phone, address, credit_limit, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, phone, address, creditLimit, notes, now, now]
      );

      try {
        await logAudit(userId, 'CREATE_CUSTOMER', `AI registered customer "${name}" (Phone: ${phone || 'N/A'})`);
      } catch (_) {}

      return {
        success: true,
        action: 'createCustomer',
        data: { id, name, phone, address, credit_limit: creditLimit },
        message: `Customer "${name}" registered successfully.`
      };
    } catch (err: any) {
      return { success: false, action: 'createCustomer', error: err.message };
    }
  }

  public async updateCustomer(input: Partial<CustomerInput> & { id?: string; customerId?: string }, userId: string = 'system_ai'): Promise<ActionResponse> {
    try {
      const db = await getDB();
      const targetId = input.customerId || input.id;
      if (!targetId) {
        return { success: false, action: 'updateCustomer', error: 'Customer ID is required' };
      }

      const updates: string[] = [];
      const values: any[] = [];

      if (input.name) {
        updates.push('name = ?');
        values.push(input.name.trim());
      }
      const phoneVal = input.phone ?? input.phone_number;
      if (phoneVal !== undefined) {
        updates.push('phone = ?');
        values.push(phoneVal?.trim() || null);
      }
      if (input.credit_limit !== undefined) {
        updates.push('credit_limit = ?');
        values.push(Math.max(0, Number(input.credit_limit)));
      }
      if (input.notes !== undefined) {
        updates.push('notes = ?');
        values.push(input.notes?.trim() || null);
      }

      if (updates.length === 0) {
        return { success: false, action: 'updateCustomer', error: 'No fields to update' };
      }

      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(targetId);

      await db.execute(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`, values);

      return { success: true, action: 'updateCustomer', message: 'Customer updated successfully' };
    } catch (err: any) {
      return { success: false, action: 'updateCustomer', error: err.message };
    }
  }

  public async deleteCustomer(idOrInput: string | { customerId?: string; id?: string; customerName?: string; name?: string }, userId: string = 'system_ai'): Promise<ActionResponse> {
    try {
      const db = await getDB();
      const targetId = typeof idOrInput === 'string' ? idOrInput : (idOrInput.customerId || idOrInput.id);
      if (!targetId) {
        return { success: false, action: 'deleteCustomer', error: 'Customer ID is required' };
      }
      await db.execute('DELETE FROM customers WHERE id = ?', [targetId]);
      return { success: true, action: 'deleteCustomer', message: 'Customer deleted successfully' };
    } catch (err: any) {
      return { success: false, action: 'deleteCustomer', error: err.message };
    }
  }

  public async updateStockQuantity(input: { productId?: string; id?: string; quantityDelta?: number; delta?: number; quantity?: number; reason?: string }, userId: string = 'system_ai'): Promise<ActionResponse> {
    try {
      const db = await getDB();
      const targetId = input.productId || input.id;
      if (!targetId) {
        return { success: false, action: 'updateStockQuantity', error: 'Product ID is required' };
      }
      const delta = Number(input.quantityDelta ?? input.delta ?? input.quantity) || 0;
      await db.execute('UPDATE products SET stock_quantity = MAX(0, stock_quantity + ?) WHERE id = ?', [delta, targetId]);
      return { success: true, action: 'updateStockQuantity', message: `Stock updated by ${delta}` };
    } catch (err: any) {
      return { success: false, action: 'updateStockQuantity', error: err.message };
    }
  }

  public async getCustomerDebt(customerNameOrPhone: string): Promise<ActionResponse> {
    try {
      const db = await getDB();
      const rows = (await db.select(
        `SELECT c.id, c.name, COALESCE(SUM(d.amount - d.paid_amount), 0) as total_debt
         FROM customers c
         LEFT JOIN customer_debts d ON c.id = d.customer_id
         WHERE c.name LIKE ? OR c.phone = ?
         GROUP BY c.id LIMIT 1`,
        [`%${customerNameOrPhone}%`, customerNameOrPhone]
      )) as any[];
      return { success: true, action: 'getCustomerDebt', data: rows[0] || null };
    } catch (err: any) {
      return { success: false, action: 'getCustomerDebt', error: err.message };
    }
  }

  public async recordCustomerDebt(input: { customerId?: string; customerName?: string; amount: number; reason?: string }, userId: string = 'system_ai'): Promise<ActionResponse> {
    try {
      const db = await getDB();
      let customerId = input.customerId;
      if (!customerId && input.customerName) {
        const rows = (await db.select('SELECT id FROM customers WHERE name LIKE ? LIMIT 1', [`%${input.customerName}%`])) as any[];
        if (rows.length > 0) customerId = rows[0].id;
      }
      if (!customerId) {
        return { success: false, action: 'recordCustomerDebt', error: 'Customer not found' };
      }
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await db.execute(
        `INSERT INTO customer_debts (id, customer_id, amount, paid_amount, status, description, created_at, updated_at)
         VALUES (?, ?, ?, 0, 'unpaid', ?, ?, ?)`,
        [id, customerId, input.amount, input.reason || 'Fiado registrado por IA', now, now]
      );
      return { success: true, action: 'recordCustomerDebt', message: `Debt of ${input.amount} MT recorded.` };
    } catch (err: any) {
      return { success: false, action: 'recordCustomerDebt', error: err.message };
    }
  }

  // =========================================================================
  // OPERATOR / USER OPERATIONS
  // =========================================================================

  public async createOperator(input: OperatorInput, userId: string = 'system_ai'): Promise<ActionResponse> {
    try {
      const db = await getDB();
      const name = input.name.trim();
      const role = input.role || 'cashier';
      const pin = input.pin ? input.pin.trim() : '1234';
      const id = input.id || crypto.randomUUID();
      const now = new Date().toISOString();

      await db.execute(
        `INSERT INTO users (id, name, role, pin, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`,
        [id, name, role, pin, now, now]
      );

      return {
        success: true,
        action: 'createOperator',
        data: { id, name, role },
        message: `Operator "${name}" (${role}) registered successfully.`
      };
    } catch (err: any) {
      return { success: false, action: 'createOperator', error: err.message };
    }
  }

  public async updateOperator(input: Partial<OperatorInput> & { id?: string; userId?: string }, userId: string = 'system_ai'): Promise<ActionResponse> {
    try {
      const db = await getDB();
      const targetId = input.userId || input.id;
      if (!targetId) {
        return { success: false, action: 'updateOperator', error: 'User ID is required' };
      }

      const updates: string[] = [];
      const values: any[] = [];

      const opName = input.userName || input.name;
      if (opName) {
        updates.push('name = ?');
        values.push(opName.trim());
      }
      if (input.role) {
        updates.push('role = ?');
        values.push(input.role);
      }
      if (input.pin) {
        updates.push('pin = ?');
        values.push(input.pin.trim());
      }
      if (input.active !== undefined) {
        updates.push('active = ?');
        values.push(input.active ? 1 : 0);
      }
      if (input.is_blocked !== undefined) {
        updates.push('active = ?');
        values.push(input.is_blocked ? 0 : 1);
      }

      if (updates.length === 0) {
        return { success: false, action: 'updateOperator', error: 'No fields to update' };
      }

      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(targetId);

      await db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
      return { success: true, action: 'updateOperator', message: 'Operator updated successfully' };
    } catch (err: any) {
      return { success: false, action: 'updateOperator', error: err.message };
    }
  }

  public async deleteOperator(idOrInput: string | { userId?: string; id?: string; userName?: string; name?: string }, userId: string = 'system_ai'): Promise<ActionResponse> {
    try {
      const db = await getDB();
      const targetId = typeof idOrInput === 'string' ? idOrInput : (idOrInput.userId || idOrInput.id);
      if (!targetId) {
        return { success: false, action: 'deleteOperator', error: 'User ID is required' };
      }
      await db.execute('DELETE FROM users WHERE id = ?', [targetId]);
      return { success: true, action: 'deleteOperator', message: 'Operator removed successfully' };
    } catch (err: any) {
      return { success: false, action: 'deleteOperator', error: err.message };
    }
  }

  public async listOperators(): Promise<ActionResponse> {
    try {
      const db = await getDB();
      const rows = (await db.select('SELECT id, name, role, active, created_at FROM users ORDER BY name ASC')) as any[];
      return { success: true, action: 'listOperators', data: rows };
    } catch (err: any) {
      return { success: false, action: 'listOperators', error: err.message };
    }
  }

  // =========================================================================
  // FAST READ QUERIES (DIRECT SQLITE - ZERO WRAPPERS)
  // =========================================================================

  public async getInventoryCount(category?: string): Promise<ActionResponse> {
    try {
      const db = await getDB();
      let query = 'SELECT COUNT(*) as total_products, COALESCE(SUM(stock_quantity), 0) as total_units FROM products';
      const params: any[] = [];
      if (category) {
        query += ' WHERE category = ?';
        params.push(category);
      }
      const rows = (await db.select(query, params)) as any[];
      const topItems = (await db.select(
        'SELECT name, stock_quantity, price_mt AS price FROM products ORDER BY stock_quantity DESC LIMIT 5'
      )) as any[];
      return {
        success: true,
        action: 'getInventoryCount',
        data: {
          totalProducts: rows[0]?.total_products || 0,
          totalUnits: rows[0]?.total_units || 0,
          topItems
        }
      };
    } catch (err: any) {
      return { success: false, action: 'getInventoryCount', error: err.message };
    }
  }

  public async searchProducts(searchTerm: string): Promise<ActionResponse> {
    try {
      const db = await getDB();
      const rows = (await db.select(
        'SELECT id, name, barcode, price_mt AS price, cost_price_mt AS cost_price, stock_quantity, category FROM products WHERE name LIKE ? OR barcode = ? LIMIT 10',
        [`%${searchTerm}%`, searchTerm]
      )) as any[];
      return { success: true, action: 'searchProducts', data: rows };
    } catch (err: any) {
      return { success: false, action: 'searchProducts', error: err.message };
    }
  }

  public async getProductByBarcode(barcode: string): Promise<ActionResponse> {
    try {
      const db = await getDB();
      const rows = (await db.select(
        'SELECT id, name, barcode, price_mt AS price, cost_price_mt AS cost_price, stock_quantity, category FROM products WHERE barcode = ? LIMIT 1',
        [barcode]
      )) as any[];
      if (rows.length === 0) {
        return { success: false, action: 'getProductByBarcode', error: 'Product not found' };
      }
      return { success: true, action: 'getProductByBarcode', data: rows[0] };
    } catch (err: any) {
      return { success: false, action: 'getProductByBarcode', error: err.message };
    }
  }

  public async getShiftSummary(): Promise<ActionResponse<ShiftSummaryData>> {
    try {
      const db = await getDB();
      const rows = (await db.select(
        `SELECT s.id, s.opened_at, s.opening_float, s.current_cash, u.name as cashier_name
         FROM shifts s
         LEFT JOIN users u ON s.user_id = u.id
         WHERE s.status = 'open'
         ORDER BY s.opened_at DESC LIMIT 1`
      )) as any[];

      if (rows.length === 0) {
        return {
          success: true,
          action: 'getShiftSummary',
          data: { hasActiveShift: false }
        };
      }

      const active = rows[0];
      return {
        success: true,
        action: 'getShiftSummary',
        data: {
          hasActiveShift: true,
          shiftId: active.id,
          openedAt: active.opened_at,
          cashierName: active.cashier_name || 'Admin',
          openingFloat: active.opening_float || 0,
          currentCash: active.current_cash || 0
        }
      };
    } catch (err: any) {
      return { success: false, action: 'getShiftSummary', error: err.message };
    }
  }

  public async getExpectedDeliveries(): Promise<ActionResponse> {
    try {
      const db = await getDB();
      const rows = (await db.select(
        `SELECT id, supplier_name, expected_date, status, notes
         FROM expected_deliveries
         WHERE status = 'pending'
         ORDER BY expected_date ASC LIMIT 10`
      )) as any[];
      return { success: true, action: 'getExpectedDeliveries', data: rows };
    } catch (err: any) {
      return { success: true, action: 'getExpectedDeliveries', data: [] };
    }
  }

  // Generic dynamic dispatcher
  public async dispatch(action: string, params: Record<string, any> = {}, userId?: string): Promise<ActionResponse> {
    switch (action) {
      case 'createProduct':
      case 'manage_inventory':
        return this.createProduct(params as ProductInput, userId);
      case 'updateProduct':
        return this.updateProduct(params, userId);
      case 'deleteProduct':
        return this.deleteProduct(params.id || params.name, userId);
      case 'createCustomer':
      case 'register_customer':
        return this.createCustomer(params as CustomerInput, userId);
      case 'updateCustomer':
        return this.updateCustomer(params as any, userId);
      case 'deleteCustomer':
        return this.deleteCustomer(params.id, userId);
      case 'createOperator':
        return this.createOperator(params as OperatorInput, userId);
      case 'updateOperator':
        return this.updateOperator(params as any, userId);
      case 'deleteOperator':
        return this.deleteOperator(params.id, userId);
      case 'listOperators':
        return this.listOperators();
      case 'getInventoryCount':
      case 'fetch_inventory':
      case 'fetchInventory':
        return this.getInventoryCount(params.category);
      case 'searchProducts':
        return this.searchProducts(params.query || params.searchTerm || params.name || '');
      case 'getProductByBarcode':
        return this.getProductByBarcode(params.barcode);
      case 'getShiftSummary':
      case 'fetch_shifts':
      case 'fetchShifts':
        return this.getShiftSummary();
      case 'getExpectedDeliveries':
      case 'fetch_deliveries':
      case 'fetchDeliveries':
        return this.getExpectedDeliveries();
      default:
        return { success: false, action, error: `Action "${action}" is not handled by PosActionDispatcher` };
    }
  }
}

export const posActionDispatcher = PosActionDispatcher.getInstance();
export const chatAgentBridge = posActionDispatcher;
