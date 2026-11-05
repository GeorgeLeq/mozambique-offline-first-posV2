/**
 * @file basetenClient.ts
 * @description Online Neural Fallback Client powered by Meta Llama on Baseten (Muse Spark 1.3).
 * Seamlessly provides cloud reasoning fallback when local Ollama is offline or warming up.
 * 
 * Strict Offline-First Rule:
 * All store state, sales, and fiado remain in local SQLite. Baseten is ONLY used as a high-speed
 * neural fallback proxy when internet is available and local Ollama is unreachable.
 */

import { ChatHistoryTurn, UnifiedAiChatResult } from './types';
import { recordProfilerMetrics } from './profilerStore';

export const STORAGE_KEY_BASETEN_KEY = 'sycomm_baseten_api_key';
export const STORAGE_KEY_BASETEN_ENDPOINT = 'sycomm_baseten_endpoint';
export const STORAGE_KEY_BASETEN_MODEL = 'sycomm_baseten_model';

// User-provided API key from Baseten
export const DEFAULT_BASETEN_API_KEY = '';
export const DEFAULT_BASETEN_ENDPOINT = '';
export const DEFAULT_BASETEN_MODEL = 'meta-models/muse-spark-open';

/**
 * Normalizes any Baseten OpenAI-compatible base URL or endpoint into the full /chat/completions URL.
 * Handles cases where the user inputs:
 *  - "https://inference.baseten.co/v1" -> "https://inference.baseten.co/v1/chat/completions"
 *  - "https://inference.baseten.co/v1/" -> "https://inference.baseten.co/v1/chat/completions"
 *  - "https://inference.baseten.co" -> "https://inference.baseten.co/v1/chat/completions"
 *  - "https://inference.baseten.co/v1/chat/completions" -> "https://inference.baseten.co/v1/chat/completions"
 *  - "https://bridge.baseten.co/v1" -> "https://inference.baseten.co/v1/chat/completions"
 */
export function resolveBasetenChatUrl(rawEndpoint: string): string {
  let url = (rawEndpoint || '').trim();
  if (!url) {
    url = DEFAULT_BASETEN_ENDPOINT;
  }
  // Trim trailing slashes
  url = url.replace(/\/+$/, '');

  // Migrate legacy bridge domain to official inference endpoint
  if (url.includes('bridge.baseten.co')) {
    url = url.replace('bridge.baseten.co', 'inference.baseten.co');
  }

  if (url.endsWith('/chat/completions')) {
    return url;
  }
  if (url.endsWith('/v1')) {
    return `${url}/chat/completions`;
  }
  if (url.includes('/v1/')) {
    return `${url.split('/v1/')[0]}/v1/chat/completions`;
  }
  return `${url}/v1/chat/completions`;
}

export function getBasetenApiKey(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY_BASETEN_KEY);
    if (saved && saved.trim()) return saved.trim();
  }
  const envKey = typeof import.meta !== 'undefined' ? (import.meta.env?.VITE_BASETEN_API_KEY || import.meta.env?.VITE_MUSE_API_KEY) : '';
  if (envKey && envKey.trim()) return envKey.trim();
  return DEFAULT_BASETEN_API_KEY;
}

export function setBasetenApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    if (!key || !key.trim()) {
      localStorage.removeItem(STORAGE_KEY_BASETEN_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY_BASETEN_KEY, key.trim());
    }
    window.dispatchEvent(new CustomEvent('ai-config-changed'));
  }
}

export function getBasetenEndpoint(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY_BASETEN_ENDPOINT);
    if (saved && saved.trim()) {
      if (saved.includes('bridge.baseten.co')) {
        return DEFAULT_BASETEN_ENDPOINT;
      }
      return resolveBasetenChatUrl(saved.trim());
    }
  }
  return DEFAULT_BASETEN_ENDPOINT;
}

export function setBasetenEndpoint(url: string): void {
  if (typeof window !== 'undefined') {
    const resolved = resolveBasetenChatUrl(url.trim() || DEFAULT_BASETEN_ENDPOINT);
    localStorage.setItem(STORAGE_KEY_BASETEN_ENDPOINT, resolved);
    window.dispatchEvent(new CustomEvent('ai-config-changed'));
  }
}

