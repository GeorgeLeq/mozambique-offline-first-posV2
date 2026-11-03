/**
 * Implements local-storage-backed Map collections to act as SQLite tables.
 * Shares mock state across executing and selecting modules.
 */

export const loadMockStorage = (key: string): Map<string, any> => {
  try {
    const stored = localStorage.getItem(`mock_db_${key}`);
    if (stored) {
      return new Map(JSON.parse(stored));
    }
  } catch (e) {
    console.warn(`Failed to load mock storage for ${key}`, e);
  }
  return new Map<string, any>();
};

export const saveMockStorage = (key: string, map: Map<string, any>) => {
  try {
    localStorage.setItem(`mock_db_${key}`, JSON.stringify(Array.from(map.entries())));
    console.log(`[MockDB] Successfully saved ${map.size} records to mock_db_${key}`);
  } catch (e) {
    console.error(`[MockDB] CRITICAL: Failed to save mock storage for ${key}:`, e);
  }
};

export const mockStorage: Record<string, Map<string, any>> = {
  settings: loadMockStorage('settings'),
  users: loadMockStorage('users'),
  products: loadMockStorage('products'),
  sales: loadMockStorage('sales'),
  barcodes: loadMockStorage('barcodes'),
  debts: loadMockStorage('debts'),
  shift_reports: loadMockStorage('shift_reports'),
  notifications: loadMockStorage('notifications'),
  debt_payments: loadMockStorage('debt_payments'),
  audit_logs: loadMockStorage('audit_logs'),
  spoiled_items: loadMockStorage('spoiled_items'),
  scan_history: loadMockStorage('scan_history'),
  emergency_tokens: loadMockStorage('emergency_tokens'),
  expected_deliveries: loadMockStorage('expected_deliveries'),
  expected_delivery_items: loadMockStorage('expected_delivery_items'),
  sale_items: loadMockStorage('sale_items'),
  feature_entitlements: loadMockStorage('feature_entitlements'),
  subscription_payments: loadMockStorage('subscription_payments'),
  subscription_plans: loadMockStorage('subscription_plans'),
  ai_voice_audit_logs: loadMockStorage('ai_voice_audit_logs'),
  ai_command_logs: loadMockStorage('ai_command_logs'),
  till_payouts: loadMockStorage('till_payouts'),
};

export const resetMockStorage = () => {
  Object.keys(mockStorage).forEach(key => {
    mockStorage[key].clear();
    saveMockStorage(key, mockStorage[key]);
  });
};

// Clean up non-UUID shift reports
Array.from(mockStorage.shift_reports.keys()).forEach(id => {
  if (!id.includes('-')) {
    mockStorage.shift_reports.delete(id);
  }
});
saveMockStorage('shift_reports', mockStorage.shift_reports);
