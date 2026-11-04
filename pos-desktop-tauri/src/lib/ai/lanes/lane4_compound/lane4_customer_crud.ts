/**
 * @file lane4_customer_crud.ts
 * @description Lane 4 Sub-Handler: Customer CRUD operations.
 * Handles customer registration, profile updates, and debt account management.
 * Logs tool execution as: lane4_customer_crud -> <action>
 */

import { queryUnifiedAiEngine } from '../../unifiedAiClient';
import { ExecutableAiAction, SentinelResponse } from '../../types';

export interface CustomerCrudOptions {
  query: string;
  lang?: 'en' | 'pt';
  pacing?: 'fast' | 'balanced' | 'detailed';
  onChunk?: (chunk: string) => void;
}

export function isCustomerCrudQuery(query: string): boolean {
  const q = query.toLowerCase();
  return (
    (q.includes('customer') || q.includes('cliente') || q.includes('client')) &&
    (q.includes('add') || q.includes('novo') || q.includes('new') || q.includes('criar') || q.includes('adicionar') || q.includes('cadastrar') || q.includes('update') || q.includes('delete') || q.includes('remover') || q.includes('fiado'))
  );
}

export async function handleCustomerCrud(options: CustomerCrudOptions): Promise<SentinelResponse> {
  const { query, lang = 'en', pacing = 'balanced', onChunk } = options;
  const isPt = lang === 'pt' || /adicionar|cliente|novo|cadastrar|fiado/i.test(query);

  let nameExtracted = 'New Customer';
  let phoneExtracted = '+258 84 000 0000';
  let debtExtracted = 0;

  const nameMatch = query.match(/(?:called|name|nome|cliente|customer)[:\s]+([A-ZÀ-Úa-zà-ú\s]+?)(?=\s+(?:with|phone|telefone|fiado|debt|por|$))/i);
  if (nameMatch) {
    nameExtracted = nameMatch[1].trim();
  }

  const debtMatch = query.match(/(?:debt|fiado|dívida)[:\s]*(\d+(?:[.,]\d+)?)\s*(?:mt)?/i);
  if (debtMatch) {
    debtExtracted = parseFloat(debtMatch[1].replace(',', '.'));
  }

  const isDelete = /delete|remover|apagar/i.test(query);
  const isUpdate = /update|alterar|mudar|atualizar/i.test(query);

  let subActionName = 'create_customer';
  let action: ExecutableAiAction;

  if (isDelete) {
    subActionName = 'delete_customer';
    action = {
      type: 'delete_customer',
      data: {
        customer_name: nameExtracted
      }
    };
  } else if (isUpdate) {
    subActionName = 'update_customer';
    action = {
      type: 'update_customer',
      data: {
        customer_name: nameExtracted,
        phone_number: phoneExtracted,
        address: 'Maputo'
      }
    };
  } else {
    subActionName = 'create_customer';
    action = {
      type: 'create_customer',
      data: {
        customer_name: nameExtracted,
        phone_number: phoneExtracted,
        address: 'Maputo',
        initial_debt_mt: debtExtracted
      }
    };
  }

  const cleanActionDesc = isDelete
    ? `Customer removal staged for "${nameExtracted}".`
    : isUpdate
    ? `Customer profile update staged for "${nameExtracted}".`
    : `Customer registration staged for "${nameExtracted}" with initial debt ${debtExtracted} MT.`;

  const systemInstruction = isPt
    ? `Você é o Store Sentinel AI da loja de retalho SYCOMM POS em Moçambique.
AÇÃO PREPARADA PARA O BANCO SQLITE LOCAL:
${cleanActionDesc}

INSTRUÇÕES OBRIGATÓRIAS (ZERO PRESETS):
Responda diretamente em texto natural com tom profissional de assistente de loja.
1. Confirme com as suas próprias palavras a ação preparada para o operador.
2. Destaque os detalhes em marcadores (•) (Nome, Fiado em MT).
3. REGRA CRÍTICA: NUNCA use chavetas {} nem escreva placeholders como [Insira ...] ou [Insert ...]. Use os dados reais preparados.
4. Formate valores monetários em Meticais (MT).`
    : `You are Store Sentinel AI for SYCOMM POS retail shops in Mozambique.
STAGED SQLITE ACTION DETAILS:
${cleanActionDesc}

MANDATORY INSTRUCTIONS (ZERO PRESETS):
Respond directly in natural text in a professional store assistant voice.
1. Confirm the staged action naturally in your own words.
2. Provide concise bullet points (•) highlighting the details (Name, Debt in MT).
3. CRITICAL RULE: NEVER output curly braces {} or bracket placeholders like [Insert New Customer Name]. State the actual details directly.
4. Always format currency in Mozambican Meticais (MT).`;

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
      answer: cleanAnswer || (isPt ? `• Ficha do cliente "${nameExtracted}" preparada para o SQLite.` : `• Staged customer record for "${nameExtracted}" ready for SQLite.`),
      modelUsed: aiRes.modelUsed || 'llama3.2:1b-local',
      isOffline: aiRes.isOffline,
      executableAction: action,
      toolCalled: `lane4_customer_crud -> ${subActionName}`,
      suggestedActions: [
        { label: isPt ? 'Ver Clientes' : 'View Customers', tab: 'clients' }
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  } catch (err: any) {
    return {
      answer: isPt
        ? `• Preparei a ficha de cadastro para o cliente "${nameExtracted}".`
        : `• Staged customer account card for "${nameExtracted}".`,
      modelUsed: 'offline',
      isOffline: true,
      executableAction: action,
      toolCalled: `lane4_customer_crud -> ${subActionName}`,
      suggestedActions: [{ label: 'View Customers', tab: 'clients' }],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }
}
