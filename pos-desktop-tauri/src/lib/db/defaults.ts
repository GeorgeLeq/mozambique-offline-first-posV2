/**
 * @file defaults.ts
 * @description Default fallback values for POS settings.
 */

export interface SettingItem {
  key: string;
  value: string;
}

export const defaultSettings: SettingItem[] = [
  { key: 'base_cash', value: '10000' },
  { key: 'low_stock_threshold', value: '5' },
  { key: 'currency_symbol', value: 'MT' },
  { key: 'currency_decimals', value: '2' },
  { key: 'currency_decimal_separator', value: ',' },
  { key: 'locale_lang', value: 'pt' },
  { key: 'receipt_header_title', value: '' },
  { key: 'receipt_header_address', value: '' },
  { key: 'receipt_header_phone', value: '' },
  { key: 'receipt_header_nuit', value: '' },
  { key: 'receipt_footer_msg', value: 'Obrigado pela sua preferência!' },
  { key: 'receipt_show_barcode', value: 'true' },
  { key: 'barcode_print_format', value: 'CODE128' },
  { key: 'barcode_print_show_price', value: 'true' },
  { key: 'barcode_print_show_name', value: 'true' },
  { key: 'barcode_print_columns', value: '4' },
  { key: 'barcode_print_font_size', value: '12' },
  { key: 'allow_negative_stock', value: '0' },
  { key: 'blind_stock_mode', value: 'false' },
  { key: 'discount_presets', value: '5%,10%,15%,-50,-100' },
  { key: 'max_discount_cap', value: '20' },
  { key: 'printer_auto_print', value: 'true' },
  { key: 'printer_paper_width', value: '80mm' },
  { key: 'printer_connection', value: 'system' },
  { key: 'printer_network_ip', value: '' },
  { key: 'printer_copies', value: '1' },
  { key: 'authorization_mode', value: 'remote_with_code' },
  { key: 'refund_time_limit', value: '-1' },
  { key: 'refund_auth_level', value: 'manager' },
  { key: 'refund_method', value: 'any' },
  { key: 'remote_auth_enabled', value: 'true' },
  { key: 'auth_trigger_void', value: 'true' },
  { key: 'auth_trigger_discount', value: 'true' },
  { key: 'auth_trigger_open_drawer', value: 'true' },
  { key: 'auth_trigger_refund', value: 'true' },
  { key: 'remote_auth_timeout', value: '60' },
  { key: 'notif_retention_days', value: '30' },
  { key: 'max_products', value: '500' },
  { key: 'max_deliveries', value: '500' },
  { key: 'max_fiado_customers', value: '500' }
];

export const keysToRemoveOnWipe: string[] = [
  'shop_id',
  'device_id',
  'current_shift_start',
  'base_cash',
  'low_stock_threshold',
  'currency_symbol',
  'currency_decimals',
  'currency_decimal_separator',
  'locale_lang',
  'receipt_header_title',
  'receipt_header_address',
  'receipt_header_phone',
  'receipt_header_nuit',
  'receipt_footer_msg',
  'receipt_show_barcode',
  'barcode_print_format',
  'barcode_print_show_price',
  'barcode_print_show_name',
  'barcode_print_columns',
  'barcode_print_font_size',
  'allow_negative_stock',
  'discount_presets',
  'max_discount_cap',
  'remote_auth_enabled',
  'auth_trigger_void',
  'auth_trigger_discount',
  'auth_trigger_open_drawer',
  'auth_trigger_refund',
  'remote_auth_timeout'
];