export function getBasetenModel(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY_BASETEN_MODEL);
    if (saved && saved.trim()) {
      // Auto-migrate legacy placeholder model names to official Muse Spark open weights model
      if (saved.trim() === 'llama-3.2-3b-instruct' || saved.trim() === 'llama-3.2-1b-instruct') {
        return DEFAULT_BASETEN_MODEL;
      }
      return saved.trim();
    }
  }
  return DEFAULT_BASETEN_MODEL;
}

export function setBasetenModel(model: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_BASETEN_MODEL, model.trim() || DEFAULT_BASETEN_MODEL);
    window.dispatchEvent(new CustomEvent('ai-config-changed'));
  }
}

export function isBasetenOnline(): boolean {
  const hasNet = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const key = getBasetenApiKey();
  return Boolean(hasNet && key && key.length > 8);
}

/**
 * Lightweight test ping to check if the Baseten API key and endpoint are working.
 */
export async function testBasetenConnection(): Promise<{ isOnline: boolean; latencyMs: number; error?: string }> {
  const apiKey = getBasetenApiKey();
  const endpoint = resolveBasetenChatUrl(getBasetenEndpoint());
  const model = getBasetenModel();

  if (!apiKey || apiKey.length < 5) {
    return { isOnline: false, latencyMs: 0, error: 'Baseten API key is missing' };
  }

  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    // 1. Try standard OpenAI-compatible header: Authorization: Bearer <key>
    let res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5
      })
    });

    // 2. Retry with Api-Key if 401 or 403
    if (res.status === 401 || res.status === 403) {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Api-Key ${apiKey}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5
        })
      });
    }

    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);

    if (res.ok) {
      return { isOnline: true, latencyMs };
    }

    const errText = await res.text().catch(() => '');
    return {
      isOnline: false,
      latencyMs,
      error: `HTTP ${res.status}: ${errText.slice(0, 150) || res.statusText}`
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      isOnline: false,
      latencyMs,
      error: err?.name === 'AbortError' ? 'Connection timeout (8s)' : (err?.message || 'Network error')
    };
  }
}

/**
 * Queries the Baseten / Muse Spark online fallback endpoint.
 * Accurately conforms to OpenAI chat completions standard at /v1/chat/completions.
 */
export async function queryBasetenFallback(options: {
  prompt: string;
  systemPrompt?: string;
  chatHistory?: ChatHistoryTurn[];
  temperature?: number;
}): Promise<UnifiedAiChatResult> {
  const { prompt, systemPrompt, chatHistory = [], temperature = 0.5 } = options;
  const apiKey = getBasetenApiKey();
  const rawEndpoint = getBasetenEndpoint();
  const endpoint = resolveBasetenChatUrl(rawEndpoint);
  const model = getBasetenModel();
  const startTime = performance.now();

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

  if (systemPrompt && systemPrompt.trim()) {
    messages.push({ role: 'system', content: systemPrompt.trim() });
  }

  if (chatHistory.length > 0) {
    for (const h of chatHistory.slice(-4)) {
      messages.push({ role: h.role, content: h.content.trim() });
    }
  }

  messages.push({ role: 'user', content: prompt.trim() });

  console.log(
    `%c[Store Sentinel Profiler] ⚡ Cloud Fallback (Baseten Muse Spark) -> ${endpoint}`,
    'color: #8b5cf6; font-weight: bold;'
  );

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    // 1. Standard OpenAI specification: Authorization: Bearer <API_KEY>
    let res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: 800
      })
    });

    // 2. If 401/403 with Bearer, attempt Api-Key header
    if (res.status === 401 || res.status === 403) {
      console.warn('[BasetenClient] Bearer auth returned', res.status, '- retrying with Api-Key header...');
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Api-Key ${apiKey}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: 800
        })
      });
    }

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Baseten HTTP ${res.status}: ${errText || res.statusText}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || data.output || data.text || '';
    const latencyMs = Math.round(performance.now() - startTime);

    recordProfilerMetrics({
      model: `Muse Spark (${model})`,
      provider: 'baseten-muse',
      latencyMs,
      evalDuration: `${latencyMs}ms`,
      promptTokens: data.usage?.prompt_tokens,
      generatedTokens: data.usage?.completion_tokens,
      isOnlineFallback: true
    });

    return {
      text: text.trim(),
      provider: 'baseten-muse',
      modelUsed: `Muse Spark (${model})`,
      isOffline: false,
      latencyMs
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);
    console.warn('[BasetenClient] Fallback request failed:', err?.message || err);

    throw err;
  }
}
