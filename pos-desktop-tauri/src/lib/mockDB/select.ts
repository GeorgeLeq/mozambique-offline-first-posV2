import { mockStorage } from './storage';

/**
 * Handles read select operations on the mock database (localStorage).
 * Simulates query execution by filtering keys and values from the internal Map stores.
 */
export const selectMockQuery = async <T>(query: string, bindValues?: any[]): Promise<T> => {
  
  if (query.includes('FROM settings WHERE key')) {
    const key = bindValues?.[0];
    const setting = mockStorage.settings.get(key);
    return (setting ? [setting] : []) as unknown as T;
  }
  if (query.includes('FROM settings')) {
    return Array.from(mockStorage.settings.values()) as unknown as T;
  }
  
  if (query.includes('FROM users WHERE pin')) {
    const pin = bindValues?.[0];
    const users = Array.from(mockStorage.users.values()).filter(u => u.pin === pin && (!u.is_deleted || u.is_deleted === 0));
    return users as unknown as T;
  }

  if (query.includes('COUNT(*) as total FROM users') || query.includes('COUNT(*) as count FROM users')) {
    if (query.includes('is_deleted = 0') || query.includes('is_deleted IS NULL')) {
      const activeCount = Array.from(mockStorage.users.values()).filter(u => !u.is_deleted || u.is_deleted === 0).length;
      return [{ total: activeCount, count: activeCount }] as unknown as T;
    }
    const totalCount = mockStorage.users.size;
    return [{ total: totalCount, count: totalCount }] as unknown as T;
  }
  
  if (query.includes('FROM users WHERE sync_status = 0')) {
    const users = Array.from(mockStorage.users.values()).filter(u => u.sync_status === 0);
    return users as unknown as T;
  }

  if (query.includes('FROM users WHERE is_deleted = 1')) {
    const users = Array.from(mockStorage.users.values()).filter(u => u.is_deleted === 1);
    return users as unknown as T;
  }
  
  if (query.includes('FROM users')) {
    return Array.from(mockStorage.users.values()) as unknown as T;
  }
  
  if (query.includes('FROM sales WHERE is_synced = 0')) {
    const sales = Array.from(mockStorage.sales.values()).filter(s => s.is_synced === 0);
    return sales as unknown as T;
  }
  
  if (query.includes('FROM products WHERE id IN')) {
    const ids = bindValues || [];
    const products = Array.from(mockStorage.products.values()).filter(p => ids.includes(p.id));
    return products as unknown as T;
  }

  if (query.includes('FROM products WHERE id = ?') || query.includes('FROM products WHERE id =')) {
    const id = bindValues?.[0];
    const products = Array.from(mockStorage.products.values()).filter(p => p.id === id);
    return products as unknown as T;
  }

  if (query.includes('FROM products WHERE sync_status = 0')) {
    const products = Array.from(mockStorage.products.values()).filter(p => p.sync_status === 0);
    return products as unknown as T;
  }

  if (query.includes('FROM products WHERE barcode')) {
    const barcode = bindValues?.[0];
    const products = Array.from(mockStorage.products.values()).filter(p => p.barcode === barcode);
    return products as unknown as T;
  }
  
  if (query.includes('FROM products')) {
    let prods = Array.from(mockStorage.products.values());
    if (query.includes('is_deleted IS NULL') || query.includes('is_deleted = 0')) {
      prods = prods.filter(p => !p.is_deleted || p.is_deleted === 0 || p.is_deleted === '0');
    }
    return prods as unknown as T;
  }

  if (query.includes('FROM expected_deliveries')) {
    let deliveries = Array.from(mockStorage.expected_deliveries.values());
    if (query.includes('WHERE id = ?') || query.includes('WHERE ed.id = ?')) {
      const id = bindValues?.[0];
      deliveries = deliveries.filter(d => d.id === id);
    }
    return deliveries as unknown as T;
  }

  if (query.includes('FROM expected_delivery_items')) {
    let items = Array.from(mockStorage.expected_delivery_items.values());
    if (bindValues && bindValues.length > 0) {
      if (query.includes('WHERE product_id = ? AND id != ?') || query.includes('WHERE product_id = ? AND id <> ?')) {
        items = items.filter(i => i.product_id === bindValues[0] && i.id !== bindValues[1]);
      } else if (query.includes('WHERE product_id = ?') || query.includes('WHERE ei.product_id = ?')) {
        items = items.filter(i => i.product_id === bindValues[0]);
      } else if (query.includes('WHERE sync_status = 0')) {
        items = items.filter(i => i.sync_status === 0);
      } else if (query.includes('WHERE delivery_id = ?') || query.includes('WHERE ei.delivery_id = ?')) {
        items = items.filter(i => i.delivery_id === bindValues[0]);
      } else if (query.includes('WHERE id = ?') || query.includes('WHERE ei.id = ?')) {
        items = items.filter(i => i.id === bindValues[0]);
      }
    } else if (query.includes('WHERE sync_status = 0')) {
      items = items.filter(i => i.sync_status === 0);
    }

    if (query.includes('COUNT(*) as cnt') || query.includes('COUNT(*)')) {
      console.log('[Mock DB] COUNT(*) expected_delivery_items:', items.length, 'for query:', query, bindValues);
      return [{ cnt: items.length }] as unknown as T;
    }

    // Perform join with products if requested
    const itemsWithProduct = items.map(item => {
      let prod = item.product_id ? mockStorage.products.get(item.product_id) : null;
      
      // Auto-heal corrupted or missing products from previous mockDb bug
      let validName = item.name;
      if (typeof validName === 'number') validName = undefined;
      let validItemName = item.item_name;
      if (typeof validItemName === 'number') validItemName = undefined;
      
      const resolvedName = validName || validItemName || prod?.name || 'Produto';

      if (!prod && item.product_id) {
        const healedProduct = {
          id: item.product_id,
          name: resolvedName,
          barcode: '',
          category: 'Geral',
          price_mt: item.cost_price_mt || 0,
          cost_price_mt: item.cost_price_mt || 0,
          stock_quantity: item.received_quantity || 0,
          is_fractional: false,
          min_stock_alert: 5,
          sync_status: 0,
          requires_verification: item.requires_verification ?? 0,
          is_deleted: 0
        };
        mockStorage.products.set(item.product_id, healedProduct);
        prod = healedProduct;
        console.log('[Mock DB] Auto-healed missing product in products storage:', healedProduct);
      }

      return {
        ...item,
        name: resolvedName,
        resolved_name: resolvedName,
        item_name: resolvedName,
        barcode: prod?.barcode || '',
        cost_price_mt: prod?.cost_price_mt || item.cost_price_mt || 0,
        stock_quantity: prod?.stock_quantity ?? 0,
        current_stock: prod?.stock_quantity ?? 0,
        is_deleted: prod?.is_deleted ?? 0,
        prod_verif: prod?.requires_verification ?? 0,
        product_attributes: prod?.attributes || null,
        packaging_data: item.packaging_data || null,
      };
    });
    console.log('[Mock DB] SELECT expected_delivery_items returning:', itemsWithProduct.length, 'items');
    return itemsWithProduct as unknown as T;
  }

  if (query.includes('FROM sale_items')) {
    let saleItems = Array.from(mockStorage.sale_items?.values() || []);
    if (bindValues && bindValues.length > 0) {
      if (query.includes('WHERE product_id = ?')) {
        saleItems = saleItems.filter((i: any) => i.product_id === bindValues[0]);
      }
    }
    if (query.includes('COUNT(*) as cnt') || query.includes('COUNT(*)')) {
      console.log('[Mock DB] COUNT(*) sale_items:', saleItems.length);
      return [{ cnt: saleItems.length }] as unknown as T;
    }
    return saleItems as unknown as T;
  }

  if (query.includes('FROM barcodes WHERE status')) {
    const status = bindValues?.[0];
    const barcodes = Array.from(mockStorage.barcodes.values()).filter(b => b.status === status);
    return barcodes as unknown as T;
  }

  if (query.includes('FROM barcodes')) {
    return Array.from(mockStorage.barcodes.values()) as unknown as T;
  }
  
  if (query.includes('FROM sales')) {
    return Array.from(mockStorage.sales.values()) as unknown as T;
  }

  if (query.includes('FROM spoiled_items')) {
    return Array.from(mockStorage.spoiled_items.values()) as unknown as T;
  }

  if (query.includes('FROM debt_payments')) {
    let list = Array.from(mockStorage.debt_payments.values());
    if (query.includes('WHERE sync_status = 0')) {
      list = list.filter(p => p.sync_status === 0);
    } else if (query.includes('WHERE debt_id = ?')) {
      const debtId = bindValues?.[0];
      list = list.filter(p => p.debt_id === debtId);
    }
    if (query.includes('ORDER BY created_at DESC')) {
      list.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }
    return list as unknown as T;
  }

  if (query.includes('FROM debts')) {
    let list = Array.from(mockStorage.debts.values());
    console.log('[DEBUG MockDB select] SELECT FROM debts before filtering. Total in mockStorage:', list.length, list);
    if (query.includes('WHERE sync_status = 0')) {
      list = list.filter(d => d.sync_status === 0);
    } else if (query.includes('WHERE status = ?') || query.includes('WHERE status')) {
      const status = bindValues?.[0];
      list = list.filter(d => d.status === status);
    } else if (query.includes('WHERE id = ?')) {
      const id = bindValues?.[0];
      list = list.filter(d => d.id === id);
    }
    if (query.includes('ORDER BY created_at DESC')) {
      list.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }
    console.log('[DEBUG MockDB select] SELECT FROM debts returning:', list.length, list);
    return list as unknown as T;
  }

  if (query.includes('FROM audit_logs')) {
    let list = Array.from(mockStorage.audit_logs.values());
    if (query.includes('ORDER BY created_at DESC')) {
      list.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }
    return list as unknown as T;
  }

  if (query.includes('FROM scan_history')) {
    let list = Array.from(mockStorage.scan_history.values());
    if (query.includes('GROUP BY user_id')) {
      const counts: Record<string, number> = {};
      list.forEach((item: any) => {
        const uid = item.user_id || 'unknown';
        counts[uid] = (counts[uid] || 0) + 1;
      });
      return Object.entries(counts).map(([user_id, count]) => ({ user_id, count })) as unknown as T;
    }
    if (query.includes('WHERE user_id = ?')) {
      const uid = bindValues?.[0];
      list = list.filter((item: any) => item.user_id === uid);
    }
    if (query.includes('ORDER BY created_at DESC')) {
      list.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }
    return list as unknown as T;
  }

  if (query.includes('FROM till_payouts')) {
    let list = Array.from(mockStorage.till_payouts?.values() || []);
    if (query.includes('GROUP BY user_id')) {
      const grouped: Record<string, { total: number; count: number }> = {};
      list.forEach((item: any) => {
        const uid = item.user_id || 'unknown';
        if (!grouped[uid]) grouped[uid] = { total: 0, count: 0 };
        grouped[uid].total += (Number(item.amount ?? item.amount_mt) || 0);
        grouped[uid].count += 1;
      });
      return Object.entries(grouped).map(([user_id, g]) => ({ user_id, total: g.total, count: g.count })) as unknown as T;
    }
    if (query.includes('WHERE user_id = ?')) {
      const uid = bindValues?.[0];
      list = list.filter((item: any) => item.user_id === uid);
    }
    if (query.includes('ORDER BY created_at DESC')) {
      list.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }
    return list as unknown as T;
  }

  if (query.includes('FROM shift_reports')) {
    let list = Array.from(mockStorage.shift_reports.values());
    if (query.includes('ORDER BY') || query.includes('closed_at') || query.includes('opened_at')) {
      list.sort((a: any, b: any) => new Date(b.opened_at || b.created_at || 0).getTime() - new Date(a.opened_at || a.created_at || 0).getTime());
    }
    return list as unknown as T;
  }

  if (query.includes('FROM notifications')) {
    return Array.from(mockStorage.notifications.values()) as unknown as T;
  }

  if (query.includes('FROM emergency_tokens')) {
    let list = Array.from(mockStorage.emergency_tokens.values());
    if (query.includes('WHERE code = ?')) {
      const code = bindValues?.[0];
      list = list.filter(t => t.code === code);
    }
    if (query.includes('is_used = 0') || query.includes('is_used = ?')) {
      // In first query, we had is_used = 0 hardcoded or via bind value.
      list = list.filter(t => t.is_used === 0 || t.is_used === '0' || t.is_used === false);
    }
    if (query.includes('cashier_id = ?')) {
      const cashierId = bindValues?.[query.includes('WHERE code = ?') ? 1 : 0];
      if (cashierId) {
        list = list.filter(t => t.cashier_id === cashierId);
      }
    }
    if (query.includes('ORDER BY created_at DESC')) {
      list.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }
    return list as unknown as T;
  }

  if (query.includes('FROM feature_entitlements')) {
    let list = Array.from(mockStorage.feature_entitlements?.values() || []);
    if (query.includes('WHERE feature_key = ?')) {
      const key = bindValues?.[0];
      list = list.filter(e => e.feature_key === key);
    }
    return list as unknown as T;
  }

  if (query.includes('FROM subscription_plans')) {
    let list = Array.from(mockStorage.subscription_plans?.values() || []);
    if (query.includes('ORDER BY price_mt ASC')) {
      list.sort((a: any, b: any) => (a.price_mt || 0) - (b.price_mt || 0));
    }
    return list as unknown as T;
  }

  if (query.includes('FROM subscription_payments')) {
    let list = Array.from(mockStorage.subscription_payments?.values() || []);
    return list as unknown as T;
  }

  if (query.includes('FROM ai_voice_audit_logs')) {
    let list = Array.from(mockStorage.ai_voice_audit_logs?.values() || []);
    if (query.includes('sync_status = 0')) {
      list = list.filter(item => item.sync_status === 0);
    }
    if (query.includes('ORDER BY created_at DESC')) {
      list.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }
    if (query.includes('LIMIT')) {
      const match = query.match(/LIMIT\s+(\d+)/i);
      const limit = match ? parseInt(match[1], 10) : 50;
      list = list.slice(0, limit);
    }
    return list as unknown as T;
  }

  if (query.includes('FROM ai_command_logs')) {
    let list = Array.from(mockStorage.ai_command_logs?.values() || []);
    if (query.includes('sync_status = 0')) {
      list = list.filter(item => item.sync_status === 0);
    }
    if (query.includes("device_origin = 'desktop_pos'") || query.includes('device_origin = "desktop_pos"')) {
      list = list.filter(item => item.device_origin === 'desktop_pos' || !item.device_origin);
    }
    if (query.includes("device_origin = 'companion_app'") || query.includes('device_origin = "companion_app"')) {
      list = list.filter(item => item.device_origin === 'companion_app');
    }
    if (query.includes('ORDER BY created_at DESC') || query.includes('ORDER BY client_timestamp DESC')) {
      list.sort((a: any, b: any) => new Date(b.created_at || b.client_timestamp || 0).getTime() - new Date(a.created_at || a.client_timestamp || 0).getTime());
    }
    if (query.includes('LIMIT')) {
      const match = query.match(/LIMIT\s+(\d+)/i);
      const limit = match ? parseInt(match[1], 10) : 50;
      list = list.slice(0, limit);
    }
    return list as unknown as T;
  }

  return [] as unknown as T;
};
