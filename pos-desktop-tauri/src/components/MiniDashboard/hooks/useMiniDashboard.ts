import { useState, useEffect, useCallback, useRef } from 'react';
import { getDB } from '../../../lib/db';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { syncAllToCloud } from '../../../lib/syncEngine';

import { useDashboardSettings } from './useDashboardSettings';
import { useDashboardFinancials } from './useDashboardFinancials';
import { useDashboardInventory } from './useDashboardInventory';

export function useMiniDashboard() {
  const { currentUser } = useAuth();
  const [cashierName, setCashierName] = useState(currentUser?.name || 'Operador');
  const [cloudOnline, setCloudOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSync, setPendingSync] = useState(0);

  const lastConnectivityCheck = useRef<number>(0);
  const cachedOnlineStatus = useRef<boolean>(true);

  const settings = useDashboardSettings();
  const financials = useDashboardFinancials();
  const inventory = useDashboardInventory();

  useEffect(() => {
    if (currentUser?.name) {
      setCashierName(currentUser.name);
    }
  }, [currentUser]);

  const fetchDashboardData = useCallback(async () => {
    try {
      const db = await getDB();
      const now = new Date();
      const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      
      const formatToSqliteUTC = (date: Date): string => {
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const seconds = String(date.getUTCSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      };

      const startOfDay = formatToSqliteUTC(localMidnight);
      const endOfDay = formatToSqliteUTC(new Date(localMidnight.getTime() + 24 * 60 * 60 * 1000));
      const thirtyDaysAgo = new Date(localMidnight.getTime() - 30 * 24 * 60 * 60 * 1000);
      const startOf30Days = formatToSqliteUTC(thirtyDaysAgo);

      // Check Internet Connectivity (Throttled with short timeout to prevent UI hang)
      let isCloudOnline = cachedOnlineStatus.current;
      const nowMs = Date.now();
      if (!navigator.onLine) {
        isCloudOnline = false;
        cachedOnlineStatus.current = false;
      } else if (nowMs - lastConnectivityCheck.current > 180000) { // Check every 3 minutes max
        lastConnectivityCheck.current = nowMs;
        try {
          const checkPromise = supabase.from('system_config').select('key').limit(1).maybeSingle();
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
          const { error } = await Promise.race([checkPromise, timeoutPromise]) as any;
          isCloudOnline = !error;
        } catch (err) {
          isCloudOnline = false;
        }
        cachedOnlineStatus.current = isCloudOnline;
      }
      setCloudOnline(isCloudOnline);

      await settings.loadSettings(db);
      await financials.loadFinancials(db, startOfDay, endOfDay);
      await inventory.loadInventory(db, startOfDay, endOfDay, startOf30Days, now);

      // System Health (Pending Sync) - consolidated into one optimized statement
      let totalUnsynced = 0;
      try {
        const res = await db.select(`
          SELECT 
            (SELECT COUNT(*) FROM sales WHERE sync_status = 0) +
            (SELECT COUNT(*) FROM products WHERE sync_status = 0) +
            (SELECT COUNT(*) FROM debts WHERE sync_status = 0) +
            (SELECT COUNT(*) FROM till_payouts WHERE sync_status = 0) +
            (SELECT COUNT(*) FROM audit_logs WHERE sync_status = 0) +
            (SELECT COUNT(*) FROM shift_reports WHERE sync_status = 0) +
            (SELECT COUNT(*) FROM spoiled_items WHERE sync_status = 0) +
            (SELECT COUNT(*) FROM product_aliases WHERE sync_status = 0) as total
        `) as any[];
        totalUnsynced = res?.[0]?.total || 0;
      } catch (e) {
        console.warn("Optimized sync query failed, falling back to legacy checks...", e);
        const tables = ['sales', 'products', 'debts', 'till_payouts', 'audit_logs', 'shift_reports', 'spoiled_items', 'product_aliases'];
        for (const table of tables) {
          try {
            let count = 0;
            try {
              const res = await db.select(`SELECT COUNT(*) as count FROM ${table} WHERE sync_status = 0`) as any[];
              count = res?.[0]?.count || 0;
            } catch {
              const res = await db.select(`SELECT COUNT(*) as count FROM ${table} WHERE is_synced = 0`) as any[];
              count = res?.[0]?.count || 0;
            }
            totalUnsynced += count;
          } catch (e2) {
            // ignore
          }
        }
      }
      setPendingSync(totalUnsynced);

    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    }
  }, [settings.loadSettings, financials.loadFinancials, inventory.loadInventory]);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 90000); // Lighter background polling (90s)
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Event-driven refreshes: 1. On tab visibility, 2. On custom dashboard-refresh events
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboardData();
      }
    };
    const handleCustomRefresh = () => {
      fetchDashboardData();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('dashboard-refresh', handleCustomRefresh);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('dashboard-refresh', handleCustomRefresh);
    };
  }, [fetchDashboardData]);

  const handleForceSync = async () => {
    setIsSyncing(true);
    lastConnectivityCheck.current = 0; // Force direct connection check
    try {
      await syncAllToCloud();
      await fetchDashboardData();
    } catch (err) {
      console.error("Manual background sync failed:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogSpoilageWrapper = async (productId: string, qty: number, reason: string, authorizedBy: string) => {
    await inventory.handleLogSpoilage(productId, qty, reason, authorizedBy, fetchDashboardData);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(val);
  };

  return {
    ...settings,
    ...financials,
    ...inventory,
    handleLogSpoilage: handleLogSpoilageWrapper,
    cashierName,
    cloudOnline,
    isSyncing,
    pendingSync,
    handleForceSync,
    formatCurrency,
    fetchDashboardData
  };
}
