/**
 * @file localLlamaClient.ts
 * @description Pure Localhost Llama 3.2 Integration for SYCOMM POS (Offline-First).
 * Bridges seamlessly into unified multi-provider engine (Localhost Ollama, Embedded GGUF).
 */

import { 
  queryUnifiedAiEngine, 
  checkAiEngineStatus, 
  getOllamaEndpoint, 
  setOllamaEndpoint, 
  getOllamaModel, 
  setOllamaModel,
  AiEngineStatus,
  UnifiedAiChatResult
} from './unifiedAiClient';

export * from './unifiedAiClient';

export interface LocalLlamaStatus {
  isOnline: boolean;
  activeModel: string;
  availableModels: string[];
  endpoint: string;
  latencyMs?: number;
  error?: string;
}

export interface LocalLlamaChatResult {
  text: string;
  modelUsed: string;
  isOffline: boolean;
  latencyMs: number;
  suggestedActions?: Array<{ label: string; tab: string }>;
  toolCalls?: Array<{ name: string; arguments: Record<string, any> }>;
}

export function getLocalLlamaEndpoint(): string {
  return getOllamaEndpoint();
}

export function setLocalLlamaEndpoint(url: string): void {
  setOllamaEndpoint(url);
}

export function getLocalLlamaModel(): string {
  return getOllamaModel();
}

export function setLocalLlamaModel(model: string): void {
  setOllamaModel(model);
}

/**
 * Checks connection status of the active AI engine.
 */
export async function checkLocalLlamaStatus(): Promise<LocalLlamaStatus> {
  const status: AiEngineStatus = await checkAiEngineStatus();
  return {
    isOnline: status.isOnline,
    activeModel: status.activeModel,
    availableModels: status.availableModels || [],
    endpoint: status.endpoint,
    latencyMs: status.latencyMs,
    error: status.error
  };
}

/**
 * Queries the active AI engine (Local Ollama or Embedded GGUF pos-parser).
 */
export async function queryLocalLlama(options: {
  prompt: string;
  systemPrompt?: string;
  telemetryContext?: Record<string, any>;
  temperature?: number;
  tools?: any[];
  format?: 'json' | string;
}): Promise<LocalLlamaChatResult> {
  const res: UnifiedAiChatResult = await queryUnifiedAiEngine(options);
  return {
    text: res.text,
    modelUsed: res.modelUsed,
    isOffline: res.isOffline,
    latencyMs: res.latencyMs,
    suggestedActions: res.suggestedActions,
    toolCalls: res.toolCalls
  };
}
