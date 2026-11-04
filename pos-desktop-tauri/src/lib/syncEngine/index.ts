import { syncSalesToCloud, syncSalesFromCloud } from './sales';
import { syncUsersToCloud, syncUsersFromCloud } from './users';
import { syncProductsToCloud, syncProductsFromCloud } from './products';
import { syncDebtsToCloud, syncDebtsFromCloud } from './debts';
import { syncShiftReportsToCloud, syncShiftReportsFromCloud } from './shiftReports';
import { syncNotificationsToCloud, syncNotificationsFromCloud } from './notifications';
import { syncSettingsToCloud, syncSettingsFromCloud } from './settings';
import { syncAuditLogsToCloud, syncAuditLogsFromCloud } from './auditLogs';
import { syncDebtPaymentsToCloud, syncDebtPaymentsFromCloud } from './debtPayments';
import { checkDeviceHeartbeat } from './heartbeat';
import { syncTillPayoutsToCloud, syncTillPayoutsFromCloud } from './tillPayouts';
import { syncSpoiledItemsToCloud, syncSpoiledItemsFromCloud } from './spoiledItems';
import { syncProductAliasesToCloud, syncProductAliasesFromCloud } from './productAliases';
import { syncScanHistoryToCloud, syncScanHistoryFromCloud } from './scanHistory';
import { syncEmergencyTokensToCloud, syncEmergencyTokensFromCloud } from './emergencyTokens';
import { syncExpectedDeliveriesToCloud, syncExpectedDeliveriesFromCloud } from './expectedDeliveries';
import { syncPosAnnouncementsToCloud, syncPosAnnouncementsFromCloud } from './posAnnouncements';
import { 
  syncSubscriptionPaymentsToCloud, 
  syncSubscriptionPaymentsFromCloud, 
  syncSubscriptionsFromCloud 
} from './subscriptions';
import { syncLiveMetricsToCloud } from './liveMetrics';
import { syncSystemConfigFromCloud } from './systemConfig';
import { syncAiCommandLogsToCloud, syncAiCommandLogsFromCloud } from './aiCommandLogs';
import { loadEntitlementsFromDb } from '../../subscription/subscriptionDb';

import { isSupabaseConfigured } from '../supabase';

// Concurrency lock to prevent overlapping background sync intervals
let isSyncing = false;
let lastSyncTime = 0;
const MIN_SYNC_INTERVAL_MS = 30000; // Enforce minimum 30s cooldown between full sync cycles

