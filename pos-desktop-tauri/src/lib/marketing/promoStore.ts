/**
 * @file promoStore.ts
 * @description Local persistent store for In-Store Marketing & Customer Display Promotional Banners.
 * 
 * Rules:
 * 1. Downloaded/saved images are persisted locally in localStorage so they remain 100% available offline.
 * 2. Stays active indefinitely even when offline (Llama 3.2 1B) until the user explicitly removes it from Sentinel Chat.
 * 3. Live broadcasts to Customer Display only when the user clicks 'Save & Broadcast'.
 */

export interface BroadcastPromoBanner {
  id: string;
  title: string;
  subtitle: string;
  price_mt: number;
  original_price_mt: number;
  badge: string;
  category: string;
  tagline: string;
  imageUrl?: string;
  bgGradient?: string;
  createdAt: number;
  isLive: boolean;
}

const STORAGE_KEY_PROMO = 'balcaopos_broadcast_promo_banner';
const PROMO_CHANNEL_NAME = 'balcaopos_promo_broadcast_channel';

// Default initial banner for Mozambican retail
export const DEFAULT_PROMO_BANNER: BroadcastPromoBanner = {
  id: 'promo-default-arroz',
  title: 'Arroz Mariana 25kg Especial',
  subtitle: 'Grão longo e soltinho, super poupança para a família moçambicana',
  price_mt: 1450,
  original_price_mt: 1650,
  badge: 'SUPER PREÇO',
  category: 'Mercearia Básica',
  tagline: 'Oferta especial de hoje na loja',
  bgGradient: 'from-amber-600 via-orange-600 to-amber-700',
  createdAt: Date.now(),
  isLive: true
};

let promoChannel: BroadcastChannel | null = null;

function getPromoChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (!promoChannel && 'BroadcastChannel' in window) {
    try {
      promoChannel = new BroadcastChannel(PROMO_CHANNEL_NAME);
    } catch {
      // Fallback to storage event
    }
  }
  return promoChannel;
}

/**
 * Returns the currently active broadcast promotional banner, or null if removed.
 */
export function getActiveBroadcastPromo(): BroadcastPromoBanner | null {
  if (typeof window === 'undefined') return DEFAULT_PROMO_BANNER;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROMO);
    if (raw === 'NONE') return null;
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('[PromoStore] Failed to read broadcast banner:', e);
  }
  return DEFAULT_PROMO_BANNER;
}

/**
 * Saves and broadcasts a promotional banner to the customer display.
 * This is ONLY called when the user clicks 'Save & Broadcast' in Sentinel Chat.
 */
export function saveAndBroadcastPromo(
  banner: Omit<BroadcastPromoBanner, 'createdAt' | 'isLive'>
): BroadcastPromoBanner {
  const completeBanner: BroadcastPromoBanner = {
    ...banner,
    createdAt: Date.now(),
    isLive: true
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_PROMO, JSON.stringify(completeBanner));
    } catch (e) {
      console.error('[PromoStore] Failed to store broadcast banner:', e);
    }

    // Broadcast across windows / PiP
    const channel = getPromoChannel();
    if (channel) {
      try {
        channel.postMessage({ type: 'PROMO_BROADCAST', payload: completeBanner });
      } catch {}
    }

    window.dispatchEvent(new CustomEvent('promo-broadcast-updated', { detail: completeBanner }));
  }

  return completeBanner;
}

/**
 * Removes the currently broadcast banner from the Customer Display.
 * Triggered from Sentinel Chat when requested by user.
 */
export function removeBroadcastPromo(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_PROMO, 'NONE');
    } catch {}

    const channel = getPromoChannel();
    if (channel) {
      try {
        channel.postMessage({ type: 'PROMO_BROADCAST', payload: null });
      } catch {}
    }

    window.dispatchEvent(new CustomEvent('promo-broadcast-updated', { detail: null }));
  }
}

/**
 * Resets back to default system promotional banner.
 */
export function resetBroadcastPromoToDefault(): BroadcastPromoBanner {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY_PROMO);
    } catch {}

    const channel = getPromoChannel();
    if (channel) {
      try {
        channel.postMessage({ type: 'PROMO_BROADCAST', payload: DEFAULT_PROMO_BANNER });
      } catch {}
    }

    window.dispatchEvent(new CustomEvent('promo-broadcast-updated', { detail: DEFAULT_PROMO_BANNER }));
  }
  return DEFAULT_PROMO_BANNER;
}

/**
 * Subscribes to changes to the active promotional banner.
 */
export function subscribeToBroadcastPromo(
  callback: (banner: BroadcastPromoBanner | null) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleCustomEvent = (e: any) => {
    callback(e.detail ?? null);
  };

  const handleChannelMsg = (event: MessageEvent) => {
    if (event.data && event.data.type === 'PROMO_BROADCAST') {
      callback(event.data.payload);
    }
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY_PROMO) {
      if (event.newValue === 'NONE') {
        callback(null);
      } else if (event.newValue) {
        try {
          callback(JSON.parse(event.newValue));
        } catch {}
      } else {
        callback(DEFAULT_PROMO_BANNER);
      }
    }
  };

  window.addEventListener('promo-broadcast-updated', handleCustomEvent);
  window.addEventListener('storage', handleStorage);
  const ch = getPromoChannel();
  if (ch) ch.addEventListener('message', handleChannelMsg);

  return () => {
    window.removeEventListener('promo-broadcast-updated', handleCustomEvent);
    window.removeEventListener('storage', handleStorage);
    if (ch) ch.removeEventListener('message', handleChannelMsg);
  };
}
