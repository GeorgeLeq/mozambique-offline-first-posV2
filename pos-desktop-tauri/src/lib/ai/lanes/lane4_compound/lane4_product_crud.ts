/**
 * @file lane4_product_crud.ts
 * @description Lane 4 Sub-Handler: Product CRUD operations.
 * Handles single & batch product creation, updates, and soft deletes.
 * Logs tool execution as: lane4_product_crud -> <action>
 */

import { queryUnifiedAiEngine } from '../../unifiedAiClient';
import { ExecutableAiAction, SentinelResponse } from '../../types';

export interface ProductCrudOptions {
  query: string;
  lang?: 'en' | 'pt';
  pacing?: 'fast' | 'balanced' | 'detailed';
  onChunk?: (chunk: string) => void;
}

export function isProductCrudQuery(query: string): boolean {
  const q = query.toLowerCase();
  return (
    (q.includes('product') || q.includes('produto')) &&
    (q.includes('add') || q.includes('novo') || q.includes('new') || q.includes('criar') || q.includes('adicionar') || q.includes('update') || q.includes('alterar') || q.includes('mudar') || q.includes('delete') || q.includes('remover') || q.includes('preço'))
  );
}

export async function handleProductCrud(options: ProductCrudOptions): Promise<SentinelResponse> {
  const { query, lang = 'en', pacing = 'balanced', onChunk } = options;
  const isPt = lang === 'pt' || /adicionar|produto|novo|preco|preço|remover/i.test(query);

  // Extract name & price via fallback heuristics if prompt contains direct values
  let nameExtracted = 'New Product';
  let priceExtracted = 50;
  let stockExtracted = 10;

  const nameMatch = query.match(/(?:called|name|nome|produto|product)[:\s]+([A-ZÀ-Úa-zà-ú0-9\s]+?)(?=\s+(?:for|price|por|custo|preco|preço|\d+|$))/i);
  if (nameMatch) {
    nameExtracted = nameMatch[1].trim();
  }

  const priceMatch = query.match(/(?:for|price|por|preco|preço)[:\s]*(\d+(?:[.,]\d+)?)\s*(?:mt|meticais)?/i) || query.match(/(\d+)\s*(?:mt|meticais)/i);
  if (priceMatch) {
    priceExtracted = parseFloat(priceMatch[1].replace(',', '.'));
  }

  const isDelete = /delete|remover|apagar/i.test(query);
  const isUpdate = /update|alterar|mudar|atualizar/i.test(query);

  const countMatch = query.match(/\b([2-9]|10|two|three|four|five)\s+(?:new\s+)?products?/i);
  let batchCount = 0;
  if (countMatch) {
    const raw = countMatch[1].toLowerCase();
    const map: Record<string, number> = { 'two': 2, 'three': 3, 'four': 4, 'five': 5 };
    batchCount = map[raw] || parseInt(raw, 10) || 2;
  }

  const isBatch = batchCount > 1 || /batch|bulk|varios|vários/i.test(query);

  let subActionName = 'create_product';
  let action: ExecutableAiAction;

  if (isDelete) {
    subActionName = 'delete_product';
    action = {
      type: 'delete_product',
      data: {
        name: nameExtracted,
        reason: isPt ? 'Removido via assistente POS' : 'Removed via POS assistant'
      }
    };
  } else if (isUpdate) {
    subActionName = 'update_product';
    action = {
      type: 'update_product',
      data: {
        target_name: nameExtracted,
        name: nameExtracted,
        price_mt: priceExtracted,
        stock_quantity: stockExtracted
      }
    };
  } else if (isBatch) {
    subActionName = 'batch_create_products';
    const effectiveCount = batchCount > 1 ? batchCount : 2;
    const items = [];
    for (let i = 1; i <= effectiveCount; i++) {
      items.push({
        name: `${nameExtracted} ${i}`,
        price_mt: priceExtracted,
        stock_quantity: stockExtracted,
        category: 'Geral'
      });
    }
    action = {
      type: 'batch_create_products',
      data: { products: items }
    };
  } else {
    subActionName = 'create_product';
    action = {
      type: 'create_product',
      data: {
        name: nameExtracted,
        price_mt: priceExtracted,
        cost_price_mt: Math.round(priceExtracted * 0.7),
        stock_quantity: stockExtracted,
        category: 'Geral'
      }
    };
  }

  const cleanActionDesc = isDelete
    ? `Product removal staged for "${nameExtracted}".`
    : isUpdate
    ? `Product update staged for "${nameExtracted}" with new price ${priceExtracted} MT.`
    : `Product draft card created for "${nameExtracted}" at ${priceExtracted} MT with initial stock ${stockExtracted} units.`;

  const systemInstruction = isPt
    ? `Você é o Store Sentinel AI da loja de retalho SYCOMM POS em Moçambique.
AÇÃO PREPARADA PARA O BANCO SQLITE LOCAL:
${cleanActionDesc}

INSTRUÇÕES OBRIGATÓRIAS (ZERO PRESETS):
Responda diretamente em texto natural com tom profissional de assistente de loja.
1. Confirme com as suas próprias palavras a ação preparada para o operador.
2. Destaque os detalhes principais em marcadores (•) (Produto, Preço em MT, Quantidade).
3. REGRA CRÍTICA: NUNCA use chavetas {} nem escreva placeholders como [Insira ...] ou [Insert ...].
4. Formate a moeda estritamente em Meticais (MT). NUNCA converta para dólares ($/USD) nem invente produtos adicionais.`
    : `You are Store Sentinel AI for SYCOMM POS retail shops in Mozambique.
STAGED SQLITE ACTION DETAILS:
${cleanActionDesc}

MANDATORY INSTRUCTIONS (ZERO PRESETS):
Respond directly in natural text in a professional store assistant voice.
1. Confirm the staged action naturally in your own words.
2. Provide concise bullet points (•) highlighting the key details (Product, Price in MT, Stock units).
3. CRITICAL RULE: NEVER output curly braces {} or bracket placeholders like [Insert Product Name] or [Insert Price]. Output the actual values directly.
4. Currency is strictly Mozambican Meticais (MT). NEVER convert prices to USD ($) or mention dollars, and NEVER invent extra products.`;

  try {
    let streamedText = '';
    const aiRes = await queryUnifiedAiEngine({
      prompt: query,
      systemPrompt: systemInstruction,
      temperature: 0.35,
      pacing,
      onChunk: (chunk: string) => {
        streamedText += chunk;
        if (onChunk) {
          onChunk(chunk);
        }
      }
    });

    const rawAnswer = aiRes.text || '';
    const cleanAnswer = rawAnswer
      .replace(/\{[a-zA-Z0-9_\[\]\s:"',-]+\}\s*/g, '')
      .replace(/\{\s*\}/g, '')
      .replace(/\[\s*(?:Insert|Insira|Preencha|Digite)[^\]]*\]/gi, '')
      .replace(/\[\s*\]/g, '')
      .replace(/\s*\((?:approximately|aprox\.?|cerca de)?\s*\$[\d.,]+\s*(?:USD)?\)/gi, '')
      .replace(/\b(?:USD|\$)\s*(\d+(?:[.,]\d+)?)/gi, '$1 MT')
      .replace(/\$\s*\[/g, '[')
      .replace(/\bSimbamente\b/gi, 'Certamente')
      .trim();

    return {
      answer: cleanAnswer || (isPt ? `• Cartão de rascunho de "${nameExtracted}" pronto para o SQLite.` : `• Staged "${nameExtracted}" draft ready for SQLite commit.`),
      modelUsed: aiRes.modelUsed || 'llama3.2:1b-local',
      isOffline: aiRes.isOffline,
      executableAction: action,
      toolCalled: `lane4_product_crud -> ${subActionName}`,
      suggestedActions: [
        { label: isPt ? 'Ver Produtos' : 'View Products', tab: 'products' }
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  } catch (err: any) {
    return {
      answer: isPt
        ? `• Preparei o registo de "${nameExtracted}" (${priceExtracted} MT) pronto para confirmar no SQLite.`
        : `• Staged product record for "${nameExtracted}" (${priceExtracted} MT) ready for SQLite confirmation.`,
      modelUsed: 'offline',
      isOffline: true,
      executableAction: action,
      toolCalled: `lane4_product_crud -> ${subActionName}`,
      suggestedActions: [{ label: 'View Products', tab: 'products' }],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }
}