export async function syncAllToCloud(): Promise<{ success: boolean; hasMoreWork: boolean }> {
  if (!isSupabaseConfigured()) {
    return { success: true, hasMoreWork: false };
  }

  const now = Date.now();
  if (now - lastSyncTime < MIN_SYNC_INTERVAL_MS) {
    return { success: true, hasMoreWork: false };
  }

  if (isSyncing) {
    return { success: false, hasMoreWork: false };
  }

  isSyncing = true;
  lastSyncTime = now;
  try {
    // 1. Check Heartbeat first. If deactivated, stop syncing.
    const isActive = await checkDeviceHeartbeat();
    if (!isActive) {
      return { success: false, hasMoreWork: false };
    }

    // 2. Fetch Subscription Entitlements & System OTA Version Config from Supabase first
    try {
      await syncSystemConfigFromCloud();
      await syncSubscriptionsFromCloud();
      await syncSubscriptionPaymentsToCloud();
      await syncSubscriptionPaymentsFromCloud();
    } catch (subErr) {
      // Subscriptions sync note
    }

    // 3. Verify if Cloud Backup & Sync Engine is unlocked (Pro/Enterprise feature)
    const entitlements = await loadEntitlementsFromDb();
    const isCloudBackupUnlocked = Boolean(entitlements['cloud_backup']?.is_unlocked);

    if (!isCloudBackupUnlocked) {
      // Free users still perform live metrics sync ONLY IF companion app was specifically bought as an add-on
      try {
        await syncLiveMetricsToCloud();
      } catch (metricsErr) {
        // Metrics note
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pos-sync-status', {
          detail: { status: 'synced', progress: 100, module: 'all', lastSyncedAt: new Date().toISOString() }
        }));
      }

      return { success: true, hasMoreWork: false };
    }

    // Define the logical execution order for syncing data tables one by one.
    // Core configurations & users are sync'd first, followed by products/inventory, deliveries, sales, debts, and write-only telemetry.
    const syncTasks = [
      { name: 'Settings (To)', fn: syncSettingsToCloud },
      { name: 'Settings (From)', fn: syncSettingsFromCloud },
      { name: 'Users (To)', fn: syncUsersToCloud },
      { name: 'Users (From)', fn: syncUsersFromCloud },
      { name: 'Products (To)', fn: syncProductsToCloud },
      { name: 'Products (From)', fn: syncProductsFromCloud },
      { name: 'Product Aliases (To)', fn: syncProductAliasesToCloud },
      { name: 'Product Aliases (From)', fn: syncProductAliasesFromCloud },
      { name: 'Expected Deliveries (To)', fn: syncExpectedDeliveriesToCloud },
      { name: 'Expected Deliveries (From)', fn: syncExpectedDeliveriesFromCloud },
      { name: 'Sales (To)', fn: syncSalesToCloud },
      { name: 'Sales (From)', fn: syncSalesFromCloud },
      { name: 'Debts (To)', fn: syncDebtsToCloud },
      { name: 'Debts (From)', fn: syncDebtsFromCloud },
      { name: 'Debt Payments (To)', fn: syncDebtPaymentsToCloud },
      { name: 'Debt Payments (From)', fn: syncDebtPaymentsFromCloud },
      { name: 'Shift Reports (To)', fn: syncShiftReportsToCloud },
      { name: 'Till Payouts (To)', fn: syncTillPayoutsToCloud },
      { name: 'Spoiled Items (To)', fn: syncSpoiledItemsToCloud },
      { name: 'Audit Logs (To)', fn: syncAuditLogsToCloud },
      { name: 'AI Command Logs (To)', fn: syncAiCommandLogsToCloud },
      { name: 'AI Command Logs (From)', fn: syncAiCommandLogsFromCloud },
      { name: 'Scan History (To)', fn: syncScanHistoryToCloud },
      { name: 'Notifications (To)', fn: syncNotificationsToCloud },
      { name: 'Notifications (From)', fn: syncNotificationsFromCloud },
      { name: 'POS Announcements (To)', fn: syncPosAnnouncementsToCloud },
      { name: 'POS Announcements (From)', fn: syncPosAnnouncementsFromCloud },
      { name: 'Emergency Tokens (To)', fn: syncEmergencyTokensToCloud },
      { name: 'Emergency Tokens (From)', fn: syncEmergencyTokensFromCloud },
      { name: 'Live Metrics for Companion App (To)', fn: syncLiveMetricsToCloud }
    ];

    let overallSuccess = true;
    let anyMoreWork = false;

    let completedTasks = 0;
    const totalTasks = syncTasks.length;

    for (const task of syncTasks) {
      await new Promise(resolve => setTimeout(resolve, 60));

      try {
        const result = await task.fn();
        if (result === true) {
          anyMoreWork = true;
        }
      } catch (taskErr) {
        overallSuccess = false;
      }
      completedTasks++;
    }

    if (typeof window !== 'undefined') {
      if (overallSuccess) {
        window.dispatchEvent(new CustomEvent('pos-sync-status', {
          detail: { status: 'synced', progress: 100, module: 'all', lastSyncedAt: new Date().toISOString() }
        }));
      } else {
        window.dispatchEvent(new CustomEvent('pos-sync-status', {
          detail: { status: 'error', progress: 0, module: 'all' }
        }));
      }
    }

    console.log(`[Sync Engine] Database synchronization cycle finished. Success: ${overallSuccess}, hasMoreWork: ${anyMoreWork}`);
    return { success: overallSuccess, hasMoreWork: anyMoreWork };
  } catch (err) {
    console.error('[Sync Engine] Fatal sync engine error:', err);
    return { success: false, hasMoreWork: false };
  } finally {
    isSyncing = false;
  }
}

