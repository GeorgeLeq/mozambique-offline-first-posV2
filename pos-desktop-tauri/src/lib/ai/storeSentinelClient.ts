/**
 * @file storeSentinelClient.ts
 * @description Master Dispatcher for Store Sentinel 4-Lane Architecture.
 * Routes user queries cleanly into:
 *  - Lane 1: Creative Marketing & Promotional Copywriter (Zero inventory dumps, target product only)
 *  - Lane 2: Open World Knowledge & Free Chat (Pure CMD Mode, zero store telemetry)
 *  - Lane 3: Exact POS Stock & Operations (Grounded in SQLite, Pure Llama 3.2 1B + JIT Tools, ZERO Presets)
 *  - Lane 4: Compound Router & Sequential Multi-Task Engine (Splits complex tasks, avoids 1B confusion)
 */

import { logAiCommand } from './aiCommandLogger';
import { 
  queryUnifiedAiEngine, 
  getActiveAiDisplayName 
} from './unifiedAiClient';
import { setProfilerGear } from './unified/profilerStore';
import { 
  isMuseOnline, 
  getMuseApiKey, 
  getMuseApiUrl, 
  setMuseApiKey 
} from './museClient';
import { searchMarketInsights } from './webSearchClient';
import { posActionDispatcher, chatAgentBridge } from './actions';
import {
  isMarketingQuery,
  handleMarketingQuery,
  isImageQuery,
  handleImageQuery,
  isOpenChatQuery,
  handleOpenChatQuery,
  isPosOperationQuery,
  handlePosOperationQuery,
  isCompoundFetchQuery,
  handleCompoundFetchQuery,
  isCompoundQuery,
  decomposeQuery,
  executeCompoundTasks,
  isProductCrudQuery,
  handleProductCrud,
  isCustomerCrudQuery,
  handleCustomerCrud,
  isOperatorCrudQuery,
  handleOperatorCrud,
  isCartCheckoutQuery,
  handleCartCheckout,
  isDeliveryPoQuery,
  handleDeliveryPo
} from './lanes';
import {
  SentinelAction,
  SentinelTelemetryHighlight,
  ExecutableAiAction,
  SentinelResponse,
  StoreTelemetrySnapshot
} from './types';
import { fetchStoreTelemetrySnapshot } from './telemetryFetcher';

// Re-export all types, telemetry, actions and lanes
export * from './types';
export * from './telemetryFetcher';
export * from './actions/posActionDispatcher';
export * from './lanes';

export { 
  isMuseOnline, 
  getMuseApiKey, 
  getMuseApiUrl, 
  setMuseApiKey,
  getMuseApiKey as getAiApiKey,
  setMuseApiKey as setAiApiKey,
  getMuseApiUrl as getAiApiUrl
};

/**
 * Checks whether the AI service is online.
 */
export function isAiOnline(): boolean {
  return isMuseOnline();
}

/**
 * Executes a live query directly through the 4-Lane Store Sentinel Architecture.
 * ZERO presets - fully dynamic neural generation with SQLite telemetry & live search.
 */
