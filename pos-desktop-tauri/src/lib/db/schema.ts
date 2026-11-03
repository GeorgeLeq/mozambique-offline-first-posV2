/**
 * @file schema.ts
 * @description SQLite database schema creation and table structural upgrades.
 */

/**
 * Executes schema creation queries and runs backward-compatibility migrations (ALTER commands).
 * @param dbInstance The active database connection (Tauri SQL Database or browser Mock)
 */
export async function initializeSchema(dbInstance: any): Promise<void> {
  // Fast check: if user_version >= 22, skip table creation and migration checks instantly for instant booting
  try {
    const versionRes = await dbInstance.select('PRAGMA user_version;');
    const currentVersion = versionRes?.[0]?.user_version ?? versionRes?.[0]?.['user_version'] ?? 0;
    if (currentVersion >= 23) {
      return;
    }
  } catch {}

  // 1. Create all base tables with complete columns in a single optimized block
  await dbInstance.execute(`
    CREATE TABLE IF NOT EXISTS expected_deliveries (
      id TEXT PRIMARY KEY,
      po_number INTEGER DEFAULT 1001,
      invoice_number TEXT,
      supplier_name TEXT NOT NULL,
      expected_date DATETIME,
      status TEXT DEFAULT 'pending', 
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sync_status INTEGER DEFAULT 0,
      requires_verification INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS expected_delivery_items (
      id TEXT PRIMARY KEY,
      delivery_id TEXT NOT NULL,
      product_id TEXT,
      name TEXT,
      packaging_data TEXT,
      expected_quantity REAL NOT NULL,
      received_quantity REAL DEFAULT 0,
      cost_price_mt REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      requires_verification INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sync_status INTEGER DEFAULT 0,
      FOREIGN KEY (delivery_id) REFERENCES expected_deliveries(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      sync_status INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS system_config (
      id TEXT PRIMARY KEY DEFAULT 'app_ota_config',
      latest_version TEXT DEFAULT '1.0.0',
      minimum_required_version TEXT DEFAULT '1.0.0',
      update_notes TEXT,
      download_url TEXT,
      support_whatsapp TEXT DEFAULT '+258871668217',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sync_status INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      pin TEXT UNIQUE NOT NULL,
      permissions_json TEXT,
      opening_cash REAL DEFAULT NULL,
      needs_shift_cash BOOLEAN DEFAULT 1,
      is_blocked BOOLEAN DEFAULT 0,
      current_shift_start TEXT DEFAULT NULL,
      current_shift_cash REAL DEFAULT NULL,
      terminal_name TEXT DEFAULT '',
      is_deleted INTEGER DEFAULT 0,
      deleted_at DATETIME,
      deletion_reason TEXT,
      deleted_by TEXT,
      sync_status INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      barcode TEXT UNIQUE,
      name TEXT NOT NULL,
      price_mt REAL NOT NULL,
      stock_quantity REAL DEFAULT 0,
      is_fractional BOOLEAN DEFAULT 0,
      min_stock_alert REAL DEFAULT 5,
      category TEXT DEFAULT '',
      cost_price_mt REAL DEFAULT 0,
      promo_price_mt REAL DEFAULT NULL,
      promo_active INTEGER DEFAULT 0,
      requires_verification INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      sync_status INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      attributes TEXT
    );

    CREATE TABLE IF NOT EXISTS product_aliases (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      barcode TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sync_status INTEGER DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      receipt_id TEXT,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      total_mt REAL NOT NULL,
      payment_method TEXT DEFAULT 'cash',
      status TEXT DEFAULT 'completed',
      is_synced BOOLEAN DEFAULT 0,
      sync_status INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      authorized_by TEXT,
      user_id TEXT,
      cashier_name TEXT,
      payment_details TEXT,
      original_price_mt REAL DEFAULT NULL,
      discount_type TEXT DEFAULT 'none',
      discount_value REAL DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS spoiled_items (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      reason TEXT NOT NULL,
      authorized_by TEXT NOT NULL,
      sale_id TEXT,
      receipt_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sync_status INTEGER DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS barcodes (
      barcode TEXT PRIMARY KEY,
      status TEXT NOT NULL CHECK(status IN ('available', 'used', 'expired')),
      expires_at DATETIME NOT NULL,
      shop_name TEXT,
      item_name TEXT,
      price_mt REAL,
      attributes TEXT,
      linked_product_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sync_status INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS debts (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      amount_mt REAL NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('unpaid', 'paid')),
      phone_number TEXT,
      address TEXT,
      payment_method TEXT,
      cashier_name TEXT,
      items_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME,
      receipt_id TEXT,
      sync_status INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS debt_payments (
      id TEXT PRIMARY KEY,
      debt_id TEXT NOT NULL,
      amount_paid_mt REAL NOT NULL,
      payment_method TEXT NOT NULL,
      receipt_id TEXT,
      cashier_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sync_status INTEGER DEFAULT 0,
      FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      details TEXT,
      user_name TEXT,
      hash TEXT,
      prev_hash TEXT,
      sequence_no INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sync_status INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS shift_reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      opening_cash REAL NOT NULL,
      closing_cash REAL,
      expected_cash REAL,
      discrepancy REAL,
      total_sales REAL,
      total_cash_sales REAL,
      total_pos_sales REAL,
      total_mkesh_sales REAL,
      status TEXT NOT NULL CHECK(status IN ('open', 'closed')),
      details_json TEXT,
      opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME,
      is_archived INTEGER DEFAULT 0,
      sync_status INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS till_payouts (
      id TEXT PRIMARY KEY,
      amount REAL,
      amount_mt REAL NOT NULL,
      reason TEXT NOT NULL,
      note TEXT,
      authorized_by TEXT NOT NULL,
      user_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_synced BOOLEAN DEFAULT 0,
      sync_status INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      is_read BOOLEAN DEFAULT 0,
      action_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sync_status INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS emergency_tokens (
      id TEXT PRIMARY KEY,
      token TEXT,
      code TEXT,
      cashier_id TEXT,
      is_used INTEGER DEFAULT 0,
      used INTEGER DEFAULT 0,
      used_by TEXT,
      used_at DATETIME,
      used_amount REAL DEFAULT 0,
      used_for TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      sync_status INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS scan_history (
      id TEXT PRIMARY KEY,
      barcode TEXT,
      product_name TEXT,
      status TEXT DEFAULT 'success',
      user_id TEXT,
      shift_id TEXT,
      product_id TEXT,
      quantity REAL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      total_mt REAL DEFAULT 0,
      payment_method TEXT,
      sale_id TEXT,
      terminal_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_synced INTEGER DEFAULT 0,
      sync_status INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS pos_announcements (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL,
      cashier_id TEXT,
      target_name TEXT DEFAULT 'All Cashiers',
      message TEXT NOT NULL,
      priority TEXT DEFAULT 'normal',
      is_acknowledged BOOLEAN DEFAULT 0,
      acknowledged_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sync_status INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ai_voice_audit_logs (
      id TEXT PRIMARY KEY,
      shop_id TEXT,
      shift_id TEXT,
      cashier_id TEXT,
      cashier_name TEXT NOT NULL DEFAULT 'Caixa',
      feature_context TEXT NOT NULL DEFAULT 'generic',
      transcribed_text TEXT NOT NULL,
      parsed_entities TEXT,
      audio_duration_seconds REAL DEFAULT 0,
      confidence_score REAL DEFAULT 0.95,
      encrypted_payload TEXT,
      is_mock INTEGER DEFAULT 0,
      is_offline INTEGER DEFAULT 0,
      sync_status INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ai_command_logs (
      id TEXT PRIMARY KEY,
      shop_id TEXT,
      user_id TEXT,
      user_name TEXT,
      device_origin TEXT DEFAULT 'desktop_pos',
      input_type TEXT NOT NULL,
      raw_input TEXT NOT NULL,
      transcription TEXT,
      detected_intent TEXT,
      tool_called TEXT,
      tool_arguments TEXT,
      tool_result TEXT,
      execution_status TEXT NOT NULL DEFAULT 'success',
      client_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      synced_at DATETIME,
      sync_status INTEGER DEFAULT 0
    );
  `);

  try {
    await dbInstance.execute("ALTER TABLE products ADD COLUMN is_deleted INTEGER DEFAULT 0;");
  } catch (e) {}

  try {
    await dbInstance.execute("ALTER TABLE expected_deliveries ADD COLUMN invoice_number TEXT;");
  } catch (e) {}

  try {
    await dbInstance.execute("ALTER TABLE debts ADD COLUMN receipt_id TEXT;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE debts ADD COLUMN payment_method TEXT;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE debts ADD COLUMN cashier_name TEXT;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE debts ADD COLUMN paid_at DATETIME;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE debts ADD COLUMN items_json TEXT;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE debts ADD COLUMN notes TEXT;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE debts ADD COLUMN is_deleted INTEGER DEFAULT 0;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE debts ADD COLUMN deleted_at DATETIME;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE products ADD COLUMN deleted_at DATETIME;");
  } catch (e) {}

  try {
    await dbInstance.execute("ALTER TABLE debt_payments ADD COLUMN amount_paid_mt REAL;");
  } catch (e) {}
  
  // Migrate data from old amount_mt column to amount_paid_mt if needed
  try {
    const cols = await dbInstance.select("PRAGMA table_info(debt_payments);") as any[];
    const hasAmountMt = cols?.some((col: any) => col.name === 'amount_mt');
    if (hasAmountMt) {
      console.log('[Schema] Found old amount_mt column in debt_payments, migrating to amount_paid_mt...');
      // Copy data from amount_mt to amount_paid_mt
      await dbInstance.execute(
        "UPDATE debt_payments SET amount_paid_mt = amount_mt WHERE amount_paid_mt IS NULL AND amount_mt IS NOT NULL;"
      );
    }
  } catch (e) {
    console.warn('[Schema] Migration check failed:', e);
  }

  try {
    await dbInstance.execute("ALTER TABLE debt_payments ADD COLUMN receipt_id TEXT;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE debt_payments ADD COLUMN cashier_name TEXT;");
  } catch (e) {}

  // Explicit backward compatibility schema migration queries
  try {
    await dbInstance.execute("ALTER TABLE audit_logs ADD COLUMN user_id TEXT;");
  } catch (e) {}

  try {
    await dbInstance.execute("ALTER TABLE till_payouts ADD COLUMN amount REAL;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE till_payouts ADD COLUMN note TEXT;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE till_payouts ADD COLUMN user_id TEXT;");
  } catch (e) {}

  // Copy old amount_mt field value to new amount if it's currently empty
  try {
    await dbInstance.execute("UPDATE till_payouts SET amount = amount_mt WHERE amount IS NULL AND amount_mt IS NOT NULL;");
  } catch (e) {}

  // Retroactive column migration queries for emergency_tokens table
  try {
    await dbInstance.execute("ALTER TABLE emergency_tokens ADD COLUMN id TEXT;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE emergency_tokens ADD COLUMN code TEXT;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE emergency_tokens ADD COLUMN cashier_id TEXT;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE emergency_tokens ADD COLUMN is_used INTEGER DEFAULT 0;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE emergency_tokens ADD COLUMN sync_status INTEGER DEFAULT 0;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE emergency_tokens ADD COLUMN expires_at DATETIME;");
  } catch (e) {}

  // Copy old token field value to new id and code if they are currently null
  try {
    await dbInstance.execute("UPDATE emergency_tokens SET id = token WHERE id IS NULL;");
  } catch (e) {}
  try {
    await dbInstance.execute("UPDATE emergency_tokens SET code = token WHERE code IS NULL;");
  } catch (e) {}

  try {
    await dbInstance.execute("ALTER TABLE shift_reports ADD COLUMN is_archived INTEGER DEFAULT 0;");
  } catch (e) {}

  try {
    await dbInstance.execute("ALTER TABLE expected_delivery_items ADD COLUMN name TEXT;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE expected_delivery_items ADD COLUMN packaging_data TEXT;");
  } catch (e) {}

  try {
    await dbInstance.execute("ALTER TABLE notifications ADD COLUMN action_url TEXT;");
  } catch (e) {}

  // Retroactive barcode permanent expiry & max_barcodes column migrations (v16)
  try {
    await dbInstance.execute("UPDATE barcodes SET expires_at = '2099-12-31T23:59:59.999Z' WHERE expires_at NOT LIKE '2099%';");
  } catch (e) {}

  try {
    await dbInstance.execute("ALTER TABLE subscription_plans ADD COLUMN max_barcodes INTEGER DEFAULT 50;");
  } catch (e) {}

  // Operator / User quota migration (v17)
  try {
    await dbInstance.execute("ALTER TABLE subscription_plans ADD COLUMN max_users INTEGER DEFAULT 3;");
  } catch (e) {}

  // Advanced Audits & Forensic Scan History migrations (v18)
  try {
    await dbInstance.execute("ALTER TABLE scan_history ADD COLUMN shift_id TEXT;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE scan_history ADD COLUMN product_id TEXT;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE scan_history ADD COLUMN quantity REAL DEFAULT 1;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE scan_history ADD COLUMN unit_price REAL DEFAULT 0;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE scan_history ADD COLUMN total_mt REAL DEFAULT 0;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE scan_history ADD COLUMN payment_method TEXT;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE scan_history ADD COLUMN sale_id TEXT;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE scan_history ADD COLUMN terminal_name TEXT;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE till_payouts ADD COLUMN shift_id TEXT;");
  } catch (e) {}

  // High performance forensic query indexes
  try {
    await dbInstance.execute("CREATE INDEX IF NOT EXISTS idx_scan_history_user_created ON scan_history(user_id, created_at DESC);");
  } catch (e) {}
  try {
    await dbInstance.execute("CREATE INDEX IF NOT EXISTS idx_scan_history_shift ON scan_history(shift_id);");
  } catch (e) {}
  try {
    await dbInstance.execute("CREATE INDEX IF NOT EXISTS idx_till_payouts_user_created ON till_payouts(user_id, created_at DESC);");
  } catch (e) {}
  try {
    await dbInstance.execute("CREATE INDEX IF NOT EXISTS idx_till_payouts_shift ON till_payouts(shift_id);");
  } catch (e) {}
  try {
    await dbInstance.execute("CREATE INDEX IF NOT EXISTS idx_sales_user_created ON sales(user_id, created_at DESC);");
  } catch (e) {}
  try {
    await dbInstance.execute("CREATE INDEX IF NOT EXISTS idx_shift_reports_user_status ON shift_reports(user_id, status, opened_at DESC);");
  } catch (e) {}

  // Employee soft-delete and retention migrations (v19)
  try {
    await dbInstance.execute("ALTER TABLE users ADD COLUMN is_deleted INTEGER DEFAULT 0;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE users ADD COLUMN deleted_at DATETIME;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE users ADD COLUMN deletion_reason TEXT;");
  } catch (e) {}
  try {
    await dbInstance.execute("ALTER TABLE users ADD COLUMN deleted_by TEXT;");
  } catch (e) {}

  // v21: High performance scale indexes for 10k+ catalog & fast cashier lookups
  try {
    await dbInstance.execute("CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);");
    await dbInstance.execute("CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);");
    await dbInstance.execute("CREATE INDEX IF NOT EXISTS idx_products_sync ON products(sync_status);");
    await dbInstance.execute("CREATE INDEX IF NOT EXISTS idx_products_deleted ON products(is_deleted);");
    await dbInstance.execute("CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);");
    await dbInstance.execute("CREATE INDEX IF NOT EXISTS idx_product_aliases_barcode ON product_aliases(barcode);");
    await dbInstance.execute("CREATE INDEX IF NOT EXISTS idx_product_aliases_prod ON product_aliases(product_id);");
    await dbInstance.execute("CREATE INDEX IF NOT EXISTS idx_barcodes_barcode ON barcodes(barcode);");
    await dbInstance.execute("CREATE INDEX IF NOT EXISTS idx_barcodes_status ON barcodes(status);");
    await dbInstance.execute("CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);");
    await dbInstance.execute("CREATE INDEX IF NOT EXISTS idx_sales_sync ON sales(sync_status);");
    await dbInstance.execute("CREATE INDEX IF NOT EXISTS idx_sales_receipt ON sales(receipt_id);");
    await dbInstance.execute("CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);");
    await dbInstance.execute("CREATE INDEX IF NOT EXISTS idx_sales_items_sale_id ON sales_items(sale_id);");
    await dbInstance.execute("CREATE INDEX IF NOT EXISTS idx_sales_items_product ON sales_items(product_id);");
    await dbInstance.execute("CREATE INDEX IF NOT EXISTS idx_client_debts_sync ON client_debts(sync_status);");
    await dbInstance.execute("CREATE INDEX IF NOT EXISTS idx_client_debts_client ON client_debts(client_id);");
  } catch (e) {}

  // v23: AI Command Logs & Sentinel forensic indexes
  try {
    await dbInstance.execute("CREATE INDEX IF NOT EXISTS idx_ai_command_logs_shop_created ON ai_command_logs(shop_id, created_at DESC);");
    await dbInstance.execute("CREATE INDEX IF NOT EXISTS idx_ai_command_logs_tool ON ai_command_logs(tool_called);");
    await dbInstance.execute("CREATE INDEX IF NOT EXISTS idx_ai_command_logs_sync ON ai_command_logs(sync_status);");
    await dbInstance.execute("CREATE INDEX IF NOT EXISTS idx_ai_command_logs_device ON ai_command_logs(device_origin);");
  } catch (e) {}

  // Stamp PRAGMA user_version = 23 so future boots skip all checks instantly
  try {
    await dbInstance.execute("PRAGMA user_version = 23;");
  } catch (e) {}
}
