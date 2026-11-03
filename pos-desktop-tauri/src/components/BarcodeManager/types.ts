export type BarcodeRecord = {
  barcode: string;
  status: 'available' | 'used' | 'expired';
  expires_at: string;
  created_at: string;
  shop_name?: string;
  item_name?: string;
  price_mt?: number;
  attributes?: string;
  linked_product_id?: string;
};
