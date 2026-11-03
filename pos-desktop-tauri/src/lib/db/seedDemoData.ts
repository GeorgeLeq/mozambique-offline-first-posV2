/**
 * @file seedDemoData.ts
 * @description Auto-seeds standard offline retail data for judges and demo testing:
 * - 4+ Mozambican retail products
 * - 4+ Customers with Fiado/debts
 * - 4+ Purchase Orders / Deliveries with items
 */

export async function ensureDemoRetailData(db: any): Promise<void> {
  try {
    // 1. Check and seed products (minimum 4)
    const existingProducts: any[] = await db.select('SELECT id, name FROM products WHERE is_deleted = 0');
    if (existingProducts.length < 4) {
      console.log(`[SeedData] Found ${existingProducts.length} products. Seeding standard catalog...`);
      const defaultProducts = [
        {
          id: 'prod-seed-coca-2l',
          barcode: '5601234567891',
          name: 'Coca-Cola 2L',
          price_mt: 120.00,
          cost_price_mt: 95.00,
          stock_quantity: 48,
          category: 'Bebidas',
          min_stock_alert: 10
        },
        {
          id: 'prod-seed-arroz-25kg',
          barcode: '5601234567892',
          name: 'Arroz Princesa 25kg',
          price_mt: 1650.00,
          cost_price_mt: 1350.00,
          stock_quantity: 25,
          category: 'Mercearia',
          min_stock_alert: 5
        },
        {
          id: 'prod-seed-oleo-5l',
          barcode: '5601234567893',
          name: 'Óleo Alimentar Sunflower 5L',
          price_mt: 580.00,
          cost_price_mt: 470.00,
          stock_quantity: 35,
          category: 'Mercearia',
          min_stock_alert: 6
        },
        {
          id: 'prod-seed-sabao-omo-1kg',
          barcode: '5601234567894',
          name: 'Sabão em Pó Omo 1kg',
          price_mt: 195.00,
          cost_price_mt: 150.00,
          stock_quantity: 60,
          category: 'Higiene & Limpeza',
          min_stock_alert: 12
        }
      ];

      for (const prod of defaultProducts) {
        try {
          const check = await db.select('SELECT id FROM products WHERE id = ? OR barcode = ?', [prod.id, prod.barcode]);
          if (check.length === 0) {
            await db.execute(
              `INSERT INTO products (id, barcode, name, price_mt, cost_price_mt, stock_quantity, category, min_stock_alert, is_deleted, sync_status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
              [prod.id, prod.barcode, prod.name, prod.price_mt, prod.cost_price_mt, prod.stock_quantity, prod.category, prod.min_stock_alert]
            );
          }
        } catch (e) {
          console.warn('[SeedData] Error inserting product:', prod.name, e);
        }
      }
    }

    // 2. Check and seed customers/debts (minimum 4)
    const existingDebts: any[] = await db.select('SELECT id, customer_name FROM debts');
    if (existingDebts.length < 4) {
      console.log(`[SeedData] Found ${existingDebts.length} debt records. Seeding standard customer ledger...`);
      const defaultDebts = [
        {
          id: 'debt-seed-1',
          customer_name: 'Armando Chissano',
          phone_number: '+258 84 123 4567',
          address: 'Bairro Central, Maputo',
          amount_mt: 1450.00,
          status: 'unpaid',
          items: [{ name: 'Arroz Princesa 25kg', quantity: 1, price: 1450 }]
        },
        {
          id: 'debt-seed-2',
          customer_name: 'Fátima Mucavele',
          phone_number: '+258 82 987 6543',
          address: 'Polana Caniço, Maputo',
          amount_mt: 820.00,
          status: 'unpaid',
          items: [{ name: 'Óleo Alimentar 5L', quantity: 1, price: 580 }, { name: 'Coca-Cola 2L', quantity: 2, price: 120 }]
        },
        {
          id: 'debt-seed-3',
          customer_name: 'Bernardo Sitoe',
          phone_number: '+258 87 555 4321',
          address: 'Matola Rio, Maputo',
          amount_mt: 2350.00,
          status: 'unpaid',
          items: [{ name: 'Arroz Princesa 25kg', quantity: 1, price: 1650 }, { name: 'Sabão Omo 1kg', quantity: 3, price: 195 }]
        },
        {
          id: 'debt-seed-4',
          customer_name: 'Marta Guambe',
          phone_number: '+258 86 333 7890',
          address: 'Alto Maé, Maputo',
          amount_mt: 600.00,
          status: 'unpaid',
          items: [{ name: 'Coca-Cola 2L', quantity: 5, price: 120 }]
        }
      ];

      for (const d of defaultDebts) {
        try {
          const check = await db.select('SELECT id FROM debts WHERE id = ?', [d.id]);
          if (check.length === 0) {
            await db.execute(
              `INSERT INTO debts (id, customer_name, phone_number, address, amount_mt, status, cashier_name, items_json, sync_status)
               VALUES (?, ?, ?, ?, ?, ?, 'Administrador', ?, 1)`,
              [d.id, d.customer_name, d.phone_number, d.address, d.amount_mt, d.status, JSON.stringify(d.items)]
            );
          }
        } catch (e) {
          console.warn('[SeedData] Error inserting debt customer:', d.customer_name, e);
        }
      }
    }

    // 3. Check and seed deliveries (minimum 4)
    const existingDeliveries: any[] = await db.select('SELECT id FROM expected_deliveries');
    if (existingDeliveries.length < 4) {
      console.log(`[SeedData] Found ${existingDeliveries.length} deliveries. Seeding restock orders...`);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const in2Days = new Date();
      in2Days.setDate(in2Days.getDate() + 2);
      const in3Days = new Date();
      in3Days.setDate(in3Days.getDate() + 3);
      const in4Days = new Date();
      in4Days.setDate(in4Days.getDate() + 4);

      const defaultDeliveries = [
        {
          id: 'del-seed-1',
          po_number: 1001,
          invoice_number: 'FAT-2025-089',
          supplier_name: 'Distribuidora Nacional LDA',
          expected_date: tomorrow.toISOString(),
          status: 'pending',
          items: [
            { id: 'del-item-1-1', name: 'Coca-Cola 2L', expected_quantity: 60, cost_price_mt: 95.00, product_id: 'prod-seed-coca-2l' }
          ]
        },
        {
          id: 'del-seed-2',
          po_number: 1002,
          invoice_number: 'FAT-2025-104',
          supplier_name: 'Moçambique Alimentos S.A.',
          expected_date: in2Days.toISOString(),
          status: 'pending',
          items: [
            { id: 'del-item-2-1', name: 'Arroz Princesa 25kg', expected_quantity: 40, cost_price_mt: 1350.00, product_id: 'prod-seed-arroz-25kg' }
          ]
        },
        {
          id: 'del-seed-3',
          po_number: 1003,
          invoice_number: 'FAT-2025-118',
          supplier_name: 'Sovena Moçambique Oils',
          expected_date: in3Days.toISOString(),
          status: 'pending',
          items: [
            { id: 'del-item-3-1', name: 'Óleo Alimentar Sunflower 5L', expected_quantity: 50, cost_price_mt: 470.00, product_id: 'prod-seed-oleo-5l' }
          ]
        },
        {
          id: 'del-seed-4',
          po_number: 1004,
          invoice_number: 'FAT-2025-142',
          supplier_name: 'Unilever Moçambique',
          expected_date: in4Days.toISOString(),
          status: 'pending',
          items: [
            { id: 'del-item-4-1', name: 'Sabão em Pó Omo 1kg', expected_quantity: 100, cost_price_mt: 150.00, product_id: 'prod-seed-sabao-omo-1kg' }
          ]
        }
      ];

      for (const del of defaultDeliveries) {
        try {
          const check = await db.select('SELECT id FROM expected_deliveries WHERE id = ?', [del.id]);
          if (check.length === 0) {
            await db.execute(
              `INSERT INTO expected_deliveries (id, po_number, invoice_number, supplier_name, expected_date, status, created_by, sync_status, requires_verification)
               VALUES (?, ?, ?, ?, ?, ?, 'Administrador', 1, 0)`,
              [del.id, del.po_number, del.invoice_number, del.supplier_name, del.expected_date, del.status]
            );

            for (const item of del.items) {
              await db.execute(
                `INSERT INTO expected_delivery_items (id, delivery_id, product_id, name, expected_quantity, received_quantity, cost_price_mt, status, requires_verification, sync_status)
                 VALUES (?, ?, ?, ?, ?, 0, ?, 'pending', 0, 1)`,
                [item.id, del.id, item.product_id, item.name, item.expected_quantity, item.cost_price_mt]
              );
            }
          }
        } catch (e) {
          console.warn('[SeedData] Error inserting delivery:', del.supplier_name, e);
        }
      }
    }
  } catch (error) {
    console.error('[SeedData] Error in ensureDemoRetailData:', error);
  }
}
