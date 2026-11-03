/**
 * Voice Intent & Entity Parser for Mozambican POS Retail Context
 * 
 * Transforms transcribed Portuguese speech into actionable business records:
 * 1. Cash-up Denomination Counter (Notes and Coins in Meticais)
 * 2. Petty Cash / Sangria Justifications
 * 3. Fast POS Search & Add Queries
 */

export interface CashUpDenominationCounts {
  1000: number;
  500: number;
  200: number;
  100: number;
  50: number;
  20: number;
  10: number;
  5: number;
  2: number;
  1: number;
  [key: number]: number;
}

export interface ParsedCashUpResult {
  counts: CashUpDenominationCounts;
  totalMt: number;
  matchedPhrases: string[];
  rawTranscript: string;
}

export interface ParsedPettyCashResult {
  type: 'withdrawal' | 'deposit';
  amount: number;
  reason: string;
  rawTranscript: string;
}

export interface ParsedPOSVoiceResult {
  query: string;
  quantity?: number;
  rawTranscript: string;
}

// Map Portuguese number words to numeric values
const WORD_TO_NUMBER: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  três: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  meia: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  catorze: 14,
  quatorze: 14,
  quinze: 15,
  dezasseis: 16,
  dezesseis: 16,
  dezassete: 17,
  dezoito: 18,
  dezanove: 19,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
  cem: 100,
  cento: 100,
  duzentos: 200,
  duzentas: 200,
  trezentos: 300,
  quatrocentos: 400,
  quinhentos: 500,
  quinhentas: 500,
  seiscentos: 600,
  setecentos: 700,
  oitocentos: 800,
  novecentos: 900,
  mil: 1000,
};

/**
 * Normalizes text: lowercase, remove punctuation, strip accents where needed
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,;:!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses verbal number representations like "vinte e cinco" or "25"
 */
function parseSpokenQuantity(tokenStr: string): number {
  const parts = tokenStr.trim().split(/\s+/).filter(p => p !== 'e');
  let total = 0;
  let currentGroup = 0;

  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      total += parseInt(part, 10);
    } else if (WORD_TO_NUMBER[part] !== undefined) {
      const val = WORD_TO_NUMBER[part];
      if (val === 1000) {
        currentGroup = currentGroup === 0 ? 1000 : currentGroup * 1000;
        total += currentGroup;
        currentGroup = 0;
      } else {
        currentGroup += val;
      }
    }
  }

  return total + currentGroup;
}

/**
 * Parses spoken cash drawer counts during blind shift close.
 * Handles patterns such as:
 * - "10 notas de mil, 5 notas de quinhentos, vinte notas de duzentos e 30 moedas de cinco"
 * - "quinze de 1000, 20 de 500, trinta de cem"
 */
export function parseSpokenCashUp(transcript: string): ParsedCashUpResult {
  const counts: CashUpDenominationCounts = {
    1000: 0,
    500: 0,
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    2: 0,
    1: 0,
  };

  const matchedPhrases: string[] = [];
  const normalized = normalizeText(transcript);

  // Split into individual clauses separated by commas, "e", "mais"
  const clauses = normalized
    .split(/,|\be\b|\bmais\b/)
    .map(c => c.trim())
    .filter(Boolean);

  // Denomination target mappings
  const denomPatterns: Array<{
    denom: keyof CashUpDenominationCounts;
    regex: RegExp;
    label: string;
  }> = [
    { denom: 1000, regex: /(?:notas?\s+de\s+|de\s+|x\s*)?(?:mil|1000|1\.000)/i, label: '1000 MT' },
    { denom: 500, regex: /(?:notas?\s+de\s+|de\s+|x\s*)?(?:quinhentos?|quinhentas?|500)/i, label: '500 MT' },
    { denom: 200, regex: /(?:notas?\s+de\s+|de\s+|x\s*)?(?:duzentos?|duzentas?|200)/i, label: '200 MT' },
    { denom: 100, regex: /(?:notas?\s+de\s+|de\s+|x\s*)?(?:cem|cento|100)/i, label: '100 MT' },
    { denom: 50, regex: /(?:notas?\s+de\s+|de\s+|x\s*)?(?:cinquenta|50)/i, label: '50 MT' },
    { denom: 20, regex: /(?:notas?\s+de\s+|de\s+|x\s*)?(?:vinte|20)/i, label: '20 MT' },
    { denom: 10, regex: /(?:moedas?\s+de\s+|notas?\s+de\s+|de\s+|x\s*)?(?:dez|10)/i, label: '10 MT' },
    { denom: 5, regex: /(?:moedas?\s+de\s+|de\s+|x\s*)?(?:cinco|5)/i, label: '5 MT' },
    { denom: 2, regex: /(?:moedas?\s+de\s+|de\s+|x\s*)?(?:dois|duas|2)/i, label: '2 MT' },
    { denom: 1, regex: /(?:moedas?\s+de\s+|de\s+|x\s*)?(?:um|uma|1)/i, label: '1 MT' },
  ];

  for (const clause of clauses) {
    for (const item of denomPatterns) {
      if (item.regex.test(clause)) {
        // Extract quantity preceding the denomination
        const cleanedClause = clause.replace(item.regex, '').replace(/notas?|moedas?/g, '').trim();
        const quantity = parseSpokenQuantity(cleanedClause);

        if (quantity > 0) {
          counts[item.denom] = (counts[item.denom] || 0) + quantity;
          matchedPhrases.push(`${quantity} × ${item.label}`);
          break; // Stop after matching this clause to a denomination
        }
      }
    }
  }

  // Calculate grand total in Meticais (MT)
  let totalMt = 0;
  for (const [denomStr, count] of Object.entries(counts)) {
    const denom = parseFloat(denomStr);
    totalMt += denom * count;
  }

  return {
    counts,
    totalMt: Math.round(totalMt * 100) / 100,
    matchedPhrases,
    rawTranscript: transcript,
  };
}

