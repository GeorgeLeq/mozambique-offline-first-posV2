/**
 * @file index.ts
 * @description Local SQLite database initialization and connection management using Tauri's SQL plugin.
 * Serves as the high-performance offline-first data layer for the retail POS system.
 */

import Database from '@tauri-apps/plugin-sql';
import { createMockDB } from '../mockDb';
import { initializeSchema } from './schema';
import { defaultSettings, keysToRemoveOnWipe } from './defaults';
import { withEventDispatcher } from '../dbEvents';
import { applyDatabaseSecurity } from '../security/dbKey';
import { ensureDemoRetailData } from './seedDemoData';

// Cache the active connection globally so we don't reload or dual-bind to the SQLite file
let dbInstance: any = null;
let dbPromise: Promise<any> | null = null;

// Write queue with priority support (UI writes take precedence over background sync)
let isProcessingQueue = false;
type QueueTask = { fn: () => Promise<any>; resolve: (v: any) => void; reject: (err: any) => void };

const priorityQueue: QueueTask[] = [];
const backgroundQueue: QueueTask[] = [];

async function processWriteQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (priorityQueue.length > 0 || backgroundQueue.length > 0) {
    // UI writes in priorityQueue always execute before background tasks
    const task = priorityQueue.length > 0 ? priorityQueue.shift()! : backgroundQueue.shift()!;
    try {
      const res = await task.fn();
      task.resolve(res);
    } catch (err) {
      task.reject(err);
    }
  }

  isProcessingQueue = false;
}

/**
 * Enqueues a database operation (read or write) to execute sequentially, avoiding overlapping locks.
 * Priority tasks (UI operations) always jump ahead of background sync tasks.
 */
async function enqueueWrite<T>(fn: () => Promise<T>, isPriority = true): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const task: QueueTask = { fn, resolve, reject };
    if (isPriority) {
      priorityQueue.push(task);
    } else {
      backgroundQueue.push(task);
    }
    processWriteQueue();
  });
}

/**
 * Executes a database operation with exponential backoff if a busy/locked state is encountered.
 */
