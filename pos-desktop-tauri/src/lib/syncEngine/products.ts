import { getDB } from '../db';
import { supabase } from '../supabase';
import { Product } from '../api';

/**
 * Background task to sync local products up to Supabase.
 */
export async function syncProductsToCloud(): Promise<boolean> {
  try {
    const db = await getDB();

    const settings = await db.select(
      "SELECT value FROM settings WHERE key = 'shop_id'"
    ) as { value: string }[];
    
    if (!settings || settings.length === 0) return false;
    const shopId = settings[0].value;

    const unsyncedProducts = await db.select(
      'SELECT * FROM products WHERE sync_status = 0 LIMIT 50'
    ) as (Product & { sync_status: number })[];

    if (!unsyncedProducts || unsyncedProducts.length === 0) return false;

    console.log(`[Products Sync] Uploading batch of ${unsyncedProducts.length} local products...`);

    // Auto-fix any local products with null or blank barcodes
    for (const product of unsyncedProducts) {
      if (!product.barcode || String(product.barcode).trim() === '') {
        const autoBarcode = `AUTO_${Math.floor(1000000000 + Math.random() * 9000000000)}`;
        await db.execute('UPDATE products SET barcode = ? WHERE id = ?', [autoBarcode, product.id]);
        product.barcode = autoBarcode;
      }
    }

    const payload = unsyncedProducts.map((product: any) => {
      const cleanBarcode = (product.barcode && String(product.barcode).trim() !== '')
        ? String(product.barcode).trim()
        : `AUTO_${String(product.id).replace(/-/g, '').slice(0, 10)}`;

      return {
        id: product.id,
        shop_id: shopId,
        barcode: cleanBarcode,
        name: product.name || 'Produto Sem Nome',
        price_mt: Number(product.price_mt) || 0,
        cost_price_mt: Number(product.cost_price_mt) || 0,
        stock_quantity: Number(product.stock_quantity) || 0,
        is_fractional: product.is_fractional ? 1 : 0,
        min_stock_alert: product.min_stock_alert ?? 5,
        category: product.category || 'Geral',
        promo_price_mt: product.promo_price_mt !== null && product.promo_price_mt !== undefined ? Number(product.promo_price_mt) : null,
        promo_active: !!product.promo_active,
        attributes: product.attributes || null,
        requires_verification: (product.requires_verification === true || product.requires_verification === 1 || product.requires_verification === '1' || product.requires_verification === 'true') ? 1 : 0,
        is_deleted: (product.is_deleted === 1 || product.is_deleted === true) ? 1 : 0,
        deleted_at: product.deleted_at || null,
        updated_at: new Date().toISOString()
      };
    });

    let { error } = await supabase
      .from('products')
      .upsert(payload, { onConflict: 'id' });

    if (error && (error.code === 'PGRST204' || error.message?.includes('deleted_at') || error.message?.includes('is_deleted'))) {
      // Fallback: Supabase products table does not have soft delete columns yet
      const fallbackPayload = payload.map(({ deleted_at, is_deleted, ...rest }) => rest);
      const res = await supabase.from('products').upsert(fallbackPayload, { onConflict: 'id' });
      error = res.error;
    }

    if (error) throw error;

    // Mark successfully uploaded products as synced in SQLite
    for (const product of unsyncedProducts) {
      await db.execute(
        'UPDATE products SET sync_status = 1 WHERE id = ?',
        [product.id]
      );
    }
    console.log(`Successfully pushed batch of ${unsyncedProducts.length} products to Supabase.`);

    // Check if more remain
    const remaining = await db.select('SELECT id FROM products WHERE sync_status = 0 LIMIT 1') as any[];
    return remaining.length > 0;
  } catch (error) {
    console.warn('Background products push failed. Will retry next time.', error);
    return false;
  }
}

/**
 * Background task to pull product updates down from Supabase.
 */
