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
          id: 'prod-seed-compal-2l',
          barcode: '5601234567895',
          name: 'Compal Néctar 2L',
          price_mt: 160.00,
          cost_price_mt: 120.00,
          stock_quantity: 40,
          category: 'Bebidas',
          min_stock_alert: 8
        },
        {
          id: 'prod-seed-pao-fresco',
          barcode: '5601234567896',
          name: 'Pão Fresco',
          price_mt: 15.00,
          cost_price_mt: 10.00,
          stock_quantity: 80,
          category: 'Padaria',
          min_stock_alert: 20
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
          const check = await db.select('SELECT id FROM products WHERE id = ? OR barcode = ? OR name = ?', [prod.id, prod.barcode, prod.name]);
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

    // 4. Seed Employee Users (Manager + 2 Cashiers)
    const seedUsers = [
      {
        id: 'usr-manager-carlos',
        name: 'Carlos Matsinhe',
        role: 'manager',
        pin: '1001',
        terminal_name: 'Terminal Central',
        current_shift_start: new Date(Date.now() - 3600000 * 3).toISOString(),
        needs_shift_cash: 0
      },
      {
        id: 'usr-cashier-maria',
        name: 'Maria Sitoe',
        role: 'operator',
        pin: '2001',
        terminal_name: 'Caixa 01',
        current_shift_start: new Date(Date.now() - 3600000 * 4).toISOString(),
        needs_shift_cash: 0
      },
      {
        id: 'usr-cashier-joao',
        name: 'João Cossa',
        role: 'operator',
        pin: '3001',
        terminal_name: 'Caixa 02',
        current_shift_start: null,
        needs_shift_cash: 1
      }
    ];

    for (const u of seedUsers) {
      try {
        const check = await db.select('SELECT id FROM users WHERE id = ? OR pin = ?', [u.id, u.pin]);
        if (check.length === 0) {
          await db.execute(
            `INSERT INTO users (id, name, role, pin, terminal_name, current_shift_start, needs_shift_cash, is_blocked, is_deleted, sync_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 1)`,
            [u.id, u.name, u.role, u.pin, u.terminal_name, u.current_shift_start, u.needs_shift_cash]
          );
        }
      } catch (e) {
        console.warn('[SeedData] Error seeding user:', u.name, e);
      }
    }

    // 5. Seed Shift Reports (Maria active shift + João's closed shift with theft discrepancy)
    const yesterday = new Date(Date.now() - 86400000);
    const seedShifts = [
      {
        id: 'shift-maria-live',
        user_id: 'usr-cashier-maria',
        user_name: 'Maria Sitoe',
        opening_cash: 1500.00,
        closing_cash: null,
        expected_cash: 6300.00,
        discrepancy: 0.00,
        total_sales: 4800.00,
        total_cash_sales: 4800.00,
        status: 'open',
        opened_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        closed_at: null,
        details_json: JSON.stringify({ note: 'Turno ativo regular em Caixa 01', terminal: 'Caixa 01' })
      },
      {
        id: 'shift-joao-stolen',
        user_id: 'usr-cashier-joao',
        user_name: 'João Cossa',
        opening_cash: 2000.00,
        closing_cash: 12000.00,
        expected_cash: 15200.00,
        discrepancy: -3200.00, // Suspicious cash shortage/theft!
        total_sales: 13200.00,
        total_cash_sales: 13200.00,
        status: 'closed',
        opened_at: new Date(yesterday.getTime() - 3600000 * 8).toISOString(),
        closed_at: yesterday.toISOString(),
        details_json: JSON.stringify({
          terminal: 'Caixa 02',
          suspicious: true,
          audit_flag: 'Quebra de caixa não justificada / Shortage of 3,200 MT detected at closing'
        })
      }
    ];

    for (const sh of seedShifts) {
      try {
        const check = await db.select('SELECT id FROM shift_reports WHERE id = ?', [sh.id]);
        if (check.length === 0) {
          await db.execute(
            `INSERT INTO shift_reports (id, user_id, user_name, opening_cash, closing_cash, expected_cash, discrepancy, total_sales, total_cash_sales, status, opened_at, closed_at, details_json, sync_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [sh.id, sh.user_id, sh.user_name, sh.opening_cash, sh.closing_cash, sh.expected_cash, sh.discrepancy, sh.total_sales, sh.total_cash_sales, sh.status, sh.opened_at, sh.closed_at, sh.details_json]
          );
        }
      } catch (e) {
        console.warn('[SeedData] Error seeding shift report:', sh.user_name, e);
      }
    }

    // 6. Seed Scan History (with past/out-of-stock items)
    const seedScans = [
      {
        id: 'scan-1',
        barcode: '6001234000011',
        product_name: 'Leite em Pó Nido 400g (Descontinuado)',
        user_id: 'usr-cashier-joao',
        shift_id: 'shift-joao-stolen',
        quantity: 3,
        unit_price: 240.00,
        total_mt: 720.00,
        terminal_name: 'Caixa 02',
        created_at: new Date(yesterday.getTime() - 3600000 * 5).toISOString()
      },
      {
        id: 'scan-2',
        barcode: '6001234000022',
        product_name: 'Sumo Santal Maçã 1L (Fora de Stock)',
        user_id: 'usr-cashier-joao',
        shift_id: 'shift-joao-stolen',
        quantity: 5,
        unit_price: 110.00,
        total_mt: 550.00,
        terminal_name: 'Caixa 02',
        created_at: new Date(yesterday.getTime() - 3600000 * 4).toISOString()
      },
      {
        id: 'scan-3',
        barcode: '6001234000033',
        product_name: 'Vinho Tinto Alentejano 750ml (Edição Esgotada)',
        user_id: 'usr-cashier-joao',
        shift_id: 'shift-joao-stolen',
        quantity: 2,
        unit_price: 650.00,
        total_mt: 1300.00,
        terminal_name: 'Caixa 02',
        created_at: new Date(yesterday.getTime() - 3600000 * 3).toISOString()
      },
      {
        id: 'scan-4',
        barcode: '5601234567891',
        product_name: 'Coca-Cola 2L',
        user_id: 'usr-cashier-maria',
        shift_id: 'shift-maria-live',
        quantity: 2,
        unit_price: 120.00,
        total_mt: 240.00,
        terminal_name: 'Caixa 01',
        created_at: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        id: 'scan-5',
        barcode: '5601234567896',
        product_name: 'Pão Fresco',
        user_id: 'usr-cashier-maria',
        shift_id: 'shift-maria-live',
        quantity: 10,
        unit_price: 15.00,
        total_mt: 150.00,
        terminal_name: 'Caixa 01',
        created_at: new Date(Date.now() - 3600000 * 1).toISOString()
      }
    ];

    for (const sc of seedScans) {
      try {
        const check = await db.select('SELECT id FROM scan_history WHERE id = ?', [sc.id]);
        if (check.length === 0) {
          await db.execute(
            `INSERT INTO scan_history (id, barcode, product_name, user_id, shift_id, quantity, unit_price, total_mt, terminal_name, created_at, status, sync_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'success', 1)`,
            [sc.id, sc.barcode, sc.product_name, sc.user_id, sc.shift_id, sc.quantity, sc.unit_price, sc.total_mt, sc.terminal_name, sc.created_at]
          );
        }
      } catch (e) {
        console.warn('[SeedData] Error seeding scan history:', sc.product_name, e);
      }
    }
  } catch (error) {
    console.error('[SeedData] Error in ensureDemoRetailData:', error);
  }
}
