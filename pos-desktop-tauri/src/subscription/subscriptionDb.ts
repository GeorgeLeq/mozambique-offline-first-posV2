/**
 * @file subscriptionDb.ts
 * @description Local SQLite and MockDB persistence for feature entitlements,
 * active subscription plans, and M-Pesa / E-Mola payment proof records.
 */

import { getDB } from '../lib/db';
import { FeatureEntitlement, FeatureKey, PaymentProofSubmission, SubscriptionPlan } from './types';
import { getPersistentDeviceId, getPersistentShopId } from './cryptoLicense';

// Default dynamic subscription plans in Meticais (Mozambique)
export const DEFAULT_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan_free',
    name: 'Plano Grátis (Base)',
    tagline: 'Funcionalidades essenciais para pequenos retalhistas',
    price_mt: 0,
    period: 'monthly',
    period_label: 'Grátis',
    features_included: ['client_debts', 'expected_deliveries'],
    max_fiado_customers: 500,
    max_products: 500,
    max_deliveries: 500,
    max_barcodes: 500,
    max_users: 10,
    advanced_audits: true,
    badge: 'Hackathon Unlocked',
    description: 'Gestão de vendas, caixa, fiados até 500 clientes, catálogo até 500 produtos, códigos de barras e encomendas até 500.'
  },
  {
    id: 'plan_fiados_monthly',
    name: 'Módulo Fiados & Clientes Pro',
    tagline: 'Expanda o limite de fiados e controle crédito sem perdas',
    price_mt: 950,
    period: 'monthly',
    period_label: '950 MT / mês',
    features_included: ['client_debts'],
    max_fiado_customers: 200,
    max_products: 500,
    max_deliveries: 500,
    max_barcodes: 500,
    max_users: 10,
    advanced_audits: false,
    is_popular: true,
    badge: 'Mais Procurado',
    description: 'Acesso completo ao Caderno de Fiados com capacidade para 200 clientes, histórico de pagamentos, limites de crédito e lembretes via WhatsApp.'
  },
  {
    id: 'plan_fiados_quarterly',
    name: 'Módulo Fiados Pro (Trimestral)',
    tagline: 'Pague 3 meses com 15% de desconto promocional',
    price_mt: 2450,
    period: 'quarterly',
    period_label: '2.450 MT / 3 meses',
    features_included: ['client_debts'],
    max_fiado_customers: 200,
    max_products: 500,
    max_deliveries: 500,
    max_barcodes: 500,
    max_users: 10,
    advanced_audits: false,
    badge: '15% Desconto',
    description: 'Pague trimestralmente via M-Pesa ou E-Mola para gerir até 200 clientes fiados sem preocupação de renovação mensal.'
  },
  {
    id: 'plan_audits_monthly',
    name: 'Módulo Auditoria Anti-Furto',
    tagline: 'Histórico minucioso de bips por operador, prevenção de quebras e auditoria de sangrias',
    price_mt: 750,
    period: 'monthly',
    period_label: '750 MT / mês',
    features_included: ['advanced_audits'],
    max_fiado_customers: 50,
    max_products: 500,
    max_deliveries: 500,
    max_barcodes: 500,
    max_users: 10,
    advanced_audits: true,
    badge: 'Anti-Furto',
    description: 'Acesso completo ao histórico detalhado de cada bip, auditoria de sangrias, relatórios de turnos com fecho cego e deteção de quebras.'
  },
  {
    id: 'plan_pro_annual',
    name: 'Pacote Pro Completo (Anual)',
    tagline: 'Todos os módulos Pro desbloqueados com suporte prioritário',
    price_mt: 8900,
    period: 'annual',
    period_label: '8.900 MT / ano',
    features_included: ['client_debts', 'expected_deliveries', 'advanced_audits', 'cloud_backup', 'unlimited_products', 'unlimited_barcodes', 'custom_permissions', 'unlimited_users'],
    max_fiado_customers: -1,
    max_products: -1,
    max_deliveries: -1,
    max_barcodes: -1,
    max_users: -1,
    advanced_audits: true,
    badge: 'Melhor Valor',
    description: 'Produtos, encomendas e fiados ilimitados, utilizadores ilimitados, controlo granular de permissões, reabastecimento a fornecedores e relatórios consolidados durante 1 ano inteiro.'
  }
];

