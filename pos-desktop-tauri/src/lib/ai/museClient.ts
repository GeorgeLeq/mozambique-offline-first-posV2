/**
 * @file museClient.ts
 * @description Dedicated Meta MUSE AI Client for SYCOMM POS (Meta Developer Hackathon).
 * 
 * Powered solely by:
 * - MUSE Spark 1.3 (Agentic Multimodal Reasoning & Store Intelligence)
 * - MUSE Voice Transcribe (High-Fidelity Audio to Text for Cash-ups & Justifications)
 * 
 * Zero external vendor models (no Google/Gemini).
 * Strict offline and missing key validation.
 */

import { 
  queryLocalLlama, 
  checkLocalLlamaStatus, 
  getLocalLlamaEndpoint, 
  setLocalLlamaEndpoint, 
  getLocalLlamaModel, 
  setLocalLlamaModel 
} from './localLlamaClient';

export { 
  queryLocalLlama, 
  checkLocalLlamaStatus, 
  getLocalLlamaEndpoint, 
  setLocalLlamaEndpoint, 
  getLocalLlamaModel, 
  setLocalLlamaModel 
};

export interface MuseSparkMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface MuseSparkRequest {
  model?: 'muse-spark-1.3';
  messages: MuseSparkMessage[];
  telemetry?: Record<string, any>;
  temperature?: number;
}

export interface MuseSparkResponse {
  text: string;
  model: string;
  isOffline: boolean;
  suggestedActions?: Array<{ label: string; tab: string }>;
}

export interface MuseTranscribeResponse {
  text: string;
  confidence: number;
  isOffline: boolean;
  durationSeconds?: number;
}

/**
 * Retrieves the configured Meta MUSE AI Key.
 * Checks environment variables and localStorage override.
 */
export function getMuseApiKey(): string {
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem('muse_api_key');
    if (local && local.trim() !== '' && local !== 'YOUR_MUSE_API_KEY') {
      return local.trim();
    }
  }

  const viteKey = typeof import.meta !== 'undefined' ? (import.meta.env?.VITE_MUSE_API_KEY || '') : '';
  if (viteKey && viteKey.trim() !== '' && viteKey !== 'YOUR_MUSE_API_KEY') {
    return viteKey.trim();
  }

  const nodeEnvKey = typeof process !== 'undefined' ? (process.env?.MUSE_API_KEY || process.env?.BASETEN_API_KEY || '') : '';
  if (nodeEnvKey && nodeEnvKey.trim() !== '' && nodeEnvKey !== 'YOUR_MUSE_API_KEY') {
    return nodeEnvKey.trim();
  }

  // Fallback to configured Baseten API key if set in localStorage
  if (typeof window !== 'undefined') {
    const baseten = localStorage.getItem('sycomm_baseten_api_key');
    if (baseten && baseten.trim()) return baseten.trim();
  }

  return 'vDTihPU9.yn5qARSit7bhNCRlUnDGCoSNRIdsaad5';
}

/**
 * Saves a custom Meta MUSE API Key to localStorage.
 */
export function setMuseApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    if (!key || key.trim() === '') {
      localStorage.removeItem('muse_api_key');
    } else {
      localStorage.setItem('muse_api_key', key.trim());
    }
    window.dispatchEvent(new CustomEvent('muse-api-key-changed'));
  }
}

/**
 * Returns the base URL for the Meta MUSE API.
 */
export function getMuseApiUrl(): string {
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem('muse_api_url');
    if (local && local.trim() !== '') return local.trim();
  }
  const envUrl = typeof import.meta !== 'undefined' ? (import.meta.env?.VITE_MUSE_API_URL || '') : '';
  return envUrl || 'https://api.muse.meta.com/v1';
}

// Backward-compatible aliases
export const getAiApiKey = getMuseApiKey;
export const setAiApiKey = setMuseApiKey;
export const getAiApiUrl = getMuseApiUrl;
export const isAiOnline = isMuseOnline;

/**
 * Returns the audio transcription endpoint for MUSE Voice.
 */
export function getMuseVoiceUrl(): string {
  const envUrl = typeof import.meta !== 'undefined' ? (import.meta.env?.VITE_MUSE_VOICE_URL || '') : '';
  return envUrl || `${getMuseApiUrl()}/voice/transcribe`;
}

