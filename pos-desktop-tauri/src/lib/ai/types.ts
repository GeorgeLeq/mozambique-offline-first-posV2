/**
 * @file types.ts
 * @description Centralized Type Definitions for Store Sentinel AI & POS Engine.
 * Single source of truth for all action cards, neural responses, and database telemetry.
 */

export interface SentinelAction {
  label: string;
  tab: 'audit' | 'scans' | 'reports' | 'products' | 'caixas' | 'menu' | 'clients' | 'restock';
  badge?: string;
}

export interface SentinelTelemetryHighlight {
  metricLabel: string;
  metricValue: string;
  status: 'good' | 'warning' | 'alert' | 'info';
}

export type ExecutableAiAction = 
  | {
      type: 'create_product';
      data: {
        name: string;
        price_mt: number;
        cost_price_mt?: number;
        stock_quantity?: number;
        category?: string;
        barcode?: string;
        unit_type?: 'unit' | 'box' | 'pack' | 'bulk';
        pack_units?: number;
        is_fractional?: boolean;
        promo_price_mt?: number;
        promo_active?: boolean;
      };
    }
  | {
      type: 'batch_create_products';
      data: {
        products: Array<{
          name: string;
          price_mt: number;
          cost_price_mt?: number;
          stock_quantity?: number;
          category?: string;
          barcode?: string;
          unit_type?: 'unit' | 'box' | 'pack' | 'bulk';
          pack_units?: number;
          is_fractional?: boolean;
        }>;
      };
    }
  | {
      type: 'update_product';
      data: {
        product_id?: string;
        target_name?: string;
        name?: string;
        price_mt?: number;
        cost_price_mt?: number;
        stock_quantity?: number;
        category?: string;
      };
    }
  | {
      type: 'delete_product';
      data: {
        product_id?: string;
        name: string;
        reason?: string;
      };
    }
  | {
      type: 'create_delivery';
      data: {
        supplier_name: string;
        invoice_number?: string;
        expected_date?: string;
        items: Array<{
          product_name: string;
          quantity: number;
          pack_type?: string;
          units_per_pack?: number;
          cost_price_mt?: number;
        }>;
      };
    }
  | {
      type: 'create_customer';
      data: {
        customer_name: string;
        phone_number?: string;
        address?: string;
        initial_debt_mt?: number;
        notes?: string;
      };
    }
  | {
      type: 'update_customer';
      data: {
        customer_id?: string;
        customer_name: string;
        phone_number?: string;
        address?: string;
      };
    }
  | {
      type: 'delete_customer';
      data: {
        customer_id?: string;
        customer_name: string;
      };
    }
  | {
      type: 'create_operator';
      data: {
        name: string;
        pin?: string;
        role?: 'operator' | 'admin' | 'manager';
        terminal_name?: string;
      };
    }
  | {
      type: 'update_operator';
      data: {
        user_id?: string;
        name: string;
        pin?: string;
        role?: string;
        is_blocked?: boolean;
      };
    }
  | {
      type: 'delete_operator';
      data: {
        user_id?: string;
        name: string;
      };
    }
  | {
      type: 'add_to_cart';
      data: {
        items: Array<{
          product_id?: string;
          product_name: string;
          quantity: number;
          unit_price_mt?: number;
          cost_price_mt?: number;
          current_stock?: number;
          unit_type?: string;
        }>;
        customer_name?: string;
        total_sale_mt?: number;
        profit_mt?: number;
      };
    }
  | {
      type: 'calculate_change';
      data: {
        total_due_mt: number;
        amount_tendered_mt: number;
        change_due_mt: number;
        notes_breakdown?: Record<string, number>;
      };
    }
  | {
      type: 'broadcast_promo_banner';
      data: {
        id: string;
        title: string;
        subtitle: string;
        price_mt: number;
        original_price_mt: number;
        badge: string;
        category: string;
        tagline: string;
        imageUrl?: string;
        bgGradient?: string;
      };
    }
  | {
      type: 'web_search';
      query: string;
    };

export interface SentinelResponse {
  answer: string;
  modelUsed: string;
  isOffline: boolean;
  suggestedActions: SentinelAction[];
  executableAction?: ExecutableAiAction;
  executableActions?: ExecutableAiAction[];
  telemetryHighlight?: SentinelTelemetryHighlight;
  toolCalled?: string;
  timestamp: string;
}

export interface StoreTelemetrySnapshot {
  shopName: string;
  users: Array<{ id: string; name: string; role: string; current_shift_start?: string }>;
  recentAudits: Array<{ id: string; user_name: string; action: string; details: string; created_at: string }>;
  recentAiCommands: Array<{
    id: string;
    user_name: string;
    device_origin: string;
    input_type: string;
    raw_input: string;
    transcription: string | null;
    detected_intent: string | null;
    tool_called: string | null;
    tool_arguments: any;
    tool_result: any;
    execution_status: string;
    created_at: string;
  }>;
  scanStatsByUser: Array<{ user_id: string; user_name: string; scan_count: number; total_mt: number }>;
  recentShifts: Array<{ id: string; user_name: string; opening_cash: number; closing_cash: number; discrepancy: number; status: string; closed_at: string }>;
  recentPayouts: Array<{ id: string; amount: number; reason: number | string; note: string; authorized_by: string; created_at: string }>;
  lowStockProducts: Array<{ id: string; name: string; stock_quantity: number; min_stock_alert: number; price_mt: number }>;
  topCustomers: Array<{ customer_name: string; total_debt: number; phone_number?: string }>;
  topSoldProducts: Array<{ name: string; qty_sold: number; revenue: number }>;
  allProducts: Array<{ id: string; name: string; category?: string; price_mt: number; stock_quantity: number; unit_type?: string; barcode?: string }>;
  pendingDeliveries?: Array<{
    id: string;
    po_number: number;
    supplier_name: string;
    expected_date?: string;
    status: string;
    total_items: number;
    total_quantity: number;
  }>;
  totalCustomersCount?: number;
  todaySalesTotal: number;
  todaySalesCount: number;
  paymentMethodsBreakdown: { cash: number; mpesa: number; emola: number; fiado: number };
}

// Unified Bridge Action Response
export interface BridgeResponse<T = any> {
  success: boolean;
  action: string;
  data?: T;
  error?: string;
  message?: string;
  auditLogged?: boolean;
}
