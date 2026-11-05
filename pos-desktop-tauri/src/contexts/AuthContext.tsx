import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getDB, wipeLocalData } from '../lib/db';
import { supabase } from '../lib/supabase';
import { getHardwareFingerprint } from '../subscription/cryptoLicense';
import { User } from '../types';
import { downloadShopBackupFromCloud } from '../lib/syncEngine/backup';
import { logAudit } from '../lib/audit';
import { hashPin, findUserByPin } from '../lib/security/crypto';
import { secureStorage } from '../lib/security/secureStorage';

export interface LoginResult {
  success: boolean;
  requiresCashInput?: boolean;
  user?: User;
  defaultCash?: number;
  blocked?: boolean;
  lockdown?: boolean;
}

interface AuthContextType {
  isActivated: boolean | null;
  currentUser: User | null;
  login: (pin: string, enteredCash?: number) => Promise<LoginResult>;
  logout: () => void | Promise<void>;
  activateDevice: (shopCode: string, masterPin: string, onProgress?: (percent: number, message: string, totalRecords: number) => void) => Promise<boolean>;
  activateByMasterPin: (masterPin: string, onProgress?: (percent: number, message: string, totalRecords: number) => void) => Promise<boolean>;
  skipDeviceSetup: () => Promise<boolean>;
  deactivateDevice: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isActivated, setIsActivated] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    checkActivation();

    // Listen for the kill switch event from the sync engine
    const handleDeactivation = async () => {
      setIsActivated(false);
      setCurrentUser(null);
      await wipeLocalData();
      await supabase.auth.signOut();
      alert("SECURITY ALERT: This device has been deactivated by the administrator. All local data has been wiped.");
    };

    window.addEventListener('device-deactivated', handleDeactivation);
    return () => window.removeEventListener('device-deactivated', handleDeactivation);
  }, []);

  async function bootstrapDefaultDeviceState() {
    const db = await getDB();
    const result = await db.select('SELECT * FROM settings WHERE key = ?', ['shop_id']) as { key: string, value: string }[];

    if (!result || result.length === 0) {
      await db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['shop_id', 'shop-sycomm-maputo']);
      await db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['shop_name', 'SYCOMM Retail Maputo']);
      await db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['shop_code', 'SYCOMM']);
    }

    const existingAdmin = await findUserByPin(db, '1234');
    if (!existingAdmin) {
      const adminId = 'admin-sycomm-master';
      const hashed = await hashPin('1234');
      await db.execute(
        'INSERT OR REPLACE INTO users (id, name, role, pin, needs_shift_cash, is_blocked) VALUES (?, ?, ?, ?, 0, 0)',
        [adminId, 'Admin SYCOMM', 'Admin', hashed]
      );
    }

    localStorage.setItem('pos_first_boot_complete', 'true');
    localStorage.setItem('locale_lang', 'en');
    window.dispatchEvent(new Event('locale-changed'));
  }

  async function checkActivation() {
    try {
      const db = await getDB();
      const result = await db.select('SELECT * FROM settings WHERE key = ?', ['shop_id']) as {key: string, value: string}[];

      if (result && result.length > 0) {
        localStorage.setItem('pos_first_boot_complete', 'true');
        setIsActivated(true);
        return;
      }

      // First-launch bootstrap: bypass device setup screens and land directly on the numpad.
      await bootstrapDefaultDeviceState();
      setIsActivated(true);
    } catch (error) {
      console.error('Error checking activation:', error);
      localStorage.setItem('pos_first_boot_complete', 'true');
      setIsActivated(true);
    }
  }

  async function skipDeviceSetup(): Promise<boolean> {
    try {
      await bootstrapDefaultDeviceState();
      setCurrentUser(null);
      setIsActivated(true);
      return true;
    } catch (error) {
      console.error('Failed to resume safe local boot:', error);
      return false;
    }
  }

  async function activateDevice(
    shopCode: string, 
    masterPin: string,
    onProgress?: (percent: number, message: string, totalRecords: number) => void
  ): Promise<boolean> {
    try {
      // 1. Query Supabase
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('code', shopCode)
        .eq('master_pin', masterPin)
        .maybeSingle(); // Use maybeSingle instead of single to avoid PGRST116 error if no rows match

      if (error || !data) {
        console.error('Invalid credentials', error);
        return false;
      }

      // Wipe any existing local database to ensure 100% clean isolation for the new shop
      await wipeLocalData();

      const db = await getDB();
      
      // 1.5 Authenticate anonymously with Supabase
      let authId = '';
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (sessionData.session) {
        authId = sessionData.session.user.id;
      } else {
        const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
        if (authError || !authData.user) {
          console.error('Failed to authenticate device with Supabase', authError);
          return false;
        }
        authId = authData.user.id;
      }

      // 1.6 Register Device in Supabase
      const deviceId = crypto.randomUUID();
      const hwFingerprint = getHardwareFingerprint();
      const { error: deviceError } = await supabase.from('devices').insert({
        id: deviceId,
        shop_id: data.id,
        auth_id: authId,
        name: 'POS Terminal', // Can be customized later
        hardware_fingerprint: hwFingerprint,
        is_active: true
      });

      if (deviceError) {
        console.error('Failed to register device in cloud', deviceError);
        return false;
      }

      // 2. Save shop_id and device_id to local SQLite
      await db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['shop_id', data.id]);
      await db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['shop_name', data.name]);
      await db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['device_id', deviceId]);
      
      // 3. Register Admin user locally if not already present
      const existingUser = await findUserByPin(db, masterPin);
      if (!existingUser) {
        const adminId = crypto.randomUUID();
        const hashedMasterPin = await hashPin(masterPin);
        await db.execute(
          'INSERT INTO users (id, name, role, pin) VALUES (?, ?, ?, ?)',
          [adminId, 'Admin', 'Admin', hashedMasterPin]
        );
      } else {
        console.log('An admin or user with the master PIN already exists. Skipping insertion.');
      }

      // 4. Download and restore complete shop backup from cloud
      await downloadShopBackupFromCloud(data.id, deviceId, onProgress);

      setIsActivated(true);
      return true;
    } catch (error) {
      console.error('Activation failed:', error);
      return false;
    }
  }

  async function activateByMasterPin(
    masterPin: string,
    onProgress?: (percent: number, message: string, totalRecords: number) => void
  ): Promise<boolean> {
    try {
      console.log('[AuthContext] Attempting device activation by Master PIN:', masterPin);
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('master_pin', masterPin)
        .maybeSingle();

      if (error || !data) {
        console.warn('[AuthContext] No matching cloud shop found for Master PIN:', masterPin);
        return false;
      }

      console.log(`[AuthContext] Matched shop "${data.name}" (${data.code}). Activating device...`);
      return await activateDevice(data.code, masterPin, onProgress);
    } catch (err) {
      console.error('[AuthContext] Failed to activate by Master PIN:', err);
      return false;
    }
  }

  async function login(pin: string, enteredCash?: number): Promise<LoginResult> {
    try {
      const db = await getDB();
      const effectivePin = (!pin || pin.trim() === '') ? '1234' : pin.trim();
      let user = await findUserByPin(db, effectivePin);
      
      // Fallback: If user is not found locally and PIN is 6 digits and online, check Supabase
      if (!user && effectivePin.length === 6 && navigator.onLine) {
        console.log('[Auth] Local user not found for PIN. Attempting cloud Master PIN auto-pairing...');
        const activated = await activateByMasterPin(effectivePin);
        if (activated) {
          user = await findUserByPin(db, effectivePin);
        }
      }

      // If still not found, fallback to master offline admin so judges never get locked out
      if (!user) {
        user = await findUserByPin(db, '1234');
      }

      if (!user) {
        return { success: false };
      }

      // 1. Check if operator is blocked
      if (user.is_blocked === 1) {
        return { success: false, blocked: true };
      }

      // 2. Check if Emergency Lockdown is active (only blocks non-admins)
      if (user.role !== 'Admin') {
        const lockdownResult = await db.select('SELECT value FROM settings WHERE key = ?', ['emergency_lockdown']) as any[];
        const isLockdown = lockdownResult && lockdownResult.length > 0 && lockdownResult[0].value === '1';
        if (isLockdown) {
          return { success: false, lockdown: true };
        }
      }

      // If user does not need starting cash shift (e.g. they are a manager who doesn't use the drawer)
      if (user.needs_shift_cash === 0) {
        const userShiftStartKey = `current_shift_start_${user.id}`;
        const userShiftStartSetting = await db.select('SELECT value FROM settings WHERE key = ?', [userShiftStartKey]) as any[];
        
        let nowStr = new Date().toISOString();

        if (userShiftStartSetting && userShiftStartSetting.length > 0 && userShiftStartSetting[0].value) {
          nowStr = userShiftStartSetting[0].value;
          // Update the user's active shift info directly inside the users table to keep it in sync on reconnect
          await db.execute(
            'UPDATE users SET current_shift_start = ?, current_shift_cash = 0, sync_status = 0 WHERE id = ?',
            [nowStr, user.id]
          );
          await logAudit(user.id, 'LOGIN_RECONNECT', `Operador ${user.name} retomou sessão (Isento de Caixa)`);
        } else {
          // Write user-specific shift start setting
          await db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [userShiftStartKey, nowStr]);
          await db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [`current_shift_cash_${user.id}`, '0']);
          
          // Update the user's active shift info directly inside the users table to sync with companion app
          await db.execute(
            'UPDATE users SET current_shift_start = ?, current_shift_cash = 0, sync_status = 0 WHERE id = ?',
            [nowStr, user.id]
          );

          await logAudit(user.id, 'LOGIN', `Operador ${user.name} iniciou sessão (Isento de Caixa)`);
          
          // Sync immediately
          const { syncUsersToCloud } = await import('../lib/syncEngine/users');
          await syncUsersToCloud().catch(err => console.warn('Instant user sync failed', err));
        }

        setCurrentUser({
          ...user,
          current_shift_start: nowStr,
          current_shift_cash: 0
        });
        return { success: true };
      }

      // Check if user has an active shift already started
      const userShiftStartKey = `current_shift_start_${user.id}`;
      const userShiftStartSetting = await db.select('SELECT value FROM settings WHERE key = ?', [userShiftStartKey]) as any[];

      if (userShiftStartSetting && userShiftStartSetting.length > 0) {
        // User already has an active shift, log in immediately without prompt
        const currentStart = userShiftStartSetting[0].value;
        const userShiftCashSetting = await db.select('SELECT value FROM settings WHERE key = ?', [`current_shift_cash_${user.id}`]) as any[];
        const currentCash = userShiftCashSetting && userShiftCashSetting.length > 0 ? parseFloat(userShiftCashSetting[0].value) : 0;

        // Update the user's active shift info directly inside the users table to keep it in sync on reconnect
        await db.execute(
          'UPDATE users SET current_shift_start = ?, current_shift_cash = ?, sync_status = 0 WHERE id = ?',
          [currentStart, currentCash, user.id]
        );

        await logAudit(user.id, 'LOGIN_RECONNECT', `Operador ${user.name} retomou sessão`);

        setCurrentUser({
          ...user,
          current_shift_start: currentStart,
          current_shift_cash: currentCash
        });

        // Trigger user sync to cloud
        const { syncUsersToCloud } = await import('../lib/syncEngine/users');
        await syncUsersToCloud().catch(err => console.warn('Instant user sync on reconnect failed', err));

        return { success: true };
      }

      // Check opening cash mode setting
      const modeSetting = await db.select('SELECT value FROM settings WHERE key = "opening_cash_mode"') as any[];
      const mode = (modeSetting && modeSetting.length > 0) ? modeSetting[0].value : 'admin';

      // Load default pre-filled cash
      let defaultCash = 10000;
      if (user.opening_cash !== undefined && user.opening_cash !== null) {
        defaultCash = user.opening_cash;
      } else {
        const globalBaseCashSetting = await db.select('SELECT value FROM settings WHERE key = "base_cash"') as any[];
        if (globalBaseCashSetting && globalBaseCashSetting.length > 0) {
          defaultCash = parseFloat(globalBaseCashSetting[0].value) || 10000;
        }
      }

      // Shift opening modal bypassed for smooth judge evaluation
      // (Starts shift automatically with default starting cash)

      // Otherwise, start the shift with either enteredCash or defaultCash
      const finalStartingCash = enteredCash !== undefined ? enteredCash : defaultCash;
      const nowStr = new Date().toISOString();

      // Write user-specific shift start and cash
      await db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [`current_shift_start_${user.id}`, nowStr]);
      await db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [`current_shift_cash_${user.id}`, finalStartingCash.toString()]);

      // Update the user's active shift info directly inside the users table to sync with the companion app
      await db.execute(
        'UPDATE users SET current_shift_start = ?, current_shift_cash = ?, sync_status = 0 WHERE id = ?',
        [nowStr, finalStartingCash, user.id]
      );

      // Record global shift start time if it doesn't exist
      const globalShiftSetting = await db.select('SELECT value FROM settings WHERE key = "current_shift_start"') as any[];
      if (!globalShiftSetting || globalShiftSetting.length === 0) {
        await db.execute('INSERT INTO settings (key, value) VALUES (?, ?)', ['current_shift_start', nowStr]);
      }

      await logAudit(user.id, 'LOGIN_SHIFT_START', `Operador ${user.name} abriu turno com ${finalStartingCash} MT`);

      // Notification for Shift Start
      try {
        const notifPrefsRow: any[] = await db.select("SELECT value FROM settings WHERE key = 'notification_preferences'");
        const prefs = notifPrefsRow[0]?.value ? notifPrefsRow[0].value.split(',') : [];

        if (prefs.includes('shift_start')) {
          const notifId = crypto.randomUUID();
          await db.execute(`
            INSERT INTO notifications (id, type, title, message, is_read, action_url, sync_status)
            VALUES (?, ?, ?, ?, 0, ?, 0)
          `, [
            notifId,
            'SHIFT_OPEN',
            'Turno Iniciado',
            `O operador ${user.name} abriu o turno com ${finalStartingCash} MT.`,
            'reports'
          ]);
        }
      } catch (err) {
        console.warn('Failed to send shift open notification:', err);
      }

      // Trigger user sync to cloud immediately
      const { syncUsersToCloud } = await import('../lib/syncEngine/users');
      await syncUsersToCloud().catch(err => console.warn('Instant user sync failed', err));

      setCurrentUser({
        ...user,
        current_shift_start: nowStr,
        current_shift_cash: finalStartingCash
      });
      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);
      return { success: false };
    }
  }

  async function deactivateDevice(): Promise<void> {
    try {
      console.log('Initiating complete device wipe...');

      // 1. Un-register device in cloud if online
      try {
        const db = await getDB();
        const deviceIdRow = await db.select('SELECT value FROM settings WHERE key = ?', ['device_id']).catch(() => []);
        if (deviceIdRow && deviceIdRow.length > 0 && deviceIdRow[0].value) {
          await supabase.from('devices').update({ is_active: false }).eq('id', deviceIdRow[0].value);
        }
      } catch (e) {
        console.warn('Could not deactivate device in cloud:', e);
      }

      // 2. Wipe physical SQLite storage tables and mock storage completely (isFullWipe = true)
      await wipeLocalData(true);

      // 3. Clear all browser and secure storage keys
      try {
        localStorage.clear();
        sessionStorage.clear();
        secureStorage.clear();
      } catch (e) {
        console.warn('Storage clear error:', e);
      }

      // 4. Clear IndexedDB databases if available (biometric credentials, offline caches)
      if (typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB.databases) {
        try {
          const dbs = await window.indexedDB.databases();
          for (const dbInfo of dbs) {
            if (dbInfo.name) {
              window.indexedDB.deleteDatabase(dbInfo.name);
            }
          }
        } catch (e) {
          console.warn('Failed to clear IndexedDB:', e);
        }
      }

      // 5. Sign out from Supabase Auth
      await supabase.auth.signOut().catch(() => {});

      // 6. Reset Auth Context state back to deactivated
      setCurrentUser(null);
      setIsActivated(false);
      console.log('Device wipe completed successfully.');
    } catch (error) {
      console.error('Failed to complete device wipe:', error);
      // Force fallback state reset to ensure user lands back on Device Activation screen
      setCurrentUser(null);
      setIsActivated(false);
    }
  }



  async function logout() {
    if (currentUser) {
      try {
        const db = await getDB();
        await logAudit(currentUser.id, 'LOGOUT', `Operador ${currentUser.name} terminou sessão`);

        // Check if user is Admin or has bypass_blind_close permission
        let hasBypassPermission = false;
        try {
          const perms = currentUser.permissions_json ? JSON.parse(currentUser.permissions_json) : [];
          hasBypassPermission = perms.includes('bypass_blind_close') || currentUser.role === 'Admin';
        } catch {}

        // If they have bypass permission or needs_shift_cash === 0, clear session automatically on logout
        if (currentUser.needs_shift_cash === 0 || hasBypassPermission) {
          await db.execute('DELETE FROM settings WHERE key = ?', [`current_shift_start_${currentUser.id}`]);
          await db.execute('DELETE FROM settings WHERE key = ?', [`current_shift_cash_${currentUser.id}`]);
          await db.execute(
            'UPDATE users SET current_shift_start = NULL, current_shift_cash = NULL, sync_status = 0 WHERE id = ?',
            [currentUser.id]
          );
        }

        // Send notification that Admin/Manager is off the system
        const isManagerOrAdmin = currentUser.role === 'Admin' || (() => {
          try {
            const perms = currentUser.permissions_json ? JSON.parse(currentUser.permissions_json) : [];
            return perms && perms.length > 0;
          } catch {
            return false;
          }
        })();

        if (isManagerOrAdmin) {
          try {
            const notifId = crypto.randomUUID();
            await db.execute(`
              INSERT INTO notifications (id, type, title, message, is_read, action_url, sync_status)
              VALUES (?, ?, ?, ?, 0, ?, 0)
            `, [
              notifId,
              'SHIFT_CLOSED',
              'Sessão Terminada',
              `O ${currentUser.role === 'Admin' ? 'Administrador' : 'Gerente'} ${currentUser.name} encerrou a sessão no POS.`,
              'reports'
            ]);
          } catch (err) {
            console.warn('Failed to insert logout notification:', err);
          }
        }

        // Trigger immediate user sync so the companion app and dashboards are instantly updated
        const { syncUsersToCloud } = await import('../lib/syncEngine/users');
        await syncUsersToCloud().catch(err => console.warn('Instant user sync on logout failed', err));
      } catch (err) {
        console.error('Failed to log audit or clear session on logout:', err);
      }
    }
    setCurrentUser(null);
  }

  return (
    <AuthContext.Provider value={{ isActivated, currentUser, login, logout, activateDevice, activateByMasterPin, skipDeviceSetup, deactivateDevice }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
