/**
 * @file singleLaneHandler.ts
 * @description Lane 3: Exact POS Stock & Operations (Grounded in SQLite).
 * Pure Llama 3.2 1B + JIT Dynamic Tools with ZERO Presets.
 * Dynamically queries SQLite, feeds factual telemetry to Llama,
 * and formats the answer into 2-3 concise, bulleted facts (•) in Meticais (MT).
 */

import { getDB } from '../../../db';
import { queryUnifiedAiEngine } from '../../unifiedAiClient';
import { SentinelResponse } from '../../types';
import { selectJitTool, PosJitToolSelection } from './jitToolSelector';

export interface SingleLaneOptions {
  query: string;
  operatorName?: string;
  lang?: 'en' | 'pt';
  onChunk?: (chunk: string) => void;
}

export function isNonFactualStoreResponse(text: string): boolean {
  if (!text || !text.trim()) return true;

  const normalized = text.replace(/\s+/g, ' ').trim();
  const lower = normalized.toLowerCase();

  const genericGreetingPatterns = [
    /^hey!\s*im your store copilot/i,
    /^hello!\s*im your store copilot/i,
    /^hi!\s*im your store copilot/i,
    /i'm your store copilot/i,
    /i am your store copilot/i,
    /how can i help you run the shop today/i,
    /how can i help/i,
    /what's on your mind/i,
    /ready to help you/i,
    /^hello!/i,
    /^hi\b/i,
    /^hey\b/i,
    /^(olá|ola|bom dia|boa tarde|boa noite)!?/i,
  ];

  if (genericGreetingPatterns.some(pattern => pattern.test(normalized))) {
    return true;
  }

  const hasStoreContext = /(stock|inventory|estoque|produto|product|fiado|debt|customer|cliente|turno|cashier|caixa)/i.test(lower);
  const hasNumbers = /\d/.test(normalized);

  if (!hasStoreContext && !hasNumbers) {
    return true;
  }

  return false;
}

export function buildCustomerSummary(rows: Array<Record<string, any>> = []) {
  const entries = Array.isArray(rows) ? rows.filter(Boolean) : [];
  const byCustomer = new Map<string, number>();
  const debtEntries: Array<{ customer_name: string; total_debt: number }> = [];

  for (const row of entries) {
    const customerName = String(row.customer_name ?? row.name ?? '').trim();
    if (!customerName) continue;

    const amount = Number(row.amount_mt ?? row.total_debt ?? row.total ?? 0) || 0;
    const running = byCustomer.get(customerName) || 0;
    byCustomer.set(customerName, running + amount);
    debtEntries.push({ customer_name: customerName, total_debt: amount });
  }

  const topDebtors = Array.from(byCustomer.entries())
    .map(([customer_name, total_debt]) => ({ customer_name, total_debt }))
    .sort((a, b) => b.total_debt - a.total_debt)
    .slice(0, 5)
    .map(d => `${d.customer_name}: ${Number(d.total_debt) || 0} MT`);

  return {
    totalCustomers: byCustomer.size,
    debtorCount: debtEntries.length,
    topDebtors
  };
}

export function buildDeliverySummary(rows: Array<Record<string, any>> = []) {
  const deliveries = Array.isArray(rows) ? rows.filter(Boolean) : [];

  const normalizedDeliveries = deliveries.map(row => {
    const supplierName = String(row.supplier_name ?? row.name ?? 'Fornecedor').trim() || 'Fornecedor';
    const quantity = Number(row.total_expected_quantity ?? row.expected_quantity ?? row.quantity ?? 0) || 0;
    const expectedDate = row.expected_date || row.date || 'Em breve';

    return {
      supplier_name: supplierName,
      expected_date: expectedDate,
      total_expected_quantity: quantity,
    };
  });

  const totalExpectedUnits = normalizedDeliveries.reduce((sum, item) => sum + (Number(item.total_expected_quantity) || 0), 0);

  return {
    pendingDeliveriesCount: normalizedDeliveries.length,
    totalExpectedUnits,
    deliveries: normalizedDeliveries.slice(0, 5).map(item => `${item.supplier_name} (${item.expected_date || 'Em breve'}${item.total_expected_quantity ? `, ${item.total_expected_quantity} un` : ''})`)
  };
}

