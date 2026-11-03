import assert from 'node:assert/strict';
import test from 'node:test';

Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  },
  configurable: true,
});

Object.defineProperty(globalThis, 'window', {
  value: { ...globalThis, dispatchEvent: () => undefined },
  configurable: true,
});

Object.defineProperty(globalThis, 'dispatchEvent', {
  value: () => undefined,
  configurable: true,
});

const { isNonFactualStoreResponse, buildCustomerSummary, buildDeliverySummary } = await import('./singleLaneHandler');
const { isIncompleteCompoundResponse } = await import('./compoundFetchHandler');
const { executeCompoundTasks } = await import('../lane4_compound/compoundExecutor');

test('rejects generic greeting as a stock response', () => {
  const text = `Hey! I'm your store copilot for SYCOMM POS. I'm connected to your live register, shelf stock, customer debts (fiado), and cashier shifts. How can I help you run the shop today?`;

  assert.equal(isNonFactualStoreResponse(text), true);
});

test('accepts a factual stock summary as a valid response', () => {
  const text = `• Current store inventory: 12 total units across 3 products.\n• Shelf stock items:\n• Rice: 10 un (120 MT)`;

  assert.equal(isNonFactualStoreResponse(text), false);
});

test('accepts a natural intro plus factual bullets as a valid response', () => {
  const text = `I checked the live stock and here is the current picture:\n• Current store inventory: 12 total units across 3 products.\n• Shelf stock items:\n• Rice: 10 un (120 MT)`;

  assert.equal(isNonFactualStoreResponse(text), false);
});

test('summarizes customer and delivery data from real debt and delivery rows without using a nonexistent customers table', () => {
  const customerSummary = buildCustomerSummary([
    { customer_name: 'Ana', amount_mt: 1500, status: 'unpaid' },
    { customer_name: 'Ana', amount_mt: 500, status: 'partial' },
    { customer_name: 'Beto', amount_mt: 2000, status: 'unpaid' }
  ]);

  const deliverySummary = buildDeliverySummary([
    { supplier_name: 'Supplier A', expected_date: '2025-01-01', total_expected_quantity: 25 },
    { supplier_name: 'Supplier B', expected_date: '2025-01-02', total_expected_quantity: 12 }
  ]);

  assert.equal(customerSummary.totalCustomers, 2);
  assert.equal(customerSummary.debtorCount, 3);
  assert.equal(deliverySummary.pendingDeliveriesCount, 2);
  assert.equal(deliverySummary.totalExpectedUnits, 37);
});

test('rejects partial compound summaries that mention only stock and then break off before customer and delivery details', () => {
  const partialText = `I checked the requested store metrics and here is the live picture:\n\n• Current Stock:\n  • Total Products: 5\n    - Coca-cola 2l (80 MT): 50 un\n    - Peanut Butter: 50 un\n• Customer and Fiado Metrics:`;

  assert.equal(isIncompleteCompoundResponse(partialText, 'What is the current stock, customer and delivery levels?'), true);
});

test('builds a dynamic compound task response instead of stale preset wording', async () => {
  const res = await executeCompoundTasks({
    tasks: [
      { id: '1', type: 'CREATE_PRODUCT', count: 2, rawText: '2 products' },
      { id: '2', type: 'CREATE_CUSTOMER', count: 3, rawText: '3 customers' },
      { id: '3', type: 'CREATE_DELIVERY', count: 1, rawText: '1 delivery' }
    ],
    query: 'Can you add 2 products, 3 customers and 1 delivery?',
    operatorName: 'Admin',
    lang: 'en'
  });

  assert.equal(/I have prepared/i.test(res.answer), false);
  assert.match(res.answer, /2 items|3 accounts|Delivery request queued|supplier/i);
});
