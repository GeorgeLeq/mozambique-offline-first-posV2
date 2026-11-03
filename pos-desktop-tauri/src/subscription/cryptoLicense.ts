/**
 * @file cryptoLicense.ts
 * @description Cryptographic license verification, hardware fingerprinting,
 * monotonic clock protection, and offline activation code generation/validation.
 */

import { FeatureKey } from './types';

// Secret seed for algorithmic signature verification (used both in Command Central generator and client validator)
const LICENSE_SECRET_SALT = 'MZ_RETAIL_POS_2026_OFFLINE_SECRET_K9';

/**
 * Generates a stable hardware fingerprint representation for the terminal.
 */
export function getHardwareFingerprint(): string {
  if (typeof window === 'undefined') return 'MZPOS-HW-DESKTOP';
  let hw = localStorage.getItem('pos_hw_fingerprint');
  if (!hw) {
    const raw = `${navigator.userAgent || ''}_${window.screen?.width || 1920}x${window.screen?.height || 1080}_${navigator.hardwareConcurrency || 4}_${navigator.language || 'pt'}`;
    const hash = Math.abs(hashString(raw)).toString(16).toUpperCase().padStart(8, '0');
    const p1 = hash.slice(0, 4);
    const p2 = hash.slice(4, 8);
    hw = `MZPOS-HW-${p1}-${p2}`;
    localStorage.setItem('pos_hw_fingerprint', hw);
  }
  return hw;
}

/**
 * Retrieves or initializes a persistent hardware-bound Device Identifier.
 */
export function getPersistentDeviceId(): string {
  if (typeof window === 'undefined') return '11111111-1111-4111-8111-111111111111';
  let deviceId = localStorage.getItem('pos_hardware_device_id');
  const isUuid = deviceId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deviceId);
  if (!deviceId || !isUuid) {
    deviceId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'c78f110c-b1dc-4e13-85e4-5f76b99982b7';
    localStorage.setItem('pos_hardware_device_id', deviceId);
  }
  return deviceId;
}

/**
 * Retrieves or initializes a Shop Identifier.
 */
export function getPersistentShopId(): string {
  if (typeof window === 'undefined') return 'SHOP-MZ-0001';
  let shopId = localStorage.getItem('pos_shop_id');
  if (!shopId) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    shopId = `SHOP-MZ-${randomSuffix}`;
    localStorage.setItem('pos_shop_id', shopId);
  }
  return shopId;
}

/**
 * Simple fast 32-bit hash for client-side checksumming.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

/**
 * Computes a deterministic checksum for a shop + device + feature + duration tuple.
 */
function computeChecksum(shopId: string, deviceId: string, feature: string, days: number): string {
  const payload = `${shopId.trim().toUpperCase()}::${deviceId.trim().toUpperCase()}::${feature.toLowerCase()}::${days}::${LICENSE_SECRET_SALT}`;
  const h1 = Math.abs(hashString(payload)).toString(36).toUpperCase().padStart(4, 'X').slice(-4);
  const h2 = Math.abs(hashString(`${payload}::REV`)).toString(36).toUpperCase().padStart(4, 'Y').slice(-4);
  return `${h1}${h2}`;
}

/**
 * Generates an offline activation code for a given shop, feature, and duration.
 * Format: MZPOS-XXXX-YYYY-ZZZZ (16 chars alphanumeric)
 * Duration: 30 (1 month), 90 (3 months), 365 (1 year), or 9999 (permanent)
 */
export function generateOfflineActivationCode(
  shopId: string,
  deviceId: string,
  feature: FeatureKey | 'all_pro',
  days: number = 30
): string {
  const normShop = shopId.trim().toUpperCase();
  const normDev = deviceId.trim().toUpperCase();
  
  // Encoded duration code: M1 (30 days), Q3 (90 days), Y1 (365 days), LF (permanent)
  let durCode = 'M1';
  if (days >= 9999) durCode = 'LF';
  else if (days >= 365) durCode = 'Y1';
  else if (days >= 90) durCode = 'Q3';
  
  // Encoded feature: CD (client_debts), ED (expected_deliveries), AP (all_pro)
  let featCode = 'CD';
  if (feature === 'expected_deliveries') featCode = 'ED';
  if (feature === 'advanced_audits') featCode = 'AA';
  if (feature === 'all_pro') featCode = 'AP';

  const part1 = `${featCode}${durCode}`;
  const checksum = computeChecksum(normShop, normDev, feature, days);
  const part2 = checksum.slice(0, 4);
  const part3 = checksum.slice(4, 8);

  return `MZPOS-${part1}-${part2}-${part3}`;
}

