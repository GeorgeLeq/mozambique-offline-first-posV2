/**
 * @file subscriptions.ts
 * @description Synchronization module for Subscription Plans, Feature Entitlements,
 * and M-Pesa / E-Mola Payment Submissions between Local SQLite and Supabase.
 */

import { getDB } from '../db';
import { supabase, isSupabaseConfigured } from '../supabase';
import { FeatureKey } from '../../subscription/types';

/**
 * Syncs locally pending payment submissions (M-Pesa / E-Mola) to Supabase payment_submissions table.
 */
export async function syncSubscriptionPaymentsToCloud(): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;

  try {
    const db = await getDB();
    const pendingRows = await db.select(
      'SELECT * FROM subscription_payments WHERE sync_status = 0'
    ) as any[];

    if (!pendingRows || pendingRows.length === 0) {
      return true;
    }

    for (const row of pendingRows) {
      const payload = {
        id: row.id,
        shop_id: row.shop_id,
        device_id: row.device_id || null,
        plan_id: row.plan_id,
        feature_key: row.feature_key,
        amount_mt: Number(row.amount_mt || 0),
        payment_method: row.payment_method,
        reference_code: row.reference_code,
        phone_number: row.phone_number || null,
        screenshot_url: row.screenshot_url || null,
        status: row.status || 'pending',
        submitted_at: row.submitted_at || new Date().toISOString()
      };

      const { error } = await supabase
        .from('payment_submissions')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        // [Sync Subscriptions] Suppressed for hackathon
      } else {
        await db.execute(
          'UPDATE subscription_payments SET sync_status = 1 WHERE id = ?',
          [row.id]
        );
      }
    }

    return true;
  } catch (_err) {
    // [Sync Subscriptions] Suppressed for hackathon
    return false;
  }
}

/**
 * Downloads review updates (approved/rejected status) for submitted payments from Supabase.
 */
