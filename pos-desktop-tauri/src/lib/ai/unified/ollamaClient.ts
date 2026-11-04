/**
 * @file ollamaClient.ts
 * @description Ollama query engine, telemetry context compressor, and suggested actions extractor.
 */

import { ChatHistoryTurn, UnifiedAiChatResult, LlamaToolCall } from './types';
import {
  getActiveAiProvider,
  getEmbeddedModelName,
  getOllamaEndpoint,
  getOllamaModel
} from './config';
import { getOllamaCandidateUrls } from './healthCheck';
import { recordProfilerMetrics } from './profilerStore';
import { isBasetenOnline, queryBasetenFallback } from './basetenClient';

/**
 * Sanitizes and compresses live SQLite telemetry into a lightweight, clean summary.
 * Strips out internal audit logs, failed command traces, and verbose JSON schemas
 * to prevent small 1B/3B models on Core i3 CPUs from getting overwhelmed or copying error structures.
 */
export function buildCleanTelemetryText(telemetry?: Record<string, any>): string {
  if (!telemetry || typeof telemetry !== 'object' || Object.keys(telemetry).length === 0) return '';

  const parts: string[] = [];

  if (telemetry.shopName) {
    parts.push(`Shop: "${telemetry.shopName}"`);
  }
  if (typeof telemetry.todaySalesTotal === 'number') {
    parts.push(`Today Sales: ${telemetry.todaySalesTotal.toLocaleString('pt-MZ')} MT (${telemetry.todaySalesCount ?? 0} tx)`);
  }
  if (telemetry.paymentMethodsBreakdown && typeof telemetry.paymentMethodsBreakdown === 'object') {
    const { cash = 0, mpesa = 0, emola = 0, fiado = 0 } = telemetry.paymentMethodsBreakdown;
    parts.push(`Payments: Cash ${cash} MT, M-Pesa ${mpesa} MT, e-Mola ${emola} MT, Fiado ${fiado} MT`);
  }
  if (Array.isArray(telemetry.lowStockProducts) && telemetry.lowStockProducts.length > 0) {
    const sample = telemetry.lowStockProducts.slice(0, 3).map((p: any) => `${p.name || 'item'} (${p.stock_quantity ?? 0} left)`).join(', ');
    parts.push(`Low Stock (${telemetry.lowStockProducts.length}): ${sample}`);
  }
  if (Array.isArray(telemetry.topCustomers) && telemetry.topCustomers.length > 0) {
    const debtors = telemetry.topCustomers.filter((c: any) => (c.total_debt ?? 0) > 0).slice(0, 3);
    if (debtors.length > 0) {
      parts.push(`Top Debtors: ${debtors.map((d: any) => `${d.customer_name} (${d.total_debt} MT)`).join(', ')}`);
    }
  }

  // Fallback if custom telemetry object passed without standard keys
  if (parts.length === 0) {
    const safeKeys = Object.keys(telemetry).filter(k =>
      !['recentAiCommands', 'recentAudits', 'error', 'errors', 'rawLogs', 'stackTrace', 'auditLogs', 'scanStatsByUser', 'recentShifts'].includes(k) &&
      (typeof telemetry[k] === 'string' || typeof telemetry[k] === 'number' || typeof telemetry[k] === 'boolean')
    );
    for (const k of safeKeys.slice(0, 4)) {
      parts.push(`${k}: ${telemetry[k]}`);
    }
  }

  return parts.length > 0 ? `\n[Live Store Data: ${parts.join(' | ')}]` : '';
}

/**
 * Extracts recommended navigation tabs based on LLM output context.
 */
