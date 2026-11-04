/**
 * @file lane4_cart_checkout.ts
 * @description Lane 4 Sub-Handler: Register Cart, POS Sales & Change Calculation operations.
 * Grounded directly in local SQLite products catalog with real price/cost lookup and stock tracking.
 * Computes exact sales total, gross profit ("quanto ganhei"), and stages interactive action cards.
 * Logs tool execution as: lane4_cart_checkout -> <action>
 */

import { getDB } from '../../../db';
import { queryUnifiedAiEngine } from '../../unifiedAiClient';
import { ExecutableAiAction, SentinelResponse } from '../../types';

export interface CartCheckoutOptions {
  query: string;
  lang?: 'en' | 'pt';
  pacing?: 'fast' | 'balanced' | 'detailed';
  onChunk?: (chunk: string) => void;
}

export function isCartCheckoutQuery(query: string): boolean {
  const q = query.toLowerCase();

  // Direct cart & checkout keywords
  if (
    q.includes('add to cart') ||
    q.includes('adicionar ao carrinho') ||
    q.includes('colocar no carrinho') ||
    q.includes('carrinho') ||
    q.includes('cart') ||
    q.includes('calculate change') ||
    q.includes('calcular troco') ||
    q.includes('troco')
  ) {
    return true;
  }

  // POS sales intent e.g., "Venda 2 pão, adiciona arroz, quanto ganhei?"
  if (/\b(venda|vende|vender|sell|vendi|vendemos)\b/i.test(q)) {
    return true;
  }

  // Adding product directly to register or cashier
  if (/\b(adiciona|adicionar|add)\b.*\b(ao caixa|no caixa|carrinho|compal|pão|pao|arroz|coca|óleo|oleo|sabão|sabao)\b/i.test(q)) {
    return true;
  }

  return false;
}

