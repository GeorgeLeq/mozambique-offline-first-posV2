/**
 * @file telemetryFormatter.ts
 * @description Grounded Telemetry Formatter & Response Sanitizer for Lane 3 POS Operations.
 * Converts raw SQLite data rows into structured, human-readable factual prose sentences.
 * Eliminates JSON curly braces {} so Llama 3.2 1B NEVER echoes raw syntax or placeholders.
 */

/**
 * Checks whether an AI response is a generic or non-factual greeting instead of real store data.
 */
export function isNonFactualStoreResponse(text: string): boolean {
  if (!text || !text.trim()) return true;

  const normalized = text.replace(/\s+/g, ' ').trim();
  const lower = normalized.toLowerCase();

  const genericGreetingPatterns = [
    /^hey!\s*im your store copilot/i,
    /^hello!\s*im your store copilot/i,
    /^hi!\s*im your store copilot/i,
    /i'm your store copilot/i,
    /i am your store copilot/i,
    /how can i help you run the shop today/i,
    /how can i help/i,
    /what's on your mind/i,
    /ready to help you/i,
    /^hello!/i,
    /^hi\b/i,
    /^hey\b/i,
    /^(olá|ola|bom dia|boa tarde|boa noite)!?/i,
  ];

  if (genericGreetingPatterns.some(pattern => pattern.test(normalized))) {
    return true;
  }

  const hasStoreContext = /(stock|inventory|estoque|produto|product|fiado|debt|customer|cliente|turno|cashier|caixa|shortage|falta|quebra|scan|leitura)/i.test(lower);
  const hasNumbers = /\d/.test(normalized);

  if (!hasStoreContext && !hasNumbers) {
    return true;
  }

  return false;
}

/**
 * Strips any residual template placeholder tags, curly braces, foreign currencies, or portmanteau words from Llama output.
 */
