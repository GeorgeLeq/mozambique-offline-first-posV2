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
  pacing?: 'fast' | 'balanced' | 'detailed';
  signal?: AbortSignal;
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
  const { query, chatHistory = [], lang = 'en', pacing = 'balanced', onChunk } = options;
  const isPt = lang === 'pt' || /olá|ola|bom dia|como vai|tudo bem|poema|história|piada/i.test(query);

  const isGreetingOrCourtesy = /^(hello|hi|hey|good morning|good afternoon|good evening|how are you|how do you do|who are you|what is your name|olá|ola|bom dia|boa tarde|boa noite|como vai|tudo bem)\b/i.test(query.trim());

  // Dynamic system prompt: For greetings, keep it natural, warm, and helpful without inventing fake daily metrics or daydreams.
  // For open knowledge, keep it rich and knowledgeable.
  let systemPrompt = '';
  if (isGreetingOrCourtesy) {
    systemPrompt = isPt
      ? `Você é o Store Sentinel AI, o assistente inteligente da loja no SYCOMM POS.
Responda de forma natural, calorosa, educada e direta ao cumprimento do operador.
Diga que está tudo bem e pergunte em que pode ajudar no caixa, stock ou operações da loja hoje.
NUNCA invente números de vendas falsos (como 10.000 clientes ou 700 transações), nem invente histórias sobre o clima ou o dia lá fora.`
      : `You are Store Sentinel AI, the intelligent store copilot for SYCOMM POS.
Respond in a warm, polite, natural, and helpful tone to the operator's greeting.
Express that you are doing well and ready to assist with POS sales, stock, customers, or store operations.
NEVER invent fake store numbers (like 10,000 customers or 700 sales), and NEVER invent daydreams about weather or scenery outside.`;
  } else {
    systemPrompt = isPt
      ? `Você é o Store Sentinel AI, um assistente inteligente, conhecedor e prestativo para lojas em Moçambique.
Forneça respostas claras, conhecedoras e bem explicadas em português de Moçambique.
Para perguntas de tecnologia, ciência, negócios, dicas comerciais ou conversa geral, responda com raciocínio natural e articulado.
NUNCA invente dados operacionais fictícios nem invente palavras inexistentes.`
      : `You are Store Sentinel AI, an intelligent, knowledgeable, and helpful retail copilot for stores in Mozambique.
Provide clear, articulate, and insightful responses.
For questions on technology, science, business ideas, or general conversation, explain ideas clearly and knowledgeably.
NEVER invent fictitious store operations or make up fake metrics.`;
  }

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
      temperature: isGreetingOrCourtesy ? 0.4 : 0.7, // Controlled temperature for greetings to prevent hallucinating stories
      pacing: isGreetingOrCourtesy ? 'fast' : pacing,
      signal: options.signal,
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
