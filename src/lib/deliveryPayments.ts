export const PAYMENT_METHODS = ['CASH', 'KBZ_PAY', 'WAVE_PAY', 'AYA_PAY', 'CB_PAY', 'BANK_TRANSFER', 'MOBILE_WALLET', 'QR'] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];
export type PaymentRow = { method: string; amount: string; reference: string };
export type PaymentAllocation = { method: PaymentMethod; amount: number; reference: string };
export type PaymentScope = { actor: string; wayplan: string; delivery: string };
export type PaymentDraft = { rows: PaymentRow[]; submission: 'editing' | 'uncertain' };
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
function minorUnits(value: unknown): number {
  const text = String(value ?? '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error('Enter a valid MMK amount with at most two decimal places.');
  const [whole, fraction = ''] = text.split('.');
  const units = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(units)) throw new Error('MMK amount is too large.');
  return units;
}
export function paymentTotals(rows: Array<{method: string; amount: string | number}>) {
  let cash = 0, digital = 0;
  for (const row of rows) {
    let amount = 0;
    try { amount = minorUnits(row.amount); } catch { continue; }
    if (row.method === 'CASH') cash += amount;
    else if (PAYMENT_METHODS.includes(row.method as PaymentMethod)) digital += amount;
  }
  return {cash: cash / 100, digital: digital / 100, total: (cash + digital) / 100};
}
export function buildPaymentPayload(rows: Array<{method: string; amount: string | number; reference?: string}>, expected: number) {
  const expectedUnits = minorUnits(expected);
  let collectedUnits = 0;
  const payment_allocations: PaymentAllocation[] = rows.map(row => {
    if (!PAYMENT_METHODS.includes(row.method as PaymentMethod)) throw new Error('Select a supported payment method.');
    const units = minorUnits(row.amount);
    if (units <= 0) throw new Error('Each payment amount must be greater than zero.');
    const reference = String(row.reference || '').trim();
    if (row.method !== 'CASH' && !reference) throw new Error('Transaction reference is required for every digital payment.');
    collectedUnits += units;
    return {method: row.method as PaymentMethod, amount: units / 100, reference};
  });
  if (collectedUnits !== expectedUnits) throw new Error('Payment total must equal the expected collection amount.');
  const methods = new Set(payment_allocations.map(row => row.method));
  const method: PaymentMethod | 'MIXED' | null = methods.size > 1 ? 'MIXED' : payment_allocations[0]?.method || null;
  return {payment_allocations, payment_method: method, payment_mode: method, cod_collected_amount: expectedUnits / 100,
    transaction_reference: payment_allocations.map(row => row.reference).filter(Boolean).join(' / ') || null};
}
function allocations(row: any): any[] | null {
  const value = row?.payment_allocations ?? row?.metadata?.payment_allocations ?? row?.reported_payment_allocations ?? row?.metadata?.reported_payment_allocations;
  return Array.isArray(value) ? value : null;
}
export function initialPaymentRows(row: any, expected: number): PaymentRow[] {
  const saved = allocations(row);
  if (saved) return saved.map(item => ({method: String(item.method || ''), amount: String(item.amount ?? ''), reference: String(item.reference || '')}));
  const method = String(row?.payment_method || row?.payment_mode || '').toUpperCase();
  if (PAYMENT_METHODS.includes(method as PaymentMethod) && expected > 0)
    return [{method, amount: String(expected), reference: String(row?.transaction_reference || '')}];
  const recorded = /DELIVERED|COMPLETED|PENDING_DRIVER/.test(String(row?.stop_status || row?.rider_status || '').toUpperCase()) || Number(row?.authoritative_cod_collected ?? row?.reported_collected ?? row?.cod_collected ?? 0) > 0;
  return !recorded && expected > 0 ? [{method: 'CASH', amount: String(expected), reference: ''}] : [];
}
export function recordedPaymentSummary(row: any): {method: PaymentMethod | 'MIXED' | 'UNKNOWN'; cash: number} {
  const saved = allocations(row);
  const collected = Number(row?.authoritative_cod_collected ?? row?.reported_collected ?? row?.cod_collected ?? 0);
  if (saved) {
    try {
      const payload = buildPaymentPayload(saved, collected);
      return {method: payload.payment_method || 'UNKNOWN', cash: paymentTotals(payload.payment_allocations).cash};
    } catch { return {method: 'UNKNOWN', cash: 0}; }
  }
  const method = String(row?.payment_method || row?.payment_mode || '').toUpperCase();
  return PAYMENT_METHODS.includes(method as PaymentMethod) ? {method: method as PaymentMethod, cash: method === 'CASH' ? collected : 0} : {method: 'UNKNOWN', cash: 0};
}
function draftKey(scope: PaymentScope) {
  if (!scope.actor || !scope.wayplan || !scope.delivery) throw new Error('Sign in and select a delivery before saving payments.');
  return `britium.delivery.payments.v1:${JSON.stringify([scope.actor, scope.wayplan, scope.delivery])}`;
}
export function readPaymentDraft(storage: Storage, scope: PaymentScope): PaymentDraft | null {
  try {
    const draft = JSON.parse(storage.getItem(draftKey(scope)) || 'null');
    if (!draft || !Array.isArray(draft.rows) || !['editing', 'uncertain'].includes(draft.submission)) return null;
    if (!draft.rows.every((row: any) => typeof row.method === 'string' && typeof row.amount === 'string' && typeof row.reference === 'string')) return null;
    return {rows: draft.rows, submission: draft.submission};
  } catch { return null; }
}
export function writePaymentDraft(storage: Storage, scope: PaymentScope, draft: PaymentDraft) {
  storage.setItem(draftKey(scope), JSON.stringify(draft));
}
export function clearPaymentDraft(storage: Storage, scope: PaymentScope) { storage.removeItem(draftKey(scope)); }
