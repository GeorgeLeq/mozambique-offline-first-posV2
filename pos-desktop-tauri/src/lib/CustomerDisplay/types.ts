/**
 * @file types.ts
 * @description Types for Dual Display & Detachable Customer-Facing Screen (Tauri v2 / Browser).
 */

export interface CustomerCartItem {
  id: string;
  name: string;
  barcode?: string;
  price_mt: number;
  original_price_mt?: number;
  quantity: number;
  discount_value?: number;
  subtotal_mt: number;
  attributes?: string;
}

export interface CustomerDisplayPromotion {
  id: string;
  title: string;
  subtitle: string;
  price_mt: number;
  original_price_mt?: number;
  badge: string;
  imageUrl?: string;
  category: string;
}

export interface CustomerDisplayState {
  cart: CustomerCartItem[];
  subtotal_mt: number;
  tax_mt: number;
  discount_mt: number;
  total_mt: number;
  cashier_name: string;
  shop_name: string;
  shop_phone: string;
  currency: string;
  is_checking_out: boolean;
  payment_method?: string | null; // 'cash' | 'mpesa' | 'emola' | 'card' | 'fiado' | 'mixed'
  amount_paid_mt?: number;
  change_due_mt?: number;
  status: 'idle' | 'active_cart' | 'payment_processing' | 'sale_completed';
  last_scanned_id?: string | null;
  updated_at: number;
}

export interface CustomerSparkMessage {
  id: string;
  sender: 'customer' | 'assistant' | 'system';
  text: string;
  timestamp: number;
  suggested_chips?: string[];
  matched_products?: {
    id: string;
    name: string;
    price_mt: number;
    stock_quantity: number;
    is_in_stock: boolean;
  }[];
  isOffline?: boolean;
  modelUsed?: string;
}
