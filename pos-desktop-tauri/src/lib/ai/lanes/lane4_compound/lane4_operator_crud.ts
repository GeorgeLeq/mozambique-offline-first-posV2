/**
 * @file lane4_operator_crud.ts
 * @description Lane 4 Sub-Handler: Staff & Operator CRUD operations.
 * Handles cashier registrations, PIN updates, and security block toggles.
 * Logs tool execution as: lane4_operator_crud -> <action>
 */

import { queryUnifiedAiEngine } from '../../unifiedAiClient';
import { ExecutableAiAction, SentinelResponse } from '../../types';

export interface OperatorCrudOptions {
  query: string;
  lang?: 'en' | 'pt';
  pacing?: 'fast' | 'balanced' | 'detailed';
}

export function isOperatorCrudQuery(query: string): boolean {
  const q = query.toLowerCase();
  return (
    (q.includes('operator') || q.includes('cashier') || q.includes('operador') || q.includes('caixa') || q.includes('staff') || q.includes('funcionario') || q.includes('funcionário')) &&
    (q.includes('add') || q.includes('novo') || q.includes('new') || q.includes('criar') || q.includes('adicionar') || q.includes('cadastrar') || q.includes('block') || q.includes('bloquear') || q.includes('delete') || q.includes('remover'))
  );
}

export async function handleOperatorCrud(options: OperatorCrudOptions): Promise<SentinelResponse> {
  const { query, lang = 'en', pacing = 'balanced' } = options;
  const isPt = lang === 'pt' || /adicionar|operador|caixa|bloquear|cadastrar/i.test(query);

  let nameExtracted = 'New Operator';
  let pinExtracted = '1234';

  const nameMatch = query.match(/(?:called|name|nome|operator|operador|caixa)[:\s]+([A-ZÀ-Úa-zà-ú\s]+?)(?=\s+(?:with|pin|pin|cargo|role|$))/i);
  if (nameMatch) {
    nameExtracted = nameMatch[1].trim();
  }

  const pinMatch = query.match(/(?:pin|code)[:\s]*(\d{4})/i);
  if (pinMatch) {
    pinExtracted = pinMatch[1];
  }

  const isDelete = /delete|remover|apagar/i.test(query);
  const isUpdate = /update|alterar|mudar|block|bloquear/i.test(query);

  let subActionName = 'create_operator';
  let action: ExecutableAiAction;

  if (isDelete) {
    subActionName = 'delete_operator';
    action = {
      type: 'delete_operator',
      data: {
        name: nameExtracted
      }
    };
  } else if (isUpdate) {
    subActionName = 'update_operator';
    action = {
      type: 'update_operator',
      data: {
        name: nameExtracted,
        pin: pinExtracted,
        role: 'operator',
        is_blocked: query.includes('block') || query.includes('bloquear')
      }
    };
  } else {
    subActionName = 'create_operator';
    action = {
      type: 'create_operator',
      data: {
        name: nameExtracted,
        pin: pinExtracted,
        role: 'operator',
        terminal_name: 'Caixa Principal'
      }
    };
  }

  const toolsDef = [
    {
      type: 'function',
      function: {
        name: 'manage_operator',
        description: 'Create, update or block cashier operators',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name of cashier operator' },
            pin: { type: 'string', description: '4 digit access PIN' }
          },
          required: ['name']
        }
      }
    }
  ];

  const defaultMsg = isPt
    ? `Preparei o cartão de cadastro para o operador de caixa "${nameExtracted}". Verifique e confirme para atribuir os acessos.`
    : `I have prepared the operator profile registration card for "${nameExtracted}". Review and confirm to assign credentials.`;

  try {
    const aiRes = await queryUnifiedAiEngine({
      prompt: query,
      systemPrompt: isPt
        ? `Você é o assistente Store Sentinel POS em Moçambique. O operador solicitou gerir perfis de operadores de caixa. Responda em UMA ÚNICA frase curta e direta confirmando o perfil. Chame a ferramenta manage_operator. NUNCA escreva tutoriais, manuais, passos numerados nem instruções de banco de dados SQL.`
        : `You are Store Sentinel POS assistant in Mozambique. The cashier requested to manage cashier profiles. Respond in ONE single short, direct sentence confirming the operator card. Call the manage_operator tool. CRITICAL: NEVER write tutorials, numbered steps, manuals, or database guides. Respond directly to the cashier.`,
      temperature: 0.1,
      pacing,
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
      toolCalled: `lane4_operator_crud -> ${subActionName}`,
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
      toolCalled: `lane4_operator_crud -> ${subActionName}`,
      suggestedActions: [{ label: 'Register', tab: 'caixas' }],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }
}
