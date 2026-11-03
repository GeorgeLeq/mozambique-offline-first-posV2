/**
 * @file config.ts
 * @description LocalStorage configuration and provider settings for the Unified AI Engine.
 */

import { AiProvider } from './types';
import { getBasetenModel } from './basetenClient';

export const STORAGE_KEY_PROVIDER = 'sycomm_ai_provider';
export const STORAGE_KEY_OLLAMA_ENDPOINT = 'sycomm_llama_endpoint';
export const STORAGE_KEY_OLLAMA_MODEL = 'sycomm_llama_model';
export const STORAGE_KEY_EMBEDDED_MODEL = 'sycomm_embedded_model';

export const DEFAULT_OLLAMA_ENDPOINT = 'http://127.0.0.1:11434';
export const DEFAULT_OLLAMA_MODEL = 'llama3.2:3b';
export const DEFAULT_EMBEDDED_MODEL = 'pos-parser';

/**
 * Returns active AI provider ('local-ollama' | 'embedded-gguf').
 */
export function getActiveAiProvider(): AiProvider {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY_PROVIDER) as AiProvider;
    if (saved === 'local-ollama' || saved === 'embedded-gguf' || saved === 'baseten-muse') {
      return saved;
    }
  }
  return 'local-ollama';
}

/**
 * Sets active AI provider.
 */
export function setActiveAiProvider(provider: AiProvider): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_PROVIDER, provider);
    window.dispatchEvent(new CustomEvent('ai-provider-changed', { detail: { provider } }));
  }
}

/**
 * Local Ollama configuration
 */
export function getOllamaEndpoint(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY_OLLAMA_ENDPOINT);
    if (saved && saved.trim()) {
      // Normalize localhost to 127.0.0.1 to avoid Windows IPv6 resolution stall (saves ~400ms)
      return saved.trim().replace('://localhost', '://127.0.0.1');
    }
  }
  return DEFAULT_OLLAMA_ENDPOINT;
}

export function setOllamaEndpoint(url: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_OLLAMA_ENDPOINT, url.trim().replace(/\/+$/, '') || DEFAULT_OLLAMA_ENDPOINT);
    window.dispatchEvent(new CustomEvent('ai-config-changed'));
  }
}

export function getOllamaModel(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY_OLLAMA_MODEL);
    if (saved && saved.trim()) return saved.trim();
  }
  return DEFAULT_OLLAMA_MODEL;
}

export function setOllamaModel(model: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_OLLAMA_MODEL, model.trim() || DEFAULT_OLLAMA_MODEL);
    window.dispatchEvent(new CustomEvent('ai-config-changed'));
  }
}

/**
 * Embedded GGUF configuration (custom pos-parser)
 */
export function getEmbeddedModelName(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY_EMBEDDED_MODEL);
    if (saved && saved.trim()) return saved.trim();
  }
  return DEFAULT_EMBEDDED_MODEL;
}

export function setEmbeddedModelName(name: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_EMBEDDED_MODEL, name.trim() || DEFAULT_EMBEDDED_MODEL);
    window.dispatchEvent(new CustomEvent('ai-config-changed'));
  }
}

/**
 * Returns formatted title and badge info for the active AI provider/model.
 */
export function getActiveAiDisplayName(): {
  title: string;
  badge: string;
  provider: AiProvider;
  model: string;
} {
  const provider = getActiveAiProvider();

  if (provider === 'embedded-gguf') {
    const model = getEmbeddedModelName();
    return {
      title: `${model} — Local GGUF`,
      badge: `📦 Embedded: ${model}`,
      provider: 'embedded-gguf',
      model
    };
  }

  if (provider === 'baseten-muse') {
    const model = getBasetenModel();
    return {
      title: `${model} — Baseten Cloud`,
      badge: '✨ Muse Spark (Baseten)',
      provider: 'baseten-muse',
      model
    };
  }

  const model = getOllamaModel();
  const cleanModel = model.includes('1b') ? 'Llama 3.2 (1B)' : 'Llama 3.2 (3B)';
  return {
    title: `${cleanModel} — Localhost Ollama`,
    badge: `🖥️ Ollama: ${model}`,
    provider: 'local-ollama',
    model
  };
}

export * from './basetenClient';

