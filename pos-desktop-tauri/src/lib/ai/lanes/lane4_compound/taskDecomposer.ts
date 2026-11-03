/**
 * @file taskDecomposer.ts
 * @description Lane 4 Task Decomposer.
 * Deconstructs compound, multi-intent prompts into atomic tasks across products,
 * customers, deliveries, operators, and POS cart items to prevent Llama 3.2 1B cognitive overload.
 */

export interface DecomposedTask {
  id: string;
  type:
    | 'CREATE_PRODUCT'
    | 'UPDATE_PRODUCT'
    | 'DELETE_PRODUCT'
    | 'CREATE_CUSTOMER'
    | 'UPDATE_CUSTOMER'
    | 'DELETE_CUSTOMER'
    | 'CREATE_OPERATOR'
    | 'CREATE_DELIVERY'
    | 'ADD_TO_CART'
    | 'CHECK_STOCK'
    | 'CHECK_SHIFTS'
    | 'CHECK_DELIVERIES'
    | 'CHECK_CUSTOMERS';
  count: number;
  rawText: string;
  entityName?: string;
  details?: Record<string, any>;
}

export interface DecompositionResult {
  isCompound: boolean;
  tasks: DecomposedTask[];
}

/**
 * Helper to parse integer or word-based count from prompt
 */
function parseCount(raw?: string): number {
  if (!raw) return 0;
  const num = parseInt(raw, 10);
  if (!isNaN(num)) return num;
  const map: Record<string, number> = {
    'one': 1, 'um': 1, 'uma': 1,
    'two': 2, 'dois': 2, 'duas': 2,
    'three': 3, 'três': 3, 'tres': 3,
    'four': 4, 'quatro': 4,
    'five': 5, 'cinco': 5,
    'six': 6, 'seis': 6,
    'seven': 7, 'sete': 7,
    'eight': 8, 'oito': 8,
    'nine': 9, 'nove': 9,
    'ten': 10, 'dez': 10
  };
  return map[raw.toLowerCase()] || 0;
}

/**
 * Checks if a user prompt is compound (has multiple distinct CRUD intents or multiple entity mutations).
 */
export function isCompoundQuery(query: string): boolean {
  const q = query.toLowerCase();

  const countPattern = /\b([1-9]|10|one|two|three|four|five|six|seven|eight|nine|ten|um|uma|dois|duas|três|tres|quatro|cinco)\s+/i;
  const hasMultipleProducts = countPattern.test(q) && /(products?|produtos?)/i.test(q);
  const hasMultipleCustomers = countPattern.test(q) && /(customers?|clientes?|clients?)/i.test(q);
  const hasMultipleDeliveries = countPattern.test(q) && /(deliveries|delivery|entregas?|fornecedores?|suppliers?|encomendas?)/i.test(q);

  const actionKeywords = /add|create|make|register|cadastrar|registar|criar|adicionar|novo|new|log|encomenda/i;

  const activeDomains = [
    (q.includes('product') || q.includes('produto')) && actionKeywords.test(q),
    (q.includes('customer') || q.includes('cliente') || q.includes('client') || q.includes('fiado')) && actionKeywords.test(q),
    (q.includes('delivery') || q.includes('entrega') || q.includes('fornecedor') || q.includes('supplier') || q.includes('restock')) && actionKeywords.test(q),
    (q.includes('operator') || q.includes('operador') || q.includes('cashier') || q.includes('caixa')) && actionKeywords.test(q)
  ];

  const activeDomainsCount = activeDomains.filter(Boolean).length;

  return activeDomainsCount >= 2 || hasMultipleProducts || hasMultipleCustomers || hasMultipleDeliveries;
}

/**
 * Deconstructs prompt into an ordered list of atomic tasks.
 */