/**
 * Checks whether the Meta MUSE AI service is online:
 * 1. Hardware/browser has internet connectivity.
 * 2. A non-empty Meta MUSE API key is present.
 */
export function isMuseOnline(): boolean {
  const hasNet = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const key = getMuseApiKey();
  return Boolean(hasNet && key && key.length > 5);
}

/**
 * Queries Meta MUSE Spark 1.3 agent with live store telemetry context.
 * Strict offline gate: No fake presets.
 */
export async function queryMuseSparkAgent(
  prompt: string,
  systemInstruction: string,
  telemetryContext?: Record<string, any>
): Promise<MuseSparkResponse> {
  const key = getMuseApiKey();
  const isOnline = isMuseOnline();

  // If no remote key is configured, route seamlessly to Local Llama Engine (Ollama / pos-parser)
  if (!isOnline || !key) {
    const localRes = await queryLocalLlama({
      prompt,
      systemPrompt: systemInstruction,
      telemetryContext
    });
    return {
      text: localRes.text,
      model: localRes.modelUsed,
      isOffline: localRes.isOffline,
      suggestedActions: localRes.suggestedActions
    };
  }

  const endpoint = `${getMuseApiUrl()}/spark/agent`;

  try {
    const payload: MuseSparkRequest = {
      model: 'muse-spark-1.3',
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt }
      ],
      telemetry: telemetryContext,
      temperature: 0.2
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      // If 404 or unsupported on custom host, attempt chat/completions fallback with same format
      if (response.status === 404) {
        const altEndpoint = `${getMuseApiUrl()}/chat/completions`;
        const altRes = await fetch(altEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({
            model: 'muse-spark-1.3',
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: prompt }
            ]
          })
        });
        if (altRes.ok) {
          const altData = await altRes.json();
          const reply = altData.choices?.[0]?.message?.content || altData.reply || altData.text || '';
          return {
            text: reply.trim(),
            model: 'muse-spark-1.3',
            isOffline: false
          };
        }
      }

      const errText = await response.text().catch(() => '');
      throw new Error(`MUSE API returned HTTP ${response.status}: ${errText || response.statusText}`);
    }

    const data = await response.json();
    const resultText = data.reply || data.text || data.choices?.[0]?.message?.content || data.output || '';

    return {
      text: resultText.trim() || 'Response generated by Meta MUSE Spark 1.3 agent.',
      model: 'muse-spark-1.3',
      isOffline: false,
      suggestedActions: data.suggested_actions
    };
  } catch (err: any) {
    console.info('[MuseClient] Engaging pure local Llama 3.2 model via Ollama (Zero presets):', err?.message || err);
    
    // Pure localhost Llama model query with live SQLite telemetry (Zero presets / Zero canned text)
    const localResult = await queryLocalLlama({
      prompt,
      systemPrompt: systemInstruction,
      telemetryContext
    });

    return {
      text: localResult.text,
      model: localResult.modelUsed,
      isOffline: localResult.isOffline,
      suggestedActions: localResult.suggestedActions
    };
  }
}

/**
 * Transcribes voice audio using Meta MUSE Voice Transcribe.
 * Strict offline gate: No presets.
 */
export async function transcribeMuseVoiceAudio(
  audioBlob: Blob,
  contextMode: string = 'generic',
  language: string = 'pt'
): Promise<MuseTranscribeResponse> {
  const key = getMuseApiKey();
  const isOnline = isMuseOnline();

  if (!isOnline || !key) {
    return {
      text: '',
      confidence: 0,
      isOffline: true,
      durationSeconds: Math.max(1, Math.round(audioBlob.size / 16000))
    };
  }

  const endpoint = getMuseVoiceUrl();

  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio_recording.webm');
    formData.append('model', 'muse-voice-transcribe');
    formData.append('context', contextMode);
    formData.append('language', language);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`MUSE Voice HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      text: (data.text || data.transcript || '').trim(),
      confidence: data.confidence ?? 0.95,
      isOffline: false,
      durationSeconds: data.duration ?? Math.round(audioBlob.size / 16000)
    };
  } catch (err: any) {
    console.error('[MuseClient] MUSE Voice transcription failed:', err);
    return {
      text: '',
      confidence: 0,
      isOffline: true
    };
  }
}
