/**
 * @file lane4_cart_checkout.ts
 * @description Lane 4 Sub-Handler: Register Cart & Change Calculation operations.
 * Handles staging items into register cart and computing cash change breakdown.
 * Logs tool execution as: lane4_cart_checkout -> <action>
 */

import { queryUnifiedAiEngine } from '../../unifiedAiClient';
import { ExecutableAiAction, SentinelResponse } from '../../types';

export interface CartCheckoutOptions {
  query: string;
  lang?: 'en' | 'pt';
}

export function isCartCheckoutQuery(query: string): boolean {
  const q = query.toLowerCase();
  return (
    q.includes('add to cart') ||
    q.includes('adicionar ao carrinho') ||
    q.includes('colocar no carrinho') ||
    q.includes('cart') ||
    q.includes('carrinho') ||
    q.includes('calculate change') ||
    q.includes('calcular troco') ||
    q.includes('troco')
  );
}

export async function handleCartCheckout(options: CartCheckoutOptions): Promise<SentinelResponse> {
  const { query, lang = 'en' } = options;
  const isPt = lang === 'pt' || /carrinho|troco|adicionar|caixa/i.test(query);

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
    let prodName = 'Product';
    let qty = 1;

    const qtyMatch = query.match(/(\d+)\s*(?:units|unidades|x|pcs)?\s*(?:of|de)?\s*([A-ZÀ-Úa-zà-ú\s]+)/i);
    if (qtyMatch) {
      qty = parseInt(qtyMatch[1], 10);
      prodName = qtyMatch[2].trim();
    }

    action = {
      type: 'add_to_cart',
      data: {
        items: [
          {
            product_name: prodName,
            quantity: qty
          }
        ]
      }
    };
  }

  const toolsDef = [
    {
      type: 'function',
      function: {
        name: isChangeCalc ? 'calculate_cash_change' : 'add_to_cart',
        description: isChangeCalc ? 'Calculate exact cash change due' : 'Add products to live POS register cart',
        parameters: {
          type: 'object',
          properties: isChangeCalc
            ? {
                amount_tendered_mt: { type: 'number', description: 'Cash received from customer' },
                total_due_mt: { type: 'number', description: 'Total sale amount' }
              }
            : {
                item_name: { type: 'string', description: 'Name of product' },
                quantity: { type: 'number', description: 'Quantity' }
              },
          required: isChangeCalc ? ['amount_tendered_mt'] : ['item_name']
        }
      }
    }
  ];

  let defaultMsg = '';
  if (action.type === 'calculate_change') {
    const d = action.data;
    defaultMsg = isPt
      ? `Cálculo de troco preparado: Total: ${d.total_due_mt} MT | Recebido: ${d.amount_tendered_mt} MT | Troco: ${d.change_due_mt} MT.`
      : `Change calculation prepared: Total: ${d.total_due_mt} MT | Tendered: ${d.amount_tendered_mt} MT | Change: ${d.change_due_mt} MT.`;
  } else {
    defaultMsg = isPt
      ? `Preparei o lançamento no carrinho do caixa para os itens solicitados.`
      : `I have staged the items to add to the live POS register cart.`;
  }

  try {
    const aiRes = await queryUnifiedAiEngine({
      prompt: query,
      systemPrompt: isPt
        ? `Você é o assistente Store Sentinel POS em Moçambique. O operador solicitou lançar itens no caixa. Responda em UMA ÚNICA frase curta e direta confirmando o lançamento. NUNCA escreva tutoriais, manuais, passos numerados nem instruções de banco de dados SQL.`
        : `You are Store Sentinel POS assistant in Mozambique. The cashier requested to stage cart items or calculate change. Respond in ONE single short, direct sentence confirming the action. CRITICAL: NEVER write tutorials, numbered steps, manuals, or database guides. Respond directly to the cashier.`,
      temperature: 0.1,
      tools: toolsDef
    });

    let rawText = (aiRes.text || '').trim();
    if (/(?:step \d+|how to create|here are the steps|follow these steps|preparation for new|to prepare a new|insert details into|create a new record)/i.test(rawText)) {
      rawText = defaultMsg;
    }

    return {
      answer: rawText || defaultMsg,
      modelUsed: 'muse-spark-1.3',
      isOffline: aiRes.isOffline,
      executableAction: action,
      toolCalled: `lane4_cart_checkout -> ${subActionName}`,
      suggestedActions: [
        { label: isPt ? 'Abrir Caixa' : 'Register', tab: 'caixas' }
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  } catch (err) {
    return {
      answer: defaultMsg,
      modelUsed: 'muse-spark-1.3',
      isOffline: true,
      executableAction: action,
      toolCalled: `lane4_cart_checkout -> ${subActionName}`,
      suggestedActions: [{ label: 'Register', tab: 'caixas' }],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }
}
