/**
 * @file lane4_delivery_po.ts
 * @description Lane 4 Sub-Handler: Supplier Delivery & Purchase Order operations.
 * Handles registering expected supplier deliveries and stock restock purchase orders.
 * Logs tool execution as: lane4_delivery_po -> <action>
 */

import { queryUnifiedAiEngine } from '../../unifiedAiClient';
import { ExecutableAiAction, SentinelResponse } from '../../types';

export interface DeliveryPoOptions {
  query: string;
  lang?: 'en' | 'pt';
  pacing?: 'fast' | 'balanced' | 'detailed';
}

export function isDeliveryPoQuery(query: string): boolean {
  const q = query.toLowerCase();
  return (
    q.includes('delivery') ||
    q.includes('deliveries') ||
    q.includes('entrega') ||
    q.includes('fornecedor') ||
    q.includes('supplier') ||
    q.includes('purchase order') ||
    q.includes('restock') ||
    q.includes('reabastecer')
  );
}

export async function handleDeliveryPo(options: DeliveryPoOptions): Promise<SentinelResponse> {
  const { query, lang = 'en', pacing = 'balanced' } = options;
  const isPt = lang === 'pt' || /entrega|fornecedor|reabastecer|encomenda/i.test(query);

  let supplierName = 'Fornecedor Principal';
  const supplierMatch = query.match(/(?:from|supplier|fornecedor)[:\s]+([A-ZÀ-Úa-zà-ú\s]+)/i);
  if (supplierMatch) {
    supplierName = supplierMatch[1].trim();
  }

  const subActionName = 'create_delivery';
  const action: ExecutableAiAction = {
    type: 'create_delivery',
    data: {
      supplier_name: supplierName,
      expected_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      items: [
        {
          product_name: 'Item Restock',
          quantity: 50,
          cost_price_mt: 30
        }
      ]
    }
  };

  const toolsDef = [
    {
      type: 'function',
      function: {
        name: 'manage_deliveries',
        description: 'Register expected supplier deliveries',
        parameters: {
          type: 'object',
          properties: {
            supplier_name: { type: 'string', description: 'Name of supplier' }
          },
          required: ['supplier_name']
        }
      }
    }
  ];

  const countMatch = query.match(/(\d+)\s*(?:deliveries|entregas|pedidos|orders?)/i);
  const deliveryCount = countMatch ? parseInt(countMatch[1], 10) : 1;

  const defaultMsg = isPt
    ? (deliveryCount > 1
        ? `Preparei ${deliveryCount} cartões de encomenda de entrega de fornecedores.`
        : `Preparei o registo de entrega esperada do fornecedor "${supplierName}". Verifique os itens e confirme.`)
    : (deliveryCount > 1
        ? `I have prepared ${deliveryCount} supplier delivery order cards.`
        : `I have prepared the expected delivery purchase order draft card for supplier "${supplierName}". Review items and confirm.`);

  try {
    const aiRes = await queryUnifiedAiEngine({
      prompt: query,
      systemPrompt: isPt
        ? `Você é o assistente Store Sentinel POS em Moçambique. O operador solicitou registar a entrega do fornecedor "${supplierName}". Responda em UMA ÚNICA frase curta e direta confirmando o registo. NUNCA mencione nomes de ferramentas de IA nem tutoriais.`
        : `You are Store Sentinel POS assistant in Mozambique. The cashier requested to register a delivery from supplier "${supplierName}". Respond in ONE single short, direct sentence confirming the draft order. NEVER mention AI tool names or tutorials.`,
      temperature: 0.1,
      pacing,
      tools: toolsDef
    });

    let rawText = (aiRes.text || '').trim();
    if (/(?:manage_deliveries|call the.*tool|step \d+|how to create|here are the steps|follow these steps|preparation for new|to prepare a new|insert details into|create a new record)/i.test(rawText)) {
      rawText = defaultMsg;
    }

    return {
      answer: rawText || defaultMsg,
      modelUsed: 'muse-spark-1.3',
      isOffline: aiRes.isOffline,
      executableAction: action,
      toolCalled: `lane4_delivery_po -> ${subActionName}`,
      suggestedActions: [
        { label: isPt ? 'Ver Entregas' : 'View Restock', tab: 'restock' }
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  } catch (err) {
    return {
      answer: defaultMsg,
      modelUsed: 'muse-spark-1.3',
      isOffline: true,
      executableAction: action,
      toolCalled: `lane4_delivery_po -> ${subActionName}`,
      suggestedActions: [{ label: 'View Restock', tab: 'restock' }],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }
}