export async function syncSubscriptionPaymentsFromCloud(): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;

  try {
    const db = await getDB();
    const settings = await db.select(
      "SELECT value FROM settings WHERE key = 'shop_id'"
    ) as { value: string }[];

    const shopId = settings?.[0]?.value;
    if (!shopId) return true;

    const { data: cloudPayments, error } = await supabase
      .from('payment_submissions')
      .select('*')
      .eq('shop_id', shopId);

    if (error || !cloudPayments) return true;

    let hasStatusChange = false;

    for (const cp of cloudPayments) {
      const local = await db.select(
        'SELECT id, status FROM subscription_payments WHERE id = ?',
        [cp.id]
      ) as any[];

      if (local && local.length > 0) {
        if (local[0].status !== cp.status) {
          hasStatusChange = true;
          await db.execute(
            `UPDATE subscription_payments 
             SET status = ?, admin_notes = ?, approved_at = ? 
             WHERE id = ?`,
            [cp.status, cp.admin_notes || '', cp.reviewed_at || null, cp.id]
          );
        }
      } else {
        // Record was submitted from another cashier/terminal for this shop
        await db.execute(
          `INSERT OR REPLACE INTO subscription_payments (
            id, shop_id, device_id, feature_key, plan_id, amount_mt,
            payment_method, reference_code, phone_number, screenshot_url,
            status, admin_notes, submitted_at, approved_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            cp.id,
            cp.shop_id,
            cp.device_id,
            cp.feature_key,
            cp.plan_id,
            cp.amount_mt,
            cp.payment_method,
            cp.reference_code,
            cp.phone_number,
            cp.screenshot_url,
            cp.status,
            cp.admin_notes,
            cp.submitted_at,
            cp.reviewed_at,
            1
          ]
        );
      }
    }

    if (hasStatusChange && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('subscription-payments-updated'));
    }

    return true;
  } catch (_err) {
    // [Sync Subscriptions] Suppressed for hackathon
    return false;
  }
}

/**
 * Downloads active feature entitlements from Supabase (auto-provisioned by payments or admin).
 */
export async function syncSubscriptionsFromCloud(): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;

  try {
    const db = await getDB();
    const settings = await db.select(
      "SELECT value FROM settings WHERE key = 'shop_id'"
    ) as { value: string }[];

    const shopId = settings?.[0]?.value;
    if (!shopId) return true;

    // 1. Fetch feature entitlements for this shop
    const { data: cloudEntitlements, error } = await supabase
      .from('feature_entitlements')
      .select('*')
      .eq('shop_id', shopId);

    if (!error && cloudEntitlements && cloudEntitlements.length > 0) {
      let changed = false;

      for (const ent of cloudEntitlements) {
        const featureKey = ent.feature_key as FeatureKey;
        const isUnlocked = Boolean(ent.is_unlocked);
        
        // Validate expiry
        let active = isUnlocked;
        if (active && ent.expires_at) {
          if (Date.now() > new Date(ent.expires_at).getTime()) {
            active = false;
          }
        }

        const existing = await db.select(
          'SELECT is_unlocked, expires_at, source FROM feature_entitlements WHERE feature_key = ?',
          [featureKey]
        ) as any[];

        const currentActive = existing && existing.length > 0 ? Boolean(existing[0].is_unlocked) : false;
        const currentExpires = existing?.[0]?.expires_at;

        if (!existing || existing.length === 0 || currentActive !== active || currentExpires !== ent.expires_at) {
          changed = true;
          await db.execute(`
            INSERT INTO feature_entitlements (
              id, feature_key, name, description, is_unlocked, plan_tier, source, unlocked_at, expires_at, signature, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'cloud_sync', ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(feature_key) DO UPDATE SET
              is_unlocked = excluded.is_unlocked,
              plan_tier = excluded.plan_tier,
              source = 'cloud_sync',
              unlocked_at = excluded.unlocked_at,
              expires_at = excluded.expires_at,
              signature = excluded.signature,
              updated_at = CURRENT_TIMESTAMP
          `, [
            ent.id || `${shopId}_${featureKey}`,
            featureKey,
            ent.name || featureKey,
            ent.description || '',
            active ? 1 : 0,
            ent.plan_tier || ent.id || 'pro',
            ent.unlocked_at || new Date().toISOString(),
            ent.expires_at || null,
            ent.signature || ''
          ]);
        }
      }

      if (changed && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('subscription-entitlements-updated'));
      }
    }

    // 2. Fetch dynamic subscription plans from Supabase
    const { data: cloudPlans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('price_mt', { ascending: true });

    if (!plansError && cloudPlans && cloudPlans.length > 0) {
      for (const p of cloudPlans) {
        const parsedMaxDeliveries = (p.max_deliveries !== undefined && p.max_deliveries !== null)
          ? Number(p.max_deliveries)
          : (p.id === 'plan_pro_annual' ? -1 : 500);

        const parsedMaxProducts = (p.max_products !== undefined && p.max_products !== null)
          ? Number(p.max_products)
          : (p.id === 'plan_pro_annual' ? -1 : 500);

        const parsedMaxFiados = (p.max_fiado_customers !== undefined && p.max_fiado_customers !== null)
          ? Number(p.max_fiado_customers)
          : (p.id === 'plan_pro_annual' ? -1 : 200);

        const parsedMaxBarcodes = (p.max_barcodes !== undefined && p.max_barcodes !== null)
          ? Number(p.max_barcodes)
          : (p.id === 'plan_pro_annual' ? -1 : 500);

        const parsedMaxUsers = (p.max_users !== undefined && p.max_users !== null)
          ? Number(p.max_users)
          : (p.id === 'plan_pro_annual' ? -1 : 10);

        const parsedAdvancedAudits = p.advanced_audits !== undefined && p.advanced_audits !== null
          ? (p.advanced_audits ? 1 : 0)
          : (p.id === 'plan_audits_monthly' || p.id === 'plan_pro_annual' ? 1 : 0);

        const parsedCustomPermissions = p.custom_permissions !== undefined && p.custom_permissions !== null
          ? (p.custom_permissions ? 1 : 0)
          : (p.id === 'plan_pro_annual' || (Array.isArray(p.features_included) && p.features_included.includes('custom_permissions')) ? 1 : 0);

        const parsedUnlimitedUsers = p.unlimited_users !== undefined && p.unlimited_users !== null
          ? (p.unlimited_users ? 1 : 0)
          : (p.id === 'plan_pro_annual' ? 1 : 0);

        const parsedCloudBackup = p.cloud_backup !== undefined && p.cloud_backup !== null
          ? (p.cloud_backup ? 1 : 0)
          : (p.cloud_audit_archive !== undefined && p.cloud_audit_archive !== null ? (p.cloud_audit_archive ? 1 : 0) : 0);

        const parsedAddons = Array.isArray(p.addons) ? JSON.stringify(p.addons) : '[]';

        await db.execute(`
          INSERT INTO subscription_plans (
            id, name, tagline, price_mt, period, period_label, max_fiado_customers, max_products, max_deliveries, max_barcodes, max_users,
            advanced_audits, custom_permissions, unlimited_users, cloud_backup, cloud_audit_archive, addons, features_included, is_popular, badge, description, is_active, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            tagline = excluded.tagline,
            price_mt = excluded.price_mt,
            period = excluded.period,
            period_label = excluded.period_label,
            max_fiado_customers = excluded.max_fiado_customers,
            max_products = excluded.max_products,
            max_deliveries = excluded.max_deliveries,
            max_barcodes = excluded.max_barcodes,
            max_users = excluded.max_users,
            advanced_audits = excluded.advanced_audits,
            custom_permissions = excluded.custom_permissions,
            unlimited_users = excluded.unlimited_users,
            cloud_backup = excluded.cloud_backup,
            cloud_audit_archive = excluded.cloud_audit_archive,
            addons = excluded.addons,
            features_included = excluded.features_included,
            is_popular = excluded.is_popular,
            badge = excluded.badge,
            description = excluded.description,
            is_active = excluded.is_active,
            updated_at = CURRENT_TIMESTAMP
        `, [
          p.id,
          p.name,
          p.tagline || '',
          p.price_mt,
          p.period,
          p.period_label || '',
          parsedMaxFiados,
          parsedMaxProducts,
          parsedMaxDeliveries,
          parsedMaxBarcodes,
          parsedMaxUsers,
          parsedAdvancedAudits,
          parsedCustomPermissions,
          parsedUnlimitedUsers,
          parsedCloudBackup,
          parsedCloudBackup,
          parsedAddons,
          JSON.stringify(p.features_included || []),
          p.is_popular ? 1 : 0,
          p.badge || '',
          p.description || '',
          p.is_active !== undefined ? (p.is_active ? 1 : 0) : 1
        ]);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('subscription-plans-updated', { detail: cloudPlans }));
      }
    }

    // 3. Resolve feature entitlements directly from subscription_plans and optional shop overrides
    try {
      let shopRow: any = null;

      if (shopId) {
        // Safe check for valid UUID format to avoid Postgres invalid UUID syntax error
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(shopId);
        if (isUuid) {
          const { data, error: uErr } = await supabase.from('shops').select('*').eq('id', shopId).maybeSingle();
          if (!uErr && data) shopRow = data;
        } else {
          const { data, error: cErr } = await supabase.from('shops').select('*').eq('code', shopId).maybeSingle();
          if (!cErr && data) shopRow = data;
        }
      }

      // If not found by shopId, query the first shop record available
      if (!shopRow) {
        const { data: firstShop } = await supabase.from('shops').select('*').limit(1).maybeSingle();
        if (firstShop) shopRow = firstShop;
      }

      if (shopRow) {
        // [Sync Subscriptions] Found shopRow from Supabase (silenced for competition)

        if (shopRow.subscription_plan_id) {
          await db.execute(
            "INSERT OR REPLACE INTO settings (key, value, sync_status) VALUES ('subscription_plan_id', ?, 1)",
            [String(shopRow.subscription_plan_id)]
          );
          await db.execute(
            "INSERT OR REPLACE INTO settings (key, value, sync_status) VALUES ('plan_id', ?, 1)",
            [String(shopRow.subscription_plan_id)]
          );
        }
        if (shopRow.plan_tier) {
          await db.execute(
            "INSERT OR REPLACE INTO settings (key, value, sync_status) VALUES ('plan_tier', ?, 1)",
            [String(shopRow.plan_tier)]
          );
        }
        if (shopRow.max_fiado_customers !== undefined && shopRow.max_fiado_customers !== null) {
          await db.execute(
            "INSERT OR REPLACE INTO settings (key, value, sync_status) VALUES ('max_fiado_customers', ?, 1)",
            [String(shopRow.max_fiado_customers)]
          );
        }
        if (shopRow.max_deliveries !== undefined && shopRow.max_deliveries !== null) {
          await db.execute(
            "INSERT OR REPLACE INTO settings (key, value, sync_status) VALUES ('max_deliveries', ?, 1)",
            [String(shopRow.max_deliveries)]
          );
        }
        if (shopRow.max_products !== undefined && shopRow.max_products !== null) {
          await db.execute(
            "INSERT OR REPLACE INTO settings (key, value, sync_status) VALUES ('max_products', ?, 1)",
            [String(shopRow.max_products)]
          );
        }
        if (shopRow.max_barcodes !== undefined && shopRow.max_barcodes !== null) {
          await db.execute(
            "INSERT OR REPLACE INTO settings (key, value, sync_status) VALUES ('max_barcodes', ?, 1)",
            [String(shopRow.max_barcodes)]
          );
        }
        if (shopRow.max_users !== undefined && shopRow.max_users !== null) {
          await db.execute(
            "INSERT OR REPLACE INTO settings (key, value, sync_status) VALUES ('max_users', ?, 1)",
            [String(shopRow.max_users)]
          );
        }
      }

      // Plan-level feature evaluation from Supabase subscription_plans (Single Source of Truth)
      let planHasAudits = false;
      let planHasCustomPermissions = false;
      let planHasCloudBackup = false;

      if (cloudPlans && cloudPlans.length > 0) {
        // Resolve matching plan by explicit subscription_plan_id, or by plan_tier, or fallback to plan ID
        const targetPlanId = shopRow?.subscription_plan_id || shopRow?.plan_tier || 'plan_free';
        
        let matchingPlan = cloudPlans.find(p => p.id === targetPlanId);
        
        if (!matchingPlan && targetPlanId) {
          // Fallback matching by name or tier if ID differs slightly (e.g. 'free' vs 'plan_free' or 'pro' vs 'plan_pro_annual')
          matchingPlan = cloudPlans.find(p => 
            p.id.toLowerCase() === targetPlanId.toLowerCase() ||
            p.id.toLowerCase().includes(targetPlanId.toLowerCase()) ||
            p.name.toLowerCase().includes(targetPlanId.toLowerCase())
          );
        }

        // If still no matching plan found, use the first plan or default
        if (!matchingPlan && cloudPlans.length > 0) {
          matchingPlan = cloudPlans.find(p => p.id === 'plan_free') || cloudPlans[0];
        }

        if (matchingPlan) {
          // [Sync Subscriptions] Resolved shop subscription plan (silenced for competition)

          // If the shop is on a specific plan, save the plan reference and limits into settings if not explicitly overridden by the shop record
          if (matchingPlan.id) {
            await db.execute(
              "INSERT OR REPLACE INTO settings (key, value, sync_status) VALUES ('subscription_plan_id', ?, 1)",
              [String(matchingPlan.id)]
            );
            await db.execute(
              "INSERT OR REPLACE INTO settings (key, value, sync_status) VALUES ('plan_tier', ?, 1)",
              [String(matchingPlan.period === 'annual' ? 'annual' : (matchingPlan.price_mt > 0 ? 'pro' : 'free'))]
            );
          }

          if (matchingPlan.price_mt > 0 || matchingPlan.id !== 'plan_free') {
            // Paid plan: inherit plan limits if shop doesn't have custom column overrides
            if (shopRow?.max_products === undefined || shopRow?.max_products === null) {
              const pLimit = matchingPlan.max_products !== undefined && matchingPlan.max_products !== null ? matchingPlan.max_products : 500;
              await db.execute(
                "INSERT OR REPLACE INTO settings (key, value, sync_status) VALUES ('max_products', ?, 1)",
                [String(pLimit)]
              );
            }
            if (shopRow?.max_barcodes === undefined || shopRow?.max_barcodes === null) {
              const bLimit = matchingPlan.max_barcodes !== undefined && matchingPlan.max_barcodes !== null ? matchingPlan.max_barcodes : 500;
              await db.execute(
                "INSERT OR REPLACE INTO settings (key, value, sync_status) VALUES ('max_barcodes', ?, 1)",
                [String(bLimit)]
              );
            }
            if (shopRow?.max_deliveries === undefined || shopRow?.max_deliveries === null) {
              const dLimit = matchingPlan.max_deliveries !== undefined && matchingPlan.max_deliveries !== null ? matchingPlan.max_deliveries : 500;
              await db.execute(
                "INSERT OR REPLACE INTO settings (key, value, sync_status) VALUES ('max_deliveries', ?, 1)",
                [String(dLimit)]
              );
            }
            if (shopRow?.max_fiado_customers === undefined || shopRow?.max_fiado_customers === null) {
              const fLimit = matchingPlan.max_fiado_customers !== undefined && matchingPlan.max_fiado_customers !== null ? matchingPlan.max_fiado_customers : 500;
              await db.execute(
                "INSERT OR REPLACE INTO settings (key, value, sync_status) VALUES ('max_fiado_customers', ?, 1)",
                [String(fLimit)]
              );
            }
            if (shopRow?.max_users === undefined || shopRow?.max_users === null) {
              const uLimit = matchingPlan.max_users !== undefined && matchingPlan.max_users !== null ? matchingPlan.max_users : 10;
              await db.execute(
                "INSERT OR REPLACE INTO settings (key, value, sync_status) VALUES ('max_users', ?, 1)",
                [String(uLimit)]
              );
            }
          }

          planHasAudits = Boolean(matchingPlan.advanced_audits) || (Array.isArray(matchingPlan.features_included) && matchingPlan.features_included.includes('advanced_audits'));
          planHasCustomPermissions = Boolean(matchingPlan.custom_permissions) || (Array.isArray(matchingPlan.features_included) && matchingPlan.features_included.includes('custom_permissions'));
          // Strictly check cloud_backup in the assigned plan
          planHasCloudBackup = Boolean(matchingPlan.cloud_backup) || (Array.isArray(matchingPlan.features_included) && (matchingPlan.features_included.includes('cloud_backup') || matchingPlan.features_included.includes('cloud_sync')));
        }
      }

      // 1. ADVANCED AUDITS
      const shouldUnlockAudits = shopRow?.advanced_audits === false ? false : (shopRow?.advanced_audits === true ? true : planHasAudits);
      
      const existingAuditEnt = await db.select(
        'SELECT is_unlocked FROM feature_entitlements WHERE feature_key = ?',
        ['advanced_audits']
      ) as any[];

      const currentLocalUnlockedAudits = existingAuditEnt && existingAuditEnt.length > 0
        ? Boolean(existingAuditEnt[0].is_unlocked)
        : false;

      let entitlementsChanged = false;

      if (!existingAuditEnt || existingAuditEnt.length === 0) {
        await db.execute(`
          INSERT INTO feature_entitlements (
            id, feature_key, name, description, is_unlocked, plan_tier, source, unlocked_at, updated_at
          ) VALUES (?, 'advanced_audits', 'Auditoria Avançada de Caixa & Leituras', 'Módulo de auditoria sincronizado com Supabase.', ?, 'addon', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          `advanced_audits`,
          shouldUnlockAudits ? 1 : 0
        ]);
        entitlementsChanged = true;
      } else if (currentLocalUnlockedAudits !== shouldUnlockAudits) {
        await db.execute(`
          UPDATE feature_entitlements 
          SET is_unlocked = ?,
              source = 'cloud_sync',
              updated_at = CURRENT_TIMESTAMP
          WHERE feature_key = 'advanced_audits'
        `, [shouldUnlockAudits ? 1 : 0]);
        entitlementsChanged = true;
      }

      // 2. CUSTOM PERMISSIONS (Gestão de Operadores)
      const shouldUnlockCustomPerms = shopRow?.custom_permissions === false ? false : (shopRow?.custom_permissions === true ? true : planHasCustomPermissions);
      
      const existingPermsEnt = await db.select(
        'SELECT is_unlocked FROM feature_entitlements WHERE feature_key = ?',
        ['custom_permissions']
      ) as any[];

      const currentLocalUnlockedPerms = existingPermsEnt && existingPermsEnt.length > 0
        ? Boolean(existingPermsEnt[0].is_unlocked)
        : false;

      if (!existingPermsEnt || existingPermsEnt.length === 0) {
        await db.execute(`
          INSERT INTO feature_entitlements (
            id, feature_key, name, description, is_unlocked, plan_tier, source, unlocked_at, updated_at
          ) VALUES (?, 'custom_permissions', 'Controlo Avançado de Permissões', 'Módulo de delegação granular de permissões sincronizado com Supabase.', ?, 'addon', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          `custom_permissions`,
          shouldUnlockCustomPerms ? 1 : 0
        ]);
        entitlementsChanged = true;
      } else if (currentLocalUnlockedPerms !== shouldUnlockCustomPerms) {
        await db.execute(`
          UPDATE feature_entitlements 
          SET is_unlocked = ?,
              source = 'cloud_sync',
              updated_at = CURRENT_TIMESTAMP
          WHERE feature_key = 'custom_permissions'
        `, [shouldUnlockCustomPerms ? 1 : 0]);
        entitlementsChanged = true;
      }

      // 3. CLOUD BACKUP & SYNC ENGINE (Single Source of Truth: Plan definition, overridable if shop explicitly flags)
      const shouldUnlockCloudBackup = shopRow?.cloud_backup === false ? false : (shopRow?.cloud_backup === true ? true : planHasCloudBackup);
      
      const existingCloudBackupEnt = await db.select(
        'SELECT is_unlocked FROM feature_entitlements WHERE feature_key = ?',
        ['cloud_backup']
      ) as any[];

      const currentLocalUnlockedCloudBackup = existingCloudBackupEnt && existingCloudBackupEnt.length > 0
        ? Boolean(existingCloudBackupEnt[0].is_unlocked)
        : false;

      if (!existingCloudBackupEnt || existingCloudBackupEnt.length === 0) {
        await db.execute(`
          INSERT INTO feature_entitlements (
            id, feature_key, name, description, is_unlocked, plan_tier, source, unlocked_at, updated_at
          ) VALUES (?, 'cloud_backup', 'Backup em Nuvem & Sincronização Automática', 'Sincronização em segundo plano de vendas, fechos e inventário para a nuvem.', ?, 'addon', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          `cloud_backup`,
          shouldUnlockCloudBackup ? 1 : 0
        ]);
        entitlementsChanged = true;
      } else if (currentLocalUnlockedCloudBackup !== shouldUnlockCloudBackup) {
        await db.execute(`
          UPDATE feature_entitlements 
          SET is_unlocked = ?,
              source = 'cloud_sync',
              updated_at = CURRENT_TIMESTAMP
          WHERE feature_key = 'cloud_backup'
        `, [shouldUnlockCloudBackup ? 1 : 0]);
        entitlementsChanged = true;
      }

      // 4. COMPANION APP (Acesso Remoto & Métricas em Tempo Real no Smartphone)
      let shouldUnlockCompanion = false;
      let companionExpiresAtStr: string | null = null;

      if (shopRow) {
        const isCompanionEnabled = Boolean(shopRow.companion_app_enabled);
        companionExpiresAtStr = shopRow.companion_app_expires_at || null;

        if (isCompanionEnabled) {
          if (companionExpiresAtStr) {
            const expiry = new Date(companionExpiresAtStr);
            shouldUnlockCompanion = expiry > new Date();
          } else {
            shouldUnlockCompanion = true; // Lifetime / active
          }
        }
      }

      const existingCompanionEnt = await db.select(
        'SELECT is_unlocked, expires_at FROM feature_entitlements WHERE feature_key = ?',
        ['companion_app']
      ) as any[];

      const currentLocalUnlockedCompanion = existingCompanionEnt && existingCompanionEnt.length > 0
        ? Boolean(existingCompanionEnt[0].is_unlocked)
        : false;

      if (!existingCompanionEnt || existingCompanionEnt.length === 0) {
        await db.execute(`
          INSERT INTO feature_entitlements (
            id, feature_key, name, description, is_unlocked, plan_tier, source, expires_at, unlocked_at, updated_at
          ) VALUES (?, 'companion_app', 'App Companion em Tempo Real no Telemóvel', 'Acesso móvel para acompanhamento ao vivo das métricas da loja.', ?, 'addon', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          `companion_app`,
          shouldUnlockCompanion ? 1 : 0,
          companionExpiresAtStr
        ]);
        entitlementsChanged = true;
      } else if (
        currentLocalUnlockedCompanion !== shouldUnlockCompanion ||
        existingCompanionEnt[0].expires_at !== companionExpiresAtStr
      ) {
        await db.execute(`
          UPDATE feature_entitlements 
          SET is_unlocked = ?,
              expires_at = ?,
              source = 'cloud_sync',
              updated_at = CURRENT_TIMESTAMP
          WHERE feature_key = 'companion_app'
        `, [
          shouldUnlockCompanion ? 1 : 0,
          companionExpiresAtStr
        ]);
        entitlementsChanged = true;
      }

      if (entitlementsChanged && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('subscription-entitlements-updated'));
      }
    } catch (_shopQuotaErr) {
      // [Sync Subscriptions] Suppressed for hackathon
    }

    return true;
  } catch (_err) {
    // [Sync Subscriptions] Suppressed for hackathon
    return false;
  }
}
