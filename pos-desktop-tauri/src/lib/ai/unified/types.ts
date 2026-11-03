/**
 * @file types.ts
 * @description Type definitions for the Unified AI Engine.
 */

export type AiProvider = 'local-ollama' | 'embedded-gguf' | 'baseten-muse';

export interface AiEngineStatus {
  provider: AiProvider;
  isOnline: boolean;
  activeModel: string;
  endpoint: string;
  latencyMs?: number;
  availableModels?: string[];
  error?: string;
}

export interface LlamaToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface UnifiedAiChatResult {
  text: string;
  provider: AiProvider;
  modelUsed: string;
  isOffline: boolean;
  latencyMs: number;
  suggestedActions?: Array<{ label: string; tab: string }>;
  toolCalls?: LlamaToolCall[];
}

export interface ChatHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}
