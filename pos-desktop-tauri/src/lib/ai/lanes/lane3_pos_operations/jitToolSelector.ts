/**
 * @file jitToolSelector.ts
 * @description Lane 3 JIT Tool Selector.
 * Maps operational retail questions to the exact SQLite fetch function,
 * ensuring zero tool bloat and precise grounding.
 */

export type PosJitToolName =
  | 'fetch_inventory'
  | 'fetch_customers'
  | 'fetch_shifts'
  | 'fetch_deliveries'
  | 'fetch_store_overview';

export interface PosJitToolSelection {
  name: PosJitToolName;
  params: Record<string, any>;
  description: string;
}

/**
 * Checks if a query is a single operational query suitable for Lane 3.
 */
export function isPosOperationQuery(query: string): boolean {
  const q = query.toLowerCase().trim();

  // Exclude explicit multi-item mutations or marketing
  if (q.includes('promotional summary') || q.includes('post para whatsapp')) return false;

  const operationalKeywords = [
    'current stock', 'check stock', 'our stock', 'stock', 'estoque', 'inventory',
    'how many products', 'which products', 'quantos produtos', 'low on stock',
    'low stock', 'stock baixo', 'out of stock', 'falta de stock',
    'who is logged in', 'who logged in', 'logged in', 'who currently has a shift',
    'who has a shift', 'active shift', 'who is the cashier', 'who is the operator',
    'quem está logado', 'quem logou', 'turno', 'caixa aberto',
    'how many customers', 'quantos clientes', 'customers do we have', 'who owes money',
    'quem deve', 'fiado', 'debt', 'dívida', 'devedores',
    'expected deliveries', 'delivery stocks', 'entregas esperadas', 'fornecedor',
    'how many customers, products', 'store overview', 'visão geral'
  ];

  return operationalKeywords.some(kw => q.includes(kw));
}

/**
 * Maps query to the exact single JIT tool required.
 */
export function selectJitTool(query: string): PosJitToolSelection {
  const q = query.toLowerCase().trim();

  // 1. Multi-domain query ("How many customers, products and delivery stocks do we have?")
  const hasProds = (q.includes('product') || q.includes('produto') || (q.includes('stock') && !q.includes('delivery stock'))) && !q.includes('add');
  const hasCusts = (q.includes('customer') || q.includes('cliente') || q.includes('client')) && !q.includes('add');
  const hasDelivs = (q.includes('delivery') || q.includes('deliveries') || q.includes('entrega')) && !q.includes('add');

  if ((hasProds && hasCusts) || (hasProds && hasDelivs) || (hasCusts && hasDelivs) || q.includes('overview') || q.includes('visão geral')) {
    return {
      name: 'fetch_store_overview',
      params: {},
      description: 'Fetch multi-domain store summary: products, customers, shifts, deliveries'
    };
  }

  // 2. Shifts & Cashier / Operator Login ("who is logged in?", "who has a shift?")
  if (
    q.includes('logged in') || q.includes('logged') || q.includes('login') ||
    q.includes('shift') || q.includes('turno') || q.includes('cashier') ||
    q.includes('caixa') || q.includes('quem logou') || q.includes('quem está logado') ||
    q.includes('who is the operator') || q.includes('who is on duty')
  ) {
    return {
      name: 'fetch_shifts',
      params: {},
      description: 'Fetch active cashier shift and logged in operator status'
    };
  }

  // 3. Deliveries / incoming restock ("how many delivery stocks?")
  if (q.includes('delivery') || q.includes('deliveries') || q.includes('entrega') || q.includes('fornecedor')) {
    return {
      name: 'fetch_deliveries',
      params: { status: 'pending' },
      description: 'Fetch expected supplier delivery shipments'
    };
  }

  // 4. Customers & Fiado Debts
  if (
    q.includes('customer') || q.includes('cliente') || q.includes('client') ||
    q.includes('debt') || q.includes('dívida') || q.includes('fiado') ||
    q.includes('owes') || q.includes('devedor')
  ) {
    return {
      name: 'fetch_customers',
      params: { filter: q.includes('debt') || q.includes('fiado') || q.includes('owes') ? 'debtors' : 'all' },
      description: 'Fetch registered customers and fiado credit debts'
    };
  }

  // 5. Default to Inventory / Stock Products
  return {
    name: 'fetch_inventory',
    params: {
      filter: q.includes('low') || q.includes('baixo') || q.includes('critical') ? 'low_stock' : 'all'
    },
    description: 'Fetch live SQLite inventory count and stock details'
  };
}
