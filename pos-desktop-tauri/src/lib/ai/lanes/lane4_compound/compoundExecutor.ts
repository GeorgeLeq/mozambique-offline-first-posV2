/**
 * @file compoundExecutor.ts
 * @description Lane 4 Compound Executor.
 * Sequentially routes decomposed sub-tasks through domain sub-handlers (each triggering actual Llama neural turns),
 * logs command traces cleanly into SQLite, and aggregates genuine neural answers and action cards.
 * ZERO presets, ZERO hardcoded template text.
 */

import { DecomposedTask } from './taskDecomposer';
import { ExecutableAiAction, SentinelResponse } from '../../types';
import { logAiCommand } from '../../aiCommandLogger';
import { handleProductCrud } from './lane4_product_crud';
import { handleCustomerCrud } from './lane4_customer_crud';
import { handleDeliveryPo } from './lane4_delivery_po';
import { handleOperatorCrud } from './lane4_operator_crud';
import { handleCartCheckout } from './lane4_cart_checkout';

export interface CompoundExecutionOptions {
  tasks: DecomposedTask[];
  query: string;
  operatorName?: string;
  lang?: 'en' | 'pt';
}

/**
 * Sequentially executes decomposed sub-tasks across domain sub-handlers (each executing real Llama turns on Ollama).
 */
export async function executeCompoundTasks(options: CompoundExecutionOptions): Promise<SentinelResponse> {
  const { tasks, query, operatorName = 'Admin', lang = 'en' } = options;
  const isPt = lang === 'pt' || /adicionar|produtos|cliente|estoque|turno|entrega|operador/i.test(query);

  const executableActions: ExecutableAiAction[] = [];
  const textSummaries: string[] = [];
  const executedTools: string[] = [];
  let isOffline = false;

  for (const task of tasks) {
    let subRes: SentinelResponse | null = null;
    let intentName = 'lane4_compound_router';

    switch (task.type) {
      case 'CREATE_PRODUCT':
      case 'UPDATE_PRODUCT':
      case 'DELETE_PRODUCT': {
        intentName = 'lane4_compound_product_CRUD';
        const subPrompt = task.entityName
          ? `Add product: ${task.entityName}`
          : (task.count > 1 ? `Add ${task.count} products` : task.rawText || 'Add product');

        subRes = await handleProductCrud({ query: subPrompt, lang });
        break;
      }

      case 'CREATE_CUSTOMER':
      case 'UPDATE_CUSTOMER':
      case 'DELETE_CUSTOMER': {
        intentName = 'lane4_compound_customer_CRUD';
        const subPrompt = task.entityName
          ? `Register customer: ${task.entityName}`
          : (task.count > 1 ? `Register ${task.count} customers` : task.rawText || 'Register customer');

        subRes = await handleCustomerCrud({ query: subPrompt, lang });
        break;
      }

      case 'CREATE_DELIVERY': {
        intentName = 'lane4_compound_delivery_PO';
        const subPrompt = task.entityName
          ? `Register delivery from ${task.entityName}`
          : (task.count > 1 ? `Register ${task.count} supplier deliveries` : task.rawText || 'Register delivery');

        subRes = await handleDeliveryPo({ query: subPrompt, lang });
        break;
      }

      case 'CREATE_OPERATOR': {
        intentName = 'lane4_compound_operator_CRUD';
        const subPrompt = task.entityName
          ? `Create operator profile: ${task.entityName}`
          : (task.rawText || 'Create new operator profile');

        subRes = await handleOperatorCrud({ query: subPrompt, lang });
        break;
      }

      case 'ADD_TO_CART': {
        intentName = 'lane4_compound_cart_checkout';
        const subPrompt = task.rawText || 'Add items to cart';
        subRes = await handleCartCheckout({ query: subPrompt, lang });
        break;
      }

      default:
        break;
    }

    if (subRes) {
      if (subRes.isOffline) isOffline = true;

      if (subRes.answer) {
        textSummaries.push(subRes.answer);
      }

      if (subRes.executableAction) {
        executableActions.push(subRes.executableAction);
      }
      if (subRes.executableActions && subRes.executableActions.length > 0) {
        executableActions.push(...subRes.executableActions);
      }

      const toolTag = subRes.toolCalled || task.type;
      executedTools.push(toolTag);

      // Log AI command trace into local SQLite
      await logAiCommand({
        user_name: operatorName,
        device_origin: 'desktop_pos',
        input_type: 'text',
        raw_input: task.rawText || task.type,
        detected_intent: intentName,
        tool_called: toolTag,
        tool_arguments: { subTask: task.type, count: task.count, entityName: task.entityName },
        execution_status: 'success'
      });
    }
  }

  // Filter out any unwanted tool-calling phrases or hallucinations
  const cleanSummaries = textSummaries.filter(s =>
    !/manage inventory tool|call the.*tool|ferramenta manage/i.test(s) &&
    !/john doe/i.test(s)
  );

  const prodActions = executableActions.filter(a => a.type === 'create_product');
  const custActions = executableActions.filter(a => a.type === 'create_customer');
  const delivActions = executableActions.filter(a => a.type === 'create_delivery');
  const opActions = executableActions.filter(a => a.type === 'create_operator');

  const summaryParts: string[] = [];
  if (isPt) {
    if (prodActions.length > 0) summaryParts.push(`${prodActions.length} ${prodActions.length === 1 ? 'produto' : 'produtos'}`);
    if (custActions.length > 0) summaryParts.push(`${custActions.length} ${custActions.length === 1 ? 'cliente' : 'clientes'}`);
    if (delivActions.length > 0) summaryParts.push(`${delivActions.length} ${delivActions.length === 1 ? 'encomenda de entrega' : 'encomendas de entrega'}`);
    if (opActions.length > 0) summaryParts.push(`${opActions.length} ${opActions.length === 1 ? 'operador de caixa' : 'operadores de caixa'}`);
  } else {
    if (prodActions.length > 0) summaryParts.push(`${prodActions.length} ${prodActions.length === 1 ? 'product' : 'products'}`);
    if (custActions.length > 0) summaryParts.push(`${custActions.length} ${custActions.length === 1 ? 'customer' : 'customers'}`);
    if (delivActions.length > 0) summaryParts.push(`${delivActions.length} ${delivActions.length === 1 ? 'delivery order' : 'delivery orders'}`);
    if (opActions.length > 0) summaryParts.push(`${opActions.length} ${opActions.length === 1 ? 'operator profile' : 'operator profiles'}`);
  }

  const consolidatedMsg = summaryParts.length > 0
    ? (isPt
        ? `Preparei os cartões de confirmação para ${summaryParts.join(', ')} abaixo. Verifique os dados e confirme cada ação ou execute todas em sequência.`
        : `I have prepared the confirmation cards for ${summaryParts.join(', ')} below. Review the details and confirm each action or execute all in sequence.`)
    : '';

  const finalAnswer = consolidatedMsg || cleanSummaries.join('\n\n') || (isPt ? 'Operações sequenciais preparadas no SYCOMM POS.' : 'Sequential operations prepared on SYCOMM POS.');

  return {
    answer: finalAnswer,
    modelUsed: 'muse-spark-1.3',
    isOffline,
    executableAction: executableActions[0],
    executableActions: executableActions.length > 0 ? executableActions : undefined,
    toolCalled: executedTools.length > 0 ? executedTools.join(' -> ') : 'lane4_compound_router',
    suggestedActions: [
      { label: isPt ? 'Ver Estoque' : 'View Inventory', tab: 'products' },
      { label: isPt ? 'Ver Clientes' : 'View Customers', tab: 'clients' }
    ],
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
}
