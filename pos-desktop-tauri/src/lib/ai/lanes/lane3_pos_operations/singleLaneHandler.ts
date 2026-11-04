/**
 * @file singleLaneHandler.ts
 * @description Lane 3: Exact POS Stock & Operations (Grounded in SQLite).
 * Pure Llama 3.2 1B + JIT Dynamic Tools with ZERO Presets.
 * Dynamically queries SQLite, feeds factual telemetry to Llama,
 * and formats the answer into concise, grounded bulleted facts (•) in Meticais (MT).
 *
 * Refactored into clean modules:
 * - `jitToolExecutor.ts`: Raw SQLite query execution
 * - `telemetryFormatter.ts`: Human prose telemetry formatting & sanitization
 * - `jitToolSelector.ts`: JIT tool selection logic
 */

import { queryUnifiedAiEngine } from '../../unifiedAiClient';
import { SentinelResponse, SentinelAction } from '../../types';
import { selectJitTool } from './jitToolSelector';
import { executeJitTool, buildCustomerSummary, buildDeliverySummary } from './jitToolExecutor';
import { formatStoreFactsHuman, sanitizeLlamaResponse, isNonFactualStoreResponse } from './telemetryFormatter';

// Re-export modular components for complete backwards compatibility
export {
  executeJitTool,
  buildCustomerSummary,
  buildDeliverySummary,
  formatStoreFactsHuman,
  sanitizeLlamaResponse,
  isNonFactualStoreResponse
};

export interface SingleLaneOptions {
  query: string;
  operatorName?: string;
  lang?: 'en' | 'pt';
  pacing?: 'fast' | 'balanced' | 'detailed';
  signal?: AbortSignal;
  onChunk?: (chunk: string) => void;
}

/**
 * Handles Lane 3 query with Pure Llama 3.2 1B neural inference grounded in SQLite. Zero presets!
 */
