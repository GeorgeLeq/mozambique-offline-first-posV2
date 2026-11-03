import { mockStorage, saveMockStorage } from '../storage';

/**
 * Handles execute/write operations for settings, shift_reports, notifications, audit_logs, and emergency_tokens in mockStorage.
 */
export function handleSystemQuery(query: string, bindValues?: any[]): boolean {
  if (query.includes('DELETE FROM settings')) {
    mockStorage.settings.clear();
    saveMockStorage('settings', mockStorage.settings);
    return true;
  }

  if (query.includes('INSERT OR REPLACE INTO settings') || query.includes('INSERT INTO settings')) {
    if (bindValues && bindValues.length >= 2) {
      mockStorage.settings.set(bindValues[0], { key: bindValues[0], value: String(bindValues[1]) });
      saveMockStorage('settings', mockStorage.settings);
    }
    return true;
  }

  if (query.includes('UPDATE settings SET value')) {
    if (bindValues && bindValues.length >= 2) {
      mockStorage.settings.set(bindValues[1], { key: bindValues[1], value: String(bindValues[0]) });
      saveMockStorage('settings', mockStorage.settings);
    }
    return true;
  }

  if (query.includes('INSERT INTO shift_reports') || query.includes('INSERT OR REPLACE INTO shift_reports')) {
    if (bindValues && bindValues.length >= 5) {
      const hasDetails = bindValues.length >= 7;
      mockStorage.shift_reports.set(bindValues[0], {
        id: bindValues[0],
        user_id: bindValues[1],
        reported_amount_mt: bindValues[2],
        expected_amount_mt: bindValues[3],
        difference_mt: bindValues[4],
        details_json: hasDetails ? bindValues[5] : null,
        created_at: hasDetails ? bindValues[6] : new Date().toISOString(),
        sync_status: hasDetails ? (bindValues[7] ?? 1) : 0
      });
      saveMockStorage('shift_reports', mockStorage.shift_reports);
    }
    return true;
  }

  if (query.includes('UPDATE shift_reports SET sync_status = 1')) {
    if (bindValues) {
      bindValues.forEach(id => {
        const report = mockStorage.shift_reports.get(id);
        if (report) {
          report.sync_status = 1;
          mockStorage.shift_reports.set(id, report);
        }
      });
      saveMockStorage('shift_reports', mockStorage.shift_reports);
    }
    return true;
  }

  if (query.includes('INSERT INTO notifications')) {
    if (bindValues && bindValues.length >= 5) {
      const numFieldsPerRow = 5;
      if (bindValues.length > numFieldsPerRow && bindValues.length % numFieldsPerRow === 0) {
        for (let i = 0; i < bindValues.length; i += numFieldsPerRow) {
          const row = bindValues.slice(i, i + numFieldsPerRow);
          mockStorage.notifications.set(row[0], {
            id: row[0],
            type: row[1],
            title: row[2],
            message: row[3],
            action_url: row[4] || null,
            is_read: 0,
            created_at: new Date().toISOString(),
            sync_status: 0
          });
        }
      } else {
        mockStorage.notifications.set(bindValues[0], {
          id: bindValues[0],
          type: bindValues[1],
          title: bindValues[2],
          message: bindValues[3],
          action_url: bindValues[4] || null,
          is_read: 0,
          created_at: new Date().toISOString(),
          sync_status: 0
        });
      }
      saveMockStorage('notifications', mockStorage.notifications);
    }
    return true;
  }

  if (query.includes('DELETE FROM notifications')) {
    if (query.includes('is_read = 1') || query.includes('is_read = TRUE')) {
      for (const [id, notif] of mockStorage.notifications.entries()) {
        if (notif.is_read) {
          mockStorage.notifications.delete(id);
        }
      }
    } else if (query.includes('created_at') && bindValues && bindValues.length > 0) {
      // Retention purge
      const days = Number(bindValues[0]) || 30;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      for (const [id, notif] of mockStorage.notifications.entries()) {
        if (notif.created_at && notif.created_at < cutoff) {
          mockStorage.notifications.delete(id);
        }
      }
    } else if (bindValues && bindValues.length > 0) {
      mockStorage.notifications.delete(bindValues[0]);
    } else {
      mockStorage.notifications.clear();
    }
    saveMockStorage('notifications', mockStorage.notifications);
    return true;
  }

  if (query.includes('UPDATE notifications SET is_read = 1')) {
    if (bindValues && bindValues.length > 0) {
      const notif = mockStorage.notifications.get(bindValues[0]);
      if (notif) {
        notif.is_read = 1;
        mockStorage.notifications.set(bindValues[0], notif);
      }
    } else {
      // Mark all as read
      for (const [id, notif] of mockStorage.notifications.entries()) {
        notif.is_read = 1;
        mockStorage.notifications.set(id, notif);
      }
    }
    saveMockStorage('notifications', mockStorage.notifications);
    return true;
  }

  if (query.includes('INSERT INTO audit_logs')) {
    if (bindValues && bindValues.length >= 4) {
      mockStorage.audit_logs.set(bindValues[0], {
        id: bindValues[0],
        user_id: bindValues[1],
        action: bindValues[2],
        details: bindValues[3],
        created_at: new Date().toISOString(),
        sync_status: 0
      });
      saveMockStorage('audit_logs', mockStorage.audit_logs);
    }
    return true;
  }

  if (query.includes('INSERT INTO scan_history')) {
    if (bindValues && bindValues.length >= 4) {
      const id = bindValues[0];
      mockStorage.scan_history.set(id, {
        id: bindValues[0],
        barcode: bindValues[1],
        product_name: bindValues[2],
        status: bindValues[3] || 'success',
        user_id: bindValues[4] || 'unknown',
        is_synced: 0,
        sync_status: 0,
        created_at: new Date().toISOString()
      });
      saveMockStorage('scan_history', mockStorage.scan_history);
    }
    return true;
  }

  if (query.includes('INSERT INTO till_payouts')) {
    if (bindValues && bindValues.length >= 3) {
      const id = bindValues[0];
      const amountVal = Number(bindValues[1]) || 0;
      mockStorage.till_payouts.set(id, {
        id,
        amount: amountVal,
        amount_mt: amountVal,
        reason: bindValues[2] || 'Despesas',
        note: bindValues[3] || '',
        user_id: bindValues[4] || null,
        authorized_by: bindValues[5] || 'Gestor',
        created_at: new Date().toISOString(),
        is_synced: 0,
        sync_status: 0
      });
      saveMockStorage('till_payouts', mockStorage.till_payouts);
    }
    return true;
  }

  if (query.includes('INSERT INTO ai_voice_audit_logs') || query.includes('INSERT OR REPLACE INTO ai_voice_audit_logs')) {
    if (bindValues && bindValues.length >= 7) {
      const id = bindValues[0];
      mockStorage.ai_voice_audit_logs.set(id, {
        id: bindValues[0],
        shop_id: bindValues[1],
        shift_id: bindValues[2],
        cashier_id: bindValues[3],
        cashier_name: bindValues[4],
        feature_context: bindValues[5],
        transcribed_text: bindValues[6],
        parsed_entities: bindValues[7],
        audio_duration_seconds: bindValues[8] ?? 0,
        confidence_score: bindValues[9] ?? 0.95,
        encrypted_payload: bindValues[10] ?? null,
        is_mock: bindValues[11] ?? 0,
        is_offline: bindValues[12] ?? 0,
        sync_status: bindValues[13] ?? 0,
        created_at: bindValues[14] || new Date().toISOString()
      });
      saveMockStorage('ai_voice_audit_logs', mockStorage.ai_voice_audit_logs);
    }
    return true;
  }

  if (query.includes('UPDATE ai_voice_audit_logs SET sync_status = 1')) {
    if (bindValues && bindValues.length > 0) {
      bindValues.forEach(id => {
        const item = mockStorage.ai_voice_audit_logs.get(id);
        if (item) {
          item.sync_status = 1;
          mockStorage.ai_voice_audit_logs.set(id, item);
        }
      });
      saveMockStorage('ai_voice_audit_logs', mockStorage.ai_voice_audit_logs);
    }
    return true;
  }

  // AI Command Logs & Muse Spark Agentic actions
  if (query.includes('INSERT INTO ai_command_logs') || query.includes('INSERT OR REPLACE INTO ai_command_logs')) {
    if (bindValues && bindValues.length >= 7) {
      const id = bindValues[0];
      mockStorage.ai_command_logs.set(id, {
        id: bindValues[0],
        shop_id: bindValues[1] || null,
        user_id: bindValues[2] || null,
        user_name: bindValues[3] || 'Operador',
        device_origin: bindValues[4] || 'desktop_pos',
        input_type: bindValues[5] || 'text',
        raw_input: bindValues[6] || '',
        transcription: bindValues[7] || null,
        detected_intent: bindValues[8] || null,
        tool_called: bindValues[9] || null,
        tool_arguments: bindValues[10] || null,
        tool_result: bindValues[11] || null,
        execution_status: bindValues[12] || 'success',
        client_timestamp: bindValues[13] || new Date().toISOString(),
        created_at: bindValues[14] || new Date().toISOString(),
        synced_at: bindValues[15] || null,
        sync_status: bindValues[16] ?? 0
      });
      saveMockStorage('ai_command_logs', mockStorage.ai_command_logs);
    }
    return true;
  }

  if (query.includes('UPDATE ai_command_logs SET sync_status = 1')) {
    if (bindValues && bindValues.length > 0) {
      bindValues.forEach(id => {
        const item = mockStorage.ai_command_logs.get(id);
        if (item) {
          item.sync_status = 1;
          item.synced_at = new Date().toISOString();
          mockStorage.ai_command_logs.set(id, item);
        }
      });
      saveMockStorage('ai_command_logs', mockStorage.ai_command_logs);
    }
    return true;
  }

  if (query.includes('UPDATE ai_command_logs SET execution_status')) {
    if (bindValues && bindValues.length >= 2) {
      const newStatus = bindValues[0];
      const targetId = bindValues[bindValues.length - 1];
      const item = mockStorage.ai_command_logs.get(targetId);
      if (item) {
        item.execution_status = newStatus;
        mockStorage.ai_command_logs.set(targetId, item);
        saveMockStorage('ai_command_logs', mockStorage.ai_command_logs);
      }
    }
    return true;
  }

  if (query.includes('INSERT INTO emergency_tokens') || query.includes('INSERT OR REPLACE INTO emergency_tokens')) {
    if (bindValues && bindValues.length >= 3) {
      const id = bindValues[0];
      mockStorage.emergency_tokens.set(id, {
        id: bindValues[0],
        code: bindValues[1],
        cashier_id: bindValues[2],
        is_used: bindValues[3] ?? 0,
        created_at: new Date().toISOString(),
        used_at: null,
        sync_status: 0
      });
      saveMockStorage('emergency_tokens', mockStorage.emergency_tokens);
    }
    return true;
  }

  if (query.includes('UPDATE emergency_tokens SET is_used = 1') || query.includes('UPDATE emergency_tokens SET is_used = ?')) {
    if (bindValues && bindValues.length > 0) {
      const id = bindValues[bindValues.length - 1];
      const token = mockStorage.emergency_tokens.get(id);
      if (token) {
        token.is_used = 1;
        token.used_at = new Date().toISOString();
        token.sync_status = 0;
        mockStorage.emergency_tokens.set(id, token);
        saveMockStorage('emergency_tokens', mockStorage.emergency_tokens);
      }
    }
    return true;
  }

  if (query.includes('UPDATE emergency_tokens SET sync_status = 1')) {
    if (bindValues && bindValues.length > 0) {
      bindValues.forEach(id => {
        const token = mockStorage.emergency_tokens.get(id);
        if (token) {
          token.sync_status = 1;
          mockStorage.emergency_tokens.set(id, token);
        }
      });
      saveMockStorage('emergency_tokens', mockStorage.emergency_tokens);
    }
    return true;
  }

  // Feature entitlements
  if (query.includes('INSERT INTO feature_entitlements') || query.includes('INSERT OR REPLACE INTO feature_entitlements')) {
    if (bindValues && bindValues.length >= 5) {
      const id = bindValues[0];
      const feature_key = bindValues[1];
      const name = bindValues[2];
      const description = bindValues[3];
      const is_unlocked = bindValues[4];
      const plan_tier = bindValues[5] || 'pro';
      const source = bindValues[6] || 'default';
      const unlocked_at = bindValues[7] || null;
      const expires_at = bindValues[8] || null;
      
      const record = {
        id,
        feature_key,
        name,
        description,
        is_unlocked: is_unlocked ? 1 : 0,
        plan_tier,
        source,
        unlocked_at,
        expires_at
      };
      mockStorage.feature_entitlements.set(id, record);
      // Also map by feature_key for quick lookup
      if (feature_key && feature_key !== id) {
        mockStorage.feature_entitlements.set(feature_key, record);
      }
      saveMockStorage('feature_entitlements', mockStorage.feature_entitlements);
    }
    return true;
  }

  if (query.includes('UPDATE feature_entitlements SET')) {
    if (bindValues && bindValues.length > 0) {
      // General update handling
      const idOrKey = bindValues[bindValues.length - 1];
      const record = mockStorage.feature_entitlements.get(idOrKey) || Array.from(mockStorage.feature_entitlements.values()).find(e => e.feature_key === idOrKey || e.id === idOrKey);
      if (record) {
        if (query.includes('is_unlocked = ?') || query.includes('is_unlocked = 1')) {
          record.is_unlocked = 1;
        }
        mockStorage.feature_entitlements.set(record.id, record);
        if (record.feature_key) mockStorage.feature_entitlements.set(record.feature_key, record);
        saveMockStorage('feature_entitlements', mockStorage.feature_entitlements);
      }
    }
    return true;
  }

  // Subscription plans
  if (query.includes('INSERT INTO subscription_plans') || query.includes('INSERT OR REPLACE INTO subscription_plans')) {
    if (bindValues && bindValues.length >= 4) {
      mockStorage.subscription_plans.set(bindValues[0], {
        id: bindValues[0],
        name: bindValues[1],
        price_mt: bindValues[2],
        period: bindValues[3],
        max_fiado_customers: bindValues[4] ?? 20,
        max_products: bindValues[5] ?? 50,
        max_deliveries: bindValues[6] ?? 50,
        max_barcodes: bindValues[7] ?? 50,
        features_included: bindValues[8] ?? '',
        is_active: bindValues[9] ?? 1
      });
      saveMockStorage('subscription_plans', mockStorage.subscription_plans);
    }
    return true;
  }

  // Subscription payments
  if (query.includes('INSERT INTO subscription_payments') || query.includes('INSERT OR REPLACE INTO subscription_payments')) {
    if (bindValues && bindValues.length >= 7) {
      mockStorage.subscription_payments.set(bindValues[0], {
        id: bindValues[0],
        shop_id: bindValues[1],
        device_id: bindValues[2],
        feature_key: bindValues[3],
        plan_id: bindValues[4],
        amount_mt: bindValues[5],
        payment_method: bindValues[6],
        reference_code: bindValues[7],
        phone_number: bindValues[8] || null,
        screenshot_url: bindValues[9] || null,
        status: bindValues[10] || 'pending',
        submitted_at: new Date().toISOString(),
        sync_status: 0
      });
      saveMockStorage('subscription_payments', mockStorage.subscription_payments);
    }
    return true;
  }

  if (query.includes('UPDATE subscription_payments SET')) {
    if (bindValues && bindValues.length > 0) {
      const id = bindValues[bindValues.length - 1];
      const payment = mockStorage.subscription_payments.get(id);
      if (payment) {
        if (query.includes('sync_status = 1')) {
          payment.sync_status = 1;
        }
        if (query.includes('status = ?')) {
          payment.status = bindValues[0];
        }
        mockStorage.subscription_payments.set(id, payment);
        saveMockStorage('subscription_payments', mockStorage.subscription_payments);
      }
    }
    return true;
  }

  return false;
}