// Initial default feature entitlements
const INITIAL_ENTITLEMENTS: FeatureEntitlement[] = [
  {
    id: 'client_debts',
    feature_key: 'client_debts',
    name: 'Gestão de Fiados & Clientes',
    description: 'Controle contas a prazo, histórico de amortizações de dívidas e limites de crédito fiado.',
    is_unlocked: true, // Free by default (up to 20 fiado customers)
    plan_tier: 'free',
    source: 'default',
    unlocked_at: new Date().toISOString(),
    expires_at: null
  },
  {
    id: 'expected_deliveries',
    feature_key: 'expected_deliveries',
    name: 'Reabastecimento & Encomendas de Fornecedores',
    description: 'Entrada de faturas com verificação de custo e conferência de mercadorias.',
    is_unlocked: true, // Free during trial/phase 1
    plan_tier: 'free',
    source: 'default',
    unlocked_at: new Date().toISOString(),
    expires_at: null
  },
  {
    id: 'advanced_audits',
    feature_key: 'advanced_audits',
    name: 'Auditoria Avançada de Caixa & Leituras',
    description: 'Histórico cronológico de bips por operador, prevenção de quebras e auditoria forense.',
    is_unlocked: false, // Locked on Free plan, unlocked with Pro / Enterprise or standalone license
    plan_tier: 'pro',
    source: 'default',
    unlocked_at: null,
    expires_at: null
  },
  {
    id: 'custom_permissions',
    feature_key: 'custom_permissions',
    name: 'Controlo Avançado de Permissões',
    description: 'Personalização e delegação granular de permissões por operador (caixas, supervisores, gerentes).',
    is_unlocked: false, // Sold separately / requires license or Pro
    plan_tier: 'pro',
    source: 'default',
    unlocked_at: null,
    expires_at: null
  },
  {
    id: 'unlimited_users',
    feature_key: 'unlimited_users',
    name: 'Operadores e Utilizadores Ilimitados',
    description: 'Cadastre operadores adicionais além do limite gratuito de 3 utilizadores.',
    is_unlocked: false, // Locked on Free plan, unlocked with upgrade
    plan_tier: 'pro',
    source: 'default',
    unlocked_at: null,
    expires_at: null
  },
  {
    id: 'cloud_backup',
    feature_key: 'cloud_backup',
    name: 'Backup em Nuvem & Sincronização Automática',
    description: 'Sincronização em segundo plano de vendas, inventário, auditorias e fechos de caixa para o Supabase.',
    is_unlocked: false, // Locked on Free plan, unlocked with Pro / Enterprise or standalone license
    plan_tier: 'pro',
    source: 'default',
    unlocked_at: null,
    expires_at: null
  },
  {
    id: 'companion_app',
    feature_key: 'companion_app',
    name: 'App Companion em Tempo Real no Telemóvel',
    description: 'Acesso remoto aos dashboards e métricas ao vivo da loja pelo smartphone do proprietário.',
    is_unlocked: false, // Controlled by companion_app_enabled & companion_app_expires_at in shops
    plan_tier: 'pro',
    source: 'default',
    unlocked_at: null,
    expires_at: null
  }
];

/**
 * Initializes tables in local SQLite and seeds initial entitlements.
 */