export function extractSuggestedActions(text: string): Array<{ label: string; tab: string }> {
  const actions: Array<{ label: string; tab: string }> = [];
  const lower = text.toLowerCase();

  if (lower.includes('stock') || lower.includes('inventory') || lower.includes('produtos')) {
    actions.push({ label: 'View Products & Stock', tab: 'products' });
  }
  if (lower.includes('fiado') || lower.includes('debt') || lower.includes('customer') || lower.includes('cliente')) {
    actions.push({ label: 'View Customers & Debts', tab: 'clients' });
  }
  if (lower.includes('caixa') || lower.includes('shift') || lower.includes('drawer') || lower.includes('cash')) {
    actions.push({ label: 'Open Cash Registers', tab: 'caixas' });
  }
  if (lower.includes('relat') || lower.includes('report') || lower.includes('sales') || lower.includes('vendas')) {
    actions.push({ label: 'View Sales Reports', tab: 'reports' });
  }

  return actions.slice(0, 3);
}

/**
 * Strips any trailing roleplay hallucinations (e.g., 'User: ... Assistant: ...')
 * that small 1B models occasionally generate when concluding a response.
 * Strictly sanitizes any Brazilian Real currency symbols (R$) to Mozambican Meticais (MT).
 */
function cleanTrailingDialogue(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/(?:\r?\n|^)\s*(?:User|Assistant|Operator|Store Sentinel AI):[\s\S]*$/i, '')
    // Fix Brazilian currency
    .replace(/R\$\s*(\d+(?:[.,]\d+)?)/gi, '$1 MT')
    .replace(/R\$/g, 'MT')
    .replace(/\breais\b/gi, 'Meticais')
    // Remove foreign currency dollar conversions e.g. "(approximately $0.80 USD)" or "$[Insert Price]"
    .replace(/\s*\((?:approximately|aprox\.?|cerca de)?\s*\$[\d.,]+\s*(?:USD)?\)/gi, '')
    .replace(/\b(?:USD|\$)\s*(\d+(?:[.,]\d+)?)/gi, '$1 MT')
    .replace(/\$\s*\[/g, '[')
    // Clean invented pseudo-Portuguese words like "Simbamente" -> "Certamente"
    .replace(/\bSimbamente\b/gi, 'Certamente')
    .replace(/\bsimbamente\b/gi, 'certamente')
    // Strip empty placeholder brackets like [Insert ...] or [Insira ...]
    .replace(/\[\s*(?:Insert|Insira|Preencha|Digite)[^\]]*\]/gi, '')
    .replace(/\[\s*\]/g, '')
    .trim();
}

/**
 * Queries the active AI engine (Local Ollama or Embedded GGUF pos-parser).
 * Injects sanitized SQLite store telemetry and returns authentic local neural output.
 * Preserves multi-turn session history so the model remembers past interactions.
 * ZERO presets, ZERO canned fake responses.
 */
// Cache working endpoint in memory for zero-latency lookups on subsequent turns
let cachedWorkingEndpoint: string | null = null;