/**
 * Executes the selected JIT tool directly on local SQLite.
 */
export async function executeJitTool(tool: PosJitToolSelection, operatorName: string): Promise<Record<string, any>> {
  const db = await getDB();

  switch (tool.name) {
    case 'fetch_inventory': {
      const isLowStock = tool.params.filter === 'low_stock';
      let rawProds: any[] = [];
      try {
        rawProds = (await db.select('SELECT id, name, price_mt, stock_quantity, is_deleted FROM products')) as any[];
      } catch (_) {}

      const activeProds = Array.isArray(rawProds)
        ? rawProds.filter(p => p && (p.is_deleted === 0 || p.is_deleted === '0' || !p.is_deleted || p.is_deleted === null))
        : [];

      const totalProducts = activeProds.length;
      const totalUnits = activeProds.reduce((sum, p) => sum + (Number(p.stock_quantity) || 0), 0);

      const sorted = [...activeProds].sort((a, b) => (Number(b.stock_quantity) || 0) - (Number(a.stock_quantity) || 0));
      const sampleList = isLowStock
        ? sorted.filter(p => (Number(p.stock_quantity) || 0) <= 10).slice(0, 5)
        : sorted.slice(0, 5);

      const sampleItems = sampleList.map(i => `${i.name || 'Produto'}: ${i.stock_quantity ?? 0} un (${Number(i.price_mt) || 0} MT)`);

      return {
        metric: isLowStock ? 'low_stock_inventory' : 'current_inventory',
        totalProducts,
        totalUnits,
        sampleItems
      };
    }

    case 'fetch_customers': {
      let rawDebts: any[] = [];
      try {
        rawDebts = (await db.select(
          `SELECT customer_name, SUM(amount_mt) as total_debt, MAX(phone_number) as phone_number, MAX(address) as address
           FROM debts
           WHERE status IN ('unpaid', 'partial', 'pending') OR status IS NULL
           GROUP BY customer_name
           ORDER BY total_debt DESC LIMIT 20`
        )) as any[];
      } catch (_) {}

      const activeDebts = Array.isArray(rawDebts) ? rawDebts.filter(d => d && d.customer_name) : [];
      const summary = buildCustomerSummary(activeDebts);

      return {
        metric: 'customer_metrics',
        totalCustomers: summary.totalCustomers,
        debtorCount: summary.debtorCount,
        topDebtors: summary.topDebtors
      };
    }

    case 'fetch_shifts': {
      let shiftRows: any[] = [];
      try {
        shiftRows = (await db.select("SELECT * FROM shift_reports WHERE status = 'open'")) as any[];
      } catch (_) {}

      let userRows: any[] = [];
      try {
        userRows = (await db.select("SELECT id, name, role FROM users WHERE (is_deleted = 0 OR is_deleted IS NULL)")) as any[];
      } catch (_) {}

      const activeShift = Array.isArray(shiftRows) ? shiftRows[0] : null;
      const activeCashierName = activeShift?.user_name || activeShift?.cashier_name || null;
      const registeredOperatorsList = Array.isArray(userRows) && userRows.length > 0
        ? userRows.map(u => `${u.name} (${u.role || 'operator'})`)
        : [operatorName];

      return {
        metric: 'shift_and_login_status',
        currentUserLoggedIn: operatorName,
        hasActiveShift: Boolean(activeShift),
        activeCashierName,
        openedAt: activeShift?.opened_at || null,
        currentCashMt: activeShift?.current_cash || activeShift?.opening_cash || 0,
        registeredOperators: registeredOperatorsList
      };
    }

    case 'fetch_deliveries': {
      let rows: any[] = [];
      try {
        rows = (await db.select(`
          SELECT d.id, d.supplier_name, d.expected_date,
                 COALESCE(SUM(i.expected_quantity), 0) as total_expected_quantity
          FROM expected_deliveries d
          LEFT JOIN expected_delivery_items i ON i.delivery_id = d.id
          WHERE d.status = 'pending' OR d.status IS NULL
          GROUP BY d.id, d.supplier_name, d.expected_date
          ORDER BY d.expected_date ASC, d.created_at DESC
        `)) as any[];
      } catch (_) {}

      const summary = buildDeliverySummary(rows);

      return {
        metric: 'expected_deliveries',
        pendingDeliveriesCount: summary.pendingDeliveriesCount,
        totalExpectedUnits: summary.totalExpectedUnits,
        deliveries: summary.deliveries
      };
    }

    case 'fetch_store_overview': {
      let inventoryRows: any[] = [];
      try {
        inventoryRows = (await db.select('SELECT stock_quantity, is_deleted FROM products WHERE (is_deleted = 0 OR is_deleted IS NULL)')) as any[];
      } catch (_) {}

      const activeProds = Array.isArray(inventoryRows) ? inventoryRows.filter(p => p) : [];

      let customerRows: any[] = [];
      try {
        customerRows = (await db.select('SELECT DISTINCT customer_name FROM debts WHERE customer_name IS NOT NULL AND customer_name <> ""')) as any[];
      } catch (_) {}

      let deliveryRows: any[] = [];
      try {
        deliveryRows = (await db.select(`
          SELECT d.id, COALESCE(SUM(i.expected_quantity), 0) as total_expected_quantity
          FROM expected_deliveries d
          LEFT JOIN expected_delivery_items i ON i.delivery_id = d.id
          WHERE d.status = 'pending' OR d.status IS NULL
          GROUP BY d.id
        `)) as any[];
      } catch (_) {}

      const totalCustomers = Array.isArray(customerRows) ? customerRows.length : 0;
      const pendingDeliveries = Array.isArray(deliveryRows) ? deliveryRows.length : 0;
      const totalExpectedUnits = (Array.isArray(deliveryRows) ? deliveryRows : []).reduce((sum, row) => sum + (Number(row.total_expected_quantity) || 0), 0);

      return {
        metric: 'store_overview',
        totalProducts: activeProds.length,
        totalUnits: activeProds.reduce((sum, p) => sum + (Number(p.stock_quantity) || 0), 0),
        totalCustomers,
        currentUserLoggedIn: operatorName,
        activeCashier: operatorName,
        pendingDeliveries,
        totalExpectedUnits
      };
    }
  }
}

