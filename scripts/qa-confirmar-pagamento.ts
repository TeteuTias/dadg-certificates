/**
 * Fecha o ciclo do pagamento em ambiente de teste.
 *
 * Procura na API do Mercado Pago o pagamento correspondente ao
 * externalReference gerado por scripts/qa-checkout-clam.ts, entrega o id desse
 * pagamento ao endpoint de webhook (como o Mercado Pago faria) e mostra a
 * situacao final da inscricao.
 *
 * Serve para testar localmente, onde o Mercado Pago nao consegue alcancar o
 * webhook.
 *
 *   set -a && . ./.env.local && set +a
 *   npx tsx scripts/qa-confirmar-pagamento.ts <externalReference> [webhookUrl]
 */
import mongoose from 'mongoose';
import { connectToDatabase } from '../lib/mongodb';
import { PaymentSession } from '../lib/selective-processes/models/PaymentSessionModel';
import { PaymentAttribution } from '../lib/selective-processes/models/PaymentAttributionModel';
import { getStudentApplicationState } from '../lib/selective-processes/services/studentSelectiveProcesses';

const EXTERNAL_REFERENCE = process.argv[2];
const WEBHOOK_URL = process.argv[3] || 'http://localhost:3000/api/selective-processes/webhook';

async function main() {
  if (!EXTERNAL_REFERENCE) throw new Error('Informe o externalReference.');

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error('MERCADOPAGO_ACCESS_TOKEN nao configurado.');

  const search = await fetch(
    `https://api.mercadopago.com/v1/payments/search?external_reference=${EXTERNAL_REFERENCE}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const body = (await search.json()) as { results?: Array<{ id: number; status: string; transaction_amount: number }> };
  const payment = body.results?.[0];

  if (!payment) {
    console.log('Nenhum pagamento encontrado para', EXTERNAL_REFERENCE, '- o checkout ainda nao foi pago.');
    process.exit(1);
  }

  console.log('pagamento no Mercado Pago:', payment.id, '| status:', payment.status, '| valor:', payment.transaction_amount);

  const webhook = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'payment', data: { id: String(payment.id) } }),
  });
  console.log('webhook respondeu:', webhook.status, await webhook.text());

  await connectToDatabase();

  const session = (await PaymentSession.findOne({ orderId: EXTERNAL_REFERENCE }).lean()) as unknown as {
    _id: mongoose.Types.ObjectId;
    owner: mongoose.Types.ObjectId;
    edicaoId: string;
    status: string;
  } | null;

  if (!session) throw new Error('Sessao de pagamento nao encontrada.');

  const attribution = (await PaymentAttribution.findOne({ compraId: session._id }).lean()) as unknown as {
    status: string;
  } | null;

  console.log('PaymentSession.status    :', session.status);
  console.log('PaymentAttribution.status:', attribution?.status);

  const state = await getStudentApplicationState({
    selectionProcessId: session.edicaoId,
    userId: String(session.owner),
  });

  console.log('status da inscricao      :', state?.status);
  console.log('ligas contratadas        :', state?.ticket?.leagueAllowanceCount);
  console.log('escolhas restantes       :', state?.remainingSelections);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('ERRO:', error);
  await mongoose.disconnect();
  process.exit(1);
});
