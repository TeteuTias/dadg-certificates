/** Pure CLAM rules: no database, environment, or gateway access. */
export class ClamError extends Error {
  constructor(public readonly code: string, public readonly status = 409, public readonly missingFields?: string[]) {
    super(code);
    this.name = 'ClamError';
  }
}

export type Payer = {
  name: string; cpf: string; zipCode: string; street: string; number: string;
  neighborhood: string; complement: string; phone: string; email: string;
};
export type Contract = { examsCount: number; amountCents: number; currency: 'BRL' };
export type GatewayPayment = {
  id: string; reference: string; status: string; amountCents: number;
  currency: string; refundedCents: number; updatedAt: string;
};

export function contractFor(
  count: number, maximum: number, available: number,
  tiers: Array<{ examsCount: number; unitTotalPrice: number }>,
): Contract {
  if (!Number.isInteger(count) || count < 1 || count > Math.min(4, maximum, available)) {
    throw new ClamError('INVALID_EXAMS_COUNT', 400);
  }
  const exact = tiers.find(t => t.examsCount === count);
  const single = tiers.find(t => t.examsCount === 1);
  const price = exact?.unitTotalPrice ?? (single ? single.unitTotalPrice * count : 0);
  const amountCents = Math.round(price * 100);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new ClamError('PRICING_NOT_CONFIGURED');
  return { examsCount: count, amountCents, currency: 'BRL' };
}

export type PaymentVerdict = 'PENDING' | 'PAID' | 'REVERSED' | 'REVIEW_REQUIRED';
export function paymentVerdict(payments: GatewayPayment[], contract: Contract, reference: string): PaymentVerdict {
  if (payments.some(p => p.reference !== reference || p.currency !== contract.currency || p.amountCents !== contract.amountCents)) {
    return 'REVIEW_REQUIRED';
  }
  if (payments.some(p => !['approved', 'refunded', 'charged_back', 'pending', 'in_process', 'authorized', 'cancelled', 'rejected'].includes(p.status))) return 'REVIEW_REQUIRED';
  if (payments.some(p => !Number.isSafeInteger(p.refundedCents) || p.refundedCents < 0 || p.refundedCents > contract.amountCents)) return 'REVIEW_REQUIRED';
  const settled = payments.filter(p => ['approved', 'refunded', 'charged_back'].includes(p.status));
  if (settled.length > 1) return 'REVIEW_REQUIRED';
  const paid = settled[0];
  if (!paid) return 'PENDING';
  if (paid.status === 'charged_back' || paid.refundedCents === contract.amountCents) return 'REVERSED';
  if (paid.status === 'refunded' || paid.refundedCents > 0) return 'REVIEW_REQUIRED';
  return 'PAID';
}

export function canCancelPayments(payments: GatewayPayment[]) {
  return payments.every(p => ['pending', 'in_process', 'authorized', 'cancelled', 'rejected'].includes(p.status));
}

export function toLocalDateTime(value: string | Date) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