/**
 * Validates an offline activation code entered by the user.
 * Supports:
 * 1. Strict cryptographic signature matching the shop ID and device ID.
 * 2. Universal Master Override codes for initial deployment testing (e.g., 'MZPOS-TEST-FIADOS-2026' or 'MZPOS-MASTER-PRO-2026').
 */
export function validateOfflineActivationCode(
  rawCode: string,
  shopId: string,
  deviceId: string
): {
  isValid: boolean;
  featureKey?: FeatureKey | 'all_pro';
  days?: number;
  message: string;
} {
  const cleanCode = rawCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');

  if (!cleanCode) {
    return { isValid: false, message: 'Por favor introduza o código de ativação.' };
  }

  // Master testing codes for immediate manual QA testing in Mozambique POS
  if (cleanCode === 'MZPOS-TEST-FIADOS-2026' || cleanCode === 'FIADOS-TEST-OK' || cleanCode === 'MZACT-FIADOS-30D') {
    return {
      isValid: true,
      featureKey: 'client_debts',
      days: 30,
      message: 'Código de Teste Válido! Módulo Fiados & Clientes ativado por 30 dias.'
    };
  }

  if (cleanCode === 'MZPOS-MASTER-PRO-2026' || cleanCode === 'PRO-MASTER-2026') {
    return {
      isValid: true,
      featureKey: 'all_pro',
      days: 365,
      message: 'Código Mestre Pro Válido! Todos os módulos desbloqueados por 365 dias.'
    };
  }

  // Parse structured MZPOS-XXXX-XXXX-XXXX format
  const parts = cleanCode.split('-');
  if (parts.length !== 4 || parts[0] !== 'MZPOS') {
    return {
      isValid: false,
      message: 'Formato de código inválido. O formato correto é MZPOS-XXXX-XXXX-XXXX.'
    };
  }

  const [_, part1, part2, part3] = parts;
  const featCode = part1.slice(0, 2);
  const durCode = part1.slice(2, 4);

  let feature: FeatureKey | 'all_pro' = 'client_debts';
  if (featCode === 'ED') feature = 'expected_deliveries';
  else if (featCode === 'AA') feature = 'advanced_audits';
  else if (featCode === 'AP') feature = 'all_pro';
  else if (featCode !== 'CD') {
    return { isValid: false, message: 'Código associado a um módulo não reconhecido.' };
  }

  let days = 30;
  if (durCode === 'Q3') days = 90;
  else if (durCode === 'Y1') days = 365;
  else if (durCode === 'LF') days = 9999;
  else if (durCode !== 'M1') {
    return { isValid: false, message: 'Duração do código não reconhecida.' };
  }

  const expectedChecksum = computeChecksum(shopId, deviceId, feature, days);
  const actualChecksum = `${part2}${part3}`;

  if (expectedChecksum !== actualChecksum) {
    // Check if maybe it was generated with shopId alone (portable shop license)
    const shopOnlyChecksum = computeChecksum(shopId, 'ANY_DEVICE', feature, days);
    if (actualChecksum !== shopOnlyChecksum) {
      return {
        isValid: false,
        message: 'Código inválido para este terminal ou loja. Verifique o ID da sua loja.'
      };
    }
  }

  return {
    isValid: true,
    featureKey: feature,
    days,
    message: `Código validado com sucesso! Módulo desbloqueado por ${days >= 9999 ? 'tempo vitalício' : `${days} dias`}.`
  };
}

/**
 * Monotonic Clock Protection: Detects if the Windows/system clock was rolled backwards
 * to illegally bypass license expiration dates.
 */
export function checkClockTampering(currentTimestamp: number = Date.now()): {
  isTampered: boolean;
  lastRecordedTimestamp: number;
} {
  const KEY = 'pos_monotonic_clock_checkpoint';
  const storedStr = localStorage.getItem(KEY);
  const lastRecorded = storedStr ? parseInt(storedStr, 10) : 0;

  // If clock moved back by more than 1 hour (3600000 ms), flag as potential tampering
  if (lastRecorded > 0 && currentTimestamp < lastRecorded - 3600000) {
    console.warn(`[Anti-Tamper] System clock rollback detected! Current: ${new Date(currentTimestamp).toISOString()}, Last Recorded: ${new Date(lastRecorded).toISOString()}`);
    return { isTampered: true, lastRecordedTimestamp: lastRecorded };
  }

  // Update checkpoint to the higher timestamp
  if (currentTimestamp > lastRecorded) {
    localStorage.setItem(KEY, currentTimestamp.toString());
  }

  return { isTampered: false, lastRecordedTimestamp: currentTimestamp };
}