async function executeWithRetry<T>(fn: () => Promise<T>, retries = 5, delay = 100): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const errorStr = String(err).toLowerCase();
    if (retries > 0 && (
      errorStr.includes('locked') || 
      errorStr.includes('busy') || 
      errorStr.includes('timeout') || 
      errorStr.includes('sqlite_busy') ||
      errorStr.includes('code 5') // SQLite error code 5 is SQLITE_BUSY
    )) {
      console.warn(`[SQLite Lock] Database is busy or locked. Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return executeWithRetry(fn, retries - 1, Math.min(delay * 1.5, 250));
    }
    throw err;
  }
}

/**
 * Initializes the SQLite database connection and runs schemas/migrations.
 * Gracefully falls back to a mock browser database structure for the AI Studio preview.
 * 
 * @returns {Promise<any>} Direct reference to active database interface
 */
export async function initDB(): Promise<any> {
  try {
    const isTauri = '__TAURI_INTERNALS__' in window;

    if (!isTauri) {
      console.warn('Tauri environment not detected. Running on decoupled Browser Mock Database.');
      dbInstance = createMockDB();
      dbInstance.execute = withEventDispatcher(dbInstance.execute.bind(dbInstance));

      // Seed missing default configurations in mock DB
      for (const item of defaultSettings) {
        try {
          const existing = await dbInstance.select('SELECT key FROM settings WHERE key = ?', [item.key]);
          if (existing.length === 0) {
            await dbInstance.execute('INSERT INTO settings (key, value) VALUES (?, ?)', [item.key, item.value]);
          }
        } catch (err) {
          console.warn(`Failed to seed default setting in mock: ${item.key}`, err);
        }
      }

      // Hot-load all local settings into local storage for fast synchronous reads in React
      try {
        const allSettings: any[] = await dbInstance.select('SELECT key, value FROM settings');
        allSettings.forEach((row: any) => {
          localStorage.setItem(row.key, row.value);
        });
      } catch (err) {
        console.error('Failed to pre-hydrate settings cache in localStorage for mock:', err);
      }

      // Seed standard demo data (products, debts, deliveries) if missing
      await ensureDemoRetailData(dbInstance);

      return dbInstance;
    }

    // Load active Tauri SQLite storage file
    dbInstance = await Database.load('sqlite:pos.db');

    // Apply machine-bound encryption key and high-performance tuning PRAGMAs
    await applyDatabaseSecurity(dbInstance);

    // Intercept and wrap physical write operations (db.execute) to serialize on client side with retries
    const originalExecute = dbInstance.execute;
    dbInstance.execute = withEventDispatcher(async (query: string, values?: any[]) => {
      return enqueueWrite(() => 
        executeWithRetry(() => originalExecute.call(dbInstance, query, values))
      );
    });

    // Intercept and wrap read operations (db.select) with exponential backoff retries (no queueing needed for reads, or direct executeWithRetry)
    const originalSelect = dbInstance.select;
    dbInstance.select = async (query: string, values?: any[]) => {
      return executeWithRetry(() => originalSelect.call(dbInstance, query, values));
    };

    // Run structural table definitions and schema upgrades
    await initializeSchema(dbInstance);

    // Seed missing default configurations (if not already seeded)
    for (const item of defaultSettings) {
      try {
        const existing = await dbInstance.select('SELECT key FROM settings WHERE key = ?', [item.key]);
        if (existing.length === 0) {
          await dbInstance.execute('INSERT INTO settings (key, value) VALUES (?, ?)', [item.key, item.value]);
        }
      } catch (err) {
        console.warn(`Failed to seed default setting: ${item.key}`, err);
      }
    }

    // Seed standard demo data (products, debts, deliveries) if missing
    await ensureDemoRetailData(dbInstance);

    // Hot-load all local settings into local storage for fast synchronous reads in React
    try {
      const allSettings: any[] = await dbInstance.select('SELECT key, value FROM settings');
      allSettings.forEach((row: any) => {
        localStorage.setItem(row.key, row.value);
      });
    } catch (err) {
      console.error('Failed to pre-hydrate settings cache in localStorage:', err);
    }

    console.log('Local SQLite offline-first database initialized successfully.');
    return dbInstance;
  } catch (error) {
    console.error('CRITICAL: SQLite database bootstrapper failed:', error);
    throw new Error('Database initialization failed. Please restart the application.');
  }
}

/**
 * Retrieves the cached connection, initiating a fresh connection if none is active.
 * 
 * @returns {Promise<any>} The operational database connection
 */
export async function getDB(): Promise<any> {
  if (dbInstance) {
    return dbInstance;
  }
  if (!dbPromise) {
    dbPromise = initDB().catch((err) => {
      dbPromise = null; // reset to allow retry next time
      throw err;
    });
  }
  return dbPromise;
}

/**
 * Safely purges all cashier transaction files, logs, settings, and shifts from local memory.
 * If isFullWipe is true, purges all database tables completely without re-seeding defaults.
 * Otherwise, re-seeds clean default variables afterward. Avoids cross-tenant database leaks.
 */
export async function wipeLocalData(isFullWipe = false): Promise<void> {
  try {
    const isTauri = '__TAURI_INTERNALS__' in window;
    const db = await getDB();

    if (!isTauri) {
      console.log('Wiping mock browser storage state.');
      const { resetMockStorage } = await import('../mockDb');
      resetMockStorage();
    } else {
      console.log('Wiping physical SQLite storage tables.');
      
      const tables = [
        'expected_delivery_items',
        'expected_deliveries',
        'users',
        'products',
        'product_aliases',
        'sales',
        'spoiled_items',
        'barcodes',
        'debts',
        'debt_payments',
        'audit_logs',
        'shift_reports',
        'notifications',
        'till_payouts',
        'scan_history',
        'emergency_tokens',
        'pos_announcements',
        'ai_command_logs',
        'ai_voice_audit_logs',
        'settings',
        'system_config'
      ];

      for (const table of tables) {
        await db.execute(`DELETE FROM ${table};`).catch((e: any) => {
          console.warn(`Failed to truncate local table: ${table}`, e);
        });
      }
    }

    if (isFullWipe) {
      localStorage.clear();
      sessionStorage.clear();
    } else {
      // Clear local cache vectors to ensure total state reset
      keysToRemoveOnWipe.forEach(key => {
        localStorage.removeItem(key);
      });

      // Re-seed clean defaults
      for (const item of defaultSettings) {
        await db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [item.key, item.value]).catch(() => {});
        localStorage.setItem(item.key, item.value);
      }
    }

    // Ensure the offline demo catalog and sample transactional data are restored after any wipe.
    await ensureDemoRetailData(db);

    console.log('Local data wipe finished successfully.');
  } catch (error) {
    console.error('Failed to wipe local data:', error);
    throw error;
  }
}

/**
 * Resets only the settings table back to default values.
 * Preserves users, products, sales history, etc.
 */
export async function resetSettingsToDefault(): Promise<void> {
  try {
    const db = await getDB();
    
    // Clear settings table
    await db.execute('DELETE FROM settings').catch((e: any) => {
      console.warn('Failed to delete settings table:', e);
    });
    
    // Re-seed all default configurations
    for (const item of defaultSettings) {
      await db.execute('INSERT OR REPLACE INTO settings (key, value, sync_status) VALUES (?, ?, 0)', [item.key, item.value]).catch(() => {});
      localStorage.setItem(item.key, item.value);
    }
    
    console.log('Settings reset to defaults successfully.');
  } catch (error) {
    console.error('Failed to reset settings to default:', error);
    throw error;
  }
}