export async function syncProductsAndDeliveriesToCloud(): Promise<{ success: boolean }> {
  if (isSyncing) {
    return { success: false };
  }
  isSyncing = true;
  try {
    const isActive = await checkDeviceHeartbeat();
    if (!isActive) return { success: false };

    // Check Cloud Backup Entitlement
    const entitlements = await loadEntitlementsFromDb();
    const isCloudBackupUnlocked = Boolean(entitlements['cloud_backup']?.is_unlocked);

    if (!isCloudBackupUnlocked) {
      console.log('[Sync Engine] Plano Grátis: Sincronização de Catálogo e Encomendas para nuvem ignorada.');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pos-sync-status', {
          detail: { status: 'synced', progress: 100, module: 'all', lastSyncedAt: new Date().toISOString() }
        }));
      }
      return { success: true };
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pos-sync-status', {
        detail: { status: 'syncing', progress: 15, module: 'products' }
      }));
    }

    let success = true;
    try {
      await syncProductsToCloud();
      await syncProductsFromCloud();
      await syncProductAliasesToCloud();
      await syncProductAliasesFromCloud();
    } catch (e) {
      console.error('[Sync Engine] Product sync error:', e);
      success = false;
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pos-sync-status', {
        detail: { status: 'syncing', progress: 60, module: 'deliveries' }
      }));
    }

    try {
      await syncExpectedDeliveriesToCloud();
      await syncExpectedDeliveriesFromCloud();
    } catch (e) {
      console.error('[Sync Engine] Expected deliveries sync error:', e);
      success = false;
    }

    if (typeof window !== 'undefined') {
      if (success) {
        window.dispatchEvent(new CustomEvent('pos-sync-status', {
          detail: { status: 'synced', progress: 100, module: 'all', lastSyncedAt: new Date().toISOString() }
        }));
      } else {
        window.dispatchEvent(new CustomEvent('pos-sync-status', {
          detail: { status: 'error', progress: 0, module: 'all' }
        }));
      }
    }

    return { success };
  } catch (err) {
    console.error('[Sync Engine] Products & Deliveries sync error:', err);
    return { success: false };
  } finally {
    isSyncing = false;
  }
}

export async function checkPendingSyncCount(): Promise<number> {
  try {
    const { getDB } = await import('../db');
    const db = await getDB();
    
    // Fast consolidated single-query execution across tables (1 IPC round-trip instead of 8)
    try {
      const res = await db.select(`
        SELECT (
          COALESCE((SELECT COUNT(*) FROM sales WHERE is_synced = 0 OR sync_status = 0), 0) +
          COALESCE((SELECT COUNT(*) FROM products WHERE is_synced = 0 OR sync_status = 0), 0) +
          COALESCE((SELECT COUNT(*) FROM debts WHERE is_synced = 0 OR sync_status = 0), 0) +
          COALESCE((SELECT COUNT(*) FROM shift_reports WHERE is_synced = 0 OR sync_status = 0), 0) +
          COALESCE((SELECT COUNT(*) FROM users WHERE sync_status = 0), 0) +
          COALESCE((SELECT COUNT(*) FROM till_payouts WHERE sync_status = 0 OR is_synced = 0), 0) +
          COALESCE((SELECT COUNT(*) FROM spoiled_items WHERE sync_status = 0), 0) +
          COALESCE((SELECT COUNT(*) FROM scan_history WHERE sync_status = 0 OR is_synced = 0), 0)
        ) as pending_total
      `) as any[];
      if (res && res[0] && res[0].pending_total !== undefined) {
        return Number(res[0].pending_total) || 0;
      }
    } catch {
      // Fallback in case any optional table is not yet migrated
    }

    let pending = 0;
    const queries = [
      "SELECT COUNT(*) as cnt FROM sales WHERE is_synced = 0 OR sync_status = 0",
      "SELECT COUNT(*) as cnt FROM products WHERE is_synced = 0 OR sync_status = 0",
      "SELECT COUNT(*) as cnt FROM debts WHERE is_synced = 0 OR sync_status = 0"
    ];
    for (const q of queries) {
      try {
        const res = await db.select(q) as any[];
        if (res && res[0]) {
          const val = res[0].cnt !== undefined ? res[0].cnt : res[0]['COUNT(*)'];
          if (val) pending += Number(val);
        }
      } catch {}
    }
    return pending;
  } catch (e) {
    return 0;
  }
}

export {
  syncSalesToCloud,
  syncSalesFromCloud,
  syncUsersToCloud,
  syncUsersFromCloud,
  syncProductsToCloud,
  syncProductsFromCloud,
  syncDebtsToCloud,
  syncDebtsFromCloud,
  syncShiftReportsToCloud,
  syncShiftReportsFromCloud,
  syncNotificationsToCloud,
  syncNotificationsFromCloud,
  syncSettingsToCloud,
  syncSettingsFromCloud,
  syncAuditLogsToCloud,
  syncAuditLogsFromCloud,
  syncDebtPaymentsToCloud,
  syncDebtPaymentsFromCloud,
  syncTillPayoutsToCloud,
  syncTillPayoutsFromCloud,
  syncSpoiledItemsToCloud,
  syncSpoiledItemsFromCloud,
  syncProductAliasesToCloud,
  syncProductAliasesFromCloud,
  syncScanHistoryToCloud,
  syncScanHistoryFromCloud,
  syncEmergencyTokensToCloud,
  syncEmergencyTokensFromCloud,
  syncExpectedDeliveriesToCloud,
  syncExpectedDeliveriesFromCloud,
  checkDeviceHeartbeat
};



