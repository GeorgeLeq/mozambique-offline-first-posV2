/**
 * @file cmdChatHandler.ts
 * @description Lane 2: Open World Knowledge & Free Chat (Gear 2 / CMD Mode).
 * Completely strips out store inventory, shelf stock, and background telemetry.
 * Lets Llama 3.2 1B / Muse Spark breathe and answer naturally and knowledgeably from its broad
 * pre-trained model (identical to running `ollama run pos-parser` in Windows CMD).
 * Configured for long, comprehensive, in-depth responses without premature truncation.
 * ZERO presets.
 */

import { queryUnifiedAiEngine } from '../../unifiedAiClient';
import { SentinelResponse } from '../../types';

export interface CmdChatOptions {
  query: string;
  chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  lang?: 'en' | 'pt';
  onChunk?: (chunk: string) => void;
}

/**
 * Detects if a query belongs to Lane 2 (Open World Knowledge, Tech, Poetry, Greetings, General Chat).
 */
export function isOpenChatQuery(query: string): boolean {
  const q = query.toLowerCase().trim();

  // Greetings & courtesies
  if (/^(hello|hi|hey|good morning|good afternoon|good evening|how are you|how do you do|who are you|what is your name)\b/i.test(q)) {
    return true;
  }
  if (/^(olá|ola|bom dia|boa tarde|boa noite|como vai|tudo bem|quem és tu|qual é o seu nome)\b/i.test(q)) {
    return true;
  }

  // Creative & literary requests
  if (/poem|poetry|poema|poesia|story|história|joke|piada|slogan/i.test(q)) {
    return true;
  }

  // Emotional support / casual chatter / advice
  if (/rough day|bad day|dia difícil|dia cansativo|triste|sad|encourage|animar|conselho|advice/i.test(q)) {
    return true;
  }

  // Tech, World & Open Knowledge (Samsung, Apple, AI, science, geography, weather, politics, recipes, etc.)
  if (/samsung|apple|iphone|android|xiaomi|google|windows|linux|spacex|tesla|hardware|cpu|gpu|ram/i.test(q)) {
    return true;
  }
  if (/what is the latest|what is the capital|who is|explain|tell me about|how does|why is|climate|weather|definition of|define\b/i.test(q)) {
    // Make sure it is not asking about store inventory/stock
    if (!/stock|estoque|inventory|product|produto|debt|fiado|shift|turno|cashier|caixa|customer|cliente/i.test(q)) {
      return true;
    }
  }

  return false;
}

/**
 * Handles Lane 2: Pure Llama 3.2 1B / Muse Spark CMD mode execution.
 * Configured for thorough, comprehensive, long responses with ZERO store telemetry constraints.
 */
export async function handleOpenChatQuery(options: CmdChatOptions): Promise<SentinelResponse> {
  const { query, chatHistory = [], lang = 'en', onChunk } = options;
  const isPt = lang === 'pt' || /olá|ola|bom dia|como vai|tudo bem|poema|história|piada/i.test(query);

  // Pure CMD System Prompt: Explicitly requests very long, thorough, and in-depth responses
  const systemPrompt = isPt
    ? `Você é o Store Sentinel AI, um assistente de inteligência completo, altamente articulado, culto e conhecedor.
Forneça respostas LONGAS, APROFUNDADAS, DETALHADAS e ABRANGENTES em português.
Para conversação aberta, perguntas de tecnologia, ciência, negócios, conselhos, histórias ou poesia, desenvolva os seus raciocínios com explicações ricas, múltiplos parágrafos e detalhes completos. NUNCA resuma ou encurte a resposta prematuramente. Mantenha a resposta fluida, informativa e muito completa.`
    : `You are Store Sentinel AI, an intelligent, highly articulate, deeply knowledgeable, and engaging copilot.
Provide VERY LONG, DETAILED, COMPREHENSIVE, AND IN-DEPTH responses.
For open conversation, general knowledge, technology, business advice, stories, or creative requests, expand thoroughly with complete paragraphs, rich explanations, and exhaustive context. NEVER cut off or shorten your answer prematurely. Fully articulate all details and ideas.`;

  // Format clean conversational context without any store telemetry
  const historyTurns = chatHistory.slice(-4).map(turn => ({
    role: turn.role,
    content: turn.content
  }));

  try {
    const aiRes = await queryUnifiedAiEngine({
      prompt: query,
      systemPrompt,
      chatHistory: historyTurns,
      temperature: 0.85, // Higher creativity for long articulate responses
      onChunk
    });

    return {
      answer: aiRes.text.trim(),
      modelUsed: aiRes.modelUsed,
      isOffline: aiRes.isOffline,
      suggestedActions: [
        { label: isPt ? 'Ajuda do Sistema' : 'System Overview', tab: 'menu' },
        { label: isPt ? 'Ver Caixa' : 'Open Register', tab: 'caixas' }
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  } catch (err: any) {
    // ZERO presets! Honest technical feedback
    return {
      answer: `[Store Sentinel Neural Engine Error]\nCould not process chat: ${err?.message || 'Neural model is offline or disconnected'}.\nPlease start Ollama on your PC ('ollama run pos-parser') or configure Muse Spark online fallback.`,
      modelUsed: 'offline',
      isOffline: true,
      suggestedActions: [
        { label: 'Open Register', tab: 'caixas' }
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }
}