export function decomposeQuery(query: string): DecompositionResult {
  const q = query.toLowerCase();
  const tasks: DecomposedTask[] = [];

  const countRegex = '\\b(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|um|uma|dois|duas|três|tres|quatro|cinco)\\s+';

  // 1. Detect Products ("create 2 products", "add 3 new products", "novo produto")
  const productCountMatch = q.match(new RegExp(`${countRegex}(?:new\\s+|novos?\\s+)?(products?|produtos?)`, 'i'));
  let productCount = 0;
  if (productCountMatch) {
    productCount = parseCount(productCountMatch[1]);
  } else if (
    (q.includes('product') || q.includes('produto')) &&
    /add|create|criar|adicionar|new|novo/i.test(q)
  ) {
    productCount = 1;
  }

  if (productCount > 0) {
    let specificName = '';
    const nameMatch = query.match(/(?:product|produto)[:\s]+([A-ZÀ-Úa-zà-ú0-9\s]+?)(?=\s+(?:and|e|for|with|price|custo|\d+|$))/i);
    if (nameMatch && !/^(?:new|novo|draft)$/i.test(nameMatch[1].trim())) {
      specificName = nameMatch[1].trim();
    }

    for (let i = 1; i <= productCount; i++) {
      const label = productCount > 1
        ? (specificName ? `${specificName} ${i}` : `New Product ${i}`)
        : (specificName || 'New Product');

      tasks.push({
        id: crypto.randomUUID(),
        type: 'CREATE_PRODUCT',
        count: 1,
        rawText: `Add product: ${label}`,
        entityName: label
      });
    }
  }

  // 2. Detect Customers ("3 customers", "register 2 clients", "novo cliente: Maria")
  const customerCountMatch = q.match(new RegExp(`${countRegex}(?:new\\s+|novos?\\s+)?(customers?|clientes?|clients?)`, 'i'));
  let customerCount = 0;
  if (customerCountMatch) {
    customerCount = parseCount(customerCountMatch[1]);
  } else if (
    (q.includes('customer') || q.includes('cliente') || q.includes('client')) &&
    /add|create|criar|adicionar|register|cadastrar|registar|new|novo/i.test(q)
  ) {
    customerCount = 1;
  }

  if (customerCount > 0) {
    let specificCustomer = '';
    const nameMatch = query.match(/(?:customer|cliente|client)[:\s]+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)/i);
    if (nameMatch) {
      specificCustomer = nameMatch[1].trim();
    }

    for (let i = 1; i <= customerCount; i++) {
      const label = customerCount > 1
        ? (specificCustomer ? `${specificCustomer} ${i}` : `New Customer ${i}`)
        : (specificCustomer || 'New Customer');

      tasks.push({
        id: crypto.randomUUID(),
        type: 'CREATE_CUSTOMER',
        count: 1,
        rawText: `Register customer: ${label}`,
        entityName: label
      });
    }
  }

  // 3. Detect Deliveries ("1 delivery", "2 deliveries", "register delivery from Unilever")
  const deliveryCountMatch = q.match(new RegExp(`${countRegex}(?:new\\s+|novas?\\s+)?(deliveries|delivery|entregas?|fornecedores?|suppliers?|encomendas?)`, 'i'));
  let deliveryCount = 0;
  if (deliveryCountMatch) {
    deliveryCount = parseCount(deliveryCountMatch[1]);
  } else if (
    (q.includes('delivery') || q.includes('entrega') || q.includes('fornecedor') || q.includes('supplier')) &&
    /add|create|criar|adicionar|log|register|registar|order|nova|encomenda/i.test(q)
  ) {
    deliveryCount = 1;
  }

  if (deliveryCount > 0) {
    let specificSupplier = '';
    const supplierMatch = query.match(/(?:supplier|fornecedor|delivery from|entrega de)[:\s]+([A-ZÀ-Úa-zà-ú0-9\s]+?)(?=\s+(?:and|e|with|\d+|$))/i);
    if (supplierMatch) {
      specificSupplier = supplierMatch[1].trim();
    }

    for (let i = 1; i <= deliveryCount; i++) {
      const label = deliveryCount > 1
        ? (specificSupplier ? `${specificSupplier} ${i}` : `Supplier ${i}`)
        : (specificSupplier || 'Supplier Delivery');

      tasks.push({
        id: crypto.randomUUID(),
        type: 'CREATE_DELIVERY',
        count: 1,
        rawText: `Register delivery from ${label}`,
        entityName: label
      });
    }
  }

  // 4. Detect Operators ("create operator: Maria")
  const hasOperatorAdd =
    (q.includes('operator') || q.includes('operador') || q.includes('cashier')) &&
    /add|create|criar|adicionar|new|novo/i.test(q);

  if (hasOperatorAdd) {
    let operatorName = '';
    const opMatch = query.match(/(?:operator|operador|cashier)[:\s]+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)/i);
    if (opMatch) {
      operatorName = opMatch[1].trim();
    }

    tasks.push({
      id: crypto.randomUUID(),
      type: 'CREATE_OPERATOR',
      count: 1,
      rawText: operatorName ? `Create operator: ${operatorName}` : 'Create new operator profile',
      entityName: operatorName || 'New Cashier'
    });
  }

  const isCompound = tasks.length >= 2;

  return {
    isCompound,
    tasks
  };
}