export async function initSubscriptionTables(): Promise<void> {
  try {
    const db = await getDB();
    
    // Create base table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price_mt REAL NOT NULL,
        period TEXT NOT NULL,
        max_fiado_customers INTEGER DEFAULT 20,
        max_products INTEGER DEFAULT 50,
        max_deliveries INTEGER DEFAULT 50,
        max_barcodes INTEGER DEFAULT 50,
        features_included TEXT,
        is_active INTEGER DEFAULT 1,
        sync_status INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Safely add any newly introduced columns to existing sqlite databases
    const columnsToAdd = [
      "max_products INTEGER DEFAULT 50",
      "max_deliveries INTEGER DEFAULT 50",
      "max_barcodes INTEGER DEFAULT 50",
      "max_users INTEGER DEFAULT 3",
      "advanced_audits INTEGER DEFAULT 0",
      "custom_permissions INTEGER DEFAULT 0",
      "unlimited_users INTEGER DEFAULT 0",
      "cloud_backup INTEGER DEFAULT 0",
      "cloud_audit_archive INTEGER DEFAULT 0",
      "addons TEXT DEFAULT '[]'",
      "tagline TEXT",
      "period_label TEXT",
      "is_popular INTEGER DEFAULT 0",
      "badge TEXT",
      "description TEXT"
    ];
    for (const col of columnsToAdd) {
      try {
        await db.execute(`ALTER TABLE subscription_plans ADD COLUMN ${col}`);
      } catch (e) {
        // Ignore column already exists errors
      }
    }

    await db.execute(`
      CREATE TABLE IF NOT EXISTS feature_entitlements (
        id TEXT PRIMARY KEY,
        feature_key TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        is_unlocked INTEGER DEFAULT 0,
        plan_tier TEXT DEFAULT 'free',
        unlocked_at DATETIME,
        expires_at DATETIME,
        source TEXT DEFAULT 'default',
        signature TEXT,
        sync_status INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS subscription_payments (
        id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        device_id TEXT,
        feature_key TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        amount_mt REAL NOT NULL,
        payment_method TEXT NOT NULL,
        reference_code TEXT NOT NULL,
        phone_number TEXT,
        screenshot_url TEXT,
        status TEXT DEFAULT 'pending',
        admin_notes TEXT,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        approved_at DATETIME,
        sync_status INTEGER DEFAULT 0
      );
    `);

    // Ensure default records exist in feature_entitlements
    for (const ent of INITIAL_ENTITLEMENTS) {
      const existing = await db.select(
        'SELECT id, is_unlocked, expires_at FROM feature_entitlements WHERE id = ?',
        [ent.id]
      ) as any[];

      if (!existing || existing.length === 0) {
        await db.execute(`
          INSERT INTO feature_entitlements (
            id, feature_key, name, description, is_unlocked, plan_tier, source, unlocked_at, expires_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          ent.id,
          ent.feature_key,
          ent.name,
          ent.description,
          ent.is_unlocked ? 1 : 0,
          ent.plan_tier,
          ent.source,
          ent.unlocked_at,
          ent.expires_at
        ]);
      }
    }

    // Retroactive migration: unlock client_debts for free on existing databases
    try {
      await db.execute(`
        UPDATE feature_entitlements 
        SET is_unlocked = 1, plan_tier = 'free', source = 'default' 
        WHERE feature_key = 'client_debts' 
          AND (source = 'default' OR source IS NULL) 
          AND (plan_tier = 'pro' OR is_unlocked = 0)
      `);
    } catch (e) {
      // ignore
    }

    // Ensure DEFAULT_PLANS exist in local subscription_plans table
    for (const plan of DEFAULT_PLANS) {
      try {
        const existingPlan = await db.select(
          'SELECT id FROM subscription_plans WHERE id = ?',
          [plan.id]
        ) as any[];

        if (!existingPlan || existingPlan.length === 0) {
          await db.execute(`
            INSERT INTO subscription_plans (
              id, name, tagline, price_mt, period, period_label,
              max_fiado_customers, max_products, max_deliveries, max_barcodes, max_users,
              advanced_audits, custom_permissions, unlimited_users, cloud_backup,
              is_popular, badge, description, features_included, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
          `, [
            plan.id,
            plan.name,
            plan.tagline || '',
            plan.price_mt,
            plan.period,
            plan.period_label,
            plan.max_fiado_customers ?? 20,
            plan.max_products ?? 50,
            plan.max_deliveries ?? 50,
            plan.max_barcodes ?? 50,
            plan.max_users ?? 3,
            plan.advanced_audits ? 1 : 0,
            plan.custom_permissions ? 1 : 0,
            plan.unlimited_users ? 1 : 0,
            plan.cloud_backup ? 1 : 0,
            plan.is_popular ? 1 : 0,
            plan.badge || '',
            plan.description || '',
            JSON.stringify(plan.features_included || [])
          ]);
        }
      } catch (pErr) {
        // ignore
      }
    }
  } catch (err) {
    console.warn('[SubscriptionDb] Table initialization warning:', err);
  }
}

/**
 * Loads all feature entitlements from SQLite.
 */
export async function loadEntitlementsFromDb(): Promise<Record<string, FeatureEntitlement>> {
  await initSubscriptionTables();
  const map: Record<string, FeatureEntitlement> = {};

  try {
    const db = await getDB();
    const rows = await db.select('SELECT * FROM feature_entitlements') as any[];
    
    if (rows && rows.length > 0) {
      for (const r of rows) {
        // Check if expired
        let isUnlocked = Boolean(r.is_unlocked);
        if (isUnlocked && r.expires_at) {
          const expTime = new Date(r.expires_at).getTime();
          if (Date.now() > expTime) {
            isUnlocked = false;
          }
        }

        map[r.feature_key] = {
          id: r.id,
          feature_key: r.feature_key,
          name: r.name,
          description: r.description,
          is_unlocked: isUnlocked,
          plan_tier: r.plan_tier,
          unlocked_at: r.unlocked_at,
          expires_at: r.expires_at,
          source: r.source,
          signature: r.signature
        };
      }
    } else {
      INITIAL_ENTITLEMENTS.forEach(e => { map[e.feature_key] = e; });
    }
  } catch (err) {
    console.warn('[SubscriptionDb] Fallback to in-memory entitlements:', err);
    INITIAL_ENTITLEMENTS.forEach(e => { map[e.feature_key] = e; });
  }

  return map;
}

/**
 * Unlocks a feature locally with duration and source.
 */
export async function unlockFeatureInDb(
  featureKey: FeatureKey | 'all_pro',
  days: number = 30,
  source: 'license_code' | 'cloud_sync' | 'trial' = 'license_code',
  signature?: string
): Promise<void> {
  const db = await getDB();
  const unlockedAt = new Date().toISOString();
  let expiresAt: string | null = null;

  if (days < 9999) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    expiresAt = d.toISOString();
  }

    const targets: FeatureKey[] = featureKey === 'all_pro' 
      ? ['client_debts', 'expected_deliveries', 'advanced_audits']
      : [featureKey];

    // Attempt to infer plan tier based on days if not provided by source (this is a fallback for offline codes)
    let impliedTier = 'pro';
    if (days === 30) impliedTier = 'plan_fiados_monthly';
    if (days === 90) impliedTier = 'plan_fiados_quarterly';
    if (days >= 365) impliedTier = 'plan_pro_annual';

    for (const fKey of targets) {
      try {
        await db.execute(`
          UPDATE feature_entitlements 
          SET is_unlocked = 1,
              plan_tier = ?,
              unlocked_at = ?,
              expires_at = ?,
              source = ?,
              signature = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE feature_key = ?
        `, [impliedTier, unlockedAt, expiresAt, source, signature || '', fKey]);
      } catch (err) {
        console.error(`[SubscriptionDb] Failed to unlock ${fKey}:`, err);
      }
    }
}

/**
 * Saves a payment proof submission record (M-Pesa or E-Mola) locally.
 */
export async function savePaymentSubmissionInDb(submission: Omit<PaymentProofSubmission, 'id' | 'submitted_at' | 'status'>): Promise<PaymentProofSubmission> {
  const db = await getDB();
  const id = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const submittedAt = new Date().toISOString();

  const record: PaymentProofSubmission = {
    ...submission,
    id,
    submitted_at: submittedAt,
    status: 'pending'
  };

  try {
    await db.execute(`
      INSERT INTO subscription_payments (
        id, shop_id, device_id, feature_key, plan_id, amount_mt,
        payment_method, reference_code, phone_number, screenshot_url,
        status, submitted_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 0)
    `, [
      record.id,
      record.shop_id,
      record.device_id,
      record.feature_key,
      record.plan_id,
      record.amount_mt,
      record.payment_method,
      record.reference_code,
      record.phone_number || '',
      record.screenshot_url || '',
      record.submitted_at
    ]);
  } catch (err) {
    console.error('[SubscriptionDb] Failed to save payment submission in SQLite:', err);
  }

  return record;
}

/**
 * Loads all subscription plans from SQLite.
 */
export async function loadPlansFromDb(): Promise<SubscriptionPlan[]> {
  await initSubscriptionTables();
  try {
    const db = await getDB();
    const rows = await db.select(
      'SELECT * FROM subscription_plans ORDER BY price_mt ASC'
    ) as any[];

    if (rows && rows.length > 0) {
      return rows.map(r => ({
        id: r.id,
        name: r.name,
        tagline: r.tagline || undefined,
        price_mt: Number(r.price_mt || 0),
        period: r.period || 'monthly',
        period_label: r.period_label || `${r.price_mt} MT`,
        max_fiado_customers: r.max_fiado_customers !== null && r.max_fiado_customers !== undefined ? Number(r.max_fiado_customers) : 500,
        max_products: r.max_products !== null && r.max_products !== undefined ? Number(r.max_products) : (r.id === 'plan_pro_annual' ? -1 : 500),
        max_deliveries: r.max_deliveries !== null && r.max_deliveries !== undefined ? Number(r.max_deliveries) : (r.id === 'plan_pro_annual' ? -1 : 500),
        max_barcodes: r.max_barcodes !== null && r.max_barcodes !== undefined ? Number(r.max_barcodes) : (r.id === 'plan_pro_annual' ? -1 : 500),
        max_users: r.max_users !== null && r.max_users !== undefined ? Number(r.max_users) : (r.id === 'plan_pro_annual' ? -1 : 10),
        advanced_audits: r.advanced_audits !== undefined && r.advanced_audits !== null 
          ? Boolean(r.advanced_audits) 
          : (r.id === 'plan_audits_monthly' || r.id === 'plan_pro_annual'),
        custom_permissions: r.custom_permissions !== undefined && r.custom_permissions !== null
          ? Boolean(r.custom_permissions)
          : (r.id === 'plan_pro_annual'),
        unlimited_users: r.unlimited_users !== undefined && r.unlimited_users !== null
          ? Boolean(r.unlimited_users)
          : (r.id === 'plan_pro_annual'),
        cloud_backup: r.cloud_backup !== undefined && r.cloud_backup !== null
          ? Boolean(r.cloud_backup)
          : (r.cloud_audit_archive !== undefined && r.cloud_audit_archive !== null ? Boolean(r.cloud_audit_archive) : r.id === 'plan_pro_annual'),
        cloud_audit_archive: r.cloud_audit_archive !== undefined && r.cloud_audit_archive !== null
          ? Boolean(r.cloud_audit_archive)
          : (r.id === 'plan_pro_annual'),
        addons: typeof r.addons === 'string' ? JSON.parse(r.addons || '[]') : (r.addons || []),
        features_included: typeof r.features_included === 'string' ? JSON.parse(r.features_included || '[]') : (r.features_included || []),
        is_popular: Boolean(r.is_popular),
        badge: r.badge || undefined,
        description: r.description || undefined,
        is_active: r.is_active !== undefined ? Boolean(r.is_active) : true
      }));
    }
  } catch (err) {
    console.warn('[SubscriptionDb] loadPlansFromDb fallback:', err);
  }
  return DEFAULT_PLANS;
}

/**
 * Loads recent payment submissions from SQLite.
 */
export async function loadPaymentSubmissionsFromDb(): Promise<PaymentProofSubmission[]> {
  try {
    const db = await getDB();
    const rows = await db.select(
      'SELECT * FROM subscription_payments ORDER BY submitted_at DESC LIMIT 20'
    ) as any[];

    if (!rows) return [];
    return rows.map(r => ({
      id: r.id,
      shop_id: r.shop_id,
      device_id: r.device_id,
      feature_key: r.feature_key,
      plan_id: r.plan_id,
      amount_mt: Number(r.amount_mt || 0),
      payment_method: r.payment_method || 'mpesa',
      reference_code: r.reference_code || '',
      phone_number: r.phone_number || '',
      screenshot_url: r.screenshot_url || '',
      status: r.status || 'pending',
      admin_notes: r.admin_notes || '',
      submitted_at: r.submitted_at,
      approved_at: r.approved_at
    }));
  } catch (err) {
    console.warn('[SubscriptionDb] Failed to load payment submissions:', err);
    return [];
  }
}
