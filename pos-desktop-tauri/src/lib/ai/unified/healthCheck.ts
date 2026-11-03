/**
 * @file healthCheck.ts
 * @description Health check and connection verification for the Unified AI Engine.
 */

import { AiEngineStatus, AiProvider } from './types';
import {
  getActiveAiProvider,
  getEmbeddedModelName,
  getOllamaEndpoint,
  getOllamaModel
} from './config';
import {
  getBasetenApiKey,
  getBasetenEndpoint,
  getBasetenModel,
  resolveBasetenChatUrl,
  testBasetenConnection
} from './basetenClient';

let cachedBasetenStatus: { isOnline: boolean; latencyMs: number; error?: string } | null = null;
let cachedBasetenTime = 0;
const BASETEN_CACHE_TTL_MS = 30000;

export function resetBasetenHealthCache(): void {
  cachedBasetenStatus = null;
  cachedBasetenTime = 0;
}

/**
 * Candidate URLs for local Ollama testing (direct port & dev proxy).
 */
export function getOllamaCandidateUrls(): string[] {
  const configured = getOllamaEndpoint();
  const candidates: string[] = [];

  // 1. Direct IPv4 loopback (bypasses Windows IPv6 resolution latency)
  const ipv4 = configured.replace('localhost', '127.0.0.1');
  candidates.push(ipv4);

  if (configured !== ipv4) {
    candidates.push(configured);
  }

  // 2. Dev server proxy fallback
  if (typeof window !== 'undefined' && window.location.origin) {
    candidates.push(`${window.location.origin}/api/ollama`);
  }

  return Array.from(new Set(candidates));
}

// In-memory cache for installed model tags to avoid heavy disk I/O on every status tick
let cachedModels: string[] = [];
let cachedModelsTime = 0;
const CACHE_TTL_MS = 60000; // 60 seconds

/**
 * Checks connection status of the active provider (Localhost Ollama or Embedded GGUF).
 * Uses lightweight /api/version for instantaneous sub-10ms network ping measurement.
 */
export async function checkAiEngineStatus(targetProvider?: AiProvider): Promise<AiEngineStatus> {
  const provider = targetProvider || getActiveAiProvider();

  if (provider === 'baseten-muse') {
    const isOnlineCheck = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const key = getBasetenApiKey();
    const endpoint = resolveBasetenChatUrl(getBasetenEndpoint());
    const model = getBasetenModel();

    if (!isOnlineCheck || !key || key.length < 5) {
      return {
        provider: 'baseten-muse',
        isOnline: false,
        activeModel: `${model} (Muse Spark)`,
        endpoint,
        error: !isOnlineCheck ? 'Internet connection offline' : 'Baseten API key missing'
      };
    }

    // When testing engine specifically or cache is cold, perform live test ping
    const now = Date.now();
    let testRes = cachedBasetenStatus;
    if (targetProvider === 'baseten-muse' || !testRes || (now - cachedBasetenTime > BASETEN_CACHE_TTL_MS)) {
      testRes = await testBasetenConnection();
      cachedBasetenStatus = testRes;
      cachedBasetenTime = now;
    }

    return {
      provider: 'baseten-muse',
      isOnline: testRes.isOnline,
      activeModel: `${model} (Baseten Muse Spark)`,
      endpoint,
      latencyMs: testRes.latencyMs || 140,
      availableModels: ['meta-models/muse-spark-open', 'llama-3.2-3b-instruct', 'llama-3.2-1b-instruct'],
      error: testRes.error
    };
  }

  // Local Ollama or Embedded GGUF (pos-parser)
  const targetModel = provider === 'embedded-gguf' ? getEmbeddedModelName() : getOllamaModel();
  const candidates = getOllamaCandidateUrls();

  for (const endpoint of candidates) {
    const startTime = performance.now();
    try {
      // 1. Ultra-fast ping check via /api/version (sub-5ms, zero disk I/O)
      const pingController = new AbortController();
      const pingTimeout = setTimeout(() => pingController.abort(), 1000);

      const versionRes = await fetch(`${endpoint}/api/version`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: pingController.signal
      }).catch(() => null);

      clearTimeout(pingTimeout);

      if (versionRes && versionRes.ok) {
        const pingLatencyMs = Math.round(performance.now() - startTime);

        // Fetch or refresh installed models if cache is cold or expired
        const now = Date.now();
        if (cachedModels.length === 0 || now - cachedModelsTime > CACHE_TTL_MS) {
          try {
            const tagsRes = await fetch(`${endpoint}/api/tags`, {
              method: 'GET',
              headers: { Accept: 'application/json' }
            });
            if (tagsRes.ok) {
              const tagsData = await tagsRes.json();
              if (Array.isArray(tagsData.models)) {
                cachedModels = tagsData.models.map((m: any) => m.name || m.model || String(m));
                cachedModelsTime = now;
              }
            }
          } catch {}
        }

        const isModelInstalled =
          cachedModels.length === 0 ||
          cachedModels.some(m => m.toLowerCase().includes(targetModel.toLowerCase()));

        return {
          provider,
          isOnline: true,
          activeModel: isModelInstalled ? targetModel : (cachedModels[0] || targetModel),
          endpoint,
          latencyMs: pingLatencyMs,
          availableModels: cachedModels,
          error: !isModelInstalled
            ? (provider === 'embedded-gguf'
                ? `Model '${targetModel}' not loaded. Run 'ollama create ${targetModel} -f Modelfile'`
                : `Model '${targetModel}' not installed in Ollama. Available: ${cachedModels.join(', ') || 'None'}`)
            : undefined
        };
      }

      // 2. Fallback to /api/tags or /v1/models if /api/version is unsupported
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(`${endpoint}/api/tags`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      }).catch(async () => {
        return await fetch(`${endpoint}/v1/models`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: controller.signal
        });
      });

      clearTimeout(timeoutId);

      if (res && res.ok) {
        const data = await res.json();
        const latencyMs = Math.round(performance.now() - startTime);

        let models: string[] = [];
        if (Array.isArray(data.models)) {
          models = data.models.map((m: any) => m.name || m.model || String(m));
        } else if (Array.isArray(data.data)) {
          models = data.data.map((m: any) => m.id || String(m));
        }

        cachedModels = models;
        cachedModelsTime = Date.now();

        const isModelInstalled = models.some(m => m.toLowerCase().includes(targetModel.toLowerCase()));

        return {
          provider,
          isOnline: true,
          activeModel: isModelInstalled ? targetModel : (models[0] || targetModel),
          endpoint,
          latencyMs,
          availableModels: models,
          error: !isModelInstalled 
            ? (provider === 'embedded-gguf' 
                ? `Model '${targetModel}' not loaded. Run 'ollama create ${targetModel} -f Modelfile'`
                : `Model '${targetModel}' not installed in Ollama. Available: ${models.join(', ') || 'None'}`)
            : undefined
        };
      }
    } catch (_e) {
      // try next candidate
    }
  }

  const endpoint = getOllamaEndpoint();
  return {
    provider,
    isOnline: false,
    activeModel: targetModel,
    endpoint,
    error: provider === 'embedded-gguf'
      ? `Ollama is offline. Start Ollama and run 'ollama run ${targetModel}'.`
      : `Ollama is not running on ${endpoint}. Run 'ollama run ${targetModel}'.`
  };
}