/**
 * Formats SQLite telemetry data into clean human sentences instead of raw JSON.
 * This completely prevents Llama 3.2 1B from echoing template brackets like {totalProducts} or {sampleItems[0]}.
 */
export function formatStoreFactsHuman(data: Record<string, any>, isPt: boolean): string {
  if (!data) return isPt ? 'Nenhum dado disponível.' : 'No data available.';

  // If compound data object
  if (data.fetch_inventory || data.fetch_customers || data.fetch_deliveries || data.fetch_shifts) {
    const sections: string[] = [];
    if (data.fetch_inventory) sections.push(formatSingleTelemetry('fetch_inventory', data.fetch_inventory, isPt));
    if (data.fetch_customers) sections.push(formatSingleTelemetry('fetch_customers', data.fetch_customers, isPt));
    if (data.fetch_deliveries) sections.push(formatSingleTelemetry('fetch_deliveries', data.fetch_deliveries, isPt));
    if (data.fetch_shifts) sections.push(formatSingleTelemetry('fetch_shifts', data.fetch_shifts, isPt));
    return sections.filter(Boolean).join('\n\n');
  }

  return formatSingleTelemetry(data.metric || 'data', data, isPt);
}

function formatSingleTelemetry(key: string, d: Record<string, any>, isPt: boolean): string {
  if (key === 'fetch_inventory' || d.metric === 'current_inventory' || d.metric === 'low_stock_inventory') {
    const totalProd = d.totalProducts ?? 0;
    const totalUnits = d.totalUnits ?? 0;
    const items = Array.isArray(d.sampleItems) && d.sampleItems.length > 0 
      ? d.sampleItems.join(', ') 
      : (isPt ? 'Nenhum item com baixo estoque' : 'None');
    return isPt
      ? `• Estoque Atual: ${totalProd} produtos registados com um total de ${totalUnits} unidades em stock.\n  Itens em catálogo: ${items}.`
      : `• Current Inventory: ${totalProd} registered products with ${totalUnits} total units in stock.\n  Catalog items: ${items}.`;
  }

  if (key === 'fetch_customers' || d.metric === 'customer_metrics') {
    const totalCust = d.totalCustomers ?? 0;
    const debtorCount = d.debtorCount ?? 0;
    const debtors = Array.isArray(d.topDebtors) && d.topDebtors.length > 0 
      ? d.topDebtors.join(', ') 
      : (isPt ? 'Nenhum fiado pendente' : 'No outstanding debts');
    return isPt
      ? `• Clientes e Fiado: ${totalCust} clientes no livro de contas, sendo ${debtorCount} com saldo devedor.\n  Maiores devedores: ${debtors}.`
      : `• Customers & Fiado Debts: ${totalCust} total customers in ledger, with ${debtorCount} customers having outstanding debts.\n  Top debtors: ${debtors}.`;
  }

  if (key === 'fetch_deliveries' || d.metric === 'expected_deliveries') {
    const pendingCount = d.pendingDeliveriesCount ?? 0;
    const units = d.totalExpectedUnits ?? 0;
    const list = Array.isArray(d.deliveries) && d.deliveries.length > 0 
      ? d.deliveries.join('; ') 
      : (isPt ? 'Nenhuma entrega agendada' : 'No pending deliveries');
    return isPt
      ? `• Encomendas e Entregas: ${pendingCount} encomendas de reposição pendentes (${units} unidades esperadas no total).\n  Próximas entregas: ${list}.`
      : `• Restock Deliveries: ${pendingCount} pending restock deliveries (${units} total expected units).\n  Upcoming deliveries: ${list}.`;
  }

  if (key === 'fetch_shifts' || d.metric === 'shift_and_login_status') {
    const active = d.hasActiveShift 
      ? (isPt ? `Turno aberto com operador ${d.activeCashierName}` : `Active shift under cashier ${d.activeCashierName}`) 
      : (isPt ? 'Nenhum turno aberto' : 'No open shift');
    const cash = d.currentCashMt ?? 0;
    const operators = Array.isArray(d.registeredOperators) ? d.registeredOperators.join(', ') : d.currentUserLoggedIn;
    return isPt
      ? `• Estado do Caixa e Turno: ${active} com fundo de caixa de ${cash} MT.\n  Operador actual: ${d.currentUserLoggedIn}. Utilizadores registados: ${operators}.`
      : `• Shift & Cash Register Status: ${active} with ${cash} MT cash in drawer.\n  Active cashier: ${d.currentUserLoggedIn}. Registered users: ${operators}.`;
  }

  if (d.metric === 'store_overview') {
    return isPt
      ? `• Resumo Geral da Loja: ${d.totalProducts ?? 0} produtos (${d.totalUnits ?? 0} unidades), ${d.totalCustomers ?? 0} clientes registados, ${d.pendingDeliveries ?? 0} entregas pendentes (${d.totalExpectedUnits ?? 0} unidades esperadas). Operador logado: ${d.activeCashier}.`
      : `• Store Overview: ${d.totalProducts ?? 0} products (${d.totalUnits ?? 0} units in stock), ${d.totalCustomers ?? 0} registered customers, ${d.pendingDeliveries ?? 0} pending deliveries (${d.totalExpectedUnits ?? 0} expected units). Logged in cashier: ${d.activeCashier}.`;
  }

  return JSON.stringify(d);
}