export function sanitizeLlamaResponse(text: string): string {
  if (!text) return text;
  return text
    .replace(/\{[a-zA-Z0-9_\[\]\s:"',-]+\}\s*/g, '')
    .replace(/\{\s*\}/g, '')
    .replace(/\(\s*\)/g, '')
    // Strip empty placeholder brackets like [Insert ...] or [Insira ...]
    .replace(/\[\s*(?:Insert|Insira|Preencha|Digite)[^\]]*\]/gi, '')
    .replace(/\[\s*\]/g, '')
    // Remove foreign currency dollar conversions
    .replace(/\s*\((?:approximately|aprox\.?|cerca de)?\s*\$[\d.,]+\s*(?:USD)?\)/gi, '')
    .replace(/\b(?:USD|\$)\s*(\d+(?:[.,]\d+)?)/gi, '$1 MT')
    .replace(/\$\s*\[/g, '[')
    // Fix invented portmanteau words
    .replace(/\bSimbamente\b/gi, 'Certamente')
    .replace(/\bsimbamente\b/gi, 'certamente')
    .trim();
}

/**
 * Formats SQLite telemetry data into clean human sentences instead of raw JSON.
 * This completely prevents Llama 3.2 1B from echoing template brackets like {totalProducts} or {sampleItems[0]}.
 */
export function formatStoreFactsHuman(data: Record<string, any>, isPt: boolean): string {
  if (!data) return isPt ? 'Nenhum dado disponível.' : 'No data available.';

  // If compound data object
  const compoundKeys = ['fetch_inventory', 'fetch_customers', 'fetch_deliveries', 'fetch_shifts', 'fetch_shift_reports', 'fetch_scan_history'];
  const hasCompound = compoundKeys.some(k => Boolean(data[k]));

  if (hasCompound) {
    const sections: string[] = [];
    if (data.fetch_inventory) sections.push(formatSingleTelemetry('fetch_inventory', data.fetch_inventory, isPt));
    if (data.fetch_customers) sections.push(formatSingleTelemetry('fetch_customers', data.fetch_customers, isPt));
    if (data.fetch_deliveries) sections.push(formatSingleTelemetry('fetch_deliveries', data.fetch_deliveries, isPt));
    if (data.fetch_shifts) sections.push(formatSingleTelemetry('fetch_shifts', data.fetch_shifts, isPt));
    if (data.fetch_shift_reports) sections.push(formatSingleTelemetry('fetch_shift_reports', data.fetch_shift_reports, isPt));
    if (data.fetch_scan_history) sections.push(formatSingleTelemetry('fetch_scan_history', data.fetch_scan_history, isPt));
    return sections.filter(Boolean).join('\n\n');
  }

  return formatSingleTelemetry(data.metric || 'data', data, isPt);
}

function formatSingleTelemetry(key: string, d: Record<string, any>, isPt: boolean): string {
  if (key === 'fetch_inventory' || d.metric === 'current_inventory' || d.metric === 'low_stock_inventory') {
    const totalProd = d.totalProducts ?? 0;
    const totalUnits = d.totalUnits ?? 0;
    const items = Array.isArray(d.sampleItems) && d.sampleItems.length > 0 
      ? d.sampleItems.join(', ') 
      : (isPt ? 'Nenhum item com baixo estoque' : 'None');
    return isPt
      ? `• Estoque Atual: ${totalProd} produtos registados com um total de ${totalUnits} unidades em stock.\n  Itens em catálogo: ${items}.`
      : `• Current Inventory: ${totalProd} registered products with ${totalUnits} total units in stock.\n  Catalog items: ${items}.`;
  }

  if (key === 'fetch_customers' || d.metric === 'customer_metrics') {
    const totalCust = d.totalCustomers ?? 0;
    const debtorCount = d.debtorCount ?? 0;
    const debtors = Array.isArray(d.topDebtors) && d.topDebtors.length > 0 
      ? d.topDebtors.join(', ') 
      : (isPt ? 'Nenhum fiado pendente' : 'No outstanding debts');
    return isPt
      ? `• Clientes e Fiado: ${totalCust} clientes no livro de contas, sendo ${debtorCount} com saldo devedor.\n  Maiores devedores: ${debtors}.`
      : `• Customers & Fiado Debts: ${totalCust} total customers in ledger, with ${debtorCount} customers having outstanding debts.\n  Top debtors: ${debtors}.`;
  }

  if (key === 'fetch_deliveries' || d.metric === 'expected_deliveries') {
    const pendingCount = d.pendingDeliveriesCount ?? 0;
    const units = d.totalExpectedUnits ?? 0;
    const list = Array.isArray(d.deliveries) && d.deliveries.length > 0 
      ? d.deliveries.join('; ') 
      : (isPt ? 'Nenhuma entrega agendada' : 'No pending deliveries');
    return isPt
      ? `• Encomendas e Entregas: ${pendingCount} encomendas de reposição pendentes (${units} unidades esperadas no total).\n  Próximas entregas: ${list}.`
      : `• Restock Deliveries: ${pendingCount} pending restock deliveries (${units} total expected units).\n  Upcoming deliveries: ${list}.`;
  }

  if (key === 'fetch_shifts' || d.metric === 'shift_and_login_status') {
    const active = d.hasActiveShift 
      ? (isPt ? `Turno aberto com operador ${d.activeCashierName}` : `Active shift under cashier ${d.activeCashierName}`) 
      : (isPt ? 'Nenhum turno aberto' : 'No open shift');
    const cash = d.currentCashMt ?? 0;
    const operators = Array.isArray(d.registeredOperators) ? d.registeredOperators.join(', ') : d.currentUserLoggedIn;
    return isPt
      ? `• Estado do Caixa e Turno: ${active} com fundo de caixa de ${cash} MT.\n  Operador actual logado: ${d.currentUserLoggedIn}. Colaboradores registados: ${operators}.`
      : `• Shift & Cash Register Status: ${active} with ${cash} MT cash in drawer.\n  Active logged in operator: ${d.currentUserLoggedIn}. Registered store staff: ${operators}.`;
  }

  if (key === 'fetch_shift_reports' || d.metric === 'shift_reports_audit') {
    const openList = Array.isArray(d.openShifts) ? d.openShifts : [];
    const closedList = Array.isArray(d.closedShifts) ? d.closedShifts : [];
    const discrepancies = Array.isArray(d.discrepancies) ? d.discrepancies : [];

    const openSummary = openList.length > 0
      ? openList.map((s: any) => `${s.cashier} (Vendas: ${s.total_sales_mt} MT, Abertura: ${s.opening_cash_mt} MT)`).join('; ')
      : (isPt ? 'Nenhum turno em aberto' : 'No open shifts');

    const discrepancyDetails = discrepancies.length > 0
      ? discrepancies.map((disc: any) => {
          const shortageNotice = disc.discrepancy_mt < 0
            ? (isPt ? `FALTA DE CAIXA / ROUBO SUSPEITO de ${Math.abs(disc.discrepancy_mt)} MT` : `CASH SHORTAGE / SUSPICIOUS THEFT of ${Math.abs(disc.discrepancy_mt)} MT`)
            : (isPt ? `Excedente de +${disc.discrepancy_mt} MT` : `Surplus of +${disc.discrepancy_mt} MT`);
          return `${disc.cashier}: ${shortageNotice} (Esperado: ${disc.expected_cash_mt} MT, Fecho em mão: ${disc.closing_cash_mt} MT. Auditoria: ${disc.audit_flag})`;
        }).join(' | ')
      : (isPt ? 'Nenhuma discrepância detetada' : 'No discrepancies detected');

    return isPt
      ? `• Relatórios e Auditoria de Turnos dos Caixas:\n  - Turnos em Aberto: ${openSummary}.\n  - Turnos Fechados: ${closedList.length} relatórios registados.\n  - Alertas e Discrepâncias de Caixa: ${discrepancyDetails}.`
      : `• Shift Reports & Register Audits:\n  - Open Shifts: ${openSummary}.\n  - Closed Shifts: ${closedList.length} total reports.\n  - Register Discrepancies & Audit Flags: ${discrepancyDetails}.`;
  }

  if (key === 'fetch_scan_history' || d.metric === 'scan_history_audit') {
    const scans = Array.isArray(d.scans) ? d.scans : [];
    const scanItems = scans.length > 0
      ? scans.slice(0, 6).map((s: any) => `${s.product_name} [${s.barcode}] (${s.quantity}x a ${s.unit_price_mt} MT = ${s.total_mt} MT lido por ${s.cashier} no ${s.terminal})`).join('\n  - ')
      : (isPt ? 'Nenhum registo de leitura recente' : 'No recent barcode scan logs');

    return isPt
      ? `• Histórico de Leituras de Código de Barras (Últimos registos):\n  - ${scanItems}`
      : `• Barcode Scan History & Operator Log (Recent scans):\n  - ${scanItems}`;
  }

  if (d.metric === 'store_overview') {
    return isPt
      ? `• Resumo Geral da Loja: ${d.totalProducts ?? 0} produtos (${d.totalUnits ?? 0} unidades), ${d.totalCustomers ?? 0} clientes registados, ${d.pendingDeliveries ?? 0} entregas pendentes (${d.totalExpectedUnits ?? 0} unidades esperadas). Operador logado: ${d.activeCashier}.`
      : `• Store Overview: ${d.totalProducts ?? 0} products (${d.totalUnits ?? 0} units in stock), ${d.totalCustomers ?? 0} registered customers, ${d.pendingDeliveries ?? 0} pending deliveries (${d.totalExpectedUnits ?? 0} expected units). Logged in cashier: ${d.activeCashier}.`;
  }

  return JSON.stringify(d);
}
