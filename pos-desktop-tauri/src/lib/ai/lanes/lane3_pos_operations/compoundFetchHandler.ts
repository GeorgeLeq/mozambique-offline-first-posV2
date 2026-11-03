/**
 * @file compoundFetchHandler.ts
 * @description Lane 3 Sequential Multi-Fetch Handler for Grounded Operational Reads.
 * Handles multi-intent read queries (e.g. stock + customers + deliveries) by sequentially
 * querying local SQLite, building compound JIT tool definitions, and providing grounded
 * factual answers in Meticais (MT) with zero presets.
 */

import { SentinelResponse } from '../../types';
import { queryUnifiedAiEngine } from '../../unifiedAiClient';
import { PosJitToolSelection } from './jitToolSelector';
import { executeJitTool, formatStoreFactsHuman, sanitizeLlamaResponse } from './singleLaneHandler';

export interface CompoundFetchOptions {
  query: string;
  operatorName?: string;
  lang?: 'en' | 'pt';
  onChunk?: (chunk: string) => void;
}

/**
 * Detects which operational JIT fetch tools are required for a query.
 */
export function detectFetchTools(query: string): string[] {
  const q = query.toLowerCase();
  const tools: string[] = [];

  const hasInventoryKey = /(stock|inventory|estoque|produto|product|catalog|catálogo|item|prateleira)/i.test(q);
  const hasCustomerKey = /(customer|cliente|fiado|debt|devedor|saldo|ledger|devedores)/i.test(q);
  const hasDeliveryKey = /(delivery|deliveries|entrega|entregas|fornecedor|supplier|encomenda|restock)/i.test(q);
  const hasShiftKey = /(shift|turno|caixa|cashier|logged|login|operador|operator|logou)/i.test(q);

  if (hasInventoryKey) tools.push('fetch_inventory');
  if (hasCustomerKey) tools.push('fetch_customers');
  if (hasDeliveryKey) tools.push('fetch_deliveries');
  if (hasShiftKey) tools.push('fetch_shifts');

  // If query asks for general overview or store status
  if (tools.length < 2 && /(overview|resumo|geral|loja|store status|how is the store|situação da loja)/i.test(q)) {
    return ['fetch_inventory', 'fetch_customers', 'fetch_deliveries', 'fetch_shifts'];
  }

  return tools;
}

/**
 * Returns true if a query involves 2 or more distinct operational fetch intents.
 */
export function isCompoundFetchQuery(query: string): boolean {
  const tools = detectFetchTools(query);
  return tools.length >= 2;
}

export function isIncompleteCompoundResponse(answer: string, query: string): boolean {
  if (!answer || !answer.trim()) return true;

  const q = query.toLowerCase();
  const requested = {
    inventory: /(stock|inventory|estoque|produto|product|catalog|catálogo|item|prateleira)/i.test(q),
    customer: /(customer|cliente|fiado|debt|devedor|saldo|ledger|devedores)/i.test(q),
    delivery: /(delivery|deliveries|entrega|entregas|fornecedor|supplier|encomenda|restock)/i.test(q),
    shift: /(shift|turno|caixa|cashier|logged|login|operador|operator|logou)/i.test(q)
  };

  const requiredKeys = Object.entries(requested).filter(([, isRequired]) => isRequired).map(([key]) => key);
  if (requiredKeys.length < 2) return false;

  const normalized = answer.replace(/\s+/g, ' ').trim();
  const mentions = {
    inventory: /(stock|inventory|estoque|product|produto|items|item|catalog|catálogo)/i.test(normalized),
    customer: /(customer|cliente|fiado|debt|devedor|saldo|ledger|customers|devedores)/i.test(normalized),
    delivery: /(delivery|deliveries|entrega|entregas|fornecedor|supplier|restock|encomenda)/i.test(normalized),
    shift: /(shift|turno|cashier|caixa|operator|operador|logged|login)/i.test(normalized)
  };

  const missing = requiredKeys.filter(key => !mentions[key as keyof typeof mentions]);
  if (missing.length > 0) return true;

  const looksCutOff = /(Current Stock|Customer and Fiado Metrics|Pending Restocks|Register Shift):\s*$/.test(normalized) || /(?:Current Stock|Customer and Fiado Metrics|Pending Restocks|Register Shift):\s*$/.test(normalized);
  if (looksCutOff) return true;

  return false;
}

/**
 * Executes multi-intent read requests sequentially against SQLite, feeds consolidated telemetry
 * to Llama 3.2 1B, and returns grounded multi-bullet facts via live token streaming.
 */