export async function queryUnifiedAiEngine(options: {
  prompt: string;
  systemPrompt?: string;
  telemetryContext?: Record<string, any>;
  chatHistory?: ChatHistoryTurn[];
  temperature?: number;
  maxTokens?: number;
  pacing?: 'fast' | 'balanced' | 'detailed';
  tools?: any[];
  format?: 'json' | string;
  signal?: AbortSignal;
  onChunk?: (chunk: string) => void;
}): Promise<UnifiedAiChatResult> {
  const { prompt, systemPrompt, telemetryContext, chatHistory = [], temperature = 0.1, maxTokens, pacing = 'balanced', tools, format, signal, onChunk } = options;
  const provider = getActiveAiProvider();
  const startTime = performance.now();

  let combinedSystem = systemPrompt?.trim() || `You are the local POS assistant for SYCOMM retail store in Mozambique. Provide direct, complete, and factual answers.`;

  // Strict Mozambican Currency Enforcement
  combinedSystem += `\n[CURRENCY MANDATE: Store currency is strictly Mozambican Meticais (MT). NEVER output Brazilian Reais (R$), Dollars ($), or Euros (€). Always write 'MT'.]`;

  // Apply user-selected Pacing Mode instruction to guide response length without presets
  if (pacing === 'fast') {
    combinedSystem += `\n[PACING REQUIREMENT: FAST] Keep your response ultra-concise in 1 to 2 short sentences. Deliver immediate numbers with zero conversational padding.`;
  } else if (pacing === 'detailed') {
    combinedSystem += `\n[PACING REQUIREMENT: IN-DEPTH] Provide a comprehensive, rich, and exhaustive multi-paragraph response with full retail operational context.`;
  } else {
    combinedSystem += `\n[PACING REQUIREMENT: BALANCED] Provide 1 direct opening sentence followed by 2 to 3 concise bullet points with numbers.`;
  }

  // If user explicitly configured Baseten Muse Spark as active provider
  if (provider === 'baseten-muse') {
    return queryBasetenFallback({
      prompt,
      systemPrompt: combinedSystem,
      chatHistory,
      temperature
    });
  }
  if (
    telemetryContext &&
    !combinedSystem.includes('CRITICAL OPEN-CHAT INSTRUCTIONS') &&
    !combinedSystem.includes('CRITICAL CREATIVE & WELLBEING INSTRUCTIONS') &&
    !combinedSystem.includes('creative retail marketing copywriter') &&
    !combinedSystem.includes('STORE DATA:') &&
    !combinedSystem.includes('Catálogo relevante')
  ) {
    const cleanTelemetry = buildCleanTelemetryText(telemetryContext);
    if (cleanTelemetry) {
      combinedSystem += `\n${cleanTelemetry}`;
    }
  }

  // Pure Localhost Inference: Localhost Ollama & Embedded pos-parser
  const targetModel = provider === 'embedded-gguf' ? getEmbeddedModelName() : getOllamaModel();
  
  // Prioritize cached working endpoint
  const rawCandidates = getOllamaCandidateUrls();
  const candidates = cachedWorkingEndpoint
    ? [cachedWorkingEndpoint, ...rawCandidates.filter(c => c !== cachedWorkingEndpoint)]
    : rawCandidates;

  let lastError = '';

  // Determine dynamic token budget:
  // - Open CMD chat, how-to, sales advice, creative marketing, advice: 2048 tokens (allows model to finish long thoughts completely!)
  // - Multi-task compound cards / stock actions: 512 tokens
  const isCreativeOrLongContent =
    combinedSystem.includes('CRITICAL CREATIVE & WELLBEING INSTRUCTIONS') ||
    combinedSystem.includes('creative retail marketing copywriter') ||
    combinedSystem.includes('CRITICAL DYNAMIC MULTI-TASK INSTRUCTIONS') ||
    combinedSystem.includes('redator de marketing criativo') ||
    combinedSystem.includes('Store Sentinel AI, um assistente') ||
    combinedSystem.includes('Store Sentinel AI, an intelligent') ||
    combinedSystem.includes('CRITICAL OPEN-CHAT INSTRUCTIONS') ||
    /how can i|how to|improve|sales|advice|explain|detail|recommend|strategy|story|história|historia|poem|poema|joke|piada|promot|anúncio|resumo|summary|encourage|animar|market|marketing|vendas|campaign|campanha|ad\b|ad copy|publicidade|ideias|tips|dicas/i.test(prompt);

  let defaultTokensForPacing = isCreativeOrLongContent ? 2048 : 512;
  if (pacing === 'fast') defaultTokensForPacing = 140;
  else if (pacing === 'balanced') defaultTokensForPacing = 320;
  else if (pacing === 'detailed') defaultTokensForPacing = isCreativeOrLongContent ? 2048 : 850;

  const dynamicNumPredict = maxTokens ?? defaultTokensForPacing;

  // Options optimized for complete, uninterrupted generation
  const effectiveTemperature = options.temperature ?? (isCreativeOrLongContent ? 0.75 : 0.2);
  const ollamaOptions = {
    temperature: effectiveTemperature,
    repeat_penalty: 1.15,
    num_ctx: 2048,
    num_predict: dynamicNumPredict,
    num_thread: 4,
    top_k: 40,
    top_p: 0.9,
    stop: [
      '<|eot_id|>',
      '<|start_header_id|>',
      '<|end_header_id|>',
      'User:',
      '\nUser:',
      'Assistant:',
      '\nAssistant:',
      'Operator:',
      '\nOperator:',
      '[Store Sentinel AI]:',
      '\n[Store Sentinel AI]:'
    ]
  };

  // Build rolling conversational transcript for fallback /api/generate (keep last 4 turns)
  let conversationTranscript = `${combinedSystem}\n\n`;
  if (chatHistory.length > 0) {
    const recentHistory = chatHistory.slice(-4);
    for (const h of recentHistory) {
      const prefix = h.role === 'user' ? 'User' : 'Assistant';
      const cleanContent = h.content.replace(/```json[\s\S]*?```/g, '').trim();
      if (cleanContent) {
        conversationTranscript += `${prefix}: ${cleanContent}\n`;
      }
    }
  }
  conversationTranscript += `User: ${prompt.trim()}\nAssistant:`;

  // Build messages array with rolling memory window (preserves system prompt + up to 4 recent turns)
  const chatMessages: Array<{ role: string; content: string }> = [];
  if (combinedSystem.trim()) {
    chatMessages.push({ role: 'system', content: combinedSystem.trim() });
  }
  if (chatHistory.length > 0) {
    const recentHistory = chatHistory.slice(-4);
    for (const h of recentHistory) {
      const cleanContent = h.content.replace(/```json[\s\S]*?```/g, '').trim();
      if (cleanContent) {
        chatMessages.push({ role: h.role, content: cleanContent });
      }
    }
  }
  if (prompt.trim()) {
    chatMessages.push({ role: 'user', content: prompt.trim() });
  }

  const isStreamingEnabled = Boolean(onChunk && (!tools || tools.length === 0));

  for (const endpoint of candidates) {
    try {
      // 1. Primary Attempt: Ollama native /api/chat endpoint (applies model's native chat template with role tokens)
      const chatController = new AbortController();
      const chatTimeoutId = setTimeout(() => chatController.abort(), 25000);
      if (signal) {
        signal.addEventListener('abort', () => chatController.abort(), { once: true });
        if (signal.aborted) chatController.abort();
      }

      const chatBody: Record<string, any> = {
        model: targetModel,
        messages: chatMessages,
        stream: isStreamingEnabled,
        keep_alive: '60m', // Keep model pinned in RAM to prevent cold-reload latency
        options: ollamaOptions
      };
      if (tools && tools.length > 0) {
        chatBody.tools = tools;
      }
      if (format) {
        chatBody.format = format;
      }

      const requestStart = performance.now();
      console.log(
        `%c[Store Sentinel Profiler] 🚀 Requesting ${targetModel} on ${endpoint}/api/chat`,
        'color: #10b981; font-weight: bold;'
      );
      console.log(
        `[Store Sentinel Profiler] Payload: ${chatMessages.length} turns (${prompt.length} chars) | JIT Tools: ${tools ? tools.length : 0} tools (${tools ? tools.map(t => t.function.name).join(' + ') : 'Zero tool bloat'})`
      );

      let chatRes = await fetch(`${endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: chatController.signal,
        body: JSON.stringify(chatBody)
      }).catch(() => null);

      // Graceful Resilience: If Ollama responds with 400 context overflow, immediately retry with lean single-turn context
      if (chatRes && !chatRes.ok && chatRes.status === 400) {
        const errText = await chatRes.clone().text().catch(() => '');
        if (errText.includes('exceeds the available context size') || errText.includes('context')) {
          console.warn('[Ollama /api/chat]: Context exceeded. Retrying with lean single-turn messages payload...');
          const leanMessages = [
            { role: 'system', content: combinedSystem.trim().slice(0, 1500) },
            { role: 'user', content: prompt.trim() }
          ];
          chatRes = await fetch(`${endpoint}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: targetModel,
              messages: leanMessages,
              stream: false,
              keep_alive: '60m',
              options: { ...ollamaOptions, num_ctx: 2048 }
            })
          }).catch(() => null);
        }
      }

      // PEG Grammar Resilience: If Ollama responds with 500 peg-native format error, retry without tools grammar
      if (chatRes && !chatRes.ok && chatRes.status === 500) {
        const errText = await chatRes.clone().text().catch(() => '');
        if (errText.includes('peg-native format') || errText.includes('llama-server chat error')) {
          console.warn('[Ollama /api/chat]: PEG grammar error on tool calling. Retrying conversational chat turn directly...');
          chatRes = await fetch(`${endpoint}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: targetModel,
              messages: chatMessages,
              stream: false,
              keep_alive: '60m',
              options: ollamaOptions
            })
          }).catch(() => null);
        }
      }

      clearTimeout(chatTimeoutId);

      if (chatRes && chatRes.ok) {
        let text = '';
        let promptEvalCount = 0;
        let evalCount = 0;
        let evalDurationMs = 0;
        let rawToolCalls: any[] | undefined = undefined;

        if (isStreamingEnabled && chatRes.body) {
          const reader = chatRes.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let accumulated = '';
          let buffer = '';

          while (true) {
            if (signal?.aborted) {
              try { await reader.cancel(); } catch (_) {}
              break;
            }
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              try {
                const parsed = JSON.parse(trimmed);
                if (parsed.message?.content) {
                  const chunk = parsed.message.content;
                  accumulated += chunk;
                  if (onChunk) onChunk(chunk);
                }
                if (parsed.prompt_eval_count) promptEvalCount = parsed.prompt_eval_count;
                if (parsed.eval_count) evalCount = parsed.eval_count;
                if (parsed.eval_duration) evalDurationMs = Math.round(parsed.eval_duration / 1e6);
              } catch (_) {}
            }
          }

          if (buffer.trim()) {
            try {
              const parsed = JSON.parse(buffer.trim());
              if (parsed.message?.content) {
                const chunk = parsed.message.content;
                accumulated += chunk;
                if (onChunk) onChunk(chunk);
              }
              if (parsed.prompt_eval_count) promptEvalCount = parsed.prompt_eval_count;
              if (parsed.eval_count) evalCount = parsed.eval_count;
              if (parsed.eval_duration) evalDurationMs = Math.round(parsed.eval_duration / 1e6);
            } catch (_) {}
          }

          text = cleanTrailingDialogue(accumulated);
        } else {
          const chatData = await chatRes.json();
          text = cleanTrailingDialogue(chatData.message?.content || '');
          promptEvalCount = chatData.prompt_eval_count || 0;
          evalCount = chatData.eval_count || 0;
          evalDurationMs = chatData.eval_duration ? Math.round(chatData.eval_duration / 1e6) : 0;
          rawToolCalls = chatData.message?.tool_calls;
        }

        const latencyMs = Math.round(performance.now() - startTime);
        const evalMs = Math.round(performance.now() - requestStart);

        console.log(
          `%c[Store Sentinel Profiler] ⚡ Response completed in ${evalMs}ms (Total latency: ${latencyMs}ms)`,
          'color: #06b6d4; font-weight: bold;',
          {
            model: targetModel,
            promptTokens: promptEvalCount,
            generatedTokens: evalCount,
            evalDuration: `${evalDurationMs || evalMs}ms`
          }
        );

        recordProfilerMetrics({
          model: targetModel,
          provider: 'local-ollama',
          promptTokens: promptEvalCount,
          generatedTokens: evalCount,
          evalDuration: `${evalDurationMs || evalMs}ms`,
          latencyMs: evalMs,
          toolsReturned: rawToolCalls?.length || 0,
          isOnlineFallback: false
        });

        let parsedToolCalls: LlamaToolCall[] | undefined = undefined;
        if (Array.isArray(rawToolCalls) && rawToolCalls.length > 0) {
          parsedToolCalls = [];
          for (const tc of rawToolCalls) {
            if (tc.function?.name) {
              let args = tc.function.arguments;
              if (typeof args === 'string') {
                try { args = JSON.parse(args); } catch {}
              }
              parsedToolCalls.push({
                name: tc.function.name,
                arguments: typeof args === 'object' && args !== null ? args : {}
              });
            }
          }
        }

        if (text || (parsedToolCalls && parsedToolCalls.length > 0)) {
          cachedWorkingEndpoint = endpoint;
          let synthesizedText = text;
          if (!synthesizedText && parsedToolCalls && parsedToolCalls.length > 0) {
            const first = parsedToolCalls[0];
            const a = first.arguments || {};
            if (first.name === 'add_to_cart') {
              const count = Array.isArray(a.items) ? a.items.length : 1;
              synthesizedText = `I have staged ${count} item(s) to add to your POS cart. Confirm below to proceed.`;
            } else if (first.name === 'calculate_cash_change') {
              const due = Number(a.total_due_mt) || 0;
              const tendered = Number(a.amount_tendered_mt) || 0;
              synthesizedText = `Change calculated: ${Math.max(0, tendered - due)} MT (Total: ${due} MT, Tendered: ${tendered} MT).`;
            } else if (first.name === 'manage_inventory' || first.name === 'create_product') {
              if (a.operation === 'update') {
                synthesizedText = `I have prepared the update for "${a.product_name || a.target_name || 'Product'}". Review details below.`;
              } else if (a.operation === 'delete') {
                synthesizedText = `I have staged "${a.product_name || a.target_name || 'Product'}" for removal from inventory.`;
              } else {
                synthesizedText = `I have prepared the catalog registration for "${a.product_name || 'New Product'}". Confirm below to save.`;
              }
            } else if (first.name === 'manage_customer_fiado' || first.name === 'create_customer') {
              synthesizedText = `I have prepared the customer account registration card for "${a.customer_name || 'New Customer'}".`;
            } else if (first.name === 'manage_deliveries' || first.name === 'create_delivery') {
              synthesizedText = `I have prepared the expected delivery order card for supplier "${a.supplier_name || 'Restock'}".`;
            } else if (first.name === 'manage_operator' || first.name === 'create_operator') {
              synthesizedText = `I have prepared the cashier operator registration card for "${a.name || 'New Cashier'}".`;
            } else if (first.name === 'batch_create_products') {
              const count = Array.isArray(a.products) ? a.products.length : 2;
              synthesizedText = `I have prepared ${count} product draft cards for your store inventory.`;
            } else if (first.name.startsWith('fetch_') || first.name === 'query_store_telemetry') {
              synthesizedText = '';
            } else {
              synthesizedText = `Prepared the ${first.name.replace(/_/g, ' ')} action card.`;
            }
          }

          return {
            text: synthesizedText || 'Prepared the requested action card.',
            provider,
            modelUsed: targetModel,
            isOffline: false,
            latencyMs,
            suggestedActions: extractSuggestedActions(synthesizedText || text),
            toolCalls: parsedToolCalls
          };
        }
      } else if (chatRes && !chatRes.ok) {
        const errText = await chatRes.text().catch(() => '');
        console.warn(`[Ollama /api/chat error ${chatRes.status}]:`, errText);
      }

      // 2. Structured Fallback: OpenAI-compatible /v1/chat/completions endpoint (supports messages & tools)
      const resController = new AbortController();
      const resTimeoutId = setTimeout(() => resController.abort(), 15000);

      const openAiBody: Record<string, any> = {
        model: targetModel,
        messages: chatMessages,
        temperature,
        max_tokens: 120,
        stream: false
      };
      if (tools && tools.length > 0) openAiBody.tools = tools;
      if (format === 'json') openAiBody.response_format = { type: 'json_object' };

      const res = await fetch(`${endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: resController.signal,
        body: JSON.stringify(openAiBody)
      }).catch(() => null);

      clearTimeout(resTimeoutId);

      if (res && res.ok) {
        const data = await res.json();
        const msg = data.choices?.[0]?.message;
        const text = cleanTrailingDialogue(msg?.content || '');
        const latencyMs = Math.round(performance.now() - startTime);

        const rawToolCalls = msg?.tool_calls;
        let parsedToolCalls: LlamaToolCall[] | undefined = undefined;
        if (Array.isArray(rawToolCalls) && rawToolCalls.length > 0) {
          parsedToolCalls = [];
          for (const tc of rawToolCalls) {
            if (tc.function?.name) {
              let args = tc.function.arguments;
              if (typeof args === 'string') {
                try { args = JSON.parse(args); } catch {}
              }
              parsedToolCalls.push({
                name: tc.function.name,
                arguments: typeof args === 'object' && args !== null ? args : {}
              });
            }
          }
        }

        if (text || (parsedToolCalls && parsedToolCalls.length > 0)) {
          return {
            text: text || 'Prepared the requested action card.',
            provider,
            modelUsed: data.model || targetModel,
            isOffline: false,
            latencyMs,
            suggestedActions: extractSuggestedActions(text),
            toolCalls: parsedToolCalls
          };
        }
      }

      // 3. Last Ditch Fallback: Ollama native /api/generate endpoint (clean single conversational turn)
      const genController = new AbortController();
      const genTimeoutId = setTimeout(() => genController.abort(), 15000);

      const cleanPrompt = `${combinedSystem.trim()}\n\nUser: ${prompt.trim()}\nAssistant (single concise sentence only, no tutorials):`;

      const genRes = await fetch(`${endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: genController.signal,
        body: JSON.stringify({
          model: targetModel,
          prompt: cleanPrompt,
          stream: false,
          options: { ...ollamaOptions, stop: ['\n\n', 'Step 1', 'User:', 'Assistant:'] }
        })
      }).catch(() => null);

      clearTimeout(genTimeoutId);

      if (genRes && genRes.ok) {
        const genData = await genRes.json();
        let text = cleanTrailingDialogue(genData.response || genData.output || '');
        // Strip any residual tutorial instructions
        if (/(?:step \d+|how to create|here are the steps|follow these steps|preparation for new|to prepare a new|insert details into|create a new record)/i.test(text)) {
          text = '';
        }
        const latencyMs = Math.round(performance.now() - startTime);

        if (text) {
          return {
            text,
            provider,
            modelUsed: genData.model || targetModel,
            isOffline: false,
            latencyMs,
            suggestedActions: extractSuggestedActions(text)
          };
        }
      }
    } catch (e: any) {
      lastError = e?.message || String(e);
    }
  }

  const latencyMs = Math.round(performance.now() - startTime);
  const endpoint = getOllamaEndpoint();

  // Seamless Online Fallback: If local Ollama is unreachable but internet & Baseten key exist,
  // engage Meta MUSE Spark 1.3 on Baseten so the user is never stuck!
  if (isBasetenOnline()) {
    try {
      console.log('%c[Store Sentinel AI] Local Ollama offline. Engaging Muse Spark (Baseten Cloud Fallback)...', 'color: #8b5cf6; font-weight: bold;');
      const fallbackRes = await queryBasetenFallback({
        prompt,
        systemPrompt: combinedSystem,
        chatHistory,
        temperature: effectiveTemperature
      });
      return fallbackRes;
    } catch (basetenErr) {
      console.warn('[Store Sentinel AI] Baseten online fallback error:', basetenErr);
    }
  }

  if (provider === 'embedded-gguf') {
    return {
      text: `[Embedded POS Model Offline]\n\nCould not reach custom model '${targetModel}' on Ollama (${endpoint}).\n\nHigh-Speed Core i3 Setup:\n1. Open Command Prompt in your .gguf folder.\n2. Run:\n   (echo FROM ./Llama-3.2-1B-Instruct-Q4_K_M.gguf & echo PARAMETER num_ctx 512 & echo PARAMETER num_thread 4 & echo PARAMETER num_predict 120) > Modelfile\n3. Create model:\n   ollama create ${targetModel} -f Modelfile\n4. Test: ollama run ${targetModel}`,
      provider: 'embedded-gguf',
      modelUsed: `${targetModel} (offline)`,
      isOffline: true,
      latencyMs
    };
  }

  return {
    text: `[Localhost Ollama Offline]\n\nCould not reach Ollama on ${endpoint} for model '${targetModel}'.\n\nSetup Instructions:\n1. Open terminal on your Windows machine.\n2. Run: ollama run ${targetModel}\n(Or download Ollama from https://ollama.com if not yet installed).`,
    provider: 'local-ollama',
    modelUsed: `${targetModel} (offline)`,
    isOffline: true,
    latencyMs
  };
}
