/**
 * @file profilerStore.ts
 * @description Reactive Store Sentinel Profiler tracking 4-Lane Gears & Inference Telemetry.
 * Tracks dynamic gear shifting across:
 *  - Gear 1: Lane 1 - Creative Marketing & Promotional Copywriter (L1-MKT)
 *  - Gear 2: Lane 2 - Open CMD Chat & Broad Knowledge (L2-CMD)
 *  - Gear 3: Lane 3 - POS Stock & Operations Grounded in SQLite (L3-POS)
 *  - Gear 4: Lane 4 - Compound Router & Sequential Multi-Task Engine (L4-CMP)
 * 
 * Exposes live latency, token generation counts, eval duration, and active provider/model.
 */

import { useState, useEffect } from 'react';

export type SentinelGearNumber = 1 | 2 | 3 | 4;

export interface SentinelGearInfo {
  gear: SentinelGearNumber;
  name: string;
  shortCode: string;
  tagline: string;
  color: string; // Tailwind color class or hex
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export const SENTINEL_GEARS: Record<SentinelGearNumber, SentinelGearInfo> = {
  1: {
    gear: 1,
    name: 'Lane 1: Creative Marketing',
    shortCode: 'G1 • MKT',
    tagline: 'WhatsApp & Flyer Promo Copywriter',
    color: '#f59e0b',
    badgeBg: 'bg-amber-500/10 dark:bg-amber-500/15',
    badgeText: 'text-amber-600 dark:text-amber-400',
    badgeBorder: 'border-amber-500/30'
  },
  2: {
    gear: 2,
    name: 'Lane 2: Open CMD Chat',
    shortCode: 'G2 • CMD',
    tagline: 'Pure Knowledge & Conversational Llama',
    color: '#06b6d4',
    badgeBg: 'bg-cyan-500/10 dark:bg-cyan-500/15',
    badgeText: 'text-cyan-600 dark:text-cyan-400',
    badgeBorder: 'border-cyan-500/30'
  },
  3: {
    gear: 3,
    name: 'Lane 3: POS Operations',
    shortCode: 'G3 • POS',
    tagline: 'Exact Stock, Fiado & Cash Register in SQLite',
    color: '#10b981',
    badgeBg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    badgeText: 'text-emerald-600 dark:text-emerald-400',
    badgeBorder: 'border-emerald-500/30'
  },
  4: {
    gear: 4,
    name: 'Lane 4: Compound Router',
    shortCode: 'G4 • CMP',
    tagline: 'Multi-Task Decomposer & Sequential Queue',
    color: '#8b5cf6',
    badgeBg: 'bg-purple-500/10 dark:bg-purple-500/15',
    badgeText: 'text-purple-600 dark:text-purple-400',
    badgeBorder: 'border-purple-500/30'
  }
};

export interface ProfilerMetrics {
  timestamp: number;
  gear: SentinelGearNumber;
  gearName: string;
  model: string;
  provider: 'local-ollama' | 'embedded-gguf' | 'baseten-muse' | 'system';
  latencyMs: number;
  evalDuration?: string;
  promptTokens?: number;
  generatedTokens?: number;
  toolsReturned?: number;
  toolNames?: string[];
  queryExcerpt?: string;
  isOnlineFallback?: boolean;
}

// In-memory singletons for zero-lag updates
let activeGear: SentinelGearNumber = 3; // Default to POS Operations
let latestMetrics: ProfilerMetrics = {
  timestamp: Date.now(),
  gear: 3,
  gearName: SENTINEL_GEARS[3].name,
  model: 'pos-parser (Llama 3.2 1B)',
  provider: 'local-ollama',
  latencyMs: 42,
  evalDuration: '38ms',
  promptTokens: 110,
  generatedTokens: 24,
  toolsReturned: 0,
  queryExcerpt: 'System Ready'
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach(fn => {
    try {
      fn();
    } catch (e) {
      console.error('[ProfilerStore] Listener error:', e);
    }
  });
}

/**
 * Shifts Store Sentinel into a specific lane/gear.
 * Called immediately when a user query is classified.
 */
export function setProfilerGear(gear: SentinelGearNumber, queryExcerpt?: string) {
  if (activeGear !== gear || queryExcerpt) {
    activeGear = gear;
    latestMetrics = {
      ...latestMetrics,
      timestamp: Date.now(),
      gear,
      gearName: SENTINEL_GEARS[gear].name,
      queryExcerpt: queryExcerpt ? queryExcerpt.slice(0, 45) : latestMetrics.queryExcerpt
    };
    notifyListeners();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sentinel-gear-changed', {
        detail: { gear, gearInfo: SENTINEL_GEARS[gear] }
      }));
    }
  }
}

/**
 * Records telemetry metrics after neural inference finishes.
 */
export function recordProfilerMetrics(metrics: Partial<ProfilerMetrics>) {
  const gear = metrics.gear || activeGear;
  latestMetrics = {
    ...latestMetrics,
    ...metrics,
    timestamp: Date.now(),
    gear,
    gearName: SENTINEL_GEARS[gear].name
  };
  notifyListeners();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sentinel-profiler-updated', {
      detail: latestMetrics
    }));
  }
}

/**
 * Returns current snapshot of Store Sentinel Profiler.
 */
export function getProfilerSnapshot() {
  return {
    activeGear,
    gearInfo: SENTINEL_GEARS[activeGear],
    latestMetrics
  };
}

/**
 * React hook to subscribe to Store Sentinel Profiler changes in real time.
 */
export function useStoreSentinelProfiler() {
  const [snapshot, setSnapshot] = useState(getProfilerSnapshot);

  useEffect(() => {
    const handleChange = () => {
      setSnapshot(getProfilerSnapshot());
    };
    listeners.add(handleChange);
    return () => {
      listeners.delete(handleChange);
    };
  }, []);

  return snapshot;
}
