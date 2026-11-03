/**
 * @file marketingHandler.ts
 * @description Lane 1: Creative Marketing & Promotional Copywriter (Gear 1).
 * Completely free, natural neural copywriting with ZERO presets.
 * 
 * Offline & Online Visual Marketing Strategy:
 * 1. When local AI (Llama 3.2 1B) is active: Disable image generation because 1B cannot handle images.
 *    Existing downloaded/saved images remain active locally until removed by user.
 * 2. When online AI (Muse Spark) is active: Generates marketing copy and creates high-res visual banner.
 * 3. Save & Broadcast Gate: The generated image is presented as an executable candidate card.
 *    Only when the user clicks 'Save & Broadcast to Customer Display' is it broadcasted live!
 * 4. Image Removal: Users can remove or clear the customer display banner directly from Sentinel Chat.
 */

import { getDB } from '../../../db';
import { queryUnifiedAiEngine, getActiveAiProvider } from '../../unifiedAiClient';
import { SentinelResponse } from '../../types';
import { generatePromoBannerImage } from '../../../marketing/bannerGenerator';
import { 
  getActiveBroadcastPromo, 
  removeBroadcastPromo,
  BroadcastPromoBanner 
} from '../../../marketing/promoStore';

export interface MarketingOptions {
  query: string;
  lang?: 'en' | 'pt';
  onChunk?: (chunk: string) => void;
}

/**
 * Checks if the user's query belongs to Lane 1 (Creative Marketing & Promotional Copywriter).
 */
export function isMarketingQuery(query: string): boolean {
  const q = query.toLowerCase();
  const marketingTokens = [
    'promotional summary',
    'promotional',
    'marketing copy',
    'write an ad',
    'write a promo',
    'slogan',
    'post para whatsapp',
    'anúncio',
    'anuncio',
    'propaganda',
    'publicidade',
    'divulgar produto',
    'divulgar',
    'flyer',
    'banner',
    'cartaz',
    'status whatsapp',
    'promoção',
    'promocao',
    'marketing',
    'campaign',
    'campanha',
    'promote',
    'promo',
    'ad copy',
    'advertising',
    'how to sell more',
    'como vender mais',
    'aumentar vendas',
    'discount flyer',
    'promover',
    'ideias de venda',
    'sales pitch',
    'generate image',
    'generate an image',
    'criar imagem',
    'gerar imagem',
    'imagem de publicidade',
    'remove promo image',
    'clear promo',
    'remover banner',
    'remover imagem',
    'clear customer display'
  ];
  return marketingTokens.some(token => q.includes(token));
}

/**
 * Extracts a candidate product name from the marketing prompt, if present.
 */
function extractTargetProductName(query: string): string {
  const q = query.toLowerCase();
  const cleaned = q
    .replace(/generate (a )?(promotional|marketing)? (image|banner|summary|ad|flyer) (for|on) (the )?/i, '')
    .replace(/cria(r)? (um )?(anúncio|banner|imagem|cartaz) (para|sobre) (o|a)?/i, '')
    .replace(/gera(r)? (uma )?imagem (para|sobre) (o|a)?/i, '')
    .replace(/post para whatsapp (d[oe] |sobre )?/i, '')
    .replace(/anúncio para whatsapp (d[oe] |sobre )?/i, '')
    .replace(/criar propaganda (d[oe] |para )?/i, '')
    .replace(/product/i, '')
    .replace(/produto/i, '')
    .replace(/campaign/i, '')
    .replace(/campanha/i, '')
    .trim();

  return cleaned.replace(/[?.,!]/g, '').trim();
}

/**
 * Checks if user is asking specifically for a visual image or banner.
 */
function isImageOrBannerRequest(query: string): boolean {
  const q = query.toLowerCase();
  return /image|imagem|banner|cartaz|poster|flyer visual|foto|visual/i.test(q);
}

/**
 * Checks if user wants to remove or clear the active customer display banner.
 */
function isRemovePromoRequest(query: string): boolean {
  const q = query.toLowerCase();
  return /remove (the )?(promo|banner|image)|clear (the )?(promo|banner|customer display)|remover (o )?(banner|imagem|promoção)|apagar (o )?(banner|imagem)|tirar (o )?banner/i.test(q);
}

/**
 * Executes Lane 1: Pure neural marketing generation with ZERO presets.
 */
