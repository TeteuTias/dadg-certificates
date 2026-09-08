import type { Contract, GatewayPayment, Payer } from '../domain';
import { ClamError } from '../domain';
type MpPayment = { id: string | number; external_reference?: string; status?: string; transaction_amount?: number; currency_id?: string; transaction_amount_refunded?: number; date_last_updated?: string };
type Preference = { id: string; init_point: string; expires: boolean; expiration_date_to: string; external_reference: string; date_created?: string };
export interface Gateway {
  create(reference: string, contract: Contract, payer: Payer, expiresAt: Date): Promise<Preference>;
  findPreference(reference: string): Promise<Preference | null>;
  payments(reference: string): Promise<GatewayPayment[]>;
  paymentReference(paymentId: string): Promise<string>;
  close(preferenceId: string, reference: string): Promise<GatewayPayment[]>;
}
export class MpGateway implements Gateway {
  private async request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token) throw new ClamError('PAYMENT_CONFIGURATION_ERROR', 503);
    // Financial requests always go to the official origin.
    const response = await fetch('https://api.mercadopago.com' + path, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(8000), cache: 'no-store',
    });
    if (!response.ok) throw new ClamError('PAYMENT_PROVIDER_UNAVAILABLE', 503);
    return response.json() as Promise<T>;
  }
  async create(reference: string, contract: Contract, payer: Payer, expiresAt: Date) {
    const notification = process.env.MERCADOPAGO_WEBHOOK_URL || `${process.env.APP_BASE_URL}/api/selective-processes/webhook`;
    if (!notification.startsWith('https://') || !process.env.MERCADOPAGO_WEBHOOK_SECRET) throw new ClamError('PAYMENT_CONFIGURATION_ERROR', 503);
    const pref = await this.request<Preference>('/checkout/preferences', 'POST', {
      external_reference: reference, items: [{ id: reference, title: `Inscrição CLAM — ${contract.examsCount} liga(s)`,
        quantity: 1, currency_id: contract.currency, unit_price: contract.amountCents / 100 }],
      payer: { email: payer.email, first_name: payer.name, identification: { type: 'CPF', number: payer.cpf } },
      notification_url: notification, auto_return: 'approved',
      back_urls: { success: process.env.MERCADOPAGO_BACK_URL_SUCCESS, pending: process.env.MERCADOPAGO_BACK_URL_PENDING, failure: process.env.MERCADOPAGO_BACK_URL_FAILURE },
      expires: true, expiration_date_from: new Date().toISOString(), expiration_date_to: expiresAt.toISOString(),
    });
    if (!pref.id || !pref.init_point || new URL(pref.init_point).protocol !== 'https:') throw new ClamError('PAYMENT_PROVIDER_UNAVAILABLE', 503);
    return pref;
  }
  async findPreference(reference: string) {
    const result = await this.request<{ elements?: Preference[]; total?: number }>('/checkout/preferences/search?external_reference=' + encodeURIComponent(reference));
    const exact = (result.elements || []).filter(p => p.external_reference === reference);
    if (exact.length > 1 || (result.total ?? exact.length) > 1) throw new ClamError('PAYMENT_REVIEW_REQUIRED');
    if (!exact.length) return null;
    const found = await this.request<Preference>('/checkout/preferences/' + encodeURIComponent(exact[0].id));
    if (found.external_reference !== reference || !found.init_point || new URL(found.init_point).protocol !== 'https:') throw new ClamError('PAYMENT_REVIEW_REQUIRED');
    return found;
  }
  async payments(reference: string) {
    const all: GatewayPayment[] = [];
    for (let offset = 0; ; offset += 100) {
      const page = await this.request<{ results: MpPayment[]; paging: { total: number } }>(
        '/v1/payments/search?external_reference=' + encodeURIComponent(reference) + '&limit=100&offset=' + offset);
      if (!Array.isArray(page.results) || !page.paging || !Number.isInteger(page.paging.total)) throw new ClamError('PAYMENT_PROVIDER_UNAVAILABLE', 503);
      for (const listed of page.results) {
        const p = await this.request<MpPayment>('/v1/payments/' + encodeURIComponent(String(listed.id)));
        if (!p.id || String(p.id) !== String(listed.id) || all.some(old => old.id === String(p.id))) throw new ClamError('PAYMENT_PROVIDER_UNAVAILABLE', 503);
        all.push({
        id: String(p.id), reference: String(p.external_reference ?? ''), status: String(p.status ?? ''),
        amountCents: Math.round(Number(p.transaction_amount) * 100), currency: String(p.currency_id ?? ''),
        refundedCents: Math.round(Number(p.transaction_amount_refunded ?? 0) * 100), updatedAt: String(p.date_last_updated ?? ''),
        });
      }
      if (offset + page.results.length >= page.paging.total) break;
      if (!page.results.length || offset >= 9900) throw new ClamError('PAYMENT_REVIEW_REQUIRED');
    }
    return all;
  }
  async paymentReference(id: string) {
    const payment = await this.request<MpPayment>('/v1/payments/' + encodeURIComponent(id));
    return payment.external_reference || '';
  }
  async close(preferenceId: string, reference: string) {
    const existing = await this.request<Preference>('/checkout/preferences/' + encodeURIComponent(preferenceId));
    if (existing.external_reference !== reference) throw new ClamError('PAYMENT_REVIEW_REQUIRED');
    // Expiring the checkout does not cancel an already issued PIX/boleto.
    await this.request('/checkout/preferences/' + encodeURIComponent(preferenceId), 'PUT', {
      expires: true, expiration_date_from: new Date(Date.now() - 86_400_000).toISOString(), expiration_date_to: new Date(Date.now() - 1000).toISOString(),
    });
    const preference = await this.request<Preference>('/checkout/preferences/' + encodeURIComponent(preferenceId));
    if (preference.external_reference !== reference || !preference.expires || !(new Date(preference.expiration_date_to).getTime() <= Date.now())) throw new ClamError('PAYMENT_CANCELLATION_PENDING');
    const payments = await this.payments(reference);
    for (const payment of payments) {
      if (['approved', 'refunded', 'charged_back'].includes(payment.status)) return payments;
      if (['pending', 'in_process', 'authorized'].includes(payment.status)) {
        await this.request('/v1/payments/' + encodeURIComponent(payment.id), 'PUT', { status: 'cancelled' });
      } else if (!['cancelled', 'rejected'].includes(payment.status)) throw new ClamError('PAYMENT_CANCELLATION_PENDING');
    }
    const confirmed = await this.payments(reference);
    if (confirmed.some(p => !['cancelled', 'rejected', 'approved', 'refunded', 'charged_back'].includes(p.status))) throw new ClamError('PAYMENT_CANCELLATION_PENDING');
    return confirmed;
  }
}
