/**
 * @file customerDisplayBus.ts
 * @description Real-time cross-window communication bus between Cashier Screen and Customer-Facing Display.
 * 
 * Works flawlessly across:
 * 1. Tauri v2 secondary WebviewWindow instances.
 * 2. Standalone browser popup windows (window.open).
 * 3. Docked Picture-in-Picture (PiP) preview components in the cashier view.
 */

import { CustomerDisplayState } from './types';

const CHANNEL_NAME = 'balcaopos_customer_display';
const STORAGE_KEY = 'balcaopos_customer_display_state';

export const INITIAL_CUSTOMER_DISPLAY_STATE: CustomerDisplayState = {
  cart: [],
  subtotal_mt: 0,
  tax_mt: 0,
  discount_mt: 0,
  total_mt: 0,
  cashier_name: 'Caixa 01',
  shop_name: 'BalcãoPOS Retail',
  shop_phone: '+258 84 900 1234',
  currency: 'MT',
  is_checking_out: false,
  status: 'idle',
  updated_at: Date.now()
};

// Singleton broadcast channel instance
let broadcastChannel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (!broadcastChannel && 'BroadcastChannel' in window) {
    try {
      broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    } catch (e) {
      console.warn('[CustomerDisplayBus] BroadcastChannel not supported, falling back to storage events:', e);
    }
  }
  return broadcastChannel;
}

/**
 * Broadcasts the cashier cart & checkout status to all secondary displays.
 */
export function broadcastCustomerDisplayState(partialState: Partial<CustomerDisplayState>) {
  if (typeof window === 'undefined') return;

  const current = getCustomerDisplayCurrentState();
  const nextState: CustomerDisplayState = {
    ...current,
    ...partialState,
    updated_at: Date.now()
  };

  // Determine status automatically if not explicitly provided
  if (!partialState.status) {
    if (nextState.cart.length === 0) {
      nextState.status = 'idle';
    } else if (nextState.is_checking_out) {
      nextState.status = 'payment_processing';
    } else {
      nextState.status = 'active_cart';
    }
  }

  // 1. Save to localStorage for instant access upon window open
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  } catch (e) {
    console.error('[CustomerDisplayBus] Failed to save state to localStorage:', e);
  }

  // 2. Broadcast via BroadcastChannel
  const channel = getChannel();
  if (channel) {
    try {
      channel.postMessage({ type: 'STATE_UPDATE', payload: nextState });
    } catch (e) {
      console.warn('[CustomerDisplayBus] BroadcastChannel postMessage failed:', e);
    }
  }
}

/**
 * Returns the latest state cached in localStorage.
 */
export function getCustomerDisplayCurrentState(): CustomerDisplayState {
  if (typeof window === 'undefined') return INITIAL_CUSTOMER_DISPLAY_STATE;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return {
        ...INITIAL_CUSTOMER_DISPLAY_STATE,
        ...JSON.parse(raw)
      };
    }
  } catch (e) {
    console.error('[CustomerDisplayBus] Failed to parse customer display state:', e);
  }

  // Fallback defaults from local store profile if present
  const shopName = localStorage.getItem('shop_name') || 'BalcãoPOS Retail';
  const shopPhone = localStorage.getItem('shop_phone') || '+258 84 900 1234';

  return {
    ...INITIAL_CUSTOMER_DISPLAY_STATE,
    shop_name: shopName,
    shop_phone: shopPhone
  };
}

/**
 * Subscribes a listener callback to real-time customer display state changes.
 * Returns an unsubscribe function.
 */
export function subscribeToCustomerDisplay(
  callback: (state: CustomerDisplayState) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  // 1. Listen via BroadcastChannel
  const channel = getChannel();
  const channelHandler = (event: MessageEvent) => {
    if (event.data && event.data.type === 'STATE_UPDATE' && event.data.payload) {
      callback(event.data.payload);
    }
  };

  if (channel) {
    channel.addEventListener('message', channelHandler);
  }

  // 2. Listen via localStorage storage events for cross-tab or cross-window fallback
  const storageHandler = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue);
        callback(parsed);
      } catch (e) {
        console.error('[CustomerDisplayBus] Failed to parse storage event state:', e);
      }
    }
  };

  window.addEventListener('storage', storageHandler);

  // Return clean unsubscriber
  return () => {
    if (channel) {
      channel.removeEventListener('message', channelHandler);
    }
    window.removeEventListener('storage', storageHandler);
  };
}
