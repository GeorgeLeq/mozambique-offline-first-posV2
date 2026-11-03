import { useEffect } from 'react';

// Dispatch a custom event when a table is updated (debounced to coalesce bulk writes)
const eventDebounceTimers: Record<string, any> = {};
const lastNotifyTimestamp: Record<string, number> = {};
const MIN_NOTIFY_COOLDOWN_MS = 300; // Enforce minimum 300ms cooldown to prevent recursive self-triggering loops

export function notifyTableUpdate(tableName: string) {
  const normalized = tableName.toLowerCase();

  // Ignore settings, config, and telemetry background writes from triggering UI table re-renders
  if (normalized === 'settings' || normalized === 'system_config' || normalized === 'ai_command_logs' || normalized === 'audit_logs') {
    return;
  }

  const now = Date.now();
  if (lastNotifyTimestamp[normalized] && now - lastNotifyTimestamp[normalized] < MIN_NOTIFY_COOLDOWN_MS) {
    return;
  }

  if (eventDebounceTimers[normalized]) {
    clearTimeout(eventDebounceTimers[normalized]);
  }

  eventDebounceTimers[normalized] = setTimeout(() => {
    delete eventDebounceTimers[normalized];
    lastNotifyTimestamp[normalized] = Date.now();
    window.dispatchEvent(new CustomEvent(`db_update_${normalized}`));
  }, 150);
}

// React hook to listen for table updates
export function useTableWatcher(tableName: string, callback: () => void) {
  useEffect(() => {
    const eventName = `db_update_${tableName.toLowerCase()}`;
    const handleUpdate = () => {
      callback();
    };
    
    window.addEventListener(eventName, handleUpdate);
    return () => {
      window.removeEventListener(eventName, handleUpdate);
    };
  }, [tableName, callback]);
}

// Wrapper for db.execute to automatically trigger events based on SQL queries
export function withEventDispatcher(dbExecute: (query: string, values?: any[]) => Promise<any>) {
  return async (query: string, values?: any[]) => {
    const result = await dbExecute(query, values);
    
    try {
      // Basic regex to extract table names from INSERT, UPDATE, DELETE queries
      // Also handles INSERT OR REPLACE INTO
      const match = query.match(/(?:INSERT(?:\s+OR\s+REPLACE)?\s+INTO|UPDATE|DELETE\s+FROM)\s+([a-zA-Z0-9_]+)/i);
      if (match && match[1]) {
        notifyTableUpdate(match[1]);
      }
    } catch (err) {
      console.warn('Failed to parse query for table notification:', err);
    }
    
    return result;
  };
}
