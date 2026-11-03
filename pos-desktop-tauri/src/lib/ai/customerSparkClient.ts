/**
 * @file customerSparkClient.ts
 * @description Isolated, Read-Only Meta MUSE Spark AI Assistant for the In-Store Customer Display.
 * Direct AI generation using Meta's MUSE Spark 1.3 agent with live local product catalog context.
 * Strict Offline Gate: No fake preset responses when offline.
 */

import { getDB } from '../db';
import { logAiCommand } from './aiCommandLogger';
import { CustomerSparkMessage } from '../customerDisplay/types';
import { 
  queryUnifiedAiEngine, 
  getActiveAiDisplayName, 
  getActiveAiProvider,
  checkAiEngineStatus
} from './unifiedAiClient';

export interface PublicProductItem {
  id: string;
  name: string;
  category: string;
  price_mt: number;
  promo_price_mt?: number;
  promo_active?: boolean;
  stock_quantity: number;
  is_in_stock: boolean;
}

/**
 * Searches the public-safe product catalog from local SQLite.
 * Strips wholesale prices, suppliers, and internal profit metadata.
 */
export async function searchPublicProducts(query: string = ''): Promise<PublicProductItem[]> {
  try {
    const db = await getDB();
    const cleanQuery = query.trim().toLowerCase();

    let sql = `
      SELECT id, name, category, price_mt, promo_price_mt, promo_active, stock_quantity 
      FROM products 
      WHERE (is_active = 1 OR is_active IS NULL)
    `;
    const params: any[] = [];

    if (cleanQuery.length > 0) {
      sql += ` AND (LOWER(name) LIKE ? OR LOWER(category) LIKE ?)`;
      params.push(`%${cleanQuery}%`, `%${cleanQuery}%`);
    }

    sql += ` ORDER BY stock_quantity DESC LIMIT 6`;

    const rows: any[] = await db.select(sql, params);
    return (rows || []).map(r => ({
      id: r.id,
      name: r.name,
      category: r.category || 'Geral',
      price_mt: Number(r.price_mt) || 0,
      promo_price_mt: r.promo_price_mt ? Number(r.promo_price_mt) : undefined,
      promo_active: Boolean(r.promo_active),
      stock_quantity: Number(r.stock_quantity) || 0,
      is_in_stock: (Number(r.stock_quantity) || 0) > 0
    }));
  } catch (err) {
    console.warn('[CustomerSparkClient] Failed to search public products:', err);
    return [];
  }
}

/**
 * Fetches active promotions to feature on the customer display.
 */
export async function getPublicPromotions(): Promise<PublicProductItem[]> {
  try {
    const db = await getDB();
    const rows: any[] = await db.select(`
      SELECT id, name, category, price_mt, promo_price_mt, promo_active, stock_quantity
      FROM products
      WHERE promo_active = 1 AND promo_price_mt IS NOT NULL
      LIMIT 4
    `);
    return (rows || []).map(r => ({
      id: r.id,
      name: r.name,
      category: r.category || 'Promoções',
      price_mt: Number(r.price_mt) || 0,
      promo_price_mt: Number(r.promo_price_mt) || 0,
      promo_active: true,
      stock_quantity: Number(r.stock_quantity) || 0,
      is_in_stock: (Number(r.stock_quantity) || 0) > 0
    }));
  } catch (err) {
    return [];
  }
}

/**
 * Sends a customer voice or text query to Meta MUSE Spark 1.3.
 * Pure dynamic generation with live catalog context.
 */
export async function askCustomerSpark(
  query: string,
  inputType: 'voice' | 'text' = 'text',
  lang: 'pt' | 'en' | 'fr' | 'sw' = 'pt'
): Promise<CustomerSparkMessage> {
  const lower = query.toLowerCase().trim();

  // 2. Search relevant products from local SQLite
  const cleanSearchTerm = lower
    .replace(/vocês têm|voces tem|tem|quanto custa|qual o preço|qual e o preco|qual é o preço|preço do|preco da|valor do|ha|tem aí|tem ai|do you have|how much is|price of/g, '')
    .replace(/[?!.]/g, '')
    .trim();
  const matchedProducts = await searchPublicProducts(cleanSearchTerm.length > 1 ? cleanSearchTerm : query);
  const activePromos = await getPublicPromotions();
  const shopName = localStorage.getItem('shop_name') || 'SYCOMM POS';

  // 3. Query Active Unified AI Engine (Groq 70B, Ollama, or Embedded GGUF)
  const aiInfo = getActiveAiDisplayName();
  try {
    const systemPrompt = `Você é o assistente inteligente no ecrã de cliente da loja "${shopName}" em Moçambique.
Diretrizes:
- Responda no idioma do cliente (Português, Inglês, Francês ou Suaíli), de forma educada, acolhedora e concisa (máximo 2 a 3 frases).
- Sempre use preços em Meticais (MT).
- NUNCA divulgue preços de custo, margens de lucro, dívidas de clientes ou informações financeiras confidenciais.
- Formas de pagamento aceites na loja: Numerário em Meticais (MT), Carteira Móvel M-Pesa (Vodacom), e-Mola (Movitel) e Cartão POS (Ponto 24/BIM/BCI).
- Catálogo relevante da loja:
  * Promoções activas: ${activePromos.map(p => `${p.name} a ${p.price_mt} MT`).join(', ') || 'Nenhuma promoção activa no momento'}
  * Produtos correspondentes encontrados: ${matchedProducts.map(p => `${p.name} (${p.is_in_stock ? `em stock: ${p.stock_quantity} un` : 'esgotado'} a ${p.price_mt} MT)`).join(', ') || 'Nenhum produto correspondente'}
`;

    const aiRes = await queryUnifiedAiEngine({
      prompt: query,
      systemPrompt,
      telemetryContext: {
        matchedProducts,
        activePromos
      }
    });

    const responseText = aiRes.text?.trim() || 'Informação processada pelo assistente.';

    // Log to SQLite audit
    try {
      await logAiCommand({
        user_name: 'Cliente (Ecrã Secundário)',
        device_origin: 'customer_display',
        input_type: inputType,
        raw_input: query,
        transcription: inputType === 'voice' ? query : undefined,
        detected_intent: 'customer_inquiry',
        tool_called: 'customer_ai_query',
        tool_arguments: { query, provider: aiRes.provider },
        tool_result: { matchedCount: matchedProducts.length, model: aiRes.modelUsed },
        execution_status: aiRes.isOffline ? 'failed' : 'success'
      });
    } catch {}

    return {
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      text: responseText,
      timestamp: Date.now(),
      modelUsed: aiRes.modelUsed || aiInfo.title,
      isOffline: aiRes.isOffline,
      matched_products: matchedProducts.slice(0, 4)
    };
  } catch (err: any) {
    console.error('[CustomerSparkClient] AI generation failed:', err);
    return {
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      text: `Não foi possível consultar o assistente de IA no momento: ${err.message || 'Erro de conexão'}.`,
      timestamp: Date.now(),
      modelUsed: aiInfo.title,
      isOffline: true
    };
  }
}

export const handleCustomerQuery = askCustomerSpark;