export async function syncProductsFromCloud(): Promise<boolean> {
  try {
    const db = await getDB();

    const settings = await db.select(
      "SELECT value FROM settings WHERE key = 'shop_id'"
    ) as { value: string }[];
    
    if (!settings || settings.length === 0) return false;
    const shopId = settings[0].value;

    // Get last pull timestamp
    const lastPullSetting = await db.select(
      "SELECT value FROM settings WHERE key = 'last_pull_products'"
    ) as { value: string }[];
    const lastPull = lastPullSetting.length > 0 ? lastPullSetting[0].value : '1970-01-01T00:00:00.000Z';
    const nextPullTime = new Date().toISOString();

    // Fetch only specific columns for updated products to reduce bandwidth egress
    let cloudProducts: any[] | null = null;
    const pRes = await supabase
      .from('products')
      .select('id, barcode, name, price_mt, cost_price_mt, stock_quantity, is_fractional, min_stock_alert, category, promo_price_mt, promo_active, attributes, requires_verification, is_deleted, deleted_at, updated_at')
      .eq('shop_id', shopId)
      .gt('updated_at', lastPull)
      .order('updated_at', { ascending: true })
      .limit(200);

    let pData: any[] | null = pRes.data;
    let pError = pRes.error;

    if (pError && (pError.code === '42703' || pError.message?.includes('is_deleted') || pError.message?.includes('deleted_at'))) {
      // Fallback: Supabase products table does not have soft-delete columns yet
      const fallback = await supabase
        .from('products')
        .select('id, barcode, name, price_mt, cost_price_mt, stock_quantity, is_fractional, min_stock_alert, category, promo_price_mt, promo_active, attributes, requires_verification, updated_at')
        .eq('shop_id', shopId)
        .gt('updated_at', lastPull)
        .order('updated_at', { ascending: true })
        .limit(200);
      pData = fallback.data as any[];
      pError = fallback.error;
    }

    if (pError) throw pError;
    cloudProducts = pData;
    if (!cloudProducts || cloudProducts.length === 0) {
      await db.execute(
        'INSERT OR REPLACE INTO settings (key, value, sync_status) VALUES (?, ?, 1)',
        ['last_pull_products', nextPullTime]
      );
      return false;
    }

    let maxUpdatedAt = lastPull;

    for (const p of cloudProducts) {
      if (p.updated_at && p.updated_at > maxUpdatedAt) {
        maxUpdatedAt = p.updated_at;
      }

      // Protect unsynced local modifications (e.g. stock reductions) from being overwritten by stale/parallel cloud data
      const local = await db.select('SELECT sync_status FROM products WHERE id = ?', [p.id]) as any[];
      if (local && local.length > 0 && Number(local[0].sync_status) === 0) {
        console.log(`[Products Sync] Skipping pull/overwrite for product ${p.id} - local changes pending upload.`);
        continue;
      }

      await db.execute(
        'INSERT OR REPLACE INTO products (id, barcode, name, price_mt, cost_price_mt, stock_quantity, is_fractional, min_stock_alert, category, promo_price_mt, promo_active, attributes, requires_verification, is_deleted, deleted_at, sync_status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)',
        [
          p.id, 
          p.barcode, 
          p.name, 
          p.price_mt, 
          p.cost_price_mt || 0,
          p.stock_quantity, 
          p.is_fractional ? 1 : 0, 
          p.min_stock_alert, 
          p.category, 
          p.promo_price_mt, 
          p.promo_active ? 1 : 0,
          p.attributes || null,
          (p.requires_verification === true || p.requires_verification === 1 || p.requires_verification === '1' || p.requires_verification === 'true') ? 1 : 0,
          (p.is_deleted === 1 || p.is_deleted === true) ? 1 : 0,
          p.deleted_at || null,
          p.updated_at || nextPullTime
        ]
      );
    }
    
    await db.execute(
      'INSERT OR REPLACE INTO settings (key, value, sync_status) VALUES (?, ?, 1)',
      ['last_pull_products', maxUpdatedAt]
    );
    
    console.log(`Successfully pulled ${cloudProducts.length} new/updated products from Supabase.`);
    return cloudProducts.length >= 200;
  } catch (error) {
    console.warn('Background products pull failed. Will retry next time.', error);
    return false;
  }
}