export async function handleCompoundFetchQuery(options: CompoundFetchOptions): Promise<SentinelResponse> {
  const { query, operatorName = 'Admin', lang = 'en', onChunk } = options;
  const isPt = lang === 'pt' || /estoque|produtos|turno|caixa|quantos|quem|fiado|logado|logou/i.test(query);

  const toolNames = detectFetchTools(query);
  const combinedData: Record<string, any> = {};

  // Sequentially query local SQLite database for each required domain
  for (const name of toolNames) {
    try {
      const toolSelection: PosJitToolSelection = {
        name: name as any,
        description: `Fetch ${name.replace('fetch_', '')} telemetry from SQLite`,
        params: {}
      };
      const data = await executeJitTool(toolSelection, operatorName);
      combinedData[name] = data;
    } catch (_) {
      combinedData[name] = { metric: name, status: 'error' };
    }
  }

  const humanFacts = formatStoreFactsHuman(combinedData, isPt);

  const systemInstruction = isPt
    ? `Você é o Store Sentinel AI da loja de retalho SYCOMM POS em Moçambique.
DADOS REAIS E EXATOS DO BANCO DE DADOS SQLITE LOCAL DA LOJA:
${humanFacts}

INSTRUÇÕES OBRIGATÓRIAS:
Responda de forma natural e útil, cobrindo TODAS as áreas solicitadas.
1. Comece com 1 frase curta e natural de introdução (ex: "Verifiquei os dados solicitados da loja e este é o panorama atual:").
2. Apresente os fatos em marcadores (•) objetivos para cada área solicitada (Estoque, Clientes/Fiado, Entregas, Turno), baseados estritamente nos dados reais acima.
3. REGRA CRÍTICA: NUNCA use chavetas {} ou nomes de variáveis como {totalProducts}, {sampleItems}, etc. Escreva apenas texto legível com números reais.
4. NUNCA invente categorias de produtos fictícias nem nomes de clientes fictícios.
5. Formate todos os valores monetários em Meticais (MT).
6. ZERO presets: não use saudações genéricas nem diga "Como posso ajudar hoje?".`
    : `You are Store Sentinel AI for SYCOMM POS retail shops in Mozambique.
REAL AND EXACT LIVE SQLITE DATABASE DATA FOR THIS STORE:
${humanFacts}

MANDATORY INSTRUCTIONS:
Respond in a natural, helpful retail-assistant voice covering ALL requested areas.
1. Start with 1 brief natural sentence, for example: "I checked the requested store metrics and here is the live picture:".
2. Provide concise bullet points (•) for each requested area (Stock, Customers/Fiado, Deliveries, Shift), strictly based on the REAL DATA above.
3. CRITICAL RULE: NEVER use curly braces {} or variable template tags like {totalProducts}, {sampleItems}, or {metric:...}. Write clean, natural sentences with plain numbers and real names.
4. NEVER invent fictitious store departments or customer names.
5. Always format currency in Mozambican Meticais (MT).
6. ZERO presets: do not use generic greetings or template brackets.`;

  try {
    let streamedText = '';
    const aiRes = await queryUnifiedAiEngine({
      prompt: query,
      systemPrompt: systemInstruction,
      temperature: 0.35,
      onChunk: (chunk: string) => {
        streamedText += chunk;
        if (onChunk) {
          onChunk(chunk);
        }
      }
    });

    const rawAnswer = aiRes.text.trim();
    const cleanAnswer = sanitizeLlamaResponse(rawAnswer);

    return {
      answer: cleanAnswer || (isPt ? '• Resumo da loja consultado no SQLite.' : '• Store summary fetched from SQLite.'),
      modelUsed: aiRes.modelUsed || 'llama3.2:1b-local',
      isOffline: aiRes.isOffline,
      toolCalled: toolNames.join(' + '),
      suggestedActions: [
        { label: isPt ? 'Ver Estoque' : 'View Inventory', tab: 'products' },
        { label: isPt ? 'Ver Clientes' : 'View Customers', tab: 'clients' }
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  } catch (err: any) {
    return {
      answer: isPt
        ? `[Erro Neural Lane 3 Compound]\nNão foi possível processar a resposta do Llama 3.2: ${err?.message || 'Modelo desconectado'}. Verifique se o Ollama está em execução.`
        : `[Lane 3 Compound Neural Error]\nCould not process Llama 3.2 response: ${err?.message || 'Model disconnected'}. Ensure Ollama is running.`,
      modelUsed: 'offline',
      isOffline: true,
      toolCalled: toolNames.join(' + '),
      suggestedActions: [{ label: 'View Inventory', tab: 'products' }],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }
}