/**
 * Strips any residual template placeholder tags or curly braces from Llama output.
 */
export function sanitizeLlamaResponse(text: string): string {
  if (!text) return text;
  return text
    .replace(/\{[a-zA-Z0-9_\[\]\s:"',-]+\}\s*/g, '')
    .replace(/\{\s*\}/g, '')
    .replace(/\(\s*\)/g, '')
    .trim();
}

/**
 * Handles Lane 3 query with Pure Llama 3.2 1B neural inference grounded in SQLite. Zero presets!
 */
export async function handlePosOperationQuery(options: SingleLaneOptions): Promise<SentinelResponse> {
  const { query, operatorName = 'Admin', lang = 'en', onChunk } = options;
  const isPt = lang === 'pt' || /estoque|produtos|turno|caixa|quantos|quem|fiado|logado|logou/i.test(query);

  // 1. Select the exact JIT tool
  const tool = selectJitTool(query);

  // 2. Execute JIT tool directly against SQLite
  let liveData: Record<string, any>;
  try {
    liveData = await executeJitTool(tool, operatorName);
  } catch (err: any) {
    liveData = { metric: 'fallback', currentUserLoggedIn: operatorName };
  }

  // 3. Convert telemetry into clean human sentences (ZERO RAW JSON BRACKETS)
  const humanFacts = formatStoreFactsHuman(liveData, isPt);

  const systemInstruction = isPt
    ? `Você é o Store Sentinel AI da loja de retalho SYCOMM POS em Moçambique.
DADOS REAIS E EXATOS DO BANCO DE DADOS SQLITE LOCAL DA LOJA:
${humanFacts}

INSTRUÇÕES OBRIGATÓRIAS:
Responda de forma natural e útil, como um assistente de loja humano, mas sempre factual.
1. Comece com 1 frase curta e natural, por exemplo: "Verifiquei o stock em tempo real e o estado atual é este:".
2. Depois, forneça 2 a 3 marcadores (•) objetivos usando estritamente os dados reais fornecidos acima.
3. REGRA CRÍTICA: NUNCA use chavetas {} ou nomes de variáveis como {totalProducts} ou {sampleItems}. Escreva os números e nomes diretamente em português normal.
4. NUNCA invente categorias de produtos fictícias nem nomes fictícios. Use APENAS os dados acima.
5. NUNCA mencione consultas SQL ou tabelas internas.
6. Formate todos os valores monetários em Meticais (MT).
7. ZERO presets: não use saudações genéricas nem produza texto vazio.`
    : `You are Store Sentinel AI for SYCOMM POS retail shops in Mozambique.
REAL AND EXACT LIVE SQLITE DATABASE DATA FOR THIS STORE:
${humanFacts}

MANDATORY INSTRUCTIONS:
Respond in a natural, helpful retail-assistant voice while staying strictly factual.
1. Start with 1 brief natural sentence, for example: "I checked the live stock and here is the current picture:".
2. Then provide 2 to 3 concise bullet points (•) based strictly on the REAL DATA above.
3. CRITICAL RULE: NEVER use curly braces {} or variable template tags like {totalProducts} or {sampleItems}. Output plain numbers and real names directly in clean English prose.
4. NEVER invent store departments or fictitious names. Use ONLY the real items provided above.
5. NEVER explain SQL queries or database table names.
6. Always format currency in Mozambican Meticais (MT).
7. ZERO presets: do not use generic greetings or placeholder templates.`;

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
      answer: cleanAnswer || (isPt ? '• Dados consultados no banco SQLite local.' : '• Live store telemetry fetched from SQLite.'),
      modelUsed: aiRes.modelUsed || 'llama3.2:1b-local',
      isOffline: aiRes.isOffline,
      toolCalled: tool.name,
      suggestedActions: [
        { label: isPt ? 'Ver Estoque' : 'View Inventory', tab: 'products' },
        { label: isPt ? 'Abrir Caixa' : 'Register', tab: 'caixas' }
      ],
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
      suggestedActions: [{ label: 'View Inventory', tab: 'products' }],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }
}