export async function askStoreSentinel(
  query: string,
  options: {
    inputType?: 'voice' | 'text';
    transcription?: string;
    userId?: string;
    userName?: string;
    userRole?: string;
    currentUser?: { id?: string; name?: string; role?: string; terminal_name?: string } | null;
    chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
    lang?: string;
    onChunk?: (chunk: string) => void;
  } = {}
): Promise<SentinelResponse> {
  const operatorName = options.currentUser?.name || options.userName || 'Admin';
  const lang = (options.lang === 'pt' ? 'pt' : 'en') as 'en' | 'pt';
  const qClean = query.trim();

  try {
    // =========================================================================
    // LANE 4: Compound Router & Sequential Multi-Task Engine
    // Triggers: "add 2 products and 1 customer", "check stock and see who logged in"
    // =========================================================================
    if (isCompoundQuery(qClean)) {
      setProfilerGear(4, qClean);
      const decomposition = decomposeQuery(qClean);
      if (decomposition.isCompound && decomposition.tasks.length >= 2) {
        const res = await executeCompoundTasks({
          tasks: decomposition.tasks,
          query: qClean,
          operatorName,
          lang
        });

        await logCommand({
          operatorName,
          query: qClean,
          options,
          intent: 'compound_multitask',
          toolCalled: res.toolCalled || 'lane4_compound_router',
          answer: res.answer,
          hasAction: Boolean(res.executableActions && res.executableActions.length > 0)
        });

        return res;
      }
    }

    if (isProductCrudQuery(qClean)) {
      setProfilerGear(4, qClean);
      const res = await handleProductCrud({ query: qClean, lang, onChunk: options.onChunk });
      await logCommand({
        operatorName,
        query: qClean,
        options,
        intent: 'product_crud',
        toolCalled: res.toolCalled || 'lane4_product_crud',
        answer: res.answer,
        hasAction: Boolean(res.executableAction)
      });
      return res;
    }

    if (isCustomerCrudQuery(qClean)) {
      setProfilerGear(4, qClean);
      const res = await handleCustomerCrud({ query: qClean, lang, onChunk: options.onChunk });
      await logCommand({
        operatorName,
        query: qClean,
        options,
        intent: 'customer_crud',
        toolCalled: res.toolCalled || 'lane4_customer_crud',
        answer: res.answer,
        hasAction: Boolean(res.executableAction)
      });
      return res;
    }

    if (isOperatorCrudQuery(qClean)) {
      setProfilerGear(4, qClean);
      const res = await handleOperatorCrud({ query: qClean, lang });
      await logCommand({
        operatorName,
        query: qClean,
        options,
        intent: 'operator_crud',
        toolCalled: res.toolCalled || 'lane4_operator_crud',
        answer: res.answer,
        hasAction: Boolean(res.executableAction)
      });
      return res;
    }

    if (isCartCheckoutQuery(qClean)) {
      setProfilerGear(4, qClean);
      const res = await handleCartCheckout({ query: qClean, lang });
      await logCommand({
        operatorName,
        query: qClean,
        options,
        intent: 'cart_checkout',
        toolCalled: res.toolCalled || 'lane4_cart_checkout',
        answer: res.answer,
        hasAction: Boolean(res.executableAction)
      });
      return res;
    }

    // =========================================================================
    // LANE 3: Exact POS Stock & Operations (Grounded in SQLite)
    // Must be evaluated before any delivery-management lane so informational inquiries
    // like "what is our stock, customer and delivery levels?" do not get misrouted into
    // create-delivery workflows.
    // =========================================================================
    if (isPosOperationQuery(qClean) || isOperationalKeywords(qClean)) {
      setProfilerGear(3, qClean);
      if (isCompoundFetchQuery(qClean)) {
        const res = await handleCompoundFetchQuery({
          query: qClean,
          operatorName,
          lang,
          onChunk: options.onChunk
        });

        await logCommand({
          operatorName,
          query: qClean,
          options,
          intent: 'compound_operational_fetch',
          toolCalled: res.toolCalled || 'lane3_compound_fetch',
          answer: res.answer,
          hasAction: false
        });

        return res;
      }

      const res = await handlePosOperationQuery({
        query: qClean,
        operatorName,
        lang,
        onChunk: options.onChunk
      });

      await logCommand({
        operatorName,
        query: qClean,
        options,
        intent: 'pos_stock_operations',
        toolCalled: res.toolCalled || 'lane3_pos_operations',
        answer: res.answer,
        hasAction: false
      });

      return res;
    }

    if (isDeliveryPoQuery(qClean)) {
      setProfilerGear(4, qClean);
      const res = await handleDeliveryPo({ query: qClean, lang });
      await logCommand({
        operatorName,
        query: qClean,
        options,
        intent: 'delivery_po',
        toolCalled: res.toolCalled || 'lane4_delivery_po',
        answer: res.answer,
        hasAction: Boolean(res.executableAction)
      });
      return res;
    }

    // =========================================================================
    // LANE 1: Creative Marketing & Promotional Image Department
    // =========================================================================
    if (isImageQuery(qClean)) {
      setProfilerGear(1, qClean);
      const res = await handleImageQuery({
        query: qClean,
        lang
      });

      await logCommand({
        operatorName,
        query: qClean,
        options,
        intent: 'marketing_image_generation',
        toolCalled: 'lane1_image_generator',
        answer: res.answer,
        hasAction: Boolean(res.executableAction)
      });

      return res;
    }

    if (isMarketingQuery(qClean)) {
      setProfilerGear(1, qClean);
      const res = await handleMarketingQuery({
        query: qClean,
        lang,
        onChunk: options.onChunk
      });

      await logCommand({
        operatorName,
        query: qClean,
        options,
        intent: 'creative_marketing',
        toolCalled: 'lane1_marketing_copywriter',
        answer: res.answer,
        hasAction: false
      });

      return res;
    }

    // =========================================================================
    // LANE 2: Open World Knowledge & Free Chat (CMD Mode)
    // Triggers: "What is the latest Samsung device?", tech, weather, poetry, greetings
    // Behavior: Completely strips out store inventory and background telemetry. Llama responds naturally.
    // =========================================================================
    if (isOpenChatQuery(qClean)) {
      setProfilerGear(2, qClean);
      const res = await handleOpenChatQuery({
        query: qClean,
        chatHistory: options.chatHistory,
        lang,
        onChunk: options.onChunk
      });

      await logCommand({
        operatorName,
        query: qClean,
        options,
        intent: 'open_world_chat',
        toolCalled: 'lane2_cmd_chat',
        answer: res.answer,
        hasAction: false
      });

      return res;
    }

    // =========================================================================
    // FALLBACK: Live Web Market Search or Natural Llama Fallback
    // =========================================================================
    const isWebSearch = /search web|search internet|pesquisa na internet|mercado grossista|wholesale market/i.test(qClean);
    if (isWebSearch) {
      const topic = qClean.replace(/search (the )?(internet|web) for/i, '').replace(/pesquisa na internet sobre/i, '').trim();
      let webContext = '';
      try {
        const insights = await searchMarketInsights(topic);
        if (insights.length > 0) {
          webContext = insights.slice(0, 2).map(r => `• ${r.title}: ${r.snippet}`).join('\n');
        }
      } catch (_) {}

      const answer = webContext
        ? `Here are current market findings for "${topic}":\n\n${webContext}`
        : `Could not retrieve live online prices for "${topic}". Checking local catalog instead.`;

      return {
        answer,
        modelUsed: 'muse-spark-1.3',
        isOffline: false,
        suggestedActions: [{ label: 'View Products', tab: 'products' }],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    }

    // Default: Run through Lane 2 CMD mode so Llama answers naturally
    setProfilerGear(2, qClean);
    const defaultRes = await handleOpenChatQuery({
      query: qClean,
      chatHistory: options.chatHistory,
      lang,
      onChunk: options.onChunk
    });

    await logCommand({
      operatorName,
      query: qClean,
      options,
      intent: 'general_inquiry',
      toolCalled: 'lane2_cmd_chat',
      answer: defaultRes.answer,
      hasAction: false
    });

    return defaultRes;

  } catch (err: any) {
    console.error('[StoreSentinel] Router error:', err);
    return {
      answer: `Unable to process query: ${err.message || 'System error'}`,
      modelUsed: 'muse-spark-1.3',
      isOffline: true,
      suggestedActions: [{ label: 'Main Menu', tab: 'menu' }],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }
}

/**
 * Checks if query contains store operation keywords
 */
function isOperationalKeywords(query: string): boolean {
  const q = query.toLowerCase();
  return (
    q.includes('stock') ||
    q.includes('estoque') ||
    q.includes('product') ||
    q.includes('produto') ||
    q.includes('customer') ||
    q.includes('cliente') ||
    q.includes('shift') ||
    q.includes('turno') ||
    q.includes('delivery') ||
    q.includes('entrega') ||
    q.includes('fiado') ||
    q.includes('debt')
  );
}

/**
 * Helper to log commands into SQLite audit trail
 */
async function logCommand(params: {
  operatorName: string;
  query: string;
  options: any;
  intent: string;
  toolCalled: string;
  answer: string;
  hasAction: boolean;
}): Promise<void> {
  try {
    await logAiCommand({
      user_name: params.operatorName,
      device_origin: 'desktop_pos',
      input_type: params.options.inputType || 'text',
      raw_input: params.query,
      transcription: params.options.transcription,
      detected_intent: params.intent,
      tool_called: params.toolCalled,
      tool_arguments: { query: params.query },
      tool_result: { answerLength: params.answer.length, hasAction: params.hasAction },
      execution_status: 'success'
    });
  } catch (err) {
    console.warn('[StoreSentinel] Failed to log command:', err);
  }
}