/**
 * Parses spoken petty cash (sangrias e suprimentos de caixa).
 * Example: "Saída de 350 meticais para compra de material de limpeza"
 */
export function parsePettyCashVoice(transcript: string): ParsedPettyCashResult {
  const normalized = normalizeText(transcript);
  
  // Determine transaction type
  const isDeposit = /\b(?:entrada|reforco|reforço|suprimento|deposito|depósito)\b/.test(normalized);
  const type: 'withdrawal' | 'deposit' = isDeposit ? 'deposit' : 'withdrawal';

  // Extract amount
  let amount = 0;
  const amountMatch = normalized.match(/(?:de\s+)?(\d+(?:[.,]\d+)?)\s*(?:meticais|mt)/);
  if (amountMatch) {
    amount = parseFloat(amountMatch[1].replace(',', '.'));
  } else {
    // Try written numbers before "meticais"
    const writtenMatch = normalized.match(/^(?:saida|saída|entrada)?\s*(?:de\s+)?([a-z\s]+)\s+(?:meticais|mt)/);
    if (writtenMatch) {
      amount = parseSpokenQuantity(writtenMatch[1]);
    }
  }

  // Extract reason: everything after "para", "de", or after the amount
  let reason = transcript;
  const reasonMatch = transcript.match(/\b(?:para|motivo:?|justificativo:?)\s+(.+)$/i);
  if (reasonMatch) {
    reason = reasonMatch[1].trim();
  } else {
    // Strip common leading words
    reason = transcript
      .replace(/^(?:saída|saida|entrada)\s+(?:de\s+)?(?:\d+|[a-z]+)\s*(?:meticais|mt)?\s*(?:para\s+)?/i, '')
      .trim();
  }

  // Capitalize first letter of reason
  if (reason.length > 0) {
    reason = reason.charAt(0).toUpperCase() + reason.slice(1);
  }

  return {
    type,
    amount: Math.round(amount * 100) / 100,
    reason: reason || 'Registo verbal sem justificação detalhada',
    rawTranscript: transcript,
  };
}

/**
 * Parses spoken POS product search & quick addition.
 * Example: "Adiciona 3 latas de coca cola" or "Procurar arroz 25kg"
 */
export function parsePOSVoice(transcript: string): ParsedPOSVoiceResult {
  const normalized = normalizeText(transcript);

  // Look for quantity
  let quantity: number | undefined;
  const qtyMatch = normalized.match(/^(?:adiciona|adicionar|poe|põe|quero|dar)\s+(\d+|[a-z]+)\s+(.+)$/i);
  let query = transcript;

  if (qtyMatch) {
    const rawQty = qtyMatch[1];
    const parsedQty = /^\d+$/.test(rawQty) ? parseInt(rawQty, 10) : parseSpokenQuantity(rawQty);
    if (parsedQty > 0) {
      quantity = parsedQty;
      query = qtyMatch[2];
    }
  } else {
    // Strip search commands
    query = transcript
      .replace(/^(?:pesquisar|buscar|procurar|encontrar|onde está|temos)\s+/i, '')
      .trim();
  }

  return {
    query: query.trim(),
    quantity,
    rawTranscript: transcript,
  };
}