export async function handlePosOperationQuery(options: SingleLaneOptions): Promise<SentinelResponse> {
  const { query, operatorName = 'Admin', lang = 'en', pacing = 'balanced', signal, onChunk } = options;
  const isPt = lang === 'pt' || /estoque|produtos|turno|caixa|quantos|quem|fiado|logado|logou|relatório|quebra|roubou|falta|leitura/i.test(query);

  // 1. Select the exact JIT tool
  const tool = selectJitTool(query);

  // 2. Execute JIT tool directly against local SQLite
  let liveData: Record<string, any>;
  try {
    liveData = await executeJitTool(tool, operatorName);
  } catch (err: any) {
    liveData = { metric: 'fallback', currentUserLoggedIn: operatorName };
  }

  // 3. Convert telemetry into clean human sentences (ZERO RAW JSON BRACKETS)
  const humanFacts = formatStoreFactsHuman(liveData, isPt);

  // 4. Construct grounded system prompt with strict zero-hallucination rules
  const systemInstruction = isPt
    ? `Você é o Store Sentinel AI da loja de retalho SYCOMM POS em Moçambique.
DADOS REAIS E EXATOS DO BANCO DE DADOS SQLITE LOCAL DA LOJA:
${humanFacts}

INSTRUÇÕES OBRIGATÓRIAS (ZERO PRESETS):
Responda de forma natural, profissional e estritamente factual com as suas próprias palavras.
1. Comece de forma natural e informe diretamente os dados reais da loja.
2. Forneça marcadores (•) objetivos com números reais dos dados acima.
3. Se a pergunta for sobre auditoria, quebra de caixa, falta ou suspeita de roubo, reporte com exatidão o operador, o valor da quebra em MT e a nota de auditoria dos dados acima.
4. Se a pergunta for sobre leituras ou histórico de código de barras, relate os produtos (mesmo fora de stock ou descontinuados) e operadores que os leram.
5. REGRA CRÍTICA: NUNCA use chavetas {}, nem colchetes de placeholders como [Insira ...].
6. NUNCA invente categorias de produtos adicionais, produtos fictícios nem nomes de pessoas fictícias. Use APENAS os dados reais acima.
7. NUNCA mencione consultas SQL ou tabelas internas.
8. Formate todos os valores monetários estritamente em Meticais (MT). NUNCA mencione dólares ($/USD) nem faça conversões cambiais.`
    : `You are Store Sentinel AI for SYCOMM POS retail shops in Mozambique.
REAL AND EXACT LIVE SQLITE DATABASE DATA FOR THIS STORE:
${humanFacts}

MANDATORY INSTRUCTIONS (ZERO PRESETS):
Respond in a natural, helpful, professional store assistant voice while staying strictly factual.
1. Start naturally in your own words and deliver the live store facts directly.
2. Provide concise bullet points (•) based strictly on the REAL DATA above.
3. If the query concerns shift audits, cash shortages, discrepancies, or suspected theft, report the exact cashier name, discrepancy amount in MT, and audit flag factually from the data above.
4. If the query concerns barcode scans or scan history, report the scanned products (including discontinued/out-of-stock items) and the cashiers who scanned them.
5. CRITICAL RULE: NEVER use curly braces {} or bracket placeholders like [Insert ...]. Output plain numbers and real names directly.
6. NEVER invent fictitious store departments, fake products (like Almond Butter), or imaginary customer names. Use ONLY the real items provided above.
7. NEVER explain SQL queries or database table names.
8. Always format currency in Mozambican Meticais (MT). NEVER output dollars ($/USD) or foreign currency conversions.`;

  try {
    let streamedText = '';
    const aiRes = await queryUnifiedAiEngine({
      prompt: query,
      systemPrompt: systemInstruction,
      temperature: 0.35,
      pacing,
      signal,
      onChunk: (chunk: string) => {
        streamedText += chunk;
        if (onChunk) {
          onChunk(chunk);
        }
      }
    });

    const rawAnswer = aiRes.text.trim();
    const cleanAnswer = sanitizeLlamaResponse(rawAnswer);

    // Provide relevant contextual UI navigation pills based on tool called
    const suggestedActions = getSuggestedActionsForTool(tool.name, isPt);

    return {
      answer: cleanAnswer || (isPt ? '• Dados consultados no banco SQLite local.' : '• Live store telemetry fetched from SQLite.'),
      modelUsed: aiRes.modelUsed || 'llama3.2:1b-local',
      isOffline: aiRes.isOffline,
      toolCalled: tool.name,
      suggestedActions,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  } catch (err: any) {
    return {
      answer: isPt
        ? `[Erro Neural Lane 3]\nNão foi possível processar a resposta do Llama 3.2: ${err?.message || 'Modelo desconectado'}. Verifique se o Ollama está em execução.`
        : `[Lane 3 Neural Error]\nCould not process Llama 3.2 response: ${err?.message || 'Model disconnected'}. Ensure Ollama is running.`,
      modelUsed: 'offline',
      isOffline: true,
      toolCalled: tool.name,
      suggestedActions: [{ label: isPt ? 'Ver Estoque' : 'View Inventory', tab: 'products' }],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }
}

/**
 * Returns contextual quick-action suggestions for the POS user interface.
 */
function getSuggestedActionsForTool(toolName: string, isPt: boolean): SentinelAction[] {
  switch (toolName) {
    case 'fetch_shift_reports':
      return [
        { label: isPt ? 'Auditoria' : 'Audit', tab: 'audit' },
        { label: isPt ? 'Relatórios' : 'Reports', tab: 'reports' }
      ];
    case 'fetch_shifts':
      return [
        { label: isPt ? 'Abrir Caixa' : 'Register', tab: 'caixas' },
        { label: isPt ? 'Relatórios' : 'Reports', tab: 'reports' }
      ];
    case 'fetch_scan_history':
      return [
        { label: isPt ? 'Histórico Leituras' : 'Scan Logs', tab: 'scans' },
        { label: isPt ? 'Vender (POS)' : 'Terminal POS', tab: 'caixas' }
      ];
    case 'fetch_customers':
      return [
        { label: isPt ? 'Ver Clientes' : 'View Customers', tab: 'clients' },
        { label: isPt ? 'Livro de Fiado' : 'Fiado Ledger', tab: 'clients' }
      ];
    case 'fetch_deliveries':
      return [
        { label: isPt ? 'Receção Encomendas' : 'Stock Deliveries', tab: 'restock' },
        { label: isPt ? 'Ver Estoque' : 'View Inventory', tab: 'products' }
      ];
    case 'fetch_inventory':
    case 'fetch_store_overview':
    default:
      return [
        { label: isPt ? 'Ver Estoque' : 'View Inventory', tab: 'products' },
        { label: isPt ? 'Abrir Caixa' : 'Register', tab: 'caixas' }
      ];
  }
}