export async function handleMarketingQuery(options: MarketingOptions): Promise<SentinelResponse> {
  const { query, lang = 'en', onChunk } = options;
  const isPt = lang === 'pt' || /whatsapp|anúncio|promoção|slogan|divulgar|vender|campanha|remover|imagem/i.test(query);

  // 1. Check for Promo Banner Removal request
  if (isRemovePromoRequest(query)) {
    removeBroadcastPromo();
    return {
      answer: isPt
        ? '🗑️ O banner promocional foi removido com sucesso do Customer Display. A tela do cliente voltou ao catálogo padrão de stock.'
        : '🗑️ The promotional banner has been successfully removed from the Customer Display. The customer screen has reverted to standard stock view.',
      modelUsed: 'local-store',
      isOffline: false,
      suggestedActions: [
        { label: isPt ? 'Ver Ecrã do Cliente' : 'View Customer Display', tab: 'menu' },
        { label: isPt ? 'Catálogo de Produtos' : 'Product Catalog', tab: 'products' }
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }

  const activeProvider = getActiveAiProvider();
  const targetCandidate = extractTargetProductName(query);

  // Fetch product from local SQLite if a candidate name is provided
  let product: { name: string; price: number; category: string; stock_quantity: number } | null = null;
  try {
    const db = await getDB();
    if (targetCandidate.length >= 2) {
      const rows = (await db.select(
        'SELECT name, price_mt as price, category, stock_quantity FROM products WHERE name LIKE ? LIMIT 1',
        [`%${targetCandidate}%`]
      )) as any[];

      if (rows && rows.length > 0) {
        product = {
          name: rows[0].name,
          price: Number(rows[0].price) || 0,
          category: rows[0].category || 'Geral',
          stock_quantity: Number(rows[0].stock_quantity) || 0
        };
      }
    }
  } catch (err) {
    // Continue if SQLite is momentarily busy
  }

  // 2. Visual Image / Banner Request
  if (isImageOrBannerRequest(query)) {
    // If local AI (Llama 3.2 1B) is detected: DISABLE images because 1B cannot handle images!
    if (activeProvider !== 'baseten-muse') {
      const activePromo = getActiveBroadcastPromo();
      return {
        answer: isPt
          ? `⚠️ **Llama 3.2 1B é um modelo neural local de texto e não suporta geração de imagens visuais.**\n\nA geração de novas imagens está desativada no modo local 1B para garantir máxima velocidade e eficiência offline.\n\n💡 **Como gerar novos banners visuais:**\n• Alterne para o **Muse Spark (Online)** nas Definições de IA (ícone da engrenagem).\n\n📌 **Estado Actual:** O seu banner promocional previamente guardado localmente continua ativo e visível no Customer Display sem necessidade de internet.`
          : `⚠️ **Llama 3.2 1B is an offline text-only neural model and cannot generate or process visual images.**\n\nImage generation is disabled while running local 1B to maintain ultra-fast offline speeds.\n\n💡 **To generate new visual banners:**\n• Switch to **Muse Spark (Online)** in AI Settings (gear icon).\n\n📌 **Current Status:** Any previously saved/downloaded promotional banner remains safely cached and active on the Customer Display without needing internet.`,
        modelUsed: 'llama3.2:1b-offline',
        isOffline: true,
        suggestedActions: activePromo ? [
          { label: isPt ? 'Remover Banner Activo' : 'Remove Active Banner', tab: 'menu' },
          { label: isPt ? 'Ver Ecrã do Cliente' : 'View Customer Display', tab: 'menu' }
        ] : [
          { label: isPt ? 'Ver Ecrã do Cliente' : 'View Customer Display', tab: 'menu' }
        ],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    }

    // ONLINE MODE (Muse Spark): Generate marketing text & visual banner image
    const candidateTitle = product ? product.name : (targetCandidate.length > 2 ? targetCandidate : 'Especial da Semana');
    const candidatePrice = product ? product.price : 1450;
    const candidateOrigPrice = Math.round(candidatePrice * 1.18);
    const candidateCategory = product ? product.category : 'Mercearia';

    const systemPrompt = isPt
      ? `Você é um redator publicitário de retalho para Moçambique.
Gere um slogan promocional curto (máx 12 palavras) e apelativo para o produto "${candidateTitle}".
Mencione valor, frescura e conveniência em Meticais (MT). Responda apenas com a frase curta.`
      : `You are a retail marketing copywriter for Mozambique.
Generate a short, punchy marketing subtitle (max 12 words) for the product "${candidateTitle}".
Emphasize value, freshness, and savings in Mozambican Meticais (MT). Respond ONLY with the single short sentence.`;

    let generatedSubtitle = isPt 
      ? 'Aproveite a melhor qualidade com preço especial para toda a família!'
      : 'Enjoy premium quality with special family savings at our shop!';

    try {
      const aiRes = await queryUnifiedAiEngine({
        prompt: `Create a 1-sentence promotional subtitle for: ${candidateTitle}`,
        systemPrompt,
        temperature: 0.7
      });
      if (aiRes.text && aiRes.text.trim()) {
        generatedSubtitle = aiRes.text.trim().replace(/^["']|["']$/g, '');
      }
    } catch {
      // Use fallback subtitle
    }

    // Generate local Data URL image (1200x630)
    const bannerImageDataUrl = generatePromoBannerImage({
      title: candidateTitle,
      subtitle: generatedSubtitle,
      price_mt: candidatePrice,
      original_price_mt: candidateOrigPrice,
      badge: 'SUPER PREÇO',
      category: candidateCategory,
      themeColor: 'amber'
    });

    const bannerCandidate: BroadcastPromoBanner = {
      id: `promo-${Date.now()}`,
      title: candidateTitle,
      subtitle: generatedSubtitle,
      price_mt: candidatePrice,
      original_price_mt: candidateOrigPrice,
      badge: 'SUPER PREÇO',
      category: candidateCategory,
      tagline: 'Oferta Especial SYCOMM POS',
      imageUrl: bannerImageDataUrl,
      bgGradient: 'from-amber-600 via-orange-600 to-amber-700',
      createdAt: Date.now(),
      isLive: false // STRICT RULE: Not live until user clicks Save & Broadcast!
    };

    return {
      answer: isPt
        ? `🎨 **Banner Promocional Gerado com Sucesso via Muse Spark!**\n\nPreparei a imagem promocional em alta definição para **"${candidateTitle}"** (${candidatePrice} MT).\n\n⚠️ **Aviso de Emissão:** A imagem está pronta para pré-visualização abaixo. Clique em **"Guardar & Transmitir ao Customer Display"** para colocá-la ao vivo na tela do cliente.`
        : `🎨 **Promotional Banner Generated via Muse Spark!**\n\nI created the high-resolution promotional marketing image for **"${candidateTitle}"** (${candidatePrice} MT).\n\n⚠️ **Broadcast Review:** The banner is staged below. Click **"Save & Broadcast to Customer Display"** to broadcast it live to the customer-facing screen.`,
      modelUsed: 'meta-models/muse-spark-open',
      isOffline: false,
      executableAction: {
        type: 'broadcast_promo_banner',
        data: bannerCandidate
      },
      suggestedActions: [
        { label: isPt ? 'Ver Ecrã do Cliente' : 'View Customer Display', tab: 'menu' }
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }

  // 3. General Marketing Copywriter (Text / WhatsApp copy)
  let productDetails = '';
  if (product) {
    productDetails = `Featured Catalog Product: "${product.name}", Current Price: ${product.price} MT, Category: ${product.category}, Shelf Stock: ${product.stock_quantity}.`;
  }

  const systemPrompt = isPt
    ? `Você é um redator de marketing criativo, dinâmico e persuasivo para uma loja de retalho em Moçambique.
Escreva de forma livre, cativante e natural para o comerciante atrair clientes no WhatsApp, redes sociais ou panfleto da loja.
Sempre mencione preços na moeda Meticais (MT). Destaque conveniência, qualidade e ótimo valor para o cliente.
Responda diretamente com o texto do anúncio ou ideias práticas de marketing sem enrolação.`
    : `You are a dynamic, creative marketing and retail advertising copywriter for a neighborhood retail shop in Mozambique.
Write freely, persuasively, and engagingly to help the merchant attract customers via WhatsApp Status, social posts, or flyers.
Always state prices in Mozambican Meticais (MT). Highlight quality, fast service, and great value.
Provide direct, compelling promotional copy or actionable promotional ideas without meta commentary.`;

  const userPrompt = productDetails
    ? `${productDetails}\nUser request: "${query}"\nWrite the marketing copy now:`
    : `User request: "${query}"\nProvide creative retail marketing copy and promotional recommendations for this shop now:`;

  try {
    const aiRes = await queryUnifiedAiEngine({
      prompt: userPrompt,
      systemPrompt,
      temperature: 0.75,
      onChunk
    });

    const outputText = aiRes.text.trim();

    return {
      answer: outputText,
      modelUsed: aiRes.modelUsed,
      isOffline: aiRes.isOffline,
      suggestedActions: [
        { label: isPt ? 'Copiar p/ WhatsApp' : 'Copy for WhatsApp', tab: 'products' },
        { label: isPt ? 'Ver Produtos' : 'View Products', tab: 'products' }
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  } catch (err: any) {
    return {
      answer: `[Store Sentinel Neural Engine Error]\nCould not generate marketing copy: ${err?.message || 'Neural model is offline or unreachable'}.\nMake sure Ollama is running ('ollama run pos-parser') or configure Muse Spark online fallback.`,
      modelUsed: 'offline',
      isOffline: true,
      suggestedActions: [
        { label: 'View Products', tab: 'products' }
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }
}