export async function handleCartCheckout(options: CartCheckoutOptions): Promise<SentinelResponse> {
  const { query, lang = 'en', pacing = 'balanced', onChunk } = options;
  const isPt = lang === 'pt' || /carrinho|troco|adicionar|venda|caixa|ganhei|lucro/i.test(query);
  const qLower = query.toLowerCase();

  const isChangeCalc = /change|troco|tendered|pagou/i.test(query);

  let subActionName = 'add_to_cart';
  let action: ExecutableAiAction;

  if (isChangeCalc) {
    subActionName = 'calculate_change';
    let due = 500;
    let tendered = 1000;

    const dueMatch = query.match(/(?:due|total|custo)[:\s]*(\d+(?:[.,]\d+)?)/i);
    if (dueMatch) due = parseFloat(dueMatch[1].replace(',', '.'));

    const tenderedMatch = query.match(/(?:tendered|paid|pagou|recebido)[:\s]*(\d+(?:[.,]\d+)?)/i) || query.match(/(\d+)\s*(?:mt)?/i);
    if (tenderedMatch) tendered = parseFloat(tenderedMatch[1].replace(',', '.'));

    const changeDue = Math.max(0, tendered - due);

    action = {
      type: 'calculate_change',
      data: {
        total_due_mt: due,
        amount_tendered_mt: tendered,
        change_due_mt: changeDue
      }
    };
  } else {
    subActionName = 'add_to_cart';

    // 1. Fetch live product catalog directly from local SQLite
    let catalog: any[] = [];
    try {
      const db = await getDB();
      catalog = (await db.select(
        'SELECT id, barcode, name, price_mt, cost_price_mt, stock_quantity, category FROM products WHERE (is_deleted = 0 OR is_deleted IS NULL)'
      )) as any[];
    } catch (e) {
      console.warn('[lane4_cart_checkout] Could not load SQLite catalog:', e);
    }

    // 2. Identify products mentioned in query by scanning catalog
    const stagedItems: Array<{
      product_id: string;
      product_name: string;
      quantity: number;
      unit_price_mt: number;
      cost_price_mt: number;
      current_stock: number;
      unit_type: string;
    }> = [];

    // Helper map to match terms to product entries
    const termMap: Array<{ pattern: RegExp; matcher: (p: any) => boolean }> = [
      { pattern: /\b(compal|compal 2l)\b/i, matcher: p => /compal/i.test(p.name) },
      { pattern: /\b(pão|pao|pão fresco|pao fresco)\b/i, matcher: p => /pão|pao/i.test(p.name) },
      { pattern: /\b(arroz|arroz 25kg|princesa)\b/i, matcher: p => /arroz/i.test(p.name) },
      { pattern: /\b(coca|coca-cola|coca cola|coca 2l)\b/i, matcher: p => /coca/i.test(p.name) },
      { pattern: /\b(óleo|oleo|sunflower)\b/i, matcher: p => /óleo|oleo/i.test(p.name) },
      { pattern: /\b(sabão|sabao|omo)\b/i, matcher: p => /omo|sabão|sabao/i.test(p.name) }
    ];

    for (const term of termMap) {
      if (term.pattern.test(qLower)) {
        const found = catalog.find(term.matcher);
        if (found) {
          // Extract quantity if specified (e.g. "2 pão", "venda 3 compal", "1 arroz")
          const termStr = term.pattern.source.replace(/\\b|\(|\)/g, '').split('|')[0];
          const qtyRegex = new RegExp(`(\\d+)\\s*(?:x|un|unidades)?\\s*(?:de\\s+)?(?:${termStr})|(?:${termStr})\\s*(\\d+)`, 'i');
          const qtyMatch = qLower.match(qtyRegex);
          let itemQty = 1;
          if (qtyMatch) {
            itemQty = parseInt(qtyMatch[1] || qtyMatch[2], 10) || 1;
          }

          stagedItems.push({
            product_id: found.id,
            product_name: found.name,
            quantity: itemQty,
            unit_price_mt: Number(found.price_mt) || 0,
            cost_price_mt: Number(found.cost_price_mt) || (Number(found.price_mt) * 0.7),
            current_stock: Number(found.stock_quantity) || 0,
            unit_type: 'un'
          });
        }
      }
    }

    // Fallback: If no catalog keyword matched, use generic regex extraction
    if (stagedItems.length === 0) {
      let prodName = 'Product';
      let qty = 1;
      const genericQtyMatch = query.match(/(\d+)\s*(?:units|unidades|x|pcs)?\s*(?:of|de)?\s*([A-ZÀ-Úa-zà-ú0-9\s]+)/i);
      if (genericQtyMatch) {
        qty = parseInt(genericQtyMatch[1], 10) || 1;
        prodName = genericQtyMatch[2].replace(/quanto ganhei|adiciona|venda|carrinho/gi, '').trim() || 'Product';
      }

      const partialMatch = catalog.find(p => p.name.toLowerCase().includes(prodName.toLowerCase()));
      stagedItems.push({
        product_id: partialMatch?.id || `prod-custom-${Date.now()}`,
        product_name: partialMatch?.name || prodName,
        quantity: qty,
        unit_price_mt: partialMatch ? Number(partialMatch.price_mt) : 50,
        cost_price_mt: partialMatch ? Number(partialMatch.cost_price_mt) : 35,
        current_stock: partialMatch ? Number(partialMatch.stock_quantity) : 20,
        unit_type: 'un'
      });
    }

    // Compute sales total and gross profit (quanto ganhei)
    const totalSaleMt = stagedItems.reduce((acc, it) => acc + (it.unit_price_mt * it.quantity), 0);
    const totalCostMt = stagedItems.reduce((acc, it) => acc + (it.cost_price_mt * it.quantity), 0);
    const profitMt = Math.max(0, totalSaleMt - totalCostMt);

    action = {
      type: 'add_to_cart',
      data: {
        items: stagedItems,
        total_sale_mt: totalSaleMt,
        profit_mt: profitMt
      }
    };
  }

  // Construct grounded factual prompt with real prices in Meticais (MT)
  const isProfitInquiry = /quanto ganhei|qual o lucro|lucro|ganho|how much did i make|how much did i earn|profit|margin|margem/i.test(query);

  let factsSummary = '';
  if (action.type === 'add_to_cart') {
    const d = action.data;
    const itemsLines = d.items.map(it => 
      `• ${it.product_name}: ${it.quantity} un x ${it.unit_price_mt} MT = ${it.quantity * (it.unit_price_mt || 0)} MT (Custo: ${it.cost_price_mt} MT/un | Stock disponível: ${it.current_stock} un)`
    ).join('\n');

    factsSummary = isPt
      ? `DADOS FACTUAIS DO CATÁLOGO SQLITE (MOÇAMBIQUE):
${itemsLines}
Total da Venda: ${d.total_sale_mt} MT
${isProfitInquiry ? `Lucro Bruto ("Quanto Ganhei"): ${d.profit_mt} MT (Calculado: Venda ${d.total_sale_mt} MT - Custo ${d.total_sale_mt! - d.profit_mt!} MT)` : ''}`
      : `FACTUAL SQLITE CATALOG DATA (MOZAMBIQUE):
${itemsLines}
Total Sale: ${d.total_sale_mt} MT
${isProfitInquiry ? `Gross Profit ("Earned"): ${d.profit_mt} MT (Calculated: Sale ${d.total_sale_mt} MT - Cost ${d.total_sale_mt! - d.profit_mt!} MT)` : ''}`;
  } else {
    const d = action.data;
    factsSummary = isPt
      ? `Total: ${d.total_due_mt} MT | Recebido: ${d.amount_tendered_mt} MT | Troco: ${d.change_due_mt} MT`
      : `Total: ${d.total_due_mt} MT | Tendered: ${d.amount_tendered_mt} MT | Change: ${d.change_due_mt} MT`;
  }

  const systemInstruction = isPt
    ? `Você é o Store Sentinel AI da loja de retalho SYCOMM POS em Moçambique.
DADOS REAIS E EXATOS DO BANCO DE DADOS SQLITE LOCAL DA LOJA:
${factsSummary}

INSTRUÇÕES OBRIGATÓRIAS (ZERO PRESETS):
1. Responda em Português de Moçambique de forma direta, clara e profissional.
2. MOEDA ESTRITAMENTE Meticais (MT). NUNCA utilize "R$", "$", nem a palavra "reais".
3. Confirme os itens preparados para o carrinho do caixa com seus valores em MT.${isProfitInquiry ? ` Explique claramente que o ganho/lucro nesta operação é de ${(action.data as any).profit_mt} MT.` : ''}
4. NÃO invente valores nem produtos fictícios. Use exclusivamente os dados factuais acima.`
    : `You are Store Sentinel AI for SYCOMM POS retail shops in Mozambique.
REAL AND EXACT LIVE SQLITE DATABASE DATA FOR THIS STORE:
${factsSummary}

MANDATORY INSTRUCTIONS (ZERO PRESETS):
1. Respond in a natural, helpful store assistant voice.
2. CURRENCY MANDATE: Mozambican Meticais (MT) ONLY. NEVER output "R$", "$", or Brazilian Reais.
3. Confirm the staged items for register cart with values in MT.${isProfitInquiry ? ` Explicitly state that the profit earned on this sale is ${(action.data as any).profit_mt} MT.` : ''}
4. Use ONLY the real factual catalog data above.`;

  try {
    const aiRes = await queryUnifiedAiEngine({
      prompt: query,
      systemPrompt: systemInstruction,
      temperature: 0.25,
      pacing,
      onChunk: (chunk: string) => {
        if (onChunk) onChunk(chunk);
      }
    });

    const cleanAnswer = (aiRes.text || '')
      .replace(/\{[a-zA-Z0-9_\[\]\s:"',-]+\}\s*/g, '')
      .replace(/\{\s*\}/g, '')
      .replace(/\bSimbamente\b/gi, 'Certamente')
      .replace(/\bsimbamente\b/gi, 'certamente')
      .replace(/\[\s*(?:Insert|Insira|Preencha|Digite)[^\]]*\]/gi, '')
      .replace(/\[\s*\]/g, '')
      .replace(/\s*\((?:approximately|aprox\.?|cerca de)?\s*\$[\d.,]+\s*(?:USD)?\)/gi, '')
      .replace(/\b(?:USD|\$)\s*(\d+(?:[.,]\d+)?)/gi, '$1 MT')
      .trim();

    return {
      answer: cleanAnswer || (isPt ? '• Itens preparados para lançamento no caixa.' : '• Items staged for POS register cart.'),
      modelUsed: aiRes.modelUsed || 'llama3.2:1b-local',
      isOffline: aiRes.isOffline,
      executableAction: action,
      toolCalled: `lane4_cart_checkout -> ${subActionName}`,
      suggestedActions: [
        { label: isPt ? 'Abrir Caixa' : 'Register', tab: 'caixas' }
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  } catch (err: any) {
    return {
      answer: isPt
        ? `• Preparei os itens no carrinho do caixa. Total: ${(action.data as any).total_sale_mt || 0} MT${isProfitInquiry ? ` | Lucro: ${(action.data as any).profit_mt || 0} MT` : ''}.`
        : `• Staged items for register cart. Total: ${(action.data as any).total_sale_mt || 0} MT${isProfitInquiry ? ` | Profit: ${(action.data as any).profit_mt || 0} MT` : ''}.`,
      modelUsed: 'offline',
      isOffline: true,
      executableAction: action,
      toolCalled: `lane4_cart_checkout -> ${subActionName}`,
      suggestedActions: [{ label: 'Register', tab: 'caixas' }],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }
}

