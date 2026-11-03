/**
 * @file deliveryLimitService.ts
 * @description Offline-first quota and expected deliveries capacity enforcement.
 * Enforces dynamic limits (default 50 orders on Free plan) based on active local/cloud subscription plans.
 */

import { getDB } from '../../../lib/db';

export interface DeliveryLimitCheckResult {
  allowed: boolean;
  limit: number;
  current: number;
}

export interface DeliveryUsageSummary {
  current: number;
  limit: number;
  isAtLimit: boolean;
  isUnlimited: boolean;
  percentage: number;
}

/**
 * Checks if creating new expected delivery order(s) is permitted under the active subscription plan.
 * @param additionalCount Number of new deliveries attempting to be added (default: 1).
 */
export async function checkExpectedDeliveryLimit(additionalCount: number = 1): Promise<DeliveryLimitCheckResult> {
  try {
    const db = await getDB();

    // 1. Check active feature entitlements & tier
    const entRows = await db.select(`
      SELECT feature_key, plan_tier, is_unlocked, expires_at 
      FROM feature_entitlements 
      WHERE is_unlocked = 1
    `) as any[];

    // Filter active and unexpired entitlements
    const activeEntitlements = (entRows || []).filter(row => {
      if (!row.is_unlocked) return false;
      if (row.expires_at) {
        return new Date(row.expires_at).getTime() > Date.now();
      }
      return true;
    });

    // 2. Fetch all subscription plans locally
    let plans: any[] = [];
    try {
      plans = await db.select('SELECT * FROM subscription_plans ORDER BY price_mt ASC') as any[];
    } catch (err) {
      console.warn('[deliveryLimitService] Error reading subscription_plans:', err);
    }

    // 3. Check for any direct shop-level setting override or plan assignments synced from Supabase
    let shopOverrideLimit: number | null = null;
    let shopPlanId: string | null = null;
    let shopPlanTier: string | null = null;

    try {
      const settingRows = await db.select(
        "SELECT key, value FROM settings WHERE key IN ('max_deliveries', 'delivery_limit', 'subscription_plan_id', 'plan_id', 'plan_tier')"
      ) as { key: string; value: string }[];

      for (const r of settingRows || []) {
        if ((r.key === 'max_deliveries' || r.key === 'delivery_limit') && r.value !== undefined && r.value !== null && r.value !== '') {
          const val = parseInt(r.value, 10);
          if (!isNaN(val)) {
            shopOverrideLimit = val;
          }
        } else if (r.key === 'subscription_plan_id' || r.key === 'plan_id') {
          shopPlanId = r.value ? r.value.toLowerCase() : null;
        } else if (r.key === 'plan_tier') {
          shopPlanTier = r.value ? r.value.toLowerCase() : null;
        }
      }
    } catch (e) {
      // ignore
    }

    // Filter active paid entitlements (exclude 'free' tier)
    const activePaidEntitlements = activeEntitlements.filter(e => 
      e.plan_tier && e.plan_tier.toLowerCase() !== 'free'
    );

    const isPaidPlanFromSettings = (
      (shopPlanId && shopPlanId !== 'plan_free' && shopPlanId !== 'free') ||
      (shopPlanTier && shopPlanTier !== 'free')
    );

    let limit: number;

    // Highest Priority: Direct limit override synced from Supabase shop record or plan settings
    if (shopOverrideLimit !== null) {
      limit = shopOverrideLimit;
    } else if (activePaidEntitlements.length > 0 || isPaidPlanFromSettings) {
      const activeTier = (
        activePaidEntitlements[0]?.plan_tier || 
        shopPlanTier || 
        shopPlanId || 
        'pro'
      ).toLowerCase();

      const hasUnlimited = (
        activePaidEntitlements.some(e => e.feature_key === 'unlimited_products') ||
        activeTier === 'enterprise' ||
        activeTier === 'lifetime' ||
        activeTier === 'custom' ||
        activeTier === 'plan_pro_annual' ||
        activeTier === 'annual'
      );

      if (hasUnlimited) {
        const annualPlan = plans.find(p => p.id === 'plan_pro_annual' || p.period === 'annual');
        if (annualPlan && annualPlan.max_deliveries !== undefined && annualPlan.max_deliveries !== null && annualPlan.max_deliveries > 0) {
          limit = Number(annualPlan.max_deliveries);
        } else {
          limit = -1; // Unlimited
        }
      } else {
        // Paid monthly / quarterly / pro tier
        // Match exact plan ID, lower ID, or period
        const matchedPlan = plans.find(p => 
          p.id?.toLowerCase() === shopPlanId ||
          p.id === activePaidEntitlements[0]?.plan_tier || 
          p.id?.toLowerCase() === activeTier || 
          p.period?.toLowerCase() === activeTier
        );

        if (matchedPlan && matchedPlan.max_deliveries !== undefined && matchedPlan.max_deliveries !== null) {
          limit = Number(matchedPlan.max_deliveries);
        } else if (matchedPlan && matchedPlan.max_products !== undefined && matchedPlan.max_products !== null) {
          limit = Number(matchedPlan.max_products);
        } else {
          // Fallback to active monthly/quarterly Pro plan
          const proPlan = plans.find(p => 
            p.id === 'plan_fiados_monthly' || 
            p.id === 'plan_fiados_quarterly' || 
            p.period === 'monthly' || 
            p.period === 'quarterly'
          ) || plans.find(p => p.price_mt > 0 && p.id !== 'plan_pro_annual');

          if (proPlan && proPlan.max_deliveries !== undefined && proPlan.max_deliveries !== null) {
            limit = Number(proPlan.max_deliveries);
          } else if (proPlan && proPlan.max_products !== undefined && proPlan.max_products !== null) {
            limit = Number(proPlan.max_products);
          } else {
            limit = 500;
          }
        }
      }
    } else {
      // Free Tier:
      // Check if a free plan was defined in subscription_plans
      const freePlan = plans.find(p => 
        p.id === 'plan_free' || 
        p.id === 'free' || 
        p.price_mt === 0 || 
        p.name?.toLowerCase().includes('grátis') || 
        p.name?.toLowerCase().includes('free')
      );

      if (freePlan && freePlan.max_deliveries !== undefined && freePlan.max_deliveries !== null) {
        limit = Math.max(500, Number(freePlan.max_deliveries));
      } else {
        limit = 500;
      }
    }

    // Ensure hackathon quota is at least 500
    if (limit !== -1 && limit < 500) {
      limit = 500;
    }

    // Unlimited quota
    if (limit === -1) {
      const countRows = await db.select(
        'SELECT COUNT(*) as total FROM expected_deliveries'
      ) as { total: number }[];
      const current = countRows?.[0]?.total || 0;
      return { allowed: true, limit: -1, current };
    }

    // 4. Count current expected deliveries
    const countRows = await db.select(
      'SELECT COUNT(*) as total FROM expected_deliveries'
    ) as { total: number }[];
    const current = countRows?.[0]?.total || 0;

    const allowed = (current + additionalCount) <= limit;

    return {
      allowed,
      limit,
      current
    };
  } catch (err) {
    console.error('[deliveryLimitService] checkExpectedDeliveryLimit error:', err);
    // Fail-safe open with 500 capacity
    return { allowed: true, limit: 500, current: 0 };
  }
}

/**
 * Returns summary statistics of current expected deliveries usage and limit.
 */
export async function getExpectedDeliveryUsage(): Promise<DeliveryUsageSummary> {
  try {
    const res = await checkExpectedDeliveryLimit(0);
    const isUnlimited = res.limit === -1;
    const isAtLimit = !isUnlimited && res.current >= res.limit;
    const percentage = isUnlimited ? 0 : Math.min(100, Math.round((res.current / res.limit) * 100));

    return {
      current: res.current,
      limit: res.limit,
      isAtLimit,
      isUnlimited,
      percentage
    };
  } catch (e) {
    return {
      current: 0,
      limit: 500,
      isAtLimit: false,
      isUnlimited: false,
      percentage: 0
    };
  }
}
